import os
import uuid
import math
import pandas as pd
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlmodel import Session, select
from app.db.session import get_session
from app.models.models import Dataset, Project, User
from app.schemas.schemas import DatasetOut, CleanDatasetRequest
from app.api.deps import get_current_user
from app.config import settings

router = APIRouter()

def normalize_json_value(value: Any) -> Any:
    if isinstance(value, dict):
        return {k: normalize_json_value(v) for k, v in value.items()}
    if isinstance(value, list):
        return [normalize_json_value(v) for v in value]
    if isinstance(value, tuple):
        return [normalize_json_value(v) for v in value]
    if isinstance(value, float):
        if math.isnan(value) or not math.isfinite(value):
            return None
        return value
    try:
        if pd.isna(value):
            return None
    except Exception:
        pass
    return value


def profile_dataset(filepath: str, filename: str) -> Dict[str, Any]:
    """Perform basic profiling of the uploaded dataset."""
    ext = os.path.splitext(filename)[1].lower()
    if ext == '.csv':
        df = pd.read_csv(filepath, nrows=1000) # read sample for profiling speed
    elif ext in ['.xlsx', '.xls']:
        df = pd.read_excel(filepath, nrows=1000)
    elif ext == '.json':
        df = pd.read_json(filepath, lines=True if ext == '.json' else False).head(1000)
    else:
        raise ValueError("Unsupported file format")

    profile = {}
    profile["columns"] = []
    for col in df.columns:
        null_count = int(df[col].isnull().sum())
        null_percentage = float((null_count / len(df)) * 100) if len(df) > 0 else 0.0
        dtype = str(df[col].dtype)
        unique_count = int(df[col].nunique())
        
        col_summary: Dict[str, Any] = {
            "name": col,
            "type": dtype,
            "null_count": null_count,
            "null_percentage": null_percentage,
            "unique_count": unique_count
        }
        
        # Add basic stats for numeric columns
        if pd.api.types.is_numeric_dtype(df[col]):
            col_summary["mean"] = float(df[col].mean()) if not df[col].isnull().all() else None
            col_summary["min"] = float(df[col].min()) if not df[col].isnull().all() else None
            col_summary["max"] = float(df[col].max()) if not df[col].isnull().all() else None
            
        profile["columns"].append(col_summary)
        
    return profile

def generate_cleaning_suggestions(df_profile: Dict[str, Any], row_count: int) -> List[Dict[str, Any]]:
    """Suggest data cleaning operations based on profiling stats."""
    suggestions = []
    
    # Check for missing values
    for col in df_profile.get("columns", []):
        if col["null_count"] > 0:
            action = {
                "column": col["name"],
                "issue": f"Contains {col['null_count']} missing values ({col['null_percentage']:.1f}%)",
                "recommended_action": "fill_missing",
                "parameters": {"strategy": "mean" if "int" in col["type"] or "float" in col["type"] else "mode"}
            }
            suggestions.append(action)
            
    return suggestions

@router.post("/", response_model=DatasetOut, status_code=status.HTTP_201_CREATED)
async def upload_dataset(
    project_id: int = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    project = db.get(Project, project_id)
    if not project or project.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Project not found")

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ['.csv', '.xlsx', '.xls', '.json']:
        raise HTTPException(status_code=400, detail="Invalid file extension. Only CSV, Excel, and JSON are supported.")

    # Save file
    file_id = str(uuid.uuid4())
    filename = f"{file_id}_{file.filename}"
    filepath = os.path.join(settings.UPLOAD_DIR, filename)
    
    try:
        with open(filepath, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")

    # Load file to count rows/columns and generate profile
    try:
        if ext == '.csv':
            df = pd.read_csv(filepath)
        elif ext in ['.xlsx', '.xls']:
            df = pd.read_excel(filepath)
        else: # JSON
            try:
                df = pd.read_json(filepath)
            except Exception:
                df = pd.read_json(filepath, lines=True)

        row_count = len(df)
        column_count = len(df.columns)
        
        # Profile
        summary = profile_dataset(filepath, file.filename)
        suggestions = generate_cleaning_suggestions(summary, row_count)
        
    except Exception as e:
        if os.path.exists(filepath):
            os.remove(filepath)
        raise HTTPException(status_code=400, detail=f"Failed to parse dataset file: {str(e)}")

    db_dataset = Dataset(
        filename=file.filename,
        filepath=filepath,
        row_count=row_count,
        column_count=column_count,
        delimiter="," if ext == '.csv' else None,
        summary=summary,
        cleaning_suggestions=suggestions,
        project_id=project_id,
        user_id=current_user.id
    )
    db.add(db_dataset)
    db.commit()
    db.refresh(db_dataset)
    
    return db_dataset

@router.get("/project/{project_id}", response_model=List[DatasetOut])
def get_project_datasets(
    project_id: int,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    project = db.get(Project, project_id)
    if not project or project.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Project not found")
        
    statement = select(Dataset).where(Dataset.project_id == project_id)
    return db.exec(statement).all()

@router.get("/{dataset_id}/preview")
def get_dataset_preview(
    dataset_id: int,
    limit: int = 10,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    dataset = db.get(Dataset, dataset_id)
    if not dataset or dataset.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    filepath = dataset.cleaned_filepath or dataset.filepath
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Dataset physical file not found")
        
    ext = os.path.splitext(dataset.filename)[1].lower()
    try:
        if ext == '.csv':
            df = pd.read_csv(filepath, nrows=limit)
        elif ext in ['.xlsx', '.xls']:
            df = pd.read_excel(filepath, nrows=limit)
        else:
            try:
                df = pd.read_json(filepath, nrows=limit)
            except Exception:
                df = pd.read_json(filepath, lines=True).head(limit)
                
        # Fill NaN values with None so JSON serialization is valid
        df = df.where(pd.notnull(df), None)
        rows = df.to_dict(orient="records")
        rows = normalize_json_value(rows)
        return {
            "columns": list(df.columns),
            "rows": rows
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read dataset preview: {str(e)}")

@router.post("/{dataset_id}/clean", response_model=DatasetOut)
def clean_dataset(
    dataset_id: int,
    request: CleanDatasetRequest,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    dataset = db.get(Dataset, dataset_id)
    if not dataset or dataset.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    filepath = dataset.filepath
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Dataset file not found")
        
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
                
        # Apply cleaning actions
        for action in request.actions:
            act_type = action.get("action")
            col = action.get("column")
            
            if act_type == "drop_duplicates":
                df = df.drop_duplicates()
            elif act_type == "fill_missing" and col in df.columns:
                strategy = action.get("parameters", {}).get("strategy", "mean")
                if strategy == "mean" and pd.api.types.is_numeric_dtype(df[col]):
                    df[col] = df[col].fillna(df[col].mean())
                elif strategy == "median" and pd.api.types.is_numeric_dtype(df[col]):
                    df[col] = df[col].fillna(df[col].median())
                elif strategy == "mode":
                    df[col] = df[col].fillna(df[col].mode()[0] if not df[col].mode().empty else "")
                elif strategy == "constant":
                    val = action.get("parameters", {}).get("value", "")
                    df[col] = df[col].fillna(val)
            elif act_type == "drop_column" and col in df.columns:
                df = df.drop(columns=[col])
                
        # Save cleaned file
        cleaned_filename = f"cleaned_{os.path.basename(filepath)}"
        cleaned_filepath = os.path.join(settings.UPLOAD_DIR, cleaned_filename)
        
        if ext == '.csv':
            df.to_csv(cleaned_filepath, index=False)
        elif ext in ['.xlsx', '.xls']:
            df.to_excel(cleaned_filepath, index=False)
        else:
            df.to_json(cleaned_filepath, orient="records", indent=2)
            
        # Recalculate profiling summary
        summary = profile_dataset(cleaned_filepath, dataset.filename)
        
        # Update database fields
        dataset.cleaned_filepath = cleaned_filepath
        dataset.row_count = len(df)
        dataset.column_count = len(df.columns)
        dataset.summary = summary
        dataset.cleaning_suggestions = [] # cleared after applying
        
        db.add(dataset)
        db.commit()
        db.refresh(dataset)
        return dataset
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Data cleaning failed: {str(e)}")
