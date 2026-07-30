from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import uuid

from app.database import get_db
from app.models.attendance import ClassSession, Attendance
from app.models.user import User, UserRole
from app.models.course import Course
from app.schemas.attendance import (
    SessionEvent,
    AttendanceOut,
    ClassSessionCreate,
    ClassSessionOut,
    FullscreenUpdate,
)
from app.core.deps import get_current_user, require_roles
from app.integrations.erp_client import sync_attendance_to_erp

router = APIRouter(prefix="/attendance", tags=["attendance"])

MINIMUM_ATTENDANCE_MINUTES = 30


@router.post("/sessions", response_model=ClassSessionOut, status_code=201)
def schedule_session(
    session_in: ClassSessionCreate,
    db: Session = Depends(get_db),
    _=Depends(require_roles(UserRole.faculty, UserRole.admin)),
):
    room_id = f"lms-{uuid.uuid4().hex[:16]}"
    session = ClassSession(course_id=session_in.course_id, jitsi_room_id=room_id)
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@router.get("/sessions/{course_id}", response_model=list[ClassSessionOut])
def list_sessions(course_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    return (
        db.query(ClassSession)
        .filter(ClassSession.course_id == course_id)
        .order_by(ClassSession.scheduled_at.desc())
        .all()
    )


@router.get("/sessions/detail/{session_id}", response_model=ClassSessionOut)
def get_session_detail(session_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    """Used by the classroom page to poll the current fullscreen_required
    state while a class is in progress - a 3-segment path ("detail" is
    literal) so it can't collide with /sessions/{course_id} above."""
    session = db.query(ClassSession).filter(ClassSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.patch("/sessions/{session_id}/fullscreen", response_model=ClassSessionOut)
def set_fullscreen_required(
    session_id: int,
    payload: FullscreenUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_roles(UserRole.faculty, UserRole.admin)),
):
    """Faculty toggles whether students in this session are held in
    fullscreen. Per the feature spec: students get pushed into fullscreen
    on join, faculty controls when they're released."""
    session = db.query(ClassSession).filter(ClassSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    session.fullscreen_required = payload.fullscreen_required
    db.commit()
    db.refresh(session)
    return session


@router.post("/event")
def record_session_event(event: SessionEvent, db: Session = Depends(get_db)):
    session = db.query(ClassSession).filter(ClassSession.jitsi_room_id == event.room_id).first()
    if not session:
        session = ClassSession(course_id=event.course_id, jitsi_room_id=event.room_id)
        db.add(session)
        db.commit()
        db.refresh(session)

    record = (
        db.query(Attendance)
        .filter(Attendance.session_id == session.id, Attendance.student_id == event.student_id)
        .first()
    )
    if not record:
        record = Attendance(session_id=session.id, student_id=event.student_id, duration_minutes=0.0)
        db.add(record)

    if event.event_type == "joined":
        record.last_joined_at = event.timestamp
    elif event.event_type == "left":
        if record.last_joined_at is not None:
            elapsed_minutes = (event.timestamp - record.last_joined_at).total_seconds() / 60
            if 0 < elapsed_minutes < 24 * 60:
                record.duration_minutes += elapsed_minutes
            record.last_joined_at = None
        record.present = record.duration_minutes >= MINIMUM_ATTENDANCE_MINUTES

    db.commit()
    db.refresh(record)

    student = db.query(User).filter(User.id == event.student_id).first()
    course = db.query(Course).filter(Course.id == event.course_id).first()
    if student and course:
        sync_attendance_to_erp(
            student_email=student.email,
            course_code=course.code,
            duration_minutes=record.duration_minutes,
            present=record.present,
        )

    return {"status": "recorded", "duration_minutes": record.duration_minutes, "present": record.present}


@router.get("/summary/{student_id}")
def get_attendance_summary(student_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    records = db.query(Attendance).filter(Attendance.student_id == student_id).all()
    if not records:
        return {"student_id": student_id, "total_sessions": 0, "present_count": 0, "percent": None}

    present_count = sum(1 for r in records if r.present)
    percent = round((present_count / len(records)) * 100)
    return {
        "student_id": student_id,
        "total_sessions": len(records),
        "present_count": present_count,
        "percent": percent,
    }


@router.get("/{course_id}/{student_id}", response_model=list[AttendanceOut])
def get_student_attendance(course_id: int, student_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    return (
        db.query(Attendance)
        .join(ClassSession)
        .filter(ClassSession.course_id == course_id, Attendance.student_id == student_id)
        .all()
    )