"""Reviewed, additive scheduled-class table upgrade. Creates no application rows."""
import argparse
from pathlib import Path
import sys
from dotenv import dotenv_values
from sqlalchemy import create_engine, inspect

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.models.scheduled_class import ScheduledClass  # noqa: E402
from scripts.production_upgrade import fingerprint  # noqa: E402

EXPECTED = {"id", "course_id", "title", "starts_at", "cancelled_at", "session_id"}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--env-file", type=Path, default=Path(__file__).resolve().parents[1] / ".env")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    url = dotenv_values(args.env_file).get("DATABASE_URL")
    if not url or not str(url).startswith(("postgresql://", "postgres://")):
        raise SystemExit("The selected environment file must contain one PostgreSQL DATABASE_URL.")
    engine = create_engine(str(url).replace("postgres://", "postgresql+psycopg://", 1).replace("postgresql://", "postgresql+psycopg://", 1))
    try:
        inspector = inspect(engine)
        if "scheduled_classes" in inspector.get_table_names():
            columns = {column["name"] for column in inspector.get_columns("scheduled_classes")}
            if columns != EXPECTED:
                raise SystemExit("Existing scheduled_classes table has an unexpected structure; no changes made.")
            print("Scheduled-class schema is already ready. No changes made.")
            return
        if not args.apply:
            print("Scheduled-class table is absent. Back up the database, then rerun with --apply.")
            return
        existing_tables = inspector.get_table_names()
        with engine.connect() as connection:
            before = fingerprint(connection, existing_tables)
        ScheduledClass.__table__.create(engine, checkfirst=False)
        columns = {column["name"] for column in inspect(engine).get_columns("scheduled_classes")}
        if columns != EXPECTED:
            raise SystemExit("Table verification failed.")
        with engine.connect() as connection:
            if fingerprint(connection, existing_tables) != before:
                raise SystemExit("Existing-record verification failed after schema creation.")
        print("Scheduled-class schema created and verified. No application records were added.")
    finally:
        engine.dispose()


if __name__ == "__main__":
    main()
