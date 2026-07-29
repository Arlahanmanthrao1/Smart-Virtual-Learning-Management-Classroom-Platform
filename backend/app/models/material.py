from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, Enum, func
import enum

from app.database import Base


class MaterialType(str, enum.Enum):
    notes = "notes"
    exam = "exam"
    pyq = "pyq"  # previous year questions


class StudyMaterial(Base):
    __tablename__ = "study_materials"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)
    title = Column(String, nullable=False)
    material_type = Column(Enum(MaterialType), nullable=False, default=MaterialType.notes)
    file_url = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())