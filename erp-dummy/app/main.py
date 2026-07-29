from fastapi import FastAPI, Request, Depends, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session

from app.database import Base, engine, get_db, SessionLocal
from app.models import Student, AttendanceRecord
from app.schemas import AttendanceSyncIn

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Dummy College ERP")
templates = Jinja2Templates(directory="app/templates")


def seed_students(db: Session) -> None:
    """Pretend this data already existed in the college's ERP long
    before the LMS platform was built. Emails match the demo LMS users
    so the two systems can be matched up during a demo."""
    if db.query(Student).count() == 0:
        db.add_all(
            [
                Student(roll_no="21CSE001", name="Aisha Khan", email="student1@college.edu", department="CSE"),
                Student(roll_no="21CSE002", name="Rohan Mehta", email="student2@college.edu", department="CSE"),
            ]
        )
        db.commit()


@app.on_event("startup")
def on_startup() -> None:
    db = SessionLocal()
    seed_students(db)
    db.close()


@app.post("/api/attendance/sync")
def sync_attendance(payload: AttendanceSyncIn, db: Session = Depends(get_db)):
    """Called by the LMS platform every time a student's attendance
    changes for a class session. This is the actual integration point -
    everything else in this service just exists to make the sync visible."""
    student = db.query(Student).filter(Student.email == payload.student_email).first()
    if not student:
        raise HTTPException(
            status_code=404,
            detail=f"No ERP record found for {payload.student_email} - add them to seed_students()",
        )

    record = (
        db.query(AttendanceRecord)
        .filter(
            AttendanceRecord.student_email == payload.student_email,
            AttendanceRecord.course_code == payload.course_code,
        )
        .first()
    )
    if not record:
        record = AttendanceRecord(student_email=payload.student_email, course_code=payload.course_code)
        db.add(record)

    record.duration_minutes = payload.duration_minutes
    record.present = payload.present
    db.commit()
    db.refresh(record)

    return {"status": "synced", "roll_no": student.roll_no, "present": record.present}


@app.get("/api/attendance")
def list_attendance(db: Session = Depends(get_db)):
    return db.query(AttendanceRecord).all()


@app.get("/", response_class=HTMLResponse)
def dashboard(request: Request, db: Session = Depends(get_db)):
    students = {s.email: s for s in db.query(Student).all()}
    records = db.query(AttendanceRecord).order_by(AttendanceRecord.synced_at.desc()).all()

    rows = [
        {
            "roll_no": students[r.student_email].roll_no if r.student_email in students else "?",
            "name": students[r.student_email].name if r.student_email in students else r.student_email,
            "course_code": r.course_code,
            "duration_minutes": r.duration_minutes,
            "present": r.present,
            "synced_at": r.synced_at,
        }
        for r in records
    ]
    return templates.TemplateResponse("dashboard.html", {"request": request, "rows": rows})
