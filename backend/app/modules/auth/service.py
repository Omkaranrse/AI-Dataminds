import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import BackgroundTasks, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.security import (
    create_access_token,
    hash_password,
    random_token,
    token_digest,
    verify_password,
)
from app.modules.auth.domain.models import ActionTokenType, User
from app.modules.auth.email import EmailService
from app.modules.auth.repository import AuthRepository
from app.modules.auth.schemas import (
    OAuthExchangeRequest,
    RegisterRequest,
    TokenResponse,
    UserResponse,
)


@dataclass
class ClientContext:
    user_agent: str | None
    ip_address: str | None


class AuthService:
    def __init__(self, session: AsyncSession, email_service: EmailService | None = None) -> None:
        self.session = session
        self.repo = AuthRepository(session)
        self.email = email_service or EmailService()

    async def register(
        self, data: RegisterRequest, background_tasks: BackgroundTasks | None = None
    ) -> User:
        if await self.repo.get_user_by_email(str(data.email)):
            raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email exists")
        user = await self.repo.create_user(
            email=str(data.email).lower(),
            name=data.name.strip(),
            password_hash=hash_password(data.password),
        )
        raw_token = await self._new_action_token(user.id, ActionTokenType.VERIFY_EMAIL, hours=24)
        await self.session.commit()
        if background_tasks is not None:
            background_tasks.add_task(self.email.send_verification, user.email, raw_token)
        else:
            await self.email.send_verification(user.email, raw_token)
        return user


    async def login(self, email: str, password: str, context: ClientContext) -> TokenResponse:
        user = await self.repo.get_user_by_email(email)
        if not user or not user.password_hash or not verify_password(password, user.password_hash):
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
        if not user.is_active:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Account is disabled")
        return await self._issue_session(user, context)

    async def refresh(self, raw_token: str, context: ClientContext) -> TokenResponse:
        settings = get_settings()
        stored = await self.repo.get_refresh_token(token_digest(raw_token))
        now = datetime.now(UTC)
        if not stored or self._is_expired(stored.expires_at, now):
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired refresh token")

        user = await self.repo.get_user(stored.user_id)
        if not user or not user.is_active:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Account unavailable")

        if stored.revoked_at is not None:
            revoked_at = (
                stored.revoked_at.replace(tzinfo=UTC)
                if stored.revoked_at.tzinfo is None
                else stored.revoked_at
            )
            elapsed = (now - revoked_at).total_seconds()
            if 0 <= elapsed <= settings.refresh_token_grace_seconds:
                # Concurrent refresh within grace window: return an active session
                return await self._issue_session(user, context)

            # Revocation outside grace window: token reuse detected!
            # Revoke all refresh tokens for this user as a security safeguard
            await self.repo.revoke_user_tokens(stored.user_id)
            await self.session.commit()
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired refresh token")

        stored.revoked_at = now
        return await self._issue_session(user, context)

    async def logout(self, raw_token: str) -> None:
        stored = await self.repo.get_refresh_token(token_digest(raw_token))
        if stored:
            now = datetime.now(UTC)
            # Expire immediately and set revoked_at to the past
            # so it cannot be revived by the grace window
            stored.expires_at = now - timedelta(seconds=1)
            stored.revoked_at = now - timedelta(days=1)
            await self.session.commit()


    async def request_password_reset(
        self, email: str, background_tasks: BackgroundTasks | None = None
    ) -> None:
        user = await self.repo.get_user_by_email(email)
        if not user or not user.password_hash:
            return
        token = await self._new_action_token(user.id, ActionTokenType.RESET_PASSWORD, hours=1)
        await self.session.commit()
        if background_tasks is not None:
            background_tasks.add_task(self.email.send_password_reset, user.email, token)
        else:
            await self.email.send_password_reset(user.email, token)


    async def reset_password(self, raw_token: str, password: str) -> None:
        action = await self._valid_action_token(raw_token, ActionTokenType.RESET_PASSWORD)
        user = await self.repo.get_user(action.user_id)
        if not user:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid token")
        user.password_hash = hash_password(password)
        action.used_at = datetime.now(UTC)
        await self.repo.revoke_user_tokens(user.id)
        await self.session.commit()

    async def verify_email(self, raw_token: str) -> None:
        action = await self._valid_action_token(raw_token, ActionTokenType.VERIFY_EMAIL)
        user = await self.repo.get_user(action.user_id)
        if not user:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid token")
        user.email_verified = True
        action.used_at = datetime.now(UTC)
        await self.session.commit()

    async def oauth_exchange(
        self, data: OAuthExchangeRequest, context: ClientContext
    ) -> TokenResponse:
        identity = await self.repo.get_oauth_identity(data.provider, data.provider_account_id)
        user = await self.repo.get_user(identity.user_id) if identity else None
        if not user:
            user = await self.repo.get_user_by_email(str(data.email))
            if not user:
                user = await self.repo.create_user(
                    email=str(data.email).lower(),
                    name=data.name.strip(),
                    image_url=data.image_url,
                    email_verified=data.email_verified,
                )
            else:
                if not data.email_verified:
                    raise HTTPException(
                        status.HTTP_403_FORBIDDEN,
                        "Cannot link OAuth account: provider email is not verified",
                    )
                if not user.email_verified:
                    user.email_verified = True
                if not user.image_url and data.image_url:
                    user.image_url = data.image_url
            await self.repo.create_oauth_identity(
                user_id=user.id,
                provider=data.provider,
                provider_account_id=data.provider_account_id,
            )
        else:
            if not user.image_url and data.image_url:
                user.image_url = data.image_url
                await self.session.commit()
        return await self._issue_session(user, context)


    async def _issue_session(self, user: User, context: ClientContext) -> TokenResponse:
        settings = get_settings()
        access_token, expires_in = create_access_token(user.id, user.role.value)
        refresh_token = random_token()
        await self.repo.create_refresh_token(
            user_id=user.id,
            token_hash=token_digest(refresh_token),
            expires_at=datetime.now(UTC) + timedelta(days=settings.refresh_token_days),
            user_agent=context.user_agent,
            ip_address=context.ip_address,
        )
        await self.session.commit()
        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=expires_in,
            user=self.user_response(user),
        )

    async def _new_action_token(self, user_id: UUID, kind: ActionTokenType, hours: int) -> str:
        token = random_token()
        await self.repo.create_action_token(
            user_id=user_id,
            token_hash=token_digest(token),
            kind=kind,
            expires_at=datetime.now(UTC) + timedelta(hours=hours),
        )
        return token

    async def _valid_action_token(self, raw: str, kind: ActionTokenType):
        action = await self.repo.get_action_token(token_digest(raw), kind)
        if not action or action.used_at or self._is_expired(action.expires_at, datetime.now(UTC)):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid or expired token")
        return action

    @staticmethod
    def _is_expired(expires_at: datetime, now: datetime) -> bool:
        """Normalize SQLite's naive timestamps; PostgreSQL returns aware values."""
        comparable_now = now.replace(tzinfo=None) if expires_at.tzinfo is None else now
        return expires_at <= comparable_now

    @staticmethod
    def user_response(user: User) -> UserResponse:
        return UserResponse(
            id=str(user.id),
            email=user.email,
            name=user.name,
            role=user.role.value,
            email_verified=user.email_verified,
            image_url=user.image_url,
        )


def validate_internal_secret(provided: str | None) -> None:
    expected = get_settings().internal_auth_secret
    if not provided or not secrets.compare_digest(provided, expected):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid internal credential")
