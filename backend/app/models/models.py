from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlmodel import SQLModel, Field, Relationship, JSON, Column
from pydantic import EmailStr

class UserBase(SQLModel):
    email: EmailStr = Field(unique=True, index=True)
    full_name: str
    is_active: bool = True

class User(UserBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    hashed_password: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    projects: List["Project"] = Relationship(back_populates="user", cascade_delete=True)

class ProjectBase(SQLModel):
    name: str = Field(index=True)
    description: Optional[str] = None

class Project(ProjectBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", ondelete="CASCADE")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    user: User = Relationship(back_populates="projects")
    datasets: List["Dataset"] = Relationship(back_populates="project", cascade_delete=True)
    chat_messages: List["ChatMessage"] = Relationship(back_populates="project", cascade_delete=True)
    reports: List["AnalysisReport"] = Relationship(back_populates="project", cascade_delete=True)

class DatasetBase(SQLModel):
    filename: str
    filepath: str
    row_count: Optional[int] = 0
    column_count: Optional[int] = 0
    delimiter: Optional[str] = ","
    summary: Optional[Dict[str, Any]] = Field(default={}, sa_column=Column(JSON))
    cleaning_suggestions: Optional[List[Dict[str, Any]]] = Field(default=[], sa_column=Column(JSON))
    cleaned_filepath: Optional[str] = None

class Dataset(DatasetBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    project_id: int = Field(foreign_key="project.id", ondelete="CASCADE")
    user_id: int = Field(foreign_key="user.id", ondelete="CASCADE")
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    project: Project = Relationship(back_populates="datasets")

class ChatMessageBase(SQLModel):
    role: str # 'user' or 'assistant'
    content: str
    code_executed: Optional[str] = None
    code_output: Optional[str] = None

class ChatMessage(ChatMessageBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    project_id: int = Field(foreign_key="project.id", ondelete="CASCADE")
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    project: Project = Relationship(back_populates="chat_messages")

class AnalysisReportBase(SQLModel):
    title: str
    content: Optional[str] = None # Markdown or text content
    visualizations: Optional[List[Dict[str, Any]]] = Field(default=[], sa_column=Column(JSON))

class AnalysisReport(AnalysisReportBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    project_id: int = Field(foreign_key="project.id", ondelete="CASCADE")
    dataset_id: int = Field(foreign_key="dataset.id", ondelete="CASCADE")
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    project: Project = Relationship(back_populates="reports")
