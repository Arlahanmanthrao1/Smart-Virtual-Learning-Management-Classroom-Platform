# Dummy College ERP

A standalone service simulating a college's pre-existing ERP system. It has
its own database and its own seeded student records — the LMS platform
pushes attendance updates into it via one API call, the way a real
integration with an existing college system would work.

## Setup

```bash
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 9000
```

Dashboard: `http://localhost:9000` (auto-refreshes every 5s)
JSON: `http://localhost:9000/api/attendance`

## Integration point

`POST /api/attendance/sync` — called automatically by the LMS backend's
`attendance.py` router every time it processes a Jitsi join/leave event.
Payload:

```json
{
  "student_email": "student1@college.edu",
  "course_code": "CS201",
  "duration_minutes": 30.0,
  "present": true
}
```

Students are matched between the two systems **by email** — see
`seed_students()` in `app/main.py`. A real integration would more likely
match on roll number or a shared college-wide student ID; this is a known
simplification worth a line in your project report.

## Why this is a separate service, not a module in `backend/`

This mirrors how it'd actually work in a real college: the ERP is someone
else's existing system, running independently, that your platform talks to
over HTTP. Keeping it as its own service (own port, own database) makes
that integration real and demoable, instead of just simulated in code.
