# AI-Powered Smart Virtual LMS — backend

FastAPI backend scaffold for the Phase 1 feature set: authentication,
courses, attendance, assignments, and quizzes.

## Setup

```bash
python3 -m venv venv
source venv/bin/activate          # venv\Scripts\activate on Windows
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

Visit `http://localhost:8000/docs` for interactive API docs (Swagger UI) —
FastAPI generates this automatically from the routes and schemas.

## What's implemented

| Module | Endpoints | Notes |
|---|---|---|
| Auth | `POST /auth/register`, `POST /auth/login`, `GET /auth/me` | Registration is restricted to the `ALLOWED_EMAIL_DOMAIN` set in `.env`. Returns a JWT on login. |
| Courses | `POST/GET /courses`, `POST /courses/{id}/enroll` | Faculty/admin create courses, students enroll. |
| Attendance | `POST /attendance/event`, `GET /attendance/{course_id}/{student_id}` | Receives Jitsi join/leave events from the frontend. **The duration-tracking logic is a placeholder** — see the comment in `app/routers/attendance.py`. Replace with real join-timestamp-to-leave-timestamp deltas before this goes further. |
| Assignments | `POST /assignments`, `GET /assignments/course/{id}`, `POST /assignments/submit`, `POST /assignments/submissions/{id}/grade` | Basic submit/grade flow. File upload itself isn't wired up yet — `file_url` currently expects a pre-uploaded URL (e.g. from S3). |
| Quizzes | `POST /quizzes`, `POST /quizzes/attempt` | Auto-grades multiple-choice attempts. |

## Roles

Four roles live on the `User` model: `student`, `faculty`, `hod`, `admin`.
Route access is enforced with the `require_roles(...)` dependency in
`app/core/deps.py` — see any router for examples.

## Database

Defaults to SQLite (`lms.db`, created automatically) so the project runs
with zero setup. To switch to Postgres, just change `DATABASE_URL` in
`.env` to something like:

```
DATABASE_URL=postgresql://user:password@localhost:5432/lms
```

and add `psycopg2-binary` to `requirements.txt`. No code changes needed —
SQLAlchemy handles the rest.

Tables are created directly from the models on startup
(`Base.metadata.create_all`). That's fine for a student project; if you
need to evolve the schema without losing data later, introduce Alembic.

## Not yet built (Phase 2 — see the AI-services module in the diagram)

- Video embedding (Jitsi) on the frontend + wiring its IFrame API events
  into `POST /attendance/event`
- Lecture recording upload/storage
- Whisper transcription + LLM summarization pipeline
- Plagiarism similarity checker (`plagiarism_score` field already exists
  on `Submission`, ready to be populated)
- At-risk student scoring
- Staff analytics aggregation endpoints

## ERP integration (done)

Every time `/attendance/event` records or updates a student's attendance,
it pushes that update to a separate dummy ERP service via
`app/integrations/erp_client.py`. Run `erp-dummy/` alongside this backend
(see its README) to see attendance sync live. Set `ERP_BASE_URL` in `.env`
if the ERP isn't running on the default `http://localhost:9000`.

## Security notes before this goes anywhere near production

- Set a real, random `SECRET_KEY` in `.env` (don't commit it)
- Tighten CORS `allow_origins` in `app/main.py` to your actual frontend URL
- Add rate limiting on `/auth/login`
