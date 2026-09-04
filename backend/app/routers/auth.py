from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError

from app.database import get_db
from app.models.user import User, UserRole
from app.schemas.user import UserCreate, UserOut
from app.schemas.auth import Token
from app.core.security import hash_password, verify_password, create_access_token
from app.core.deps import get_current_user, require_roles

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(
    user_in: UserCreate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_roles(UserRole.admin)),
):
    """Administrator-only student creation using the approved college domain."""
    return _create_account(user_in, UserRole.student, db)


@router.post("/register-faculty", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register_faculty(
    user_in: UserCreate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_roles(UserRole.admin)),
):
    """Administrator-only faculty creation; the caller cannot choose privileges."""
    return _create_account(user_in, UserRole.faculty, db)


def _create_account(user_in: UserCreate, role: UserRole, db: Session):
    existing = db.query(User).filter(func.lower(User.email) == user_in.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        name=user_in.name,
        email=user_in.email,
        hashed_password=hash_password(user_in.password),
        role=role,
        department=user_in.department,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Email already registered") from None
    db.refresh(user)
    return user


@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # OAuth2PasswordRequestForm uses "username" as the field name; we treat it as email.
    user = db.query(User).filter(func.lower(User.email) == form_data.username.strip().lower()).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect email or password")

    token = create_access_token(data={"sub": str(user.id), "role": user.role.value})
    return Token(access_token=token)


@router.get("/me", response_model=UserOut)
def read_me(current_user: User = Depends(get_current_user)):
    return current_user
