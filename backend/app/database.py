from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.pool import NullPool
import os

from app.config import settings

# SQLite needs this flag for multi-threaded FastAPI access; Postgres ignores it.
database_url = settings.database_url
if database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql+psycopg://", 1)
elif database_url.startswith("postgresql://"):
    database_url = database_url.replace("postgresql://", "postgresql+psycopg://", 1)
if os.getenv("VERCEL") and not database_url.startswith("postgresql+psycopg://"):
    raise RuntimeError("Vercel requires a hosted PostgreSQL DATABASE_URL; local SQLite cannot be deployed.")
connect_args = {"check_same_thread": False} if database_url.startswith("sqlite") else {"connect_timeout": 10}
pool_options = {"poolclass": NullPool} if database_url.startswith("postgresql") else {}

engine = create_engine(database_url, connect_args=connect_args, pool_pre_ping=True, **pool_options)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def ensure_schema_compatibility():
    """Apply tiny additive upgrades while the project is still pre-Alembic.

    ``create_all`` cannot add columns to existing databases. These small,
    additive upgrades preserve existing records until Alembic is introduced.
    """
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    if engine.dialect.name == "sqlite" and "class_sessions" in tables and "ended_at" not in {
        column["name"] for column in inspector.get_columns("class_sessions")
    }:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE class_sessions ADD COLUMN ended_at DATETIME"))

    if "courses" in tables and "course_type" not in {
        column["name"] for column in inspector.get_columns("courses")
    }:
        with engine.begin() as connection:
            if engine.dialect.name == "postgresql":
                connection.execute(text("ALTER TABLE courses ADD COLUMN IF NOT EXISTS course_type VARCHAR NOT NULL DEFAULT 'academic'"))
            else:
                connection.execute(text("ALTER TABLE courses ADD COLUMN course_type VARCHAR NOT NULL DEFAULT 'academic'"))


# Kept as a compatibility alias for existing imports and operator scripts.
ensure_local_schema_compatibility = ensure_schema_compatibility


def get_db():
    """FastAPI dependency that yields a DB session and always closes it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
