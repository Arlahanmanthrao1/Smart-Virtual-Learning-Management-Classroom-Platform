from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.course import Course, Enrollment
from app.models.user import User, UserRole
from app.schemas.course import CourseCreate, CourseOut, EnrollmentOut
from app.schemas.user import UserOut
from app.core.deps import get_current_user, require_roles

router = APIRouter(prefix="/courses", tags=["courses"])


@router.post("/", response_model=CourseOut, status_code=201)
def create_course(
    course_in: CourseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.faculty, UserRole.admin)),
):
    existing = db.query(Course).filter(Course.code == course_in.code).first()
    if existing:
        raise HTTPException(status_code=400, detail="Course code already exists")

    course = Course(**course_in.model_dump(), faculty_id=current_user.id)
    db.add(course)
    db.commit()
    db.refresh(course)
    return course


@router.get("/", response_model=list[CourseOut])
def list_courses(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return db.query(Course).all()


@router.get("/enrolled", response_model=list[CourseOut])
def list_my_enrolled_courses(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.student)),
):
    """Powers the student dashboard's course list - only courses this
    student is actually enrolled in, not every course in the system."""
    return (
        db.query(Course)
        .join(Enrollment)
        .filter(Enrollment.student_id == current_user.id)
        .all()
    )


@router.get("/{course_id}", response_model=CourseOut)
def get_course(course_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    return course


@router.post("/{course_id}/enroll", response_model=EnrollmentOut, status_code=201)
def enroll(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.student)),
):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    existing = (
        db.query(Enrollment)
        .filter(Enrollment.course_id == course_id, Enrollment.student_id == current_user.id)
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Already enrolled")

    enrollment = Enrollment(student_id=current_user.id, course_id=course_id)
    db.add(enrollment)
    db.commit()
    db.refresh(enrollment)
    return enrollment


def _require_owned_course(course_id: int, current_user: User, db: Session) -> Course:
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if course.faculty_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only manage students in your own courses")
    return course


@router.get("/{course_id}/students", response_model=list[UserOut])
def list_course_students(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.faculty)),
):
    _require_owned_course(course_id, current_user, db)
    return (
        db.query(User)
        .join(Enrollment, Enrollment.student_id == User.id)
        .filter(Enrollment.course_id == course_id)
        .distinct()
        .order_by(User.name, User.id)
        .all()
    )


@router.delete("/{course_id}/students/{student_id}", status_code=204)
def remove_course_student(
    course_id: int,
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.faculty)),
):
    """Remove only the enrollment, preserving the account and academic history."""
    _require_owned_course(course_id, current_user, db)
    removed = db.query(Enrollment).filter(
        Enrollment.course_id == course_id, Enrollment.student_id == student_id
    ).delete(synchronize_session=False)
    if not removed:
        db.rollback()
        raise HTTPException(status_code=404, detail="Student is not enrolled in this course")
    db.commit()
    return Response(status_code=204)
