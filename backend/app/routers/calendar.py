"""Read-only calendar, scoped by the same course boundaries as coursework."""
from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.access import courses_query
from app.core.deps import require_roles
from app.database import get_db
from app.models.assignment import Assignment
from app.models.attendance import ClassSession
from app.models.scheduled_class import ScheduledClass
from app.models.course import Course
from app.models.user import UserRole

router = APIRouter(prefix="/calendar", tags=["calendar"])


def utc(value):
    # SQLite discards timezone information; stored application timestamps are UTC.
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


class CalendarEvent(BaseModel):
    id: str
    kind: Literal["assignment", "class"]
    title: str
    course_id: int
    course_name: str
    course_code: str
    starts_at: datetime
    ended_at: datetime | None = None
    status: Literal["scheduled", "started", "ended"] | None = None


@router.get("/events", response_model=list[CalendarEvent])
def events(
    start: datetime, end: datetime, response: Response,
    db: Session = Depends(get_db),
    user=Depends(require_roles(UserRole.student, UserRole.faculty, UserRole.hod)),
):
    if start.tzinfo is None or end.tzinfo is None:
        raise HTTPException(422, "Include a timezone in the calendar date range")
    start, end = utc(start), utc(end)
    if not timedelta(0) < end - start <= timedelta(days=62):
        raise HTTPException(422, "Choose a calendar range of up to 62 days")
    scope = courses_query(db, user).with_entities(Course.id)
    result = []
    planned_session_ids = db.query(ScheduledClass.session_id).filter(
        ScheduledClass.course_id.in_(scope), ScheduledClass.session_id.is_not(None),
    )
    for model, field, kind in [(Assignment, Assignment.due_date, "assignment"),
                               (ClassSession, ClassSession.scheduled_at, "class")]:
        query = db.query(model, Course).join(Course, model.course_id == Course.id).filter(
            model.course_id.in_(scope), field >= start, field < end,
        )
        if model is ClassSession:
            query = query.filter(ClassSession.id.not_in(planned_session_ids))
        rows = query.order_by(field, model.id).limit(2001).all()
        if len(rows) > 2000:
            raise HTTPException(422, "Too many events. Choose a shorter calendar range")
        for record, course in rows:
            result.append(CalendarEvent(
                id=f"{kind}-{record.id}", kind=kind,
                title=record.title if kind == "assignment" else "Class session",
                course_id=course.id, course_name=course.name, course_code=course.code,
                starts_at=utc(record.due_date if kind == "assignment" else record.scheduled_at),
                ended_at=utc(record.ended_at) if kind == "class" and record.ended_at else None,
                status=("ended" if record.ended_at else "started") if kind == "class" else None,
            ))
    # Preserve the planned time after Start and attach its live/ended status.
    # Ad-hoc sessions continue to use their actual start time above.
    plans = db.query(ScheduledClass, Course).join(Course).outerjoin(ClassSession).filter(
        ScheduledClass.course_id.in_(scope), ScheduledClass.starts_at >= start,
        ScheduledClass.starts_at < end, ScheduledClass.cancelled_at.is_(None),
    ).order_by(ScheduledClass.starts_at, ScheduledClass.id).limit(2001).all()
    if len(plans) > 2000:
        raise HTTPException(422, "Too many events. Choose a shorter calendar range")
    result.extend(CalendarEvent(
        id=f"scheduled-{plan.id}", kind="class", title=plan.title,
        course_id=course.id, course_name=course.name, course_code=course.code,
        starts_at=utc(plan.starts_at),
        ended_at=utc(plan.session.ended_at) if plan.session_id and plan.session.ended_at else None,
        status="ended" if plan.session_id and plan.session.ended_at else "started" if plan.session_id else "scheduled",
    ) for plan, course in plans)
    response.headers["Cache-Control"] = "no-store"
    return sorted(result, key=lambda item: (item.starts_at, item.id))
