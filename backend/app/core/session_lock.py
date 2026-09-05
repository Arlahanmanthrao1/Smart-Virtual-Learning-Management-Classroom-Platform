from app.models.course import Course


def lock_course_sessions(db, course_id):
    # A no-op update obtains a write lock on both SQLite and PostgreSQL.
    # All class-start paths take this lock before inspecting active sessions.
    # It changes no course data and is released by commit/rollback.
    db.query(Course).filter(Course.id == course_id).update(
        {Course.id: Course.id}, synchronize_session=False,
    )
