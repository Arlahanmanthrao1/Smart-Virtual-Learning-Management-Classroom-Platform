from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.material import MaterialType


class MaterialCreate(BaseModel):
    course_id: int
    title: str
    material_type: MaterialType = MaterialType.notes
    file_url: str
    description: str | None = None


class MaterialOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    course_id: int
    title: str
    material_type: MaterialType
    file_url: str
    description: str | None = None
    uploaded_at: datetime