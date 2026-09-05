from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, JSON, String, Text, func
from sqlalchemy.orm import relationship

from app.database import Base


class ProgrammingAssessment(Base):
    __tablename__ = "programming_assessments"

    id = Column(Integer, primary_key=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    allowed_languages = Column(JSON, nullable=False)
    starter_code = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    test_cases = relationship("ProgrammingTestCase", back_populates="assessment")


class ProgrammingTestCase(Base):
    __tablename__ = "programming_test_cases"

    id = Column(Integer, primary_key=True)
    assessment_id = Column(Integer, ForeignKey("programming_assessments.id"), nullable=False, index=True)
    stdin = Column(Text, nullable=False, default="")
    expected_output = Column(Text, nullable=False)
    is_hidden = Column(Boolean, nullable=False, default=False)
    points = Column(Float, nullable=False, default=1.0)
    position = Column(Integer, nullable=False, default=0)
    assessment = relationship("ProgrammingAssessment", back_populates="test_cases")


class ProgrammingSubmission(Base):
    __tablename__ = "programming_submissions"

    id = Column(Integer, primary_key=True)
    assessment_id = Column(Integer, ForeignKey("programming_assessments.id"), nullable=False, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    language = Column(String(30), nullable=False)
    source_code = Column(Text, nullable=False)
    passed_count = Column(Integer, nullable=False)
    total_count = Column(Integer, nullable=False)
    score = Column(Float, nullable=False)
    results = Column(JSON, nullable=False)
    submitted_at = Column(DateTime(timezone=True), server_default=func.now())
