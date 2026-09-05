import httpx

from app.config import settings


def sync_attendance_to_erp(student_email: str, course_code: str, duration_minutes: float, present: bool, *, institution_id: int | None = None) -> None:
    """Pushes an attendance update to the college's (dummy) ERP system.

    Fire-and-forget: if the ERP is unreachable, we log it but never let
    that break attendance tracking inside the LMS itself. A real
    integration might instead queue failed syncs for retry.
    """
    # A shared ERP must never receive records from unrelated institutions.
    if not settings.erp_base_url or not institution_id or institution_id != settings.erp_institution_id:
        return
    try:
        httpx.post(
            f"{settings.erp_base_url}/api/attendance/sync",
            json={
                "student_email": student_email,
                "course_code": course_code,
                "duration_minutes": duration_minutes,
                "present": present,
            },
            timeout=3,
        )
    except httpx.RequestError as exc:
        print(f"[ERP sync] failed to reach ERP at {settings.erp_base_url}: {exc}")
