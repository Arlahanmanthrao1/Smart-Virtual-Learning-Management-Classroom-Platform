from typing import Literal

from pydantic import BaseModel, ConfigDict


class CourseCreate(BaseModel):
    name: str
    code: str
    department: str | None = None
    semester: str | None = None
    course_type: Literal["academic", "non_academic"] = "academic"


class CourseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    code: str
    department: str | None = None
    semester: str | None = None
    course_type: Literal["academic", "non_academic"]
    faculty_id: int | None = None


class EnrollmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    student_id: int
    course_id: int
