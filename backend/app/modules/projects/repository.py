from uuid import UUID

import sqlalchemy as sa
from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.domain.models import User
from app.modules.projects.domain.models import Project, ProjectMember


class ProjectRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(self, project: Project, membership: ProjectMember) -> Project:
        self.session.add_all([project, membership])
        await self.session.flush()
        return project

    async def get(self, project_id: UUID, *, lock: bool = False) -> Project | None:
        query: Select[tuple[Project]] = select(Project).where(Project.id == project_id)
        if lock:
            query = query.with_for_update()
        return (await self.session.execute(query)).scalar_one_or_none()

    async def membership(self, project_id: UUID, user_id: UUID) -> ProjectMember | None:
        result = await self.session.execute(
            select(ProjectMember).where(
                ProjectMember.project_id == project_id, ProjectMember.user_id == user_id
            )
        )
        return result.scalar_one_or_none()

    async def list_for_user(
        self,
        user_id: UUID,
        include_archived: bool,
        is_admin: bool,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[tuple[Project, ProjectMember | None, int]], int]:
        count_members = (
            select(func.count(ProjectMember.id))
            .where(ProjectMember.project_id == Project.id)
            .correlate(Project)
            .scalar_subquery()
        )
        if is_admin:
            items_query = select(Project, sa.null(), count_members)
            count_query = select(func.count(Project.id))
        else:
            items_query = (
                select(Project, ProjectMember, count_members)
                .join(ProjectMember, ProjectMember.project_id == Project.id)
                .where(ProjectMember.user_id == user_id)
            )
            count_query = (
                select(func.count(Project.id))
                .join(ProjectMember, ProjectMember.project_id == Project.id)
                .where(ProjectMember.user_id == user_id)
            )

        if not include_archived:
            items_query = items_query.where(Project.archived_at.is_(None))
            count_query = count_query.where(Project.archived_at.is_(None))

        total = int((await self.session.execute(count_query)).scalar_one())
        result = await self.session.execute(
            items_query.order_by(Project.updated_at.desc()).limit(limit).offset(offset)
        )
        return list(result.all()), total

    async def member_count(self, project_id: UUID) -> int:
        result = await self.session.execute(
            select(func.count(ProjectMember.id)).where(ProjectMember.project_id == project_id)
        )
        return int(result.scalar_one())

    async def list_members(
        self, project_id: UUID, limit: int = 50, offset: int = 0
    ) -> list[tuple[ProjectMember, User]]:
        result = await self.session.execute(
            select(ProjectMember, User)
            .join(User, User.id == ProjectMember.user_id)
            .where(ProjectMember.project_id == project_id)
            .order_by(ProjectMember.joined_at)
            .limit(limit)
            .offset(offset)
        )
        return list(result.all())


    async def user_by_email(self, email: str) -> User | None:
        result = await self.session.execute(select(User).where(User.email == email.lower()))
        return result.scalar_one_or_none()

    async def add_member(self, member: ProjectMember) -> ProjectMember:
        self.session.add(member)
        await self.session.flush()
        return member

    async def delete(self, entity: Project | ProjectMember) -> None:
        await self.session.delete(entity)
