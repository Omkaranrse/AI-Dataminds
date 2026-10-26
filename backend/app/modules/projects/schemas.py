from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, model_validator

from app.modules.projects.domain.models import ProjectMemberRole


class ProjectCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    description: str | None = Field(default=None, max_length=2000)


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    version: int = Field(ge=1)

    @model_validator(mode="after")
    def has_change(self):
        if self.name is None and "description" not in self.model_fields_set:
            raise ValueError("At least one project field is required")
        return self


class ArchiveRequest(BaseModel):
    archived: bool
    version: int = Field(ge=1)


class MemberAdd(BaseModel):
    email: EmailStr
    role: ProjectMemberRole


class MemberUpdate(BaseModel):
    role: ProjectMemberRole


class MemberResponse(BaseModel):
    id: str
    user_id: str
    name: str
    email: EmailStr
    image_url: str | None
    role: ProjectMemberRole
    joined_at: datetime


class ProjectResponse(BaseModel):
    id: str
    name: str
    description: str | None
    owner_id: str
    current_user_role: ProjectMemberRole
    member_count: int
    archived_at: datetime | None
    version: int
    created_at: datetime
    updated_at: datetime


class ProjectListResponse(BaseModel):
    items: list[ProjectResponse]
    total: int
    limit: int = 50
    offset: int = 0

