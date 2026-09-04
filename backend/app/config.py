from pydantic_settings import BaseSettings
from pydantic import Field, SecretStr
from typing import Literal


class Settings(BaseSettings):
    # SQLite by default so the project runs with zero setup.
    # Swap to a Postgres URL (postgresql://user:pass@host/db) when you're ready -
    # SQLAlchemy handles the switch, no code changes needed.
    database_url: str = "sqlite:///./lms.db"

    secret_key: str = "change-this-secret-key-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24  # 24 hours
    minimum_attendance_minutes: float = 30

    video_provider: Literal["jaas", "jitsi"] = "jaas"
    jitsi_domain: str = "meet.jit.si"
    jaas_app_id: str = ""
    jaas_api_key_id: str = ""
    # Relative paths are resolved from backend/, never exposed to the browser.
    jaas_private_key_path: str = ""
    jaas_private_key: SecretStr = SecretStr("")
    jaas_token_expire_minutes: int = Field(default=60, ge=5, le=240)

    # Only emails on this domain can register - the "secure college
    # authentication" feature from the spec.
    allowed_email_domain: str = "hitam.org"

    # Where the (dummy) college ERP is running, for pushing attendance sync calls.
    erp_base_url: str = ""
    allowed_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    class Config:
        env_file = ".env"


settings = Settings()
