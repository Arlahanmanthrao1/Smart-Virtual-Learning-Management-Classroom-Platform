from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.material import StudyMaterial
from app.models.user import User, UserRole
from app.schemas.material import MaterialCreate, MaterialOut
from app.core.deps import get_current_user, require_roles

router = APIRouter(prefix="/materials", tags=["materials"])


@router.post("/", response_model=MaterialOut, status_code=201)
def upload_material(
    material_in: MaterialCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.admin)),
):
    """Admin uploads exams, notes, or previous-year questions. file_url
    expects a pre-uploaded file link (e.g. from S3) - see the note on
    file uploads in the backend README."""
    material = StudyMaterial(**material_in.model_dump(), uploaded_by=current_user.id)
    db.add(material)
    db.commit()
    db.refresh(material)
    return material


@router.get("/course/{course_id}", response_model=list[MaterialOut])
def list_materials(course_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    """Powers the study-guide view on the student dashboard."""
    return (
        db.query(StudyMaterial)
        .filter(StudyMaterial.course_id == course_id)
        .order_by(StudyMaterial.uploaded_at.desc())
        .all()
    )