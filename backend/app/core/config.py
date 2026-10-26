from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False, extra="ignore")

    app_name: str = "DataMind AI"
    environment: str = "development"
    database_url: str = "postgresql+asyncpg://datamind:datamind@localhost:5432/datamind"
    jwt_secret: str = Field(min_length=32)
    jwt_issuer: str = "datamind-api"
    access_token_minutes: int = 15
    refresh_token_days: int = 30
    refresh_token_grace_seconds: int = 30
    frontend_url: str = "http://localhost:3000"
    internal_auth_secret: str = Field(min_length=32)
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_username: str | None = None
    smtp_password: str | None = None
    smtp_from: str = "DataMind AI <no-reply@datamind.local>"
    smtp_use_tls: bool = True
    cors_origins: list[str] = ["http://localhost:3000"]
    allowed_hosts: list[str] = ["*"]
    trust_proxy_headers: bool = False

    @field_validator("database_url", mode="before")
    @classmethod
    def assemble_database_url(cls, value: object) -> object:
        if isinstance(value, str):
            if value.startswith("postgres://"):
                return value.replace("postgres://", "postgresql+asyncpg://", 1)
            if value.startswith("postgresql://") and not value.startswith("postgresql+asyncpg://"):
                return value.replace("postgresql://", "postgresql+asyncpg://", 1)
        return value

    @field_validator("cors_origins", "allowed_hosts", mode="before")
    @classmethod
    def split_origins(cls, value: object) -> object:
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
