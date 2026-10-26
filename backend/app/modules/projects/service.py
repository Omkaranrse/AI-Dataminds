from datetime import UTC, datetime
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.domain.models import User, UserRole
from app.modules.projects.domain.models import Project, ProjectMember, ProjectMemberRole
from app.modules.projects.repository import ProjectRepository
from app.modules.projects.schemas import (
    ArchiveRequest,
    MemberAdd,
    MemberResponse,
    ProjectCreate,
    ProjectResponse,
    ProjectUpdate,
)


class ProjectService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = ProjectRepository(session)

    async def create(self, data: ProjectCreate, user: User) -> ProjectResponse:
        project = Project(
            name=data.name.strip(),
            description=self._clean_description(data.description),
            owner_id=user.id,
        )
        membership = ProjectMember(user_id=user.id, role=ProjectMemberRole.OWNER, project=project)
        await self.repo.create(project, membership)
        await self.session.commit()
        return self._project_response(project, ProjectMemberRole.OWNER, 1)

    async def list_projects(
        self,
        user: User,
        include_archived: bool = False,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[ProjectResponse], int]:
        rows, total = await self.repo.list_for_user(
            user.id,
            include_archived,
            user.role == UserRole.ADMIN,
            limit=limit,
            offset=offset,
        )
        items = [
            self._project_response(
                project,
                membership.role if membership else ProjectMemberRole.OWNER,
                member_count,
            )
            for project, membership, member_count in rows
        ]
        return items, total


    async def get(self, project_id: UUID, user: User) -> ProjectResponse:
        project, membership = await self._accessible(project_id, user)
        count = await self.repo.member_count(project_id)
        return self._project_response(project, self._role(user, membership), count)

    async def update(self, project_id: UUID, data: ProjectUpdate, user: User) -> ProjectResponse:
        project, membership = await self._accessible(project_id, user, lock=True)
        self._require_editor(user, membership)
        self._check_version(project, data.version)
        if data.name is not None:
            project.name = data.name.strip()
        if "description" in data.model_fields_set:
            project.description = self._clean_description(data.description)
        project.version += 1
        await self.session.commit()
        return self._project_response(
            project, self._role(user, membership), await self.repo.member_count(project_id)
        )

    async def archive(self, project_id: UUID, data: ArchiveRequest, user: User) -> ProjectResponse:
        project, membership = await self._accessible(project_id, user, lock=True)
        self._require_owner(user, membership)
        self._check_version(project, data.version)
        project.archived_at = datetime.now(UTC) if data.archived else None
        project.version += 1
        await self.session.commit()
        return self._project_response(
            project, self._role(user, membership), await self.repo.member_count(project_id)
        )

    async def delete(self, project_id: UUID, user: User) -> None:
        project, membership = await self._accessible(project_id, user, lock=True)
        self._require_owner(user, membership)
        await self.repo.delete(project)
        await self.session.commit()

    async def members(
        self, project_id: UUID, user: User, limit: int = 50, offset: int = 0
    ) -> list[MemberResponse]:
        await self._accessible(project_id, user)
        return [
            self._member_response(member, member_user)
            for member, member_user in await self.repo.list_members(
                project_id, limit=limit, offset=offset
            )
        ]


    async def add_member(self, project_id: UUID, data: MemberAdd, user: User) -> MemberResponse:
        _, membership = await self._accessible(project_id, user)
        self._require_owner(user, membership)
        if data.role == ProjectMemberRole.OWNER:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY, "Owner role cannot be assigned"
            )
        member_user = await self.repo.user_by_email(str(data.email))
        if not member_user:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "No active user has that email")
        if not member_user.is_active:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "User account is disabled")
        if await self.repo.membership(project_id, member_user.id):
            raise HTTPException(status.HTTP_409_CONFLICT, "User is already a project member")
        member = await self.repo.add_member(
            ProjectMember(project_id=project_id, user_id=member_user.id, role=data.role)
        )
        await self.session.commit()
        return self._member_response(member, member_user)

    async def update_member(
        self, project_id: UUID, member_id: UUID, role: ProjectMemberRole, user: User
    ) -> MemberResponse:
        project, membership = await self._accessible(project_id, user)
        self._require_owner(user, membership)
        target = await self.session.get(ProjectMember, member_id)
        if not target or target.project_id != project_id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Project member not found")
        if target.user_id == project.owner_id or role == ProjectMemberRole.OWNER:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY, "Owner membership is immutable"
            )
        target.role = role
        member_user = await self.session.get(User, target.user_id)
        if not member_user:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Project member user not found")
        await self.session.commit()
        return self._member_response(target, member_user)

    async def remove_member(self, project_id: UUID, member_id: UUID, user: User) -> None:
        project, membership = await self._accessible(project_id, user)
        self._require_owner(user, membership)
        target = await self.session.get(ProjectMember, member_id)
        if not target or target.project_id != project_id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Project member not found")
        if target.user_id == project.owner_id:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY, "Project owner cannot be removed"
            )
        await self.repo.delete(target)
        await self.session.commit()

    async def _accessible(
        self, project_id: UUID, user: User, *, lock: bool = False
    ) -> tuple[Project, ProjectMember | None]:
        project = await self.repo.get(project_id, lock=lock)
        membership = await self.repo.membership(project_id, user.id)
        if not project or (not membership and user.role != UserRole.ADMIN):
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
        return project, membership

    @staticmethod
    def _role(user: User, membership: ProjectMember | None) -> ProjectMemberRole:
        return membership.role if membership else ProjectMemberRole.OWNER

    @staticmethod
    def _require_editor(user: User, membership: ProjectMember | None) -> None:
        if user.role != UserRole.ADMIN and (
            not membership or membership.role == ProjectMemberRole.VIEWER
        ):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Editor access required")

    @staticmethod
    def _require_owner(user: User, membership: ProjectMember | None) -> None:
        if user.role != UserRole.ADMIN and (
            not membership or membership.role != ProjectMemberRole.OWNER
        ):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Owner access required")

    @staticmethod
    def _check_version(project: Project, version: int) -> None:
        if project.version != version:
            raise HTTPException(
                status.HTTP_409_CONFLICT, "Project changed since it was loaded; refresh and retry"
            )

    @staticmethod
    def _clean_description(value: str | None) -> str | None:
        cleaned = value.strip() if value else None
        return cleaned or None

    @staticmethod
    def _project_response(
        project: Project, role: ProjectMemberRole, member_count: int
    ) -> ProjectResponse:
        return ProjectResponse(
            id=str(project.id),
            name=project.name,
            description=project.description,
            owner_id=str(project.owner_id),
            current_user_role=role,
            member_count=member_count,
            archived_at=project.archived_at,
            version=project.version,
            created_at=project.created_at,
            updated_at=project.updated_at,
        )

    @staticmethod
    def _member_response(member: ProjectMember, user: User) -> MemberResponse:
        return MemberResponse(
            id=str(member.id),
            user_id=str(user.id),
            name=user.name,
            email=user.email,
            image_url=user.image_url,
            role=member.role,
            joined_at=member.joined_at,
        )
