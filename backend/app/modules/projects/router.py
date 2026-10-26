from uuid import UUID

from fastapi import APIRouter, Query, Response, status

from app.modules.auth.dependencies import CurrentUser, SessionDep
from app.modules.auth.schemas import MessageResponse
from app.modules.projects.schemas import (
    ArchiveRequest,
    MemberAdd,
    MemberResponse,
    MemberUpdate,
    ProjectCreate,
    ProjectListResponse,
    ProjectResponse,
    ProjectUpdate,
)
from app.modules.projects.service import ProjectService

router = APIRouter(prefix="/projects", tags=["Projects"])


@router.get("", response_model=ProjectListResponse)
async def list_projects(
    session: SessionDep,
    user: CurrentUser,
    include_archived: bool = False,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> ProjectListResponse:
    items, total = await ProjectService(session).list_projects(
        user, include_archived, limit=limit, offset=offset
    )
    return ProjectListResponse(items=items, total=total, limit=limit, offset=offset)


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    data: ProjectCreate, session: SessionDep, user: CurrentUser
) -> ProjectResponse:
    return await ProjectService(session).create(data, user)


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: UUID, session: SessionDep, user: CurrentUser) -> ProjectResponse:
    return await ProjectService(session).get(project_id, user)


@router.patch("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: UUID, data: ProjectUpdate, session: SessionDep, user: CurrentUser
) -> ProjectResponse:
    return await ProjectService(session).update(project_id, data, user)


@router.post("/{project_id}/archive", response_model=ProjectResponse)
async def archive_project(
    project_id: UUID, data: ArchiveRequest, session: SessionDep, user: CurrentUser
) -> ProjectResponse:
    return await ProjectService(session).archive(project_id, data, user)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(project_id: UUID, session: SessionDep, user: CurrentUser) -> Response:
    await ProjectService(session).delete(project_id, user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{project_id}/members", response_model=list[MemberResponse])
async def list_members(
    project_id: UUID,
    session: SessionDep,
    user: CurrentUser,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> list[MemberResponse]:
    return await ProjectService(session).members(project_id, user, limit=limit, offset=offset)



@router.post(
    "/{project_id}/members", response_model=MemberResponse, status_code=status.HTTP_201_CREATED
)
async def add_member(
    project_id: UUID, data: MemberAdd, session: SessionDep, user: CurrentUser
) -> MemberResponse:
    return await ProjectService(session).add_member(project_id, data, user)


@router.patch("/{project_id}/members/{member_id}", response_model=MemberResponse)
async def update_member(
    project_id: UUID,
    member_id: UUID,
    data: MemberUpdate,
    session: SessionDep,
    user: CurrentUser,
) -> MemberResponse:
    return await ProjectService(session).update_member(project_id, member_id, data.role, user)


@router.delete("/{project_id}/members/{member_id}", response_model=MessageResponse)
async def remove_member(
    project_id: UUID, member_id: UUID, session: SessionDep, user: CurrentUser
) -> MessageResponse:
    await ProjectService(session).remove_member(project_id, member_id, user)
    return MessageResponse(message="Project member removed")
