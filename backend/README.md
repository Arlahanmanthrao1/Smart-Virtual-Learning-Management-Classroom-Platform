# AI-Powered Smart Virtual LMS — backend

FastAPI backend scaffold for the Phase 1 feature set: authentication,
courses, attendance, assignments, and quizzes.

## Setup

For the video classroom, follow [JaaS Dev setup](JAAS_SETUP.md). JaaS credentials
must be supplied on the backend before meetings can connect.

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
| Attendance | `POST /attendance/event`, `GET /attendance/{course_id}/{student_id}` | Authenticated Jitsi join/leave events are paired into real elapsed durations and synchronized to the ERP. |
| Live sessions | `POST /attendance/sessions`, `PATCH /attendance/sessions/{id}/fullscreen`, `PATCH /attendance/sessions/{id}/end` | Faculty can control fullscreen policy and durably end a class for every connected student. |
| Assignments | `POST /assignments`, `GET /assignments/course/{id}`, `POST /assignments/submit`, `POST /assignments/submissions/{id}/grade` | Basic submit/grade flow. File upload itself isn't wired up yet — `file_url` currently expects a pre-uploaded URL (e.g. from S3). |
| Quizzes | `POST /quizzes`, `POST /quizzes/attempt` | Auto-grades multiple-choice attempts. |

## Roles

Faculty can open **My Courses → Manage enrolled students** to review and remove
enrollments. `GET /courses/{course_id}/students` and
`DELETE /courses/{course_id}/students/{student_id}` require the faculty owner of
that course. Removal requires confirmation in the UI and preserves the student
account, other enrollments, assignment submissions, quiz attempts, and attendance
history. It is not a ban: existing self-enrollment remains available, and removal
does not disconnect an ongoing video call. No database migration is needed.

`POST /auth/register` requires an authenticated administrator and creates only
students (a `role` field is rejected). Administrators use **Register student** in
their dashboard, then privately share the student's login details. No automatic
email is sent. Students have Login only; `/register` redirects to Login.
Administrators can also use **Create faculty** in their dashboard. It calls
`POST /auth/register-faculty`, which requires administrator access and creates only
faculty accounts using the same domain and password validation. Faculty use the
same login page and are directed to their teaching dashboard. Neither endpoint
accepts a client-selected role or creates HOD/admin accounts.
Existing accounts are unchanged; an initial administrator must be provisioned locally by an authorized
operator. Registration checks the configured domain, not mailbox ownership.
Further security review is needed before public deployment.

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
