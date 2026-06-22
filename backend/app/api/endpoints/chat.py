import os
import re
import json
import math
import pandas as pd
from typing import List, Any
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

def find_column_by_keywords(columns: list[str], keywords: list[str]) -> str | None:
    lower = [c.lower() for c in columns]
    for keyword in keywords:
        for index, col in enumerate(lower):
            if keyword in col:
                return columns[index]
    return None


def normalize_json_value(value: Any) -> Any:
    if isinstance(value, float):
        if math.isnan(value) or not math.isfinite(value):
            return None
        return value
    if isinstance(value, dict):
        return {k: normalize_json_value(v) for k, v in value.items()}
    if isinstance(value, list):
        return [normalize_json_value(v) for v in value]
    return value


def safe_json_dumps(value: Any) -> str:
    normalized = normalize_json_value(value)
    return json.dumps(normalized, default=str)


def summarize_result(result: Any, query: str) -> str:
    if isinstance(result, pd.DataFrame):
        rows = len(result)
        cols = len(result.columns)
        if rows == 0:
            return "I found no rows matching that request."
        if "top" in query or "highest" in query or "largest" in query or "best" in query:
            return f"I found {rows} rows matching your request. Here are the top results by your criteria."
        if "show" in query or "list" in query or "sample" in query or "first" in query:
            return f"I returned the first {rows} rows for your query."
        return f"I found {rows} rows and {cols} columns for your request. Here is a preview."

    if isinstance(result, pd.Series):
        values = result.to_dict()
        pairs = [f"{k}: {v}" for k, v in list(values.items())[:6]]
        return f"I computed the following values: {', '.join(pairs)}."

    if isinstance(result, dict):
        if not result:
            return "I found no results."
        pairs = [f"{k}: {v}" for k, v in list(result.items())[:6]]
        return f"I found these values: {', '.join(pairs)}."

    if isinstance(result, list):
        if len(result) == 0:
            return "I found no results."
        if all(isinstance(item, dict) for item in result):
            return f"I returned {len(result)} rows from your dataset. Here is a preview of the first records."
        return f"I returned {len(result)} items."

    if isinstance(result, (int, float, str, bool)):
        return f"The answer is {result}."

    return "I executed your query and generated a result."


def fallback_pandas_generator(df: pd.DataFrame, query: str) -> str:
    """Generates simple heuristic Pandas commands when LLM is unavailable."""
    query = query.lower().strip()
    columns = df.columns.tolist()
    numeric_cols = df.select_dtypes(include=['number']).columns.tolist()
    product_col = find_column_by_keywords(columns, ["product", "item", "sku", "name", "category", "brand"])
    quantity_col = find_column_by_keywords(columns, ["quantity", "sales", "sold", "units", "amount", "revenue", "count"])

    if "most sold" in query or "top selling" in query or "best selling" in query or "highest sales" in query:
        if product_col and quantity_col:
            return f"result = df.groupby('{product_col}')['{quantity_col}'].sum().sort_values(ascending=False).head(5).reset_index().to_dict(orient='records')"
        if product_col:
            return f"result = df['{product_col}'].value_counts().head(5).to_dict()"
        if quantity_col:
            return f"result = df.nlargest(5, '{quantity_col}').reset_index().to_dict(orient='records')"

    if "average" in query or "mean" in query:
        for c in columns:
            if c.lower() in query and pd.api.types.is_numeric_dtype(df[c]):
                return f"result = f'Average of {c} is {{df[\"{c}\"].mean():.2f}}'"
        if numeric_cols:
            return f"result = df[{json.dumps(numeric_cols)}].mean().to_dict()"

    if "max" in query or "highest" in query:
        for c in columns:
            if c.lower() in query and pd.api.types.is_numeric_dtype(df[c]):
                return f"result = f'Maximum of {c} is {{df[\"{c}\"].max()}}'"
        if numeric_cols:
            return f"result = df[{json.dumps(numeric_cols)}].max().to_dict()"

    if "min" in query or "lowest" in query or "minimum" in query:
        for c in columns:
            if c.lower() in query and pd.api.types.is_numeric_dtype(df[c]):
                return f"result = f'Minimum of {c} is {{df[\"{c}\"].min()}}'"

    if "describe" in query or "summary" in query or "statistics" in query:
        return "result = df.describe().to_dict()"

    if "how many rows" in query or "rows" in query or "count" in query or "size" in query:
        return "result = f'Total rows: {len(df)}'"

    if "sample" in query or "show me" in query or "top 5" in query or "first 5" in query:
        return "result = df.head().to_dict(orient='records')"

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
            ans_content = summarize_result(result, message_in.content)
            if isinstance(result, pd.DataFrame):
                output_str = safe_json_dumps(result.to_dict(orient='records'))
            elif isinstance(result, pd.Series):
                output_str = safe_json_dumps(result.to_dict())
            else:
                output_str = safe_json_dumps(result)
        else:
            ans_content = stdout_str.strip() or "Executed successfully but returned no output."
            output_str = safe_json_dumps(stdout_str.strip())
    else:
        ans_content = f"Failed to execute analytical query: {stdout_str.strip()}"
        output_str = safe_json_dumps(stdout_str.strip())
        
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
