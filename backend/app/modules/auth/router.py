from typing import Annotated

from fastapi import APIRouter, Header, Request, status

from app.modules.auth.dependencies import CurrentUser, SessionDep
from app.modules.auth.schemas import (
    ForgotPasswordRequest,
    LoginRequest,
    MessageResponse,
    OAuthExchangeRequest,
    RefreshRequest,
    RegisterRequest,
    ResetPasswordRequest,
    TokenResponse,
    UserResponse,
    VerifyEmailRequest,
)
from app.modules.auth.service import AuthService, ClientContext, validate_internal_secret

router = APIRouter(prefix="/auth", tags=["Authentication"])


def client_context(request: Request) -> ClientContext:
    forwarded = request.headers.get("x-forwarded-for")
    ip = (
        forwarded.split(",")[0].strip()
        if forwarded
        else request.client.host
        if request.client
        else None
    )
    return ClientContext(user_agent=request.headers.get("user-agent"), ip_address=ip)


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(data: RegisterRequest, session: SessionDep) -> UserResponse:
    user = await AuthService(session).register(data)
    return AuthService.user_response(user)


@router.post("/login", response_model=TokenResponse)
async def login(data: LoginRequest, request: Request, session: SessionDep) -> TokenResponse:
    return await AuthService(session).login(str(data.email), data.password, client_context(request))


@router.post("/refresh", response_model=TokenResponse)
async def refresh(data: RefreshRequest, request: Request, session: SessionDep) -> TokenResponse:
    return await AuthService(session).refresh(data.refresh_token, client_context(request))


@router.post("/logout", response_model=MessageResponse)
async def logout(data: RefreshRequest, session: SessionDep) -> MessageResponse:
    await AuthService(session).logout(data.refresh_token)
    return MessageResponse(message="Signed out")


@router.post(
    "/forgot-password", response_model=MessageResponse, status_code=status.HTTP_202_ACCEPTED
)
async def forgot_password(data: ForgotPasswordRequest, session: SessionDep) -> MessageResponse:
    await AuthService(session).request_password_reset(str(data.email))
    return MessageResponse(message="If that account exists, a reset link has been sent")


@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(data: ResetPasswordRequest, session: SessionDep) -> MessageResponse:
    await AuthService(session).reset_password(data.token, data.password)
    return MessageResponse(message="Password updated")


@router.post("/verify-email", response_model=MessageResponse)
async def verify_email(data: VerifyEmailRequest, session: SessionDep) -> MessageResponse:
    await AuthService(session).verify_email(data.token)
    return MessageResponse(message="Email verified")


@router.get("/me", response_model=UserResponse)
async def me(user: CurrentUser) -> UserResponse:
    return AuthService.user_response(user)


@router.post("/oauth/exchange", response_model=TokenResponse, include_in_schema=False)
async def oauth_exchange(
    data: OAuthExchangeRequest,
    request: Request,
    session: SessionDep,
    internal_secret: Annotated[str | None, Header(alias="X-Internal-Auth")] = None,
) -> TokenResponse:
    validate_internal_secret(internal_secret)
    return await AuthService(session).oauth_exchange(data, client_context(request))
