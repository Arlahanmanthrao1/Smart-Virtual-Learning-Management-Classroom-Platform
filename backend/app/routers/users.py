from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User, UserRole
from app.schemas.user import UserOut
from app.core.deps import require_roles

from app.core.access import users_query, department_name

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/", response_model=list[UserOut])
def list_users(
    db: Session = Depends(get_db),
    _=Depends(require_roles(UserRole.admin, UserRole.hod, UserRole.faculty)),
):
    return users_query(db, _).order_by(User.name).all()


class AccountDetails(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    name: str = Field(min_length=2, max_length=120)
    department: str | None = None


@router.patch("/{user_id}", response_model=UserOut)
def update_account(user_id: int, payload: AccountDetails, db: Session = Depends(get_db),
                   admin: User = Depends(require_roles(UserRole.admin))):
    account = users_query(db, admin).filter(User.id == user_id).first()
    if not account:
        raise HTTPException(404, "Account not found")
    account.name = payload.name
    account.department = department_name(db, admin, payload.department) if account.role != UserRole.admin or payload.department else None
    db.commit()
    db.refresh(account)
    return account
