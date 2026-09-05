import time

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.access import course_access, courses_query, resource_access
from app.core.deps import get_current_user, require_roles
from app.database import get_db
from app.integrations.code_runner import execute_code
from app.models.programming import ProgrammingAssessment, ProgrammingSubmission, ProgrammingTestCase
from app.models.user import User, UserRole
from app.schemas.programming import CodeRunRequest, CodeSubmitRequest, ProgrammingAssessmentCreate, SUPPORTED_LANGUAGES

router = APIRouter(prefix="/programming", tags=["programming assessments"])


def assessment_summary(item, course=None):
    return {
        "id": item.id, "course_id": item.course_id, "course_name": course.name if course else None,
        "course_code": course.code if course else None, "title": item.title,
        "description": item.description, "allowed_languages": item.allowed_languages,
        "starter_code": item.starter_code, "test_count": len(item.test_cases),
    }


def checked_language(assessment, language):
    normalized = language.lower().strip()
    if normalized not in SUPPORTED_LANGUAGES or normalized not in assessment.allowed_languages:
        raise HTTPException(422, "This language is not enabled for the assessment")
    return normalized


@router.post("/assessments", status_code=201)
def create_assessment(payload: ProgrammingAssessmentCreate, db: Session = Depends(get_db), current_user=Depends(require_roles(UserRole.faculty, UserRole.admin))):
    course = course_access(db, current_user, payload.course_id, manage=True)
    assessment = ProgrammingAssessment(course_id=course.id, title=payload.title.strip(), description=payload.description, allowed_languages=payload.allowed_languages, starter_code=payload.starter_code)
    db.add(assessment); db.flush()
    for position, test in enumerate(payload.test_cases):
        db.add(ProgrammingTestCase(assessment_id=assessment.id, position=position, **test.model_dump()))
    db.commit(); db.refresh(assessment)
    return assessment_summary(assessment, course)


@router.get("/assessments")
def list_assessments(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    courses = courses_query(db, current_user).all()
    by_id = {course.id: course for course in courses}
    if not by_id:
        return []
    assessments = db.query(ProgrammingAssessment).filter(ProgrammingAssessment.course_id.in_(by_id)).order_by(ProgrammingAssessment.created_at.desc()).all()
    return [assessment_summary(item, by_id[item.course_id]) for item in assessments]


@router.get("/course/{course_id}")
def course_assessments(course_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    course = course_access(db, current_user, course_id)
    return [assessment_summary(item, course) for item in db.query(ProgrammingAssessment).filter(ProgrammingAssessment.course_id == course_id).order_by(ProgrammingAssessment.created_at.desc()).all()]


@router.get("/assessments/{assessment_id}")
def get_assessment(assessment_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    item = resource_access(db, current_user, ProgrammingAssessment, assessment_id)
    course = course_access(db, current_user, item.course_id)
    result = assessment_summary(item, course)
    result["test_cases"] = [{
        "id": test.id, "position": test.position, "is_hidden": test.is_hidden,
        "stdin": None if test.is_hidden and current_user.role == UserRole.student else test.stdin,
        "expected_output": None if test.is_hidden and current_user.role == UserRole.student else test.expected_output,
        "points": test.points,
    } for test in sorted(item.test_cases, key=lambda test: test.position)]
    return result


@router.post("/run")
def run_code(payload: CodeRunRequest, db: Session = Depends(get_db), current_user=Depends(require_roles(UserRole.student))):
    assessment = resource_access(db, current_user, ProgrammingAssessment, payload.assessment_id)
    language = checked_language(assessment, payload.language)
    try:
        return execute_code(language, payload.source_code, payload.stdin)
    except RuntimeError as error:
        raise HTTPException(503, str(error)) from error


@router.post("/assessments/{assessment_id}/submit", status_code=201)
def submit_code(assessment_id: int, payload: CodeSubmitRequest, db: Session = Depends(get_db), current_user: User = Depends(require_roles(UserRole.student))):
    assessment = resource_access(db, current_user, ProgrammingAssessment, assessment_id)
    language = checked_language(assessment, payload.language)
    tests = sorted(assessment.test_cases, key=lambda test: test.position)
    if not tests:
        raise HTTPException(409, "This assessment has no test cases")
    results = []
    earned = 0.0
    total_points = sum(test.points for test in tests)
    try:
        for index, test in enumerate(tests):
            execution = execute_code(language, payload.source_code, test.stdin)
            passed = execution["exit_code"] == 0 and execution["output"].rstrip() == test.expected_output.rstrip()
            if passed:
                earned += test.points
            results.append({
                "case": index + 1, "hidden": test.is_hidden, "passed": passed,
                "output": None if test.is_hidden else execution["output"],
                "expected_output": None if test.is_hidden else test.expected_output,
                "stderr": None if test.is_hidden else execution["stderr"] or execution["compile_output"],
                "status": execution["status"],
            })
            if index < len(tests) - 1:
                time.sleep(0.21)
    except RuntimeError as error:
        raise HTTPException(503, str(error)) from error
    score = round((earned / total_points) * 100, 2)
    submission = ProgrammingSubmission(assessment_id=assessment.id, student_id=current_user.id, language=language, source_code=payload.source_code, passed_count=sum(1 for result in results if result["passed"]), total_count=len(tests), score=score, results=results)
    db.add(submission); db.commit(); db.refresh(submission)
    return {"id": submission.id, "passed_count": submission.passed_count, "total_count": submission.total_count, "score": score, "results": results}
