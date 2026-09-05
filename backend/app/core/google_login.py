from hmac import compare_digest
from fastapi import HTTPException, Request
from google.auth.exceptions import GoogleAuthError, TransportError
from google.auth.transport.requests import Request as GoogleRequest
from google.oauth2 import id_token

from app.config import settings
from app.core.institution_domains import configured_login_origins, request_login_host


def google_browser_context(request: Request):
    # GIS popup callback posts JSON; this endpoint never accepts Google's form
    # redirect mode and never sets cookies or accepts a redirect URL.
    origins = {value.strip().rstrip("/") for value in settings.allowed_origins.split(",") if value.strip()}
    origins.update(configured_login_origins())
    if request.headers.get("origin") not in origins:
        raise HTTPException(403, "Use the EKEEKRTA sign-in page to continue with Google")
    if request.headers.get("content-type", "").split(";")[0].strip() != "application/json":
        raise HTTPException(415, "Google sign-in requires a JSON request")
    return request_login_host(request)


def verify_google_credential(credential: str, nonce: str) -> dict:
    if not settings.google_client_id:
        raise HTTPException(503, "Google sign-in is not configured yet. Please use your password.")
    transport = GoogleRequest()

    def bounded_request(*args, **kwargs):
        kwargs["timeout"] = 8
        return transport(*args, **kwargs)

    try:
        claims = id_token.verify_oauth2_token(credential, bounded_request, audience=settings.google_client_id)
    except TransportError:
        raise HTTPException(503, "Google verification is temporarily unavailable. Please try again or use your password.") from None
    except (GoogleAuthError, ValueError, TypeError, KeyError):
        raise HTTPException(401, "Google sign-in could not be verified. Please try again.") from None
    token_nonce = claims.get("nonce")
    if not isinstance(token_nonce, str) or not token_nonce.isascii() or not compare_digest(token_nonce, nonce):
        raise HTTPException(401, "Google sign-in expired or does not match this attempt. Please try again.")
    subject, email, domain = claims.get("sub"), claims.get("email"), claims.get("hd")
    if (claims.get("email_verified") is not True or not isinstance(subject, str) or not 1 <= len(subject) <= 255
            or not isinstance(email, str) or email.count("@") != 1 or not isinstance(domain, str) or not domain
            or email.rsplit("@", 1)[1].lower() != domain.lower() or domain.lower() in ("gmail.com", "googlemail.com")):
        raise HTTPException(403, "Use your institution-managed Google college account, not a personal Google account.")
    return {"subject": subject, "email": email.lower(), "domain": domain.lower()}
