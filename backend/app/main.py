from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
import app.models  # noqa: F401 - imports every model so Base knows about all tables
from app.routers import auth, users, courses, attendance, assignments, quiz, materials

# Creates tables directly from the models - fine for local dev and demos.
# Swap for Alembic migrations if this ever needs to survive schema changes
# against real data.
Base.metadata.create_all(bind=engine)

app = FastAPI(title="AI-Powered Smart Virtual LMS", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten to your frontend's origin before deploying
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(courses.router)
app.include_router(attendance.router)
app.include_router(assignments.router)
app.include_router(quiz.router)
app.include_router(materials.router)


@app.get("/")
def health_check():
    return {"status": "ok", "service": "lms-backend"}