import os
from pathlib import Path

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

TEST_DB_PATH = Path(__file__).resolve().parent.parent / "datamind-test.sqlite3"

os.environ.setdefault("JWT_SECRET", "test-jwt-secret-that-is-at-least-32-characters")
os.environ.setdefault("INTERNAL_AUTH_SECRET", "test-internal-secret-at-least-32-characters")
os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("DATABASE_URL", f"sqlite+aiosqlite:///{TEST_DB_PATH}")

from app.core.database import Base, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.modules.auth.domain import models  # noqa: E402, F401
from app.modules.projects.domain import models as project_models  # noqa: E402, F401


@pytest.fixture(scope="session", autouse=True)
def cleanup_test_database():
    yield
    if TEST_DB_PATH.exists():
        try:
            TEST_DB_PATH.unlink()
        except OSError:
            pass


@pytest_asyncio.fixture
async def clean_database():
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.drop_all)
        await connection.run_sync(Base.metadata.create_all)
    yield


@pytest_asyncio.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as test_client:
        yield test_client

