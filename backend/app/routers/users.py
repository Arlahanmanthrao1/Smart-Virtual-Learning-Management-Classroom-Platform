from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User, UserRole
from app.schemas.user import UserOut
from app.core.deps import require_roles

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/", response_model=list[UserOut])
def list_users(
    db: Session = Depends(get_db),
    # Faculty included per the feature spec ("complete student details
    # accessible to faculty dashboard"). If this should actually be scoped
    # to "my students only" rather than the whole college, this is the
    # line to change - tighten to a course/department filter instead.
    _=Depends(require_roles(UserRole.admin, UserRole.hod, UserRole.faculty)),
):
    return db.query(User).all()