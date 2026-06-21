from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from app.db.session import get_session
from app.models.models import Project, User
from app.schemas.schemas import ProjectCreate, ProjectOut
from app.api.deps import get_current_user

router = APIRouter()

@router.get("/", response_model=List[ProjectOut])
def get_projects(
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    statement = select(Project).where(Project.user_id == current_user.id)
    return db.exec(statement).all()

@router.post("/", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
def create_project(
    project_in: ProjectCreate,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    db_project = Project(
        name=project_in.name,
        description=project_in.description,
        user_id=current_user.id
    )
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    return db_project

@router.get("/{project_id}", response_model=ProjectOut)
def get_project(
    project_id: int,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    project = db.get(Project, project_id)
    if not project or project.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: int,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    project = db.get(Project, project_id)
    if not project or project.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Project not found")
    db.delete(project)
    db.commit()
    return None
