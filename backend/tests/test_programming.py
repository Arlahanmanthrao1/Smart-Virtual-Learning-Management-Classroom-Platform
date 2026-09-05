import unittest
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models
from app.core.security import create_access_token
from app.database import Base, get_db
from app.models import Course, Enrollment, Institution, ProgrammingSubmission, User, UserRole
from app.routers import programming


class ProgrammingAssessmentTest(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        self.db = sessionmaker(bind=self.engine)()
        self.db.add_all([Institution(id=1,name="Alpha",email_domain="alpha.edu"), Institution(id=2,name="Beta",email_domain="beta.edu")])
        self.db.flush()
        self.db.add_all([
            User(id=1,name="Faculty",email="faculty@alpha.edu",role=UserRole.faculty,department="CS",institution_id=1,hashed_password="unused"),
            User(id=2,name="Student",email="student@alpha.edu",role=UserRole.student,department="CS",institution_id=1,hashed_password="unused"),
            User(id=3,name="Other",email="other@alpha.edu",role=UserRole.student,department="CS",institution_id=1,hashed_password="unused"),
            User(id=4,name="Foreign",email="foreign@beta.edu",role=UserRole.faculty,department="CS",institution_id=2,hashed_password="unused"),
        ])
        self.db.flush()
        self.db.add_all([Course(id=1,name="Algorithms",code="CS1",faculty_id=1,department="CS",institution_id=1), Course(id=2,name="Foreign",code="CS2",faculty_id=4,department="CS",institution_id=2)])
        self.db.flush(); self.db.add(Enrollment(course_id=1,student_id=2)); self.db.commit()
        api = FastAPI(); api.include_router(programming.router); api.dependency_overrides[get_db] = lambda: self.db
        self.client = TestClient(api)
        self.addCleanup(self.engine.dispose); self.addCleanup(self.db.close); self.addCleanup(self.client.close)

    def request(self, method, path, user, json=None):
        return self.client.request(method,path,json=json,headers={"Authorization":"Bearer " + create_access_token({"sub":str(user)})})

    def create(self, user=1, course=1):
        return self.request("POST","/programming/assessments",user,json={"course_id":course,"title":"Add numbers","description":"Read two integers and print their sum.","allowed_languages":["python","c++"],"starter_code":"","test_cases":[{"stdin":"2 3\n","expected_output":"5\n","is_hidden":False},{"stdin":"10 7\n","expected_output":"17\n","is_hidden":True}]})

    def test_create_scope_and_hidden_cases(self):
        created = self.create()
        self.assertEqual(created.status_code,201,created.text)
        assessment_id = created.json()["id"]
        self.assertIn(self.create(user=4,course=1).status_code,(403,404))
        self.assertEqual(self.create(user=2).status_code,403)
        listed = self.request("GET","/programming/assessments",2).json()
        self.assertEqual([item["id"] for item in listed],[assessment_id])
        detail = self.request("GET",f"/programming/assessments/{assessment_id}",2).json()
        self.assertEqual(detail["test_cases"][0]["expected_output"],"5\n")
        self.assertIsNone(detail["test_cases"][1]["stdin"])
        self.assertIsNone(detail["test_cases"][1]["expected_output"])
        self.assertIn(self.request("GET",f"/programming/assessments/{assessment_id}",3).status_code,(403,404))

    @patch("app.routers.programming.time.sleep", return_value=None)
    @patch("app.routers.programming.execute_code")
    def test_run_and_submit_score_without_hidden_output(self, execute, _sleep):
        assessment_id = self.create().json()["id"]
        execute.return_value = {"output":"5\n","stderr":"","compile_output":"","status":None,"exit_code":0}
        run = self.request("POST","/programming/run",2,json={"assessment_id":assessment_id,"language":"python","source_code":"print(sum(map(int,input().split())))","stdin":"2 3\n"})
        self.assertEqual(run.status_code,200,run.text)
        execute.side_effect = [
            {"output":"5\n","stderr":"","compile_output":"","status":None,"exit_code":0},
            {"output":"0\n","stderr":"","compile_output":"","status":None,"exit_code":0},
        ]
        result = self.request("POST",f"/programming/assessments/{assessment_id}/submit",2,json={"language":"python","source_code":"print(sum(map(int,input().split())))"})
        self.assertEqual(result.status_code,201,result.text)
        self.assertEqual((result.json()["passed_count"],result.json()["score"]),(1,50.0))
        self.assertIsNone(result.json()["results"][1]["output"])
        self.assertIsNone(result.json()["results"][1]["expected_output"])
        self.assertIsNone(result.json()["results"][1]["stderr"])
        self.assertEqual(self.db.query(ProgrammingSubmission).count(),1)
        bad_language = self.request("POST","/programming/run",2,json={"assessment_id":assessment_id,"language":"java","source_code":"class Main {}","stdin":""})
        self.assertEqual(bad_language.status_code,422)


if __name__ == "__main__":
    unittest.main()
