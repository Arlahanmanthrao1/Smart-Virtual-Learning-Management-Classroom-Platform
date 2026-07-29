from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.assignment import Assignment, Submission
from app.models.user import User, UserRole
from app.schemas.assignment import AssignmentCreate, AssignmentOut, SubmissionCreate, SubmissionOut
from app.core.deps import get_current_user, require_roles

router = APIRouter(prefix="/assignments", tags=["assignments"])


@router.post("/", response_model=AssignmentOut, status_code=201)
def create_assignment(
    assignment_in: AssignmentCreate,
    db: Session = Depends(get_db),
    _=Depends(require_roles(UserRole.faculty, UserRole.admin)),
):
    assignment = Assignment(**assignment_in.model_dump())
    db.add(assignment)
    db.commit()
    db.refresh(assignment)
    return assignment


@router.get("/course/{course_id}", response_model=list[AssignmentOut])
def list_assignments(course_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    return db.query(Assignment).filter(Assignment.course_id == course_id).all()


@router.get("/submissions/me", response_model=list[SubmissionOut])
def list_my_submissions(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.student)),
):
    """Powers the student dashboard's assignment status list."""
    return db.query(Submission).filter(Submission.student_id == current_user.id).all()


@router.get("/{assignment_id}/submissions", response_model=list[SubmissionOut])
def list_submissions_for_assignment(
    assignment_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_roles(UserRole.faculty, UserRole.admin)),
):
    """Powers the faculty grading view - every student's submission for
    one assignment."""
    return db.query(Submission).filter(Submission.assignment_id == assignment_id).all()


@router.post("/submit", response_model=SubmissionOut, status_code=201)
def submit_assignment(
    submission_in: SubmissionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.student)),
):
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
    submission.marks_obtained = marks
    db.commit()
    db.refresh(submission)
    return submission