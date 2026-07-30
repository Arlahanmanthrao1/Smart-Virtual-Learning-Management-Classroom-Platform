from datetime import datetime

from pydantic import BaseModel, ConfigDict


class SessionEvent(BaseModel):
    room_id: str
    course_id: int
    student_id: int
    event_type: str  # "joined" or "left"
    timestamp: datetime


class AttendanceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    session_id: int
    student_id: int
    duration_minutes: float
    present: bool


class ClassSessionCreate(BaseModel):
    course_id: int


class ClassSessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    course_id: int
    jitsi_room_id: str
    scheduled_at: datetime
    recording_url: str | None = None
    fullscreen_required: bool


class FullscreenUpdate(BaseModel):
    fullscreen_required: bool