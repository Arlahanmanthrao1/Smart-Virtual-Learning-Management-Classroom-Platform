from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.assignment import Assignment, Submission
from app.models.user import User, UserRole
from app.schemas.assignment import AssignmentCreate, AssignmentOut, SubmissionCreate, SubmissionOut
from app.core.deps import get_current_user, require_roles

from app.core.access import course_access, resource_access, tenant
from app.models.course import Course, Enrollment
import math
from datetime import timezone

router = APIRouter(prefix="/assignments", tags=["assignments"])


@router.post("/", response_model=AssignmentOut, status_code=201)
def create_assignment(
    assignment_in: AssignmentCreate,
    db: Session = Depends(get_db),
    _=Depends(require_roles(UserRole.faculty, UserRole.admin)),
):
    course_access(db, _, assignment_in.course_id, manage=True)
    if assignment_in.due_date is not None:
        # Normalize before SQLite discards offsets; legacy naive inputs mean UTC.
        due = assignment_in.due_date
        assignment_in.due_date = due.replace(tzinfo=timezone.utc) if due.tzinfo is None else due.astimezone(timezone.utc)
    assignment = Assignment(**assignment_in.model_dump())
    db.add(assignment)
    db.commit()
    db.refresh(assignment)
    return assignment


@router.get("/course/{course_id}", response_model=list[AssignmentOut])
def list_assignments(course_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    course_access(db, _, course_id)
    return db.query(Assignment).filter(Assignment.course_id == course_id).all()


@router.get("/submissions/me", response_model=list[SubmissionOut])
def list_my_submissions(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.student)),
):
    """Powers the student dashboard's assignment status list."""
    return db.query(Submission).join(Assignment).join(Course).filter(Submission.student_id == current_user.id, Course.institution_id == tenant(current_user)).all()


@router.get("/{assignment_id}/submissions", response_model=list[SubmissionOut])
def list_submissions_for_assignment(
    assignment_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_roles(UserRole.faculty, UserRole.admin)),
):
    """Powers the faculty grading view - every student's submission for
    one assignment."""
    resource_access(db, _, Assignment, assignment_id, manage=True)
    query = db.query(Submission).join(User, User.id == Submission.student_id).filter(Submission.assignment_id == assignment_id, User.institution_id == tenant(_))
    if _.role == UserRole.faculty:
        course_id = db.get(Assignment, assignment_id).course_id
        query = query.filter(Submission.student_id.in_(db.query(Enrollment.student_id).filter(Enrollment.course_id == course_id)))
    return query.all()


@router.post("/submit", response_model=SubmissionOut, status_code=201)
def submit_assignment(
    submission_in: SubmissionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.student)),
):
    resource_access(db, current_user, Assignment, submission_in.assignment_id)
    submission = Submission(
        assignment_id=submission_in.assignment_id,
        student_id=current_user.id,
        file_url=submission_in.file_url,
    )
    db.add(submission)
    db.commit()
    db.refresh(submission)
    return submission


@router.post("/submissions/{submission_id}/grade", response_model=SubmissionOut)
def grade_submission(
    submission_id: int,
    marks: float,
    db: Session = Depends(get_db),
    _=Depends(require_roles(UserRole.faculty, UserRole.admin)),
):
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    assignment = resource_access(db, _, Assignment, submission.assignment_id, manage=True)
    student = db.get(User, submission.student_id)
    if not student or student.institution_id != tenant(_):
        raise HTTPException(404, "Submission not found")
    if _.role == UserRole.faculty and not db.query(Enrollment).filter(Enrollment.course_id == assignment.course_id, Enrollment.student_id == student.id).first():
        raise HTTPException(403, "Student is no longer enrolled in your course")
    if not math.isfinite(marks) or marks < 0 or marks > assignment.max_marks:
        raise HTTPException(422, "Marks must be between zero and the assignment maximum")
    submission.marks_obtained = marks
    db.commit()
    db.refresh(submission)
    return submission
