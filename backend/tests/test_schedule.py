"""Scheduled-class behavior uses an empty, disposable in-memory database."""
from datetime import datetime, timedelta, timezone
import unittest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
import app.models
from app.database import Base, get_db
from app.core.security import create_access_token
from app.models import User, UserRole, Course, Enrollment, ScheduledClass, ClassSession
from app.models.institution import Institution
from app.routers import schedule, calendar, attendance


class ScheduleTest(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        self.db = sessionmaker(bind=self.engine)()
        self.db.add_all([Institution(id=1,name="Alpha",email_domain="alpha.edu"), Institution(id=2,name="Beta",email_domain="beta.edu")])
        self.db.flush()
        for ident, role, dept, inst in [(1,"faculty","CS",1),(2,"faculty","CS",1),(3,"student","CS",1),
                                       (4,"hod","CS",1),(5,"faculty","CS",2),(6,"student","CS",2),(7,"admin",None,1)]:
            self.db.add(User(id=ident,name=f"Test {ident}",email=f"test{ident}@example.edu",role=UserRole(role),department=dept,institution_id=inst,hashed_password="unused"))
        self.db.flush()
        self.db.add_all([Course(id=1,name="Owned",code="A1",faculty_id=1,department="CS",institution_id=1),
                         Course(id=2,name="Other",code="A2",faculty_id=2,department="CS",institution_id=1),
                         Course(id=3,name="Foreign",code="B1",faculty_id=5,department="CS",institution_id=2)])
        self.db.flush()
        self.db.add_all([Enrollment(course_id=1,student_id=3), Enrollment(course_id=3,student_id=6)])
        self.db.commit()
        api = FastAPI()
        api.include_router(schedule.router)
        api.include_router(calendar.router)
        api.include_router(attendance.router)
        api.dependency_overrides[get_db] = lambda: self.db
        self.client = TestClient(api)
        # Cleanup callbacks run in reverse order: client, session, then engine.
        self.addCleanup(self.engine.dispose); self.addCleanup(self.db.close); self.addCleanup(self.client.close)
        self.start = (datetime.now(timezone.utc) + timedelta(days=3)).replace(microsecond=0)

    def request(self, method, path, user, json=None, params=None):
        return self.client.request(method,path,json=json,params=params,headers={"Authorization":"Bearer " + create_access_token({"sub":str(user)})})

    def create(self, user=1, course=1, title="Planned class", start=None):
        return self.request("POST","/schedule",user,json={"course_id":course,"title":title,"starts_at":(start or self.start).isoformat()})

    def calendar(self, user):
        return self.request("GET","/calendar/events",user,params={"start":(self.start-timedelta(days=1)).isoformat(),"end":(self.start+timedelta(days=1)).isoformat()})

    def test_schedule_is_optional_plan_not_session(self):
        response = self.create()
        self.assertEqual(response.status_code,201,response.text)
        self.assertEqual(response.json()["status"],"scheduled")
        self.assertEqual(self.db.query(ClassSession).count(),0)
        self.assertEqual(self.request("GET","/schedule",1).json()[0]["title"],"Planned class")
        for user in (1,3,4):
            event = self.calendar(user).json()[0]
            self.assertEqual((event["status"],event["title"]),("scheduled","Planned class"))
        self.assertEqual(self.calendar(6).json(),[])

    def test_only_owning_faculty_can_create_start_or_cancel(self):
        plan = self.create().json()
        for user in (2,3,4,7):
            self.assertIn(self.create(user=user).status_code,(403,404))
            self.assertIn(self.request("POST",f"/schedule/{plan['id']}/start",user).status_code,(403,404))
            self.assertIn(self.request("POST",f"/schedule/{plan['id']}/cancel",user).status_code,(403,404))
        self.assertIn(self.create(user=1,course=3).status_code,(403,404))

    def test_start_is_idempotent_and_plan_disappears_after_end(self):
        plan = self.create().json()
        first = self.request("POST",f"/schedule/{plan['id']}/start",1)
        again = self.request("POST",f"/schedule/{plan['id']}/start",1)
        self.assertEqual(first.status_code,200,first.text)
        self.assertEqual(first.json()["id"],again.json()["id"])
        self.assertEqual(self.db.query(ClassSession).count(),1)
        self.assertEqual(self.request("GET","/schedule",1).json()[0]["status"],"live")
        events = self.calendar(3).json()
        self.assertEqual(len(events),1)
        self.assertEqual((events[0]["title"],events[0]["status"]),("Planned class","started"))
        session = self.db.get(ClassSession,first.json()["id"])
        session.ended_at = datetime.now(timezone.utc); self.db.commit()
        self.assertEqual(self.request("GET","/schedule",1).json(),[])
        self.assertEqual(self.request("GET","/attendance/sessions/1",1).json(),[])
        history = self.request("GET","/attendance/sessions/1?include_ended=true",1)
        self.assertEqual(history.status_code,200,history.text)
        self.assertEqual(history.json()[0]["id"],session.id)
        self.assertIsNotNone(history.json()[0]["ended_at"])
        self.assertEqual(self.calendar(3).json()[0]["status"],"ended")
        self.assertEqual(self.request("POST",f"/schedule/{plan['id']}/start",1).status_code,409)

    def test_cancelled_plan_leaves_no_attendance_session_or_calendar_event(self):
        plan = self.create().json()
        response = self.request("POST",f"/schedule/{plan['id']}/cancel",1)
        self.assertEqual(response.status_code,204,response.text)
        self.assertEqual(self.db.query(ClassSession).count(),0)
        self.assertEqual(self.calendar(3).json(),[])
        self.assertEqual(self.request("POST",f"/schedule/{plan['id']}/start",1).status_code,409)

    def test_validation_duplicate_and_active_class_conflict(self):
        self.assertEqual(self.create(title=" ").status_code,422)
        self.assertEqual(self.create(start=datetime.now(timezone.utc)-timedelta(minutes=1)).status_code,422)
        self.assertEqual(self.create(start=datetime.now(timezone.utc)+timedelta(days=367)).status_code,422)
        self.assertEqual(self.create().status_code,201)
        self.assertEqual(self.create().status_code,409)
        plan = self.create(start=self.start+timedelta(hours=1)).json()
        self.db.add(ClassSession(course_id=1,jitsi_room_id="existing-live")); self.db.commit()
        self.assertEqual(self.request("POST",f"/schedule/{plan['id']}/start",1).status_code,409)

    def test_cross_institution_schedule_directory_does_not_leak(self):
        self.create()
        own = self.create(user=5,course=3,start=self.start+timedelta(hours=2))
        self.assertEqual(own.status_code,201,own.text)
        self.assertEqual({item["course_id"] for item in self.request("GET","/schedule",1).json()},{1})
        self.assertEqual({item["course_id"] for item in self.request("GET","/schedule",5).json()},{3})
