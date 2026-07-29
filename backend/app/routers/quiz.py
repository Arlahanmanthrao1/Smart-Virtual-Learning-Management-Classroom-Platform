from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.quiz import Quiz, Question, QuizAttempt
from app.models.user import User, UserRole
from app.schemas.quiz import QuizCreate, QuizOut, QuizDetailOut, QuizAttemptCreate
from app.core.deps import get_current_user, require_roles

router = APIRouter(prefix="/quizzes", tags=["quizzes"])


@router.post("/", response_model=QuizOut, status_code=201)
def create_quiz(
    quiz_in: QuizCreate,
    db: Session = Depends(get_db),
    _=Depends(require_roles(UserRole.faculty, UserRole.admin)),
):
    quiz = Quiz(course_id=quiz_in.course_id, title=quiz_in.title, total_marks=quiz_in.total_marks)
    db.add(quiz)
    db.commit()
    db.refresh(quiz)

    for q in quiz_in.questions:
        db.add(Question(quiz_id=quiz.id, text=q.text, options=q.options, correct_option=q.correct_option))
    db.commit()
    return quiz


@router.get("/course/{course_id}", response_model=list[QuizOut])
def list_quizzes(course_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    """Powers the quiz list on the student dashboard."""
    return db.query(Quiz).filter(Quiz.course_id == course_id).all()


@router.get("/{quiz_id}", response_model=QuizDetailOut)
def get_quiz(quiz_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    """Fetches a quiz with its questions for a student to take - options
    are included, correct_option is not (see QuestionSafeOut)."""
    quiz = db.query(Quiz).filter(Quiz.id == quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    return quiz


@router.post("/attempt")
def attempt_quiz(
    attempt_in: QuizAttemptCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.student)),
):
    questions = db.query(Question).filter(Question.quiz_id == attempt_in.quiz_id).all()
    if not questions:
        raise HTTPException(status_code=404, detail="Quiz not found or has no questions")

    correct = sum(1 for q in questions if attempt_in.answers.get(q.id) == q.correct_option)
    score = (correct / len(questions)) * 100

    attempt = QuizAttempt(quiz_id=attempt_in.quiz_id, student_id=current_user.id, score=score)
    db.add(attempt)
    db.commit()
    db.refresh(attempt)
    return {"score": score, "correct": correct, "total": len(questions)}