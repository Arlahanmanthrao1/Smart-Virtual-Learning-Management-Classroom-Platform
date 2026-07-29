from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # SQLite by default so the project runs with zero setup.
    # Swap to a Postgres URL (postgresql://user:pass@host/db) when you're ready -
    # SQLAlchemy handles the switch, no code changes needed.
    database_url: str = "sqlite:///./lms.db"

    secret_key: str = "change-this-secret-key-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24  # 24 hours

    # Only emails on this domain can register - the "secure college
    # authentication" feature from the spec.
    allowed_email_domain: str = "college.edu"

    # Where the (dummy) college ERP is running, for pushing attendance sync calls.
    erp_base_url: str = "http://localhost:9000"

    class Config:
        env_file = ".env"


settings = Settings()
