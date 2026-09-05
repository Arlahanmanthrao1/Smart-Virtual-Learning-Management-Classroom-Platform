from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, func
from app.database import Base


class GoogleIdentity(Base):
    __tablename__ = "google_identities"
    # Google subject is stable; email is only used for the initial verified link.
    subject = Column(String(255), primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
