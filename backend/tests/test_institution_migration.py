"""Legacy schema migration regression: disposable SQLite, no saved LMS records."""
import unittest
from sqlalchemy import create_engine, text, inspect
from sqlalchemy.orm import Session
import app.models
from app.database import Base
from app.models import User, Course, Enrollment, Submission, Attendance, QuizAttempt
from app.models.institution import Institution, Department
from scripts.migrate_institutions import migrate


class InstitutionMigrationTest(unittest.TestCase):
    def setUp(self):
        self.engine=create_engine("sqlite://")
        with self.engine.begin() as c:
            c.execute(text("""CREATE TABLE users (id INTEGER PRIMARY KEY, name VARCHAR NOT NULL,
                email VARCHAR UNIQUE NOT NULL, hashed_password VARCHAR NOT NULL, role VARCHAR NOT NULL,
                department VARCHAR, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)"""))
            c.execute(text("""CREATE TABLE courses (id INTEGER PRIMARY KEY, name VARCHAR NOT NULL,
                code VARCHAR UNIQUE NOT NULL, department VARCHAR, semester VARCHAR,
                faculty_id INTEGER REFERENCES users(id), created_at DATETIME DEFAULT CURRENT_TIMESTAMP)"""))
        Base.metadata.create_all(self.engine)
        with self.engine.begin() as c:
            c.execute(text("INSERT INTO users (id,name,email,hashed_password,role,department) VALUES (1,'Test admin','admin@hitam.org','unchanged-admin-hash','admin',NULL), (2,'Test faculty','faculty@hitam.org','unchanged-faculty-hash','faculty',' CS '), (3,'Test student','student@hitam.org','unchanged-student-hash','student','cs')"))
            c.execute(text("INSERT INTO courses (id,name,code,department,faculty_id) VALUES (7,'Test course','CS101','CS',2)"))
            c.execute(text("INSERT INTO enrollments (student_id,course_id) VALUES (3,7)"))
            c.execute(text("INSERT INTO assignments (id,course_id,title) VALUES (1,7,'Test work')"))
            c.execute(text("INSERT INTO submissions (id,assignment_id,student_id,marks_obtained,file_url) VALUES (1,1,3,86,'https://example.com/test')"))
            c.execute(text("INSERT INTO quizzes (id,course_id,title) VALUES (1,7,'Test quiz')"))
            c.execute(text("INSERT INTO quiz_attempts (quiz_id,student_id,score) VALUES (1,3,90)"))
            c.execute(text("INSERT INTO class_sessions (id,course_id,jitsi_room_id,fullscreen_required) VALUES (1,7,'unchanged-room',1)"))
            c.execute(text("INSERT INTO attendance (session_id,student_id,duration_minutes,present) VALUES (1,3,45,1)"))
        self.addCleanup(self.engine.dispose)

    def run_migration(self):
        with self.engine.connect() as c:
            c.exec_driver_sql("BEGIN IMMEDIATE")
            ident=migrate(c,"HITAM","hitam.org")
            c.commit()
            return ident

    def test_preserves_history_and_is_idempotent(self):
        ident=self.run_migration()
        self.assertEqual(self.run_migration(),ident)
        with Session(self.engine) as db:
            self.assertEqual(db.query(Institution).count(),1)
            self.assertIsNone(db.get(Institution,ident).email)
            self.assertEqual(db.query(Department).count(),1)
            self.assertEqual(db.get(User,3).hashed_password,"unchanged-student-hash")
            self.assertEqual(db.get(User,3).institution_id,ident)
            self.assertEqual(db.get(User,3).department,db.get(User,2).department)
            self.assertEqual(db.get(Course,7).faculty_id,2)
            self.assertEqual(db.get(Course,7).institution_id,ident)
            self.assertEqual(db.query(Enrollment).one().course_id,7)
            self.assertEqual(db.get(Submission,1).marks_obtained,86)
            self.assertEqual(db.query(Attendance).one().duration_minutes,45)
            self.assertEqual(db.query(QuizAttempt).one().score,90)
            other=Institution(name="Test other",email_domain="other.edu")
            db.add(other);db.flush()
            db.add(Course(name="Other institution course",code="CS101",institution_id=other.id))
            db.commit()
        with self.engine.connect() as c:
            self.assertIsNone(c.execute(text("PRAGMA foreign_key_check")).first())

    def test_custom_columns_are_not_dropped(self):
        with self.engine.begin() as c:
            c.execute(text("ALTER TABLE courses ADD COLUMN custom_information VARCHAR"))
            c.execute(text("UPDATE courses SET custom_information='preserve-me'"))
        with self.assertRaises(ValueError):
            self.run_migration()
        with self.engine.connect() as c:
            self.assertEqual(c.execute(text("SELECT custom_information FROM courses WHERE id=7")).scalar(),"preserve-me")
            self.assertNotIn("institution_id",{column["name"] for column in inspect(c).get_columns("users")})

    def test_different_legacy_owner_is_refused(self):
        self.run_migration()
        with self.engine.begin() as c:
            with self.assertRaises(ValueError):
                migrate(c,"Wrong owner","wrong.edu")


if __name__ == "__main__":
    unittest.main()
