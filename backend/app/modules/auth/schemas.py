from pydantic import BaseModel, EmailStr, Field, field_validator


class RegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=12, max_length=128)

    @field_validator("password")
    @classmethod
    def strong_password(cls, value: str) -> str:
        if not any(c.isupper() for c in value) or not any(c.islower() for c in value):
            raise ValueError("Password must contain upper- and lowercase letters")
        if not any(c.isdigit() for c in value):
            raise ValueError("Password must contain a number")
        return value


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=32)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=32)
    password: str = Field(min_length=12, max_length=128)

    _validate_password = field_validator("password")(RegisterRequest.strong_password.__func__)


class VerifyEmailRequest(BaseModel):
    token: str = Field(min_length=32)


class OAuthExchangeRequest(BaseModel):
    provider: str = Field(pattern="^(google|github)$")
    provider_account_id: str = Field(min_length=1, max_length=255)
    email: EmailStr
    name: str = Field(min_length=1, max_length=120)
    image_url: str | None = None
    email_verified: bool = True



class UserResponse(BaseModel):
    id: str
    email: EmailStr
    name: str
    role: str
    email_verified: bool
    image_url: str | None = None


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserResponse


class MessageResponse(BaseModel):
    message: str
