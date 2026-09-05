"""One-time local bootstrap. Never deployed or exposed as an HTTP endpoint."""
import argparse
import getpass
import os
import re
import subprocess
import sys
import warnings
from urllib.parse import urlparse

import bcrypt
from email_validator import validate_email, EmailNotValidError
import psycopg


def validate_database_url(value):
    value = value.strip()
    if not value:
        raise ValueError("Nothing was received. Copy the connection string in Neon, then paste it before pressing Enter.")
    # Extract only the URL; wrappers such as psql or DATABASE_URL= are never run.
    urls = re.findall(r"postgres(?:ql)?://[^\s\"'<>`“”‘’]+", value, flags=re.IGNORECASE)
    if len(urls) != 1:
        raise ValueError("Expected one connection string beginning with postgresql://. A website address will not work.")
    url = urls[0].rstrip(";")
    try:
        parsed = urlparse(url)
        hostname = parsed.hostname
        port = parsed.port
    except ValueError:
        raise ValueError("The connection string has an invalid address. Copy a fresh one from Neon > Connect.") from None
    if not hostname or not hostname.endswith(".neon.tech"):
        raise ValueError("The database host is not a Neon host. Copy the connection string from Neon > Connect, not your Vercel website URL.")
    if not parsed.username or not parsed.password or not parsed.path.strip("/"):
        raise ValueError("The connection string is incomplete: it must include a username, password, and database name. Copy the full value from Neon > Connect.")
    return url


def database_url_from_clipboard():
    if os.name != "nt":
        raise ValueError("Clipboard mode is supported on Windows. Run without --clipboard on other systems.")
    try:
        result = subprocess.run(
            ["powershell.exe", "-NoProfile", "-NonInteractive", "-Command",
             "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-Clipboard -Raw"],
            capture_output=True, encoding="utf-8", timeout=10,
        )
        if result.returncode:
            raise ValueError
    except Exception:
        raise ValueError("Could not read the clipboard. Copy the Neon connection string and retry, or run without --clipboard.") from None
    return validate_database_url(result.stdout.lstrip("\ufeff"))


def create_first_admin(connection, name, email, password):
    """Caller owns the transaction; refuse to replace/promote any existing user."""
    if len(password) < 12 or len(password.encode("utf-8")) > 72:
        raise ValueError("Use a password with at least 12 characters and at most 72 UTF-8 bytes.")
    password_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("ascii")
    with connection.cursor() as cursor:
        # Serialize bootstrap attempts and account creation until commit.
        cursor.execute("LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE")
        cursor.execute("SELECT id FROM users WHERE role = 'admin' LIMIT 1")
        if cursor.fetchone():
            raise ValueError("An administrator already exists. No accounts were changed.")
        cursor.execute("SELECT id FROM users WHERE lower(email) = lower(%s)", (email,))
        if cursor.fetchone():
            raise ValueError("This email already belongs to an account. It was not changed or promoted.")
        cursor.execute(
            "INSERT INTO users (name, email, hashed_password, role) VALUES (%s, %s, %s, 'admin') RETURNING id",
            (name, email, password_hash),
        )
        return cursor.fetchone()[0]


def main():
    parser = argparse.ArgumentParser(description="Create the first administrator in the deployed Neon database.")
    parser.add_argument("--email", required=True)
    parser.add_argument("--clipboard", action="store_true", help="Read the copied Neon connection string privately from the Windows clipboard.")
    args = parser.parse_args()
    try:
        email = validate_email(args.email, check_deliverability=False).normalized.lower()
        name = input("Administrator name [Administrator]: ").strip() or "Administrator"
        if len(name) > 120:
            raise ValueError("Name must not exceed 120 characters.")
        print("Use the same Neon database you configured for the Vercel backend.")
        # Never fall back to visibly echoed input in a non-interactive terminal.
        with warnings.catch_warnings():
            warnings.simplefilter("error", getpass.GetPassWarning)
            if args.clipboard:
                input("Copy the Neon connection string now. Return here and press Enter (do not paste): ")
                url = database_url_from_clipboard()
                print("Neon connection string read from clipboard. Its value will not be displayed.")
            else:
                url = validate_database_url(getpass.getpass("Neon connection string (hidden; full psql command is also accepted): "))
            password = getpass.getpass("Choose an admin password (hidden, minimum 12 characters): ")
            confirmation = getpass.getpass("Confirm password (hidden): ")
        if password != confirmation:
            raise ValueError("Passwords do not match. No account was created.")
        print(f"Create the first administrator: {name} <{email}>")
        if input("Type CREATE to continue: ").strip() != "CREATE":
            print("Cancelled. No account was created.")
            return 1
        with psycopg.connect(url, sslmode="require", connect_timeout=15) as connection:
            with connection.cursor() as cursor:
                cursor.execute("SELECT to_regclass(\'public.institutions\')")
                if cursor.fetchone()[0] is not None:
                    raise ValueError("This database uses institution onboarding. Register a new institution through the application; existing institutions must use their administrator account.")
            create_first_admin(connection, name, email, password)
        print(f"Administrator created. Sign in as {email} using your chosen password.")
        print("https://smart-virtual-lms-frontend-ruby.vercel.app/login")
        return 0
    except (ValueError, EmailNotValidError) as error:
        print(str(error))
    except (KeyboardInterrupt, EOFError, getpass.GetPassWarning):
        print("Setup cancelled or hidden input unavailable. Run this command in a local PowerShell terminal.")
    except Exception:
        # Connection errors can include credentials/hostnames; never echo them.
        print("Setup failed. Check your Neon connection string and that the LMS schema exists. No existing account was overwritten.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
