import asyncio
import os
import re
import json
import math
import pandas as pd
from typing import List, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlmodel import Session, select
from app.db.session import get_session
from app.models.models import ChatMessage, Dataset, Project, User
from app.schemas.schemas import ChatMessageCreate, ChatMessageOut, ChatRequest
from app.api.deps import get_current_user
from app.services.sandbox import run_pandas_code_safely
from app.config import settings

try:
    from langchain_groq import ChatGroq
    HAS_GROQ = True
except ImportError:
    HAS_GROQ = False

router = APIRouter()


# ── Helpers ───────────────────────────────────────────────────────────────────

def find_column_by_keywords(columns: list[str], keywords: list[str]) -> str | None:
    lower = [c.lower() for c in columns]
    for keyword in keywords:
        for index, col in enumerate(lower):
            if keyword == col or keyword in col:
                return columns[index]
    return None


def find_preferred_column(columns: list[str], keywords_groups: list[list[str]]) -> str | None:
    for keywords in keywords_groups:
        match = find_column_by_keywords(columns, keywords)
        if match:
            return match
    return None


def find_product_column(columns: list[str]) -> str | None:
    return find_preferred_column(columns, [
        ["product_name", "item_name", "name", "title", "brand", "category", "product", "item"],
        ["product_id", "item_id", "sku", "id"]
    ])


def find_quantity_column(columns: list[str]) -> str | None:
    return find_preferred_column(columns, [
        ["quantity", "sales", "sold", "units", "amount", "revenue", "count"],
        ["price", "value"]
    ])


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
    return json.dumps(normalize_json_value(value), default=str)


def fallback_pandas_generator(df: pd.DataFrame, query: str) -> str:
    query_lower = query.lower().strip()
    columns = df.columns.tolist()
    numeric_cols = df.select_dtypes(include=["number"]).columns.tolist()
    product_col = find_product_column(columns)
    quantity_col = find_quantity_column(columns)

    if any(k in query_lower for k in ["most sold", "top selling", "best selling", "highest sold", "highest selling", "highest sales", "top sold"]):
        if product_col and quantity_col:
            return f"result = df.groupby('{product_col}')['{quantity_col}'].sum().sort_values(ascending=False).head(5).reset_index().to_dict(orient='records')"
        if product_col:
            return f"result = df['{product_col}'].value_counts().head(5).to_dict()"
        if quantity_col:
            return f"result = df.nlargest(5, '{quantity_col}').reset_index().to_dict(orient='records')"

    if any(k in query_lower for k in ["average", "mean"]):
        for c in columns:
            if c.lower() in query_lower and pd.api.types.is_numeric_dtype(df[c]):
                return f"result = f'The average {c} is {{df[\"{c}\"].mean():.2f}}'"
        if numeric_cols:
            return f"result = df[{json.dumps(numeric_cols)}].mean().to_dict()"

    if any(k in query_lower for k in ["max", "highest", "largest"]):
        for c in columns:
            if c.lower() in query_lower and pd.api.types.is_numeric_dtype(df[c]):
                return f"result = f'The maximum {c} is {{df[\"{c}\"].max()}}'"
        if numeric_cols:
            return f"result = df[{json.dumps(numeric_cols)}].max().to_dict()"

    if any(k in query_lower for k in ["min", "lowest", "minimum"]):
        for c in columns:
            if c.lower() in query_lower and pd.api.types.is_numeric_dtype(df[c]):
                return f"result = f'The minimum {c} is {{df[\"{c}\"].min()}}'"

    if any(k in query_lower for k in ["describe", "summary", "statistics"]):
        return "result = df.describe().to_dict()"

    if any(k in query_lower for k in ["how many rows", "count", "size", "total rows"]):
        return "result = f'There are {len(df)} rows in the dataset.'"

    if any(k in query_lower for k in ["sample", "show", "top 5", "first 5", "head"]):
        return "result = df.head().to_dict(orient='records')"

    return "result = df.head().to_dict(orient='records')"


def get_llm():
    """Return a ChatGroq instance or None."""
    if settings.GROQ_API_KEY and HAS_GROQ:
        return ChatGroq(
            groq_api_key=settings.GROQ_API_KEY,
            model="llama-3.3-70b-versatile",
            temperature=0.1,
        )
    return None


def generate_pandas_code(df: pd.DataFrame, query: str) -> str:
    llm = get_llm()
    if llm:
        try:
            schema_info = {
                "columns": list(df.columns),
                "dtypes": {c: str(t) for c, t in df.dtypes.items()},
                "sample_head": df.head(3).to_dict(orient="records"),
            }
            prompt = f"""You are a senior data scientist writing Python/Pandas code.
Dataset schema:
{json.dumps(schema_info, indent=2)}

Write Python code to answer: "{query}"

Rules:
1. The dataset is already loaded as 'df'. Do NOT load or read any file.
2. Assign the final answer to a variable named 'result'.
3. Return ONLY raw Python code — no markdown, no backticks.
4. No imports, no system calls, no file writes."""
            code = llm.invoke(prompt).content.strip()
            code = re.sub(r"^```python\s*", "", code, flags=re.IGNORECASE)
            code = re.sub(r"```$", "", code).strip()
            return code
        except Exception:
            pass
    return fallback_pandas_generator(df, query)


def natural_language_answer(result: Any, query: str, df: pd.DataFrame) -> str:
    if isinstance(result, pd.DataFrame):
        result_preview = result.head(10).to_dict(orient="records")
        rows = len(result)
    elif isinstance(result, pd.Series):
        result_preview = result.to_dict()
        rows = None
    else:
        result_preview = result
        rows = None

    result_str = json.dumps(normalize_json_value(result_preview), default=str)

    llm = get_llm()
    if llm:
        try:
            llm_nl = ChatGroq(
                groq_api_key=settings.GROQ_API_KEY,
                model="llama-3.3-70b-versatile",
                temperature=0.4,
            )
            prompt = f"""You are a friendly, expert data analyst. A user asked:
"{query}"

The analysis returned this result:
{result_str}
{"(showing first 10 of " + str(rows) + " rows)" if rows else ""}

Write a clear, conversational 1-3 sentence answer explaining what the data shows.
- Mention specific numbers, names, or values from the result.
- Sound like a human analyst, not a robot.
- Do NOT say "I executed code" or mention pandas/dataframes.
- If it's a table, summarise the key insight instead of listing every row."""
            return llm_nl.invoke(prompt).content.strip()
        except Exception:
            pass

    # Fallback plain answer
    if isinstance(result, str):
        return result
    if isinstance(result, (int, float)):
        return f"The answer is {result}."
    if isinstance(result, pd.DataFrame):
        if len(result) == 0:
            return "I found no rows matching that filter."
        if len(result.columns) >= 2:
            first_row = result.iloc[0].to_dict()
            string_keys = [k for k, v in first_row.items() if isinstance(v, str)]
            numeric_keys = [k for k, v in first_row.items() if isinstance(v, (int, float))]
            if string_keys and numeric_keys:
                label = next((k for k in string_keys if any(w in k.lower() for w in ["product", "item", "name", "title", "brand", "category"])), string_keys[0])
                value = next((k for k in numeric_keys if any(w in k.lower() for w in ["sale", "sold", "count", "quantity", "amount", "revenue"])), numeric_keys[0])
                return f"{first_row[label]} is the top item with {first_row[value]} total {value.replace('_', ' ')}."
        return f"I found {len(result)} rows. Here's a preview of the results."
    if isinstance(result, list) and all(isinstance(row, dict) for row in result):
        if not result:
            return "I found no matching results."
        first = result[0]
        string_keys = [k for k, v in first.items() if isinstance(v, str)]
        numeric_keys = [k for k, v in first.items() if isinstance(v, (int, float))]
        if string_keys and numeric_keys:
            label = next((k for k in string_keys if any(w in k.lower() for w in ["product", "item", "name", "title", "brand", "category"])), string_keys[0])
            value = next((k for k in numeric_keys if any(w in k.lower() for w in ["sale", "sold", "count", "quantity", "amount", "revenue"])), numeric_keys[0])
            return f"{first[label]} is the top item with {first[value]} total {value.replace('_', ' ')}."
        if len(result) == 1:
            pairs = [f"{k}: {v}" for k, v in first.items()]
            return "Here is the result: " + ", ".join(pairs) + "."
        return f"I found {len(result)} matching rows. The first result is {list(first.values())[0]}."
    if isinstance(result, dict):
        if not result:
            return "I found no matching results."
        string_keys = [k for k, v in result.items() if isinstance(v, str)]
        numeric_keys = [k for k, v in result.items() if isinstance(v, (int, float))]
        if string_keys and numeric_keys:
            label = next((k for k in string_keys if any(w in k.lower() for w in ["product", "item", "name", "title", "brand", "category"])), string_keys[0])
            value = next((k for k in numeric_keys if any(w in k.lower() for w in ["sale", "sold", "count", "quantity", "amount", "revenue"])), numeric_keys[0])
            return f"{result[label]} is the top item with {result[value]} total {value.replace('_', ' ')}."
        pairs = [f"{k}: {v}" for k, v in list(result.items())[:5]]
        return "Here's what I found: " + ", ".join(pairs) + "."
    return "Here are the results based on your query."


def load_dataframe(dataset) -> pd.DataFrame:
    filepath = dataset.cleaned_filepath or dataset.filepath
    ext = os.path.splitext(dataset.filename)[1].lower()
    if ext == ".csv":
        return pd.read_csv(filepath)
    if ext in [".xlsx", ".xls"]:
        return pd.read_excel(filepath)
    try:
        return pd.read_json(filepath)
    except Exception:
        return pd.read_json(filepath, lines=True)


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/project/{project_id}/stream")
async def chat_stream(
    project_id: int,
    body: ChatRequest,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    project = db.get(Project, project_id)
    if not project or project.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Project not found")

    dataset_stmt = (
        select(Dataset)
        .where(Dataset.project_id == project_id)
        .order_by(Dataset.created_at.desc())
    )
    dataset = db.exec(dataset_stmt).first()

    if not dataset:
        async def no_dataset():
            yield "data: Please upload a dataset first before asking questions.\n\n"
            yield "data: [DONE]\n\n"
        return StreamingResponse(no_dataset(), media_type="text/event-stream")

    loop = asyncio.get_event_loop()

    # Capture these outside the thread to avoid session issues
    project_id_val = project_id
    content_val = body.content

    def run_pipeline():
        try:
            df = load_dataframe(dataset)
        except Exception as e:
            return f"Sorry, I couldn't load your dataset: {e}", None, None

        code = generate_pandas_code(df, content_val)
        success, stdout_str, result = run_pandas_code_safely(df, code)

        if not success:
            return f"I ran into an issue analysing your data: {stdout_str.strip()}", code, None

        answer = natural_language_answer(result, content_val, df)

        if result is not None:
            if isinstance(result, pd.DataFrame):
                output_str = safe_json_dumps(result.to_dict(orient="records"))
            elif isinstance(result, pd.Series):
                output_str = safe_json_dumps(result.to_dict())
            else:
                output_str = safe_json_dumps(result)
        else:
            output_str = safe_json_dumps(stdout_str.strip())

        return answer, code, output_str

    async def generate():
        # Open the stream immediately
        yield "data: \n\n"

        answer, code, output_str = await loop.run_in_executor(None, run_pipeline)

        # Save messages to DB on the main thread (thread-safe)
        try:
            user_msg = ChatMessage(
                project_id=project_id_val,
                role="user",
                content=content_val,
            )
            db.add(user_msg)

            assistant_msg = ChatMessage(
                project_id=project_id_val,
                role="assistant",
                content=answer,
                code_executed=code,
                code_output=output_str,
            )
            db.add(assistant_msg)
            db.commit()
        except Exception:
            pass  # Don't break the stream if DB save fails

        # Stream word by word
        words = answer.split(" ")
        for i, word in enumerate(words):
            chunk = word + (" " if i < len(words) - 1 else "")
            yield f"data: {chunk}\n\n"
            await asyncio.sleep(0.04)

        # Send metadata chunk for code + table
        if output_str and code:
            meta = json.dumps({"code_executed": code, "code_output": output_str})
            yield f"data: __META__{meta}\n\n"

        yield "data: [DONE]\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


@router.post("/project/{project_id}", response_model=ChatMessageOut)
def send_chat_message(
    project_id: int,
    message_in: ChatMessageCreate,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    project = db.get(Project, project_id)
    if not project or project.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Project not found")

    dataset_stmt = (
        select(Dataset)
        .where(Dataset.project_id == project_id)
        .order_by(Dataset.created_at.desc())
    )
    dataset = db.exec(dataset_stmt).first()
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No dataset uploaded. Please upload a dataset first.",
        )

    user_msg = ChatMessage(project_id=project_id, role="user", content=message_in.content)
    db.add(user_msg)
    db.commit()

    try:
        df = load_dataframe(dataset)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load dataset: {e}")

    generated_code = generate_pandas_code(df, message_in.content)
    success, stdout_str, result = run_pandas_code_safely(df, generated_code)

    if success and result is not None:
        ans_content = natural_language_answer(result, message_in.content, df)
        if isinstance(result, pd.DataFrame):
            output_str = safe_json_dumps(result.to_dict(orient="records"))
        elif isinstance(result, pd.Series):
            output_str = safe_json_dumps(result.to_dict())
        else:
            output_str = safe_json_dumps(result)
    else:
        ans_content = stdout_str.strip() or "Executed successfully but returned no output."
        output_str = safe_json_dumps(stdout_str.strip())

    assistant_msg = ChatMessage(
        project_id=project_id,
        role="assistant",
        content=ans_content,
        code_executed=generated_code,
        code_output=output_str,
    )
    db.add(assistant_msg)
    db.commit()
    db.refresh(assistant_msg)
    return assistant_msg


@router.get("/project/{project_id}", response_model=List[ChatMessageOut])
def get_chat_history(
    project_id: int,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    project = db.get(Project, project_id)
    if not project or project.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Project not found")

    statement = (
        select(ChatMessage)
        .where(ChatMessage.project_id == project_id)
        .order_by(ChatMessage.created_at.asc())
    )
    return db.exec(statement).all()