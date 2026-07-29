from pydantic import BaseModel


class AttendanceSyncIn(BaseModel):
    student_email: str
    course_code: str
    duration_minutes: float
    present: bool
