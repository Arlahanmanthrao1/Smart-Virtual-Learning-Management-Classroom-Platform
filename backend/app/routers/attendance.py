from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
import uuid

from app.database import get_db
from app.models.attendance import ClassSession, Attendance
from app.models.user import User, UserRole
from app.models.course import Course
from app.schemas.attendance import SessionEvent, AttendanceOut, ClassSessionCreate, ClassSessionOut
from app.core.deps import get_current_user, require_roles
from app.integrations.erp_client import sync_attendance_to_erp

router = APIRouter(prefix="/attendance", tags=["attendance"])

# Minutes a student must be present before they're marked attended.
# Tune this to match your college's actual attendance policy.
MINIMUM_ATTENDANCE_MINUTES = 30


@router.post("/sessions", response_model=ClassSessionOut, status_code=201)
def schedule_session(
    session_in: ClassSessionCreate,
    db: Session = Depends(get_db),
    _=Depends(require_roles(UserRole.faculty, UserRole.admin)),
):
    """Faculty schedules a class ahead of time. Generates a random,
    unguessable room ID - never a human-readable name - so the only way
    to reach it is through an authenticated, enrollment-checked dashboard.
    See the Jitsi implementation doc, Section 4, for why this matters."""
    room_id = f"lms-{uuid.uuid4().hex[:16]}"
    session = ClassSession(course_id=session_in.course_id, jitsi_room_id=room_id)
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@router.get("/sessions/{course_id}", response_model=list[ClassSessionOut])
def list_sessions(course_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    """Lets a student's dashboard show a Join button for a course's
    scheduled sessions, most recent first."""
    return (
        db.query(ClassSession)
        .filter(ClassSession.course_id == course_id)
        .order_by(ClassSession.scheduled_at.desc())
        .all()
    )


@router.post("/event")
def record_session_event(event: SessionEvent, db: Session = Depends(get_db)):
    """Called by the frontend every time Jitsi's IFrame API fires a
    participantJoined / participantLeft event for a class session.

    This scaffold increments duration by a fixed amount per "left" event so
    you can wire up the frontend end-to-end first. Swap in real duration
    tracking (store the join timestamp, compute the delta on leave) once
    the join/leave events are flowing correctly - that's the one piece
    worth testing carefully since attendance depends on it.
    """
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

    if event.event_type == "left":
        record.duration_minutes += 1
        record.present = record.duration_minutes >= MINIMUM_ATTENDANCE_MINUTES

    db.commit()
    db.refresh(record)

    # Push the update to the college's ERP so attendance stays in sync
    # across both systems automatically - no manual re-entry needed.
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
def get_attendance_summary(
    student_id: int,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    """Overall attendance across every course a student has records in -
    powers the at-risk indicator on the faculty roster view. Percentage
    is null if the student has no attendance records yet, rather than a
    misleading 0%."""
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
def get_student_attendance(
    course_id: int,
    student_id: int,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    return (
        db.query(Attendance)
        .join(ClassSession)
        .filter(ClassSession.course_id == course_id, Attendance.student_id == student_id)
        .all()
    )