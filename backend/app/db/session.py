from sqlmodel import create_engine, SQLModel, Session
from app.config import settings

# Setup engine with connection pool configurations
if settings.DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        settings.DATABASE_URL,
        connect_args={"check_same_thread": False},
        echo=False
    )
else:
    engine = create_engine(
        settings.DATABASE_URL,
        pool_pre_ping=True,
        echo=False
    )

def init_db() -> None:
    # Import models here to register them with metadata
    from app.models.models import User, Project, Dataset, ChatMessage, AnalysisReport
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session
