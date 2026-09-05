"""Calendar checks use disposable SQLite fixtures only."""
from datetime import datetime, timezone
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
import unittest
import app.models
from app.database import Base, get_db
from app.core.security import create_access_token
from app.models import User, UserRole, Course, Enrollment, Assignment, ClassSession
from app.models.institution import Institution
from app.routers import calendar, assignments


class CalendarTest(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        self.db = sessionmaker(bind=self.engine)()
        self.db.add_all([Institution(id=1, name="Test A", email_domain="alpha.edu"), Institution(id=2, name="Test B", email_domain="beta.edu")])
        self.db.flush()
        for ident, role, dept, institution in [(1,"student","CS",1),(2,"faculty","CS",1),(3,"hod","CS",1),
                                               (4,"faculty","CS",1),(5,"faculty","EC",1),(6,"faculty","CS",2),
                                               (7,"hod",None,1),(8,"admin",None,1),(9,"student","CS",1)]:
            self.db.add(User(id=ident, name="Test", email=f"test{ident}@alpha.edu", role=UserRole(role),
                             department=dept, institution_id=institution, hashed_password="unused"))
        self.db.flush()
        for ident, owner, dept, inst in [(1,2,"CS",1),(2,4,"CS",1),(3,5,"EC",1),(4,6,"CS",2)]:
            self.db.add(Course(id=ident, name=f"Course {ident}", code=f"C{ident}", faculty_id=owner, department=dept, institution_id=inst))
        self.db.flush()
        self.db.add(Enrollment(student_id=1, course_id=1))
        for ident in range(1,5):
            self.db.add(Assignment(course_id=ident, title="Deadline", due_date=datetime(2026,9,4,10,tzinfo=timezone.utc)))
            self.db.add(ClassSession(course_id=ident, jitsi_room_id=f"PRIVATE-{ident}", scheduled_at=datetime(2026,9,4,9,tzinfo=timezone.utc)))
        self.db.add(Assignment(course_id=1, title="No date"))
        self.db.add(Assignment(course_id=1, title="End boundary", due_date=datetime(2026,10,1,tzinfo=timezone.utc)))
        self.db.commit()
        api = FastAPI()
        api.include_router(calendar.router)
        api.include_router(assignments.router)
        api.dependency_overrides[get_db] = lambda: self.db
        self.client = TestClient(api)
        self.addCleanup(self.engine.dispose)
        self.addCleanup(self.db.close)
        self.addCleanup(self.client.close)

    def get(self, user=1, **dates):
        return self.client.get("/calendar/events", params=dates or {"start":"2026-09-01T00:00:00Z", "end":"2026-10-01T00:00:00Z"},
                               headers={"Authorization":"Bearer " + create_access_token({"sub":str(user)})} if user else {})

    def test_scopes_and_no_private_meeting_details(self):
        for user, expected in [(1,{1}),(2,{1}),(3,{1,2}),(4,{2}),(5,{3}),(6,{4}),(7,set()),(9,set())]:
            with self.subTest(user=user):
                response = self.get(user)
                self.assertEqual(response.status_code,200,response.text)
                self.assertEqual({item["course_id"] for item in response.json()},expected)
                self.assertEqual(len(response.json()),len(expected)*2)
                self.assertNotIn("PRIVATE",response.text)
                self.assertEqual(response.headers["cache-control"],"no-store")

    def test_auth_and_role_required(self):
        self.assertEqual(self.get(0).status_code,401)
        self.assertEqual(self.get(8).status_code,403)

    def test_invalid_ranges(self):
        for start,end in [("bad","bad"),("2026-09-01","2026-10-01"),
                          ("2026-09-01T00:00:00Z","2026-09-01T00:00:00Z"),
                          ("2026-09-01T00:00:00Z","2026-08-01T00:00:00Z"),
                          ("2026-09-01T00:00:00Z","2027-09-01T00:00:00Z")]:
            self.assertEqual(self.get(start=start,end=end).status_code,422)

    def test_timezone_boundaries_and_order(self):
        response = self.get(start="2026-09-04T14:30:00+05:30",end="2026-09-04T15:30:00+05:30")
        self.assertEqual([item["kind"] for item in response.json()],["class"])
        data = self.get().json()
        self.assertEqual([item["kind"] for item in data],["class","assignment"])
        self.assertTrue(data[0]["starts_at"].endswith("Z"))

    def test_removed_enrollment_revokes_calendar(self):
        self.db.query(Enrollment).delete()
        self.db.commit()
        self.assertEqual(self.get().json(),[])

    def test_posted_deadline_appears_in_calendar_in_utc(self):
        response = self.client.post("/assignments/", json={"course_id":1,"title":"New deadline","due_date":"2026-09-15T01:00:00+05:30"},
                                    headers={"Authorization":"Bearer " + create_access_token({"sub":"2"})})
        self.assertEqual(response.status_code,201,response.text)
        event = next(item for item in self.get().json() if item["title"] == "New deadline")
        self.assertEqual(event["starts_at"],"2026-09-14T19:30:00Z")

    def test_unassigned_institution_fails_closed(self):
        self.db.get(User,1).institution_id = None
        self.db.commit()
        self.assertEqual(self.get().status_code,403)
