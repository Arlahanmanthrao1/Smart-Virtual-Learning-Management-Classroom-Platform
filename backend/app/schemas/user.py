from pydantic import BaseModel, EmailStr, ConfigDict, field_validator

from app.models.user import UserRole
from app.config import settings


class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: UserRole = UserRole.student
    department: str | None = None

    @field_validator("email")
    @classmethod
    def validate_college_email(cls, v: str) -> str:
        domain = v.split("@")[-1].lower()
        if domain != settings.allowed_email_domain.lower():
            raise ValueError(f"Email must belong to the {settings.allowed_email_domain} domain")
        return v


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: EmailStr
    role: UserRole
    department: str | None = None
