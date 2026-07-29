from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, func

from app.database import Base


class Student(Base):
    """Pre-existing student records, as if this ERP already had its own
    student database before the LMS platform was ever built. Matched to
    LMS users by email - a real integration would likely match on roll
    number or a college-wide student ID instead."""

    __tablename__ = "students"

    id = Column(Integer, primary_key=True, index=True)
    roll_no = Column(String, unique=True, nullable=False)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)
    department = Column(String, nullable=True)


class AttendanceRecord(Base):
    __tablename__ = "attendance_records"

    id = Column(Integer, primary_key=True, index=True)
    student_email = Column(String, nullable=False, index=True)
    course_code = Column(String, nullable=False)
    duration_minutes = Column(Float, default=0.0)
    present = Column(Boolean, default=False)
    synced_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
