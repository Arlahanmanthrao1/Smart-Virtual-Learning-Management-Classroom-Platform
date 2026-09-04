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


def ensure_local_schema_compatibility():
    """Apply tiny additive upgrades while the project is still pre-Alembic.

    ``create_all`` cannot add a column to an existing SQLite database. Keeping
    this compatibility shim here lets existing demo databases gain durable
    session-ending support without asking users to delete their data.
    """
    if engine.dialect.name != "sqlite":
        return
    inspector = inspect(engine)
    if "class_sessions" not in inspector.get_table_names():
        return

    columns = {column["name"] for column in inspector.get_columns("class_sessions")}
    if "ended_at" not in columns:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE class_sessions ADD COLUMN ended_at DATETIME"))


def get_db():
    """FastAPI dependency that yields a DB session and always closes it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
