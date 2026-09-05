from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Index
from sqlalchemy.orm import relationship
from app.database import Base


class ScheduledClass(Base):
    """A plan is not an attendance session; create the latter only on Start."""
    __tablename__ = "scheduled_classes"
    __table_args__ = (Index("ix_scheduled_classes_course_starts", "course_id", "starts_at"),)
    id = Column(Integer, primary_key=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)
    title = Column(String(200), nullable=False)
    starts_at = Column(DateTime(timezone=True), nullable=False)
    cancelled_at = Column(DateTime(timezone=True), nullable=True)
    session_id = Column(Integer, ForeignKey("class_sessions.id"), nullable=True, unique=True)
    course = relationship("Course")
    session = relationship("ClassSession")
