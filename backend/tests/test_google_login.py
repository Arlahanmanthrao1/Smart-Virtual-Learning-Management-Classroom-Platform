"""Disposable account fixtures and locally signed Google-token verification tests."""
import json
import time
import unittest
from types import SimpleNamespace
from unittest.mock import patch
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import FastAPI
from fastapi.testclient import TestClient
from google.auth.exceptions import TransportError
from jose import jwt
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models
from app.config import settings
from app.database import Base, get_db
from app.models import User, UserRole, GoogleIdentity
from app.models.institution import Institution
from app.routers import auth


class GoogleLoginTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        cls.private = key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption())
        cls.public = key.public_key().public_bytes(serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo).decode()

    def setUp(self):
        self.engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        self.db = sessionmaker(bind=self.engine)()
        self.db.add_all([Institution(id=1, name="Isolated Alpha", email_domain="alpha.edu"),
                         Institution(id=2, name="Isolated Beta", email_domain="beta.edu")])
        self.db.flush()
        for ident, domain, role in [(1,"alpha.edu",UserRole.student),(2,"beta.edu",UserRole.faculty)]:
            self.db.add(User(id=ident, name="Isolated test", email=f"test@{domain}", role=role,
                             institution_id=ident, hashed_password="unchanged-test-hash"))
        self.db.commit()
        api = FastAPI(); api.include_router(auth.router)
        api.dependency_overrides[get_db] = lambda: self.db
        self.client = TestClient(api)
        self.addCleanup(self.engine.dispose); self.addCleanup(self.db.close); self.addCleanup(self.client.close)
        for name, value in {"google_client_id":"test-client.apps.googleusercontent.com", "allowed_origins":"https://app.example.com",
                            "institution_login_hosts":{"ekeekrta.alpha.edu":"alpha.edu", "ekeekrta.beta.edu":"beta.edu"}}.items():
            setting = patch.object(settings, name, value); setting.start(); self.addCleanup(setting.stop)
        certs = SimpleNamespace(status=200, data=json.dumps({"test-key":self.public}).encode())
        transport = patch("app.core.google_login.GoogleRequest", return_value=lambda *a, **kw: certs)
        transport.start(); self.addCleanup(transport.stop)
        self.nonce = "a" * 64

    def token(self, changes=None, algorithm="RS256"):
        claims = {"iss":"https://accounts.google.com", "aud":settings.google_client_id, "sub":"google-subject-1",
                  "email":"test@alpha.edu", "hd":"alpha.edu", "email_verified":True, "nonce":self.nonce,
                  "iat":int(time.time())-10, "exp":int(time.time())+300}
        claims.update(changes or {})
        return jwt.encode(claims, self.private if algorithm == "RS256" else "not-google", algorithm=algorithm, headers={"kid":"test-key"})

    def login(self, changes=None, origin="https://app.example.com", extra=None, credential=None):
        return self.client.post("/auth/google", headers={"Origin":origin}, json={"credential":credential or self.token(changes),
                                                                              "nonce":self.nonce, **(extra or {})})

    def test_valid_google_login_preserves_role_and_password(self):
        response = self.login()
        self.assertEqual(response.status_code, 200, response.text)
        claims = jwt.decode(response.json()["access_token"], settings.secret_key, algorithms=[settings.algorithm])
        self.assertEqual((claims["sub"],claims["role"]), ("1","student"))
        self.assertEqual(self.db.get(GoogleIdentity,"google-subject-1").user_id, 1)
        self.assertEqual(self.db.get(User,1).hashed_password,"unchanged-test-hash")
        self.assertEqual(self.login().status_code,200)
        self.assertEqual(self.db.query(GoogleIdentity).count(),1)
        self.assertEqual(self.db.query(User).count(),2)

    def test_google_signature_audience_issuer_and_expiry_are_checked(self):
        for changes in [{"aud":"another-client"},{"iss":"https://attacker.invalid"},{"exp":int(time.time())-60},
                        {"iat":int(time.time())+300},{"nonce":"b"*64},{"nonce":"é"*64}]:
            with self.subTest(changes=changes): self.assertEqual(self.login(changes).status_code,401)
        self.assertEqual(self.login(credential=self.token(algorithm="HS256")).status_code,401)
        self.assertEqual(self.login(credential="not-a-token-but-long-enough").status_code,401)
        self.assertEqual(self.db.query(GoogleIdentity).count(),0)

    def test_personal_unverified_and_non_managed_accounts_are_denied(self):
        for changes in [{"email":"test@gmail.com","hd":None},{"hd":None},{"email_verified":False},
                        {"email_verified":"true"},{"hd":"other.edu"},{"sub":""}]:
            with self.subTest(changes=changes): self.assertEqual(self.login(changes).status_code,403)

    def test_no_account_creation_or_privilege_injection(self):
        self.assertEqual(self.login({"email":"new@alpha.edu"}).status_code,403)
        self.assertEqual(self.login(extra={"role":"admin"}).status_code,422)
        self.assertEqual(self.login(extra={"institution_id":2}).status_code,422)
        self.assertEqual(self.db.query(User).count(),2)

    def test_custom_portal_enforces_college_and_binds_session(self):
        self.assertEqual(self.login(origin="https://ekeekrta.beta.edu").status_code,403)
        response = self.login(origin="https://ekeekrta.alpha.edu")
        self.assertEqual(response.status_code,200,response.text)
        token = response.json()["access_token"]
        self.assertEqual(self.client.get("/auth/me",headers={"Origin":"https://ekeekrta.alpha.edu","Authorization":f"Bearer {token}"}).status_code,200)
        self.assertEqual(self.client.get("/auth/me",headers={"Origin":"https://ekeekrta.beta.edu","Authorization":f"Bearer {token}"}).status_code,401)

    def test_binding_cannot_be_replaced_or_moved(self):
        self.assertEqual(self.login().status_code,200)
        self.assertEqual(self.login({"sub":"different-google-user"}).status_code,403)
        self.assertEqual(self.login({"email":"test@beta.edu","hd":"beta.edu"}).status_code,403)
        self.assertEqual(self.db.query(GoogleIdentity).count(),1)

    def test_json_and_origin_required_for_google_callback(self):
        self.assertEqual(self.login(origin="https://attacker.invalid").status_code,403)
        self.assertEqual(self.login(origin="null").status_code,403)
        response=self.client.post("/auth/google",json={"credential":self.token(),"nonce":self.nonce})
        self.assertEqual(response.status_code,403)
        self.assertNotEqual(self.client.post("/auth/google",headers={"Origin":"https://app.example.com"},data={"credential":self.token(),"nonce":self.nonce}).status_code,200)

    def test_missing_config_and_google_outage_do_not_leak_credentials(self):
        with patch.object(settings,"google_client_id",""):
            self.assertEqual(self.client.get("/auth/google/config").json(),{"client_id":None})
            self.assertEqual(self.login().status_code,503)
        with patch("app.core.google_login.id_token.verify_oauth2_token",side_effect=TransportError("private diagnostic")):
            response=self.login();self.assertEqual(response.status_code,503)
            self.assertNotIn("private diagnostic",response.text)
        self.assertEqual(self.client.get("/auth/google/config").headers["cache-control"],"no-store")

    def test_unassigned_account_is_denied(self):
        self.db.get(User,1).institution_id=None;self.db.commit()
        self.assertEqual(self.login().status_code,403)


if __name__ == "__main__":
    unittest.main()
