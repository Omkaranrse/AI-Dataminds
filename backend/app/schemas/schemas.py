from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenPayload(BaseModel):
    sub: Optional[str] = None

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str

class UserOut(BaseModel):
    id: int
    email: EmailStr
    full_name: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None

class ProjectOut(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    user_id: int
    created_at: datetime

    class Config:
        from_attributes = True

class DatasetOut(BaseModel):
    id: int
    filename: str
    row_count: int
    column_count: int
    delimiter: str
    summary: Dict[str, Any]
    cleaning_suggestions: List[Dict[str, Any]]
    cleaned_filepath: Optional[str] = None
    project_id: int
    created_at: datetime

    class Config:
        from_attributes = True

class ChatMessageCreate(BaseModel):
    content: str

class ChatMessageOut(BaseModel):
    id: int
    role: str
    content: str
    code_executed: Optional[str] = None
    code_output: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class AnalysisReportOut(BaseModel):
    id: int
    title: str
    content: Optional[str] = None
    visualizations: List[Dict[str, Any]]
    created_at: datetime

    class Config:
        from_attributes = True

class CleanDatasetRequest(BaseModel):
    actions: List[Dict[str, Any]] # e.g. [{"action": "drop_duplicates"}, {"action": "fill_missing", "column": "age", "strategy": "mean"}]
