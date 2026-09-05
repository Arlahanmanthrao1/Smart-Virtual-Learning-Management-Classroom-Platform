"""Local/operator-only bootstrap for a migrated institution with no administrator.

New institutions should use the onboarding page instead. Never promote or replace
an existing account. The configured DATABASE_URL selects the database.
"""
import argparse
import getpass
import sys
import warnings
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sqlalchemy import func, text
from app.database import SessionLocal
from app.models.institution import Institution
from app.models.user import User, UserRole
from app.schemas.user import UserCreate
from app.core.security import hash_password


def bootstrap(db, domain, details):
    if len(details.password) < 12:
        raise ValueError("Administrator password must contain at least 12 characters")
    if db.bind.dialect.name == "postgresql":
        db.execute(text("LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE"))
    institution = db.query(Institution).filter(Institution.email_domain == domain).first()
    if not institution:
        raise ValueError("Institution not found. Complete the migration first.")
    if details.email.split("@")[-1] != domain:
        raise ValueError("Administrator email must use the institution domain")
    if db.query(User).filter(User.institution_id == institution.id, User.role == UserRole.admin).first():
        raise ValueError("This institution already has an administrator. Nothing was changed.")
    if db.query(User).filter(func.lower(User.email) == details.email).first():
        raise ValueError("This email already belongs to an account. It will not be promoted or overwritten.")
    account=User(name=details.name, email=details.email, hashed_password=hash_password(details.password),
                 role=UserRole.admin, institution_id=institution.id)
    db.add(account)
    db.flush()
    return account


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--domain",required=True)
    parser.add_argument("--email",required=True)
    args=parser.parse_args()
    domain=args.domain.strip().lower().lstrip("@")
    with SessionLocal() as db:
        institution=db.query(Institution).filter(Institution.email_domain == domain).first()
        if not institution:
            raise ValueError("Institution not found. Complete the migration first.")
        print(f"Database type: {db.bind.dialect.name}. Institution: {institution.name} (@{domain})")
        name=input("Administrator full name: ")
        with warnings.catch_warnings():
            warnings.simplefilter("error",getpass.GetPassWarning)
            password=getpass.getpass("New password (hidden, at least 12 characters): ")
            if password != getpass.getpass("Confirm password (hidden): "):
                raise ValueError("Passwords do not match")
        # Do not echo Pydantic errors: they can include the password input.
        try:
            details=UserCreate(name=name,email=args.email,password=password)
        except Exception:
            raise ValueError("Invalid name, email or password. Password must fit within 72 UTF-8 bytes.") from None
        if input("Type CREATE to create this institution's first administrator: ") != "CREATE":
            print("Cancelled. No account was created.")
            return
        bootstrap(db,domain,details)
        db.commit()
        print("Administrator created. Use the normal application login page.")


if __name__ == "__main__":
    try:
        main()
    except ValueError as error:
        print(str(error));sys.exit(1)
    except (KeyboardInterrupt,EOFError,getpass.GetPassWarning):
        print("Cancelled. Use an interactive local terminal for hidden password entry.");sys.exit(1)
    except Exception:
        print("Setup failed. Check the database configuration and institution migration. No existing account was replaced.");sys.exit(1)
