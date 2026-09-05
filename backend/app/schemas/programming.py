from pydantic import BaseModel, Field, field_validator


SUPPORTED_LANGUAGES = {"python", "java", "c", "c++", "javascript"}


class ProgrammingTestCaseCreate(BaseModel):
    stdin: str = Field(default="", max_length=10000)
    expected_output: str = Field(min_length=1, max_length=10000)
    is_hidden: bool = False
    points: float = Field(default=1.0, gt=0, le=100)


class ProgrammingAssessmentCreate(BaseModel):
    course_id: int
    title: str = Field(min_length=2, max_length=200)
    description: str | None = Field(default=None, max_length=10000)
    allowed_languages: list[str] = Field(min_length=1, max_length=5)
    starter_code: str | None = Field(default=None, max_length=50000)
    test_cases: list[ProgrammingTestCaseCreate] = Field(min_length=1, max_length=5)

    @field_validator("title")
    @classmethod
    def validate_title(cls, value):
        if not value.strip():
            raise ValueError("Enter an assessment title")
        return value.strip()

    @field_validator("allowed_languages")
    @classmethod
    def validate_languages(cls, values):
        normalized = list(dict.fromkeys(value.lower().strip() for value in values))
        if any(value not in SUPPORTED_LANGUAGES for value in normalized):
            raise ValueError("Choose only Python, Java, C, C++, or JavaScript")
        return normalized


class CodeRunRequest(BaseModel):
    assessment_id: int
    language: str
    source_code: str = Field(min_length=1, max_length=50000)
    stdin: str = Field(default="", max_length=10000)


class CodeSubmitRequest(BaseModel):
    language: str
    source_code: str = Field(min_length=1, max_length=50000)
