from pydantic import BaseModel, ConfigDict


class QuestionCreate(BaseModel):
    text: str
    options: list[str]
    correct_option: int


class QuizCreate(BaseModel):
    course_id: int
    title: str
    total_marks: float = 100.0
    questions: list[QuestionCreate]


class QuizOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    course_id: int
    title: str
    total_marks: float


class QuestionSafeOut(BaseModel):
    """Question shape shown to students taking the quiz - deliberately
    omits correct_option so the answer never reaches the browser."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    text: str
    options: list[str]


class QuizDetailOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    course_id: int
    title: str
    total_marks: float
    questions: list[QuestionSafeOut]


class QuizAttemptCreate(BaseModel):
    quiz_id: int
    answers: dict[int, int]  # question_id -> selected option index