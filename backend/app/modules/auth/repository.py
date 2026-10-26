from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.domain.models import (
    ActionToken,
    ActionTokenType,
    OAuthIdentity,
    RefreshToken,
    User,
)


class AuthRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_user_by_email(self, email: str) -> User | None:
        result = await self.session.execute(select(User).where(User.email == email.lower()))
        return result.scalar_one_or_none()

    async def get_user(self, user_id: UUID) -> User | None:
        return await self.session.get(User, user_id)

    async def create_user(self, **values: object) -> User:
        user = User(**values)
        self.session.add(user)
        await self.session.flush()
        return user

    async def create_refresh_token(self, **values: object) -> RefreshToken:
        token = RefreshToken(**values)
        self.session.add(token)
        await self.session.flush()
        return token

    async def get_refresh_token(self, digest: str) -> RefreshToken | None:
        result = await self.session.execute(
            select(RefreshToken).where(RefreshToken.token_hash == digest).with_for_update()
        )
        return result.scalar_one_or_none()

    async def revoke_user_tokens(self, user_id: UUID) -> None:
        now = datetime.now(UTC)
        await self.session.execute(
            update(RefreshToken)
            .where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None))
            .values(
                revoked_at=now - timedelta(days=1),
                expires_at=now - timedelta(seconds=1),
            )
        )


    async def create_action_token(self, **values: object) -> ActionToken:
        token = ActionToken(**values)
        self.session.add(token)
        await self.session.flush()
        return token

    async def get_action_token(self, digest: str, kind: ActionTokenType) -> ActionToken | None:
        result = await self.session.execute(
            select(ActionToken)
            .where(ActionToken.token_hash == digest, ActionToken.kind == kind)
            .with_for_update()
        )
        return result.scalar_one_or_none()

    async def get_oauth_identity(self, provider: str, account_id: str) -> OAuthIdentity | None:
        result = await self.session.execute(
            select(OAuthIdentity).where(
                OAuthIdentity.provider == provider,
                OAuthIdentity.provider_account_id == account_id,
            )
        )
        return result.scalar_one_or_none()

    async def create_oauth_identity(self, **values: object) -> OAuthIdentity:
        identity = OAuthIdentity(**values)
        self.session.add(identity)
        await self.session.flush()
        return identity
