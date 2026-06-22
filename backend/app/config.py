import os
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "Aether Data"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = "supersecretjwtkey98765432101234567890abcdef"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7

    # Databases
    DATABASE_URL: str = "sqlite:///./dev.db"
    REDIS_URL: str = "redis://localhost:6379/0"

    # LLM Settings
    GROQ_API_KEY: str | None = None
    OPENAI_API_KEY: str | None = None
    ANTHROPIC_API_KEY: str | None = None

    # Storage
    UPLOAD_DIR: str = "./uploads"

    # CORS
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000"
    ]

    ENV: str = "development"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )

settings = Settings()
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)