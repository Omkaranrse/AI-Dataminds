import os
import pandas as pd
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from app.db.session import get_session
from app.models.models import ChatMessage, Dataset, Project, User
from app.schemas.schemas import ChatMessageCreate, ChatMessageOut
from app.api.deps import get_current_user
from app.services.sandbox import run_pandas_code_safely
from app.config import settings

# LangChain imports
try:
    from langchain_openai import ChatOpenAI
    HAS_OPENAI = True
except ImportError:
    HAS_OPENAI = False

router = APIRouter()

def fallback_pandas_generator(df: pd.DataFrame, query: str) -> str:
    """Generates simple heuristic Pandas commands when LLM is unavailable."""
    query = query.lower().strip()
    cols = [c.lower() for c in df.columns]
    
    # 1. Search for simple averages/mean
    if "average" in query or "mean" in query:
        for c in df.columns:
            if c.lower() in query and pd.api.types.is_numeric_dtype(df[c]):
                return f"result = f'Average of {c} is {{df[\"{c}\"].mean():.2f}}'"
        # Global numeric averages
        num_cols = df.select_dtypes(include=['number']).columns.tolist()
        if num_cols:
            return f"result = df[{num_cols}].mean().to_dict()"
            
    # 2. Maximum/highest
    if "max" in query or "highest" in query:
        for c in df.columns:
            if c.lower() in query and pd.api.types.is_numeric_dtype(df[c]):
                return f"result = f'Maximum of {c} is {{df[\"{c}\"].max()}}'"
        # Global maxes
        num_cols = df.select_dtypes(include=['number']).columns.tolist()
        if num_cols:
            return f"result = df[{num_cols}].max().to_dict()"
            
    # 3. Minimum/lowest
    if "min" in query or "lowest" in query:
        for c in df.columns:
            if c.lower() in query and pd.api.types.is_numeric_dtype(df[c]):
                return f"result = f'Minimum of {c} is {{df[\"{c}\"].min()}}'"
                
    # 4. Describe / Info
    if "describe" in query or "summary" in query or "statistics" in query:
        return "result = df.describe().to_dict()"
        
    # 5. Row count
    if "how many rows" in query or "count" in query or "size" in query:
        return "result = f'Total rows: {len(df)}'"
        
    # Default to top 5 rows
    return "result = df.head().to_dict(orient='records')"

@router.post("/project/{project_id}", response_model=ChatMessageOut)
def send_chat_message(
    project_id: int,
    message_in: ChatMessageCreate,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    project = db.get(Project, project_id)
    if not project or project.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Project not found")
        
    # Get the latest dataset of the project
    dataset_statement = select(Dataset).where(Dataset.project_id == project_id).order_by(Dataset.created_at.desc())
    dataset = db.exec(dataset_statement).first()
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No dataset uploaded in this project. Please upload a dataset first."
        )
        
    # Save User message
    user_msg = ChatMessage(
        project_id=project_id,
        role="user",
        content=message_in.content
    )
    db.add(user_msg)
    db.commit()
    
    # Load DataFrame
    filepath = dataset.cleaned_filepath or dataset.filepath
    ext = os.path.splitext(dataset.filename)[1].lower()
    try:
        if ext == '.csv':
            df = pd.read_csv(filepath)
        elif ext in ['.xlsx', '.xls']:
            df = pd.read_excel(filepath)
        else:
            try:
                df = pd.read_json(filepath)
            except Exception:
                df = pd.read_json(filepath, lines=True)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load dataset: {str(e)}")
        
    generated_code = ""
    # Attempt to use OpenAI if key is configured
    if settings.OPENAI_API_KEY and HAS_OPENAI:
        try:
            llm = ChatOpenAI(openai_api_key=settings.OPENAI_API_KEY, model="gpt-4o-mini", temperature=0.1)
            schema_info = {
                "columns": list(df.columns),
                "dtypes": {c: str(t) for c, t in df.dtypes.items()},
                "sample_head": df.head(3).to_dict(orient="records")
            }
            prompt = f"""
            You are a senior data scientist writing Python/Pandas code.
            Given the dataset schema:
            {schema_info}
            
            Write python code to answer the query: "{message_in.content}"
            
            Rules:
            1. The dataset is already loaded in a global variable called 'df'. Do NOT load or read the file.
            2. Assign the final output value to a variable named 'result' so it can be extracted. E.g., `result = df['age'].mean()`.
            3. Do not include markdown code block formatting (```python) in your response, return ONLY the raw python code.
            4. Keep it secure: No imports, no system commands, no writing files.
            """
            response = llm.invoke(prompt)
            generated_code = response.content.strip()
            # Remove potential markdown wraps
            generated_code = re.sub(r"^```python\s*", "", generated_code, flags=re.IGNORECASE)
            generated_code = re.sub(r"```$", "", generated_code).strip()
        except Exception:
            generated_code = fallback_pandas_generator(df, message_in.content)
    else:
        generated_code = fallback_pandas_generator(df, message_in.content)
        
    # Execute code safely
    success, stdout_str, result = run_pandas_code_safely(df, generated_code)
    
    # Formulate answer content
    if success:
        if result is not None:
            if isinstance(result, pd.DataFrame):
                ans_content = f"Query completed. Found {len(result)} rows."
                output_str = result.to_json(orient="records")
            elif isinstance(result, pd.Series):
                ans_content = "Query results compiled:"
                output_str = result.to_json()
            else:
                ans_content = str(result)
                output_str = stdout_str
        else:
            ans_content = stdout_str if stdout_str else "Executed successfully but returned no output."
            output_str = stdout_str
    else:
        ans_content = f"Failed to execute analytical query: {stdout_str}"
        output_str = stdout_str
        
    # Save Assistant message
    assistant_msg = ChatMessage(
        project_id=project_id,
        role="assistant",
        content=ans_content,
        code_executed=generated_code,
        code_output=output_str
    )
    db.add(assistant_msg)
    db.commit()
    db.refresh(assistant_msg)
    
    return assistant_msg

@router.get("/project/{project_id}", response_model=List[ChatMessageOut])
def get_chat_history(
    project_id: int,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    project = db.get(Project, project_id)
    if not project or project.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Project not found")
        
    statement = select(ChatMessage).where(ChatMessage.project_id == project_id).order_by(ChatMessage.created_at.asc())
    return db.exec(statement).all()
