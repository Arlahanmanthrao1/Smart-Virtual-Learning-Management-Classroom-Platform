from sqlalchemy import Column, Integer, String, ForeignKey, Float, JSON, DateTime, func
from sqlalchemy.orm import relationship

from app.database import Base


class Quiz(Base):
    __tablename__ = "quizzes"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)
    title = Column(String, nullable=False)
    total_marks = Column(Float, default=100.0)

    course = relationship("Course")
    questions = relationship("Question", back_populates="quiz")


class Question(Base):
    __tablename__ = "questions"

    id = Column(Integer, primary_key=True, index=True)
    quiz_id = Column(Integer, ForeignKey("quizzes.id"), nullable=False)
    text = Column(String, nullable=False)
    options = Column(JSON, nullable=False)  # list[str]
    correct_option = Column(Integer, nullable=False)  # index into options

    quiz = relationship("Quiz", back_populates="questions")


class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"

    id = Column(Integer, primary_key=True, index=True)
    quiz_id = Column(Integer, ForeignKey("quizzes.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    score = Column(Float, default=0.0)
    submitted_at = Column(DateTime(timezone=True), server_default=func.now())

    quiz = relationship("Quiz")
    student = relationship("User")
