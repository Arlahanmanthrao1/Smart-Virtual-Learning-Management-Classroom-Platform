"""Provision production settings via stdin; never print or persist secret values."""
import json
from pathlib import Path
import secrets
import shutil
import subprocess
import sys

from dotenv import dotenv_values
from cryptography.hazmat.primitives.serialization import load_pem_private_key

ROOT = Path(__file__).resolve().parents[2]
SCOPE = "arlahanmanthrao-gmailcoms-projects"
BACKEND = "prj_QgjoleYg59gu1mQmYjcZHdmFZnSw"
FRONTEND = "prj_W27QGTDmgzAZqxEN20YyhvbYRmAK"


def run(*args, cwd=None, value=None):
    result = subprocess.run([shutil.which("vercel.cmd") or shutil.which("vercel"), *args],
                            cwd=cwd or ROOT, input=value, text=True,
                            stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if result.returncode:
        raise RuntimeError("Vercel command failed; check the project settings in the console.")
    return result.stdout


def configure():
    identity = json.loads(run("api", "/v2/user", "--raw"))["user"]
    if identity["email"] != "arlahanmanthrao@gmail.com":
        raise RuntimeError("Wrong Vercel account; no settings were changed.")
    values = dotenv_values(ROOT / "backend/.env")
    key_path = Path(values.get("JAAS_PRIVATE_KEY_PATH") or "")
    if not key_path.is_absolute():
        key_path = ROOT / "backend" / key_path
    key = values.get("JAAS_PRIVATE_KEY") or key_path.read_text(encoding="utf-8")
    key = key.replace("\\n", "\n")
    load_pem_private_key(key.encode(), password=None)

    backend_values = {
        "SECRET_KEY": secrets.token_urlsafe(48),
        "ALLOWED_ORIGINS": "https://smart-virtual-lms-frontend-ruby.vercel.app",
        "VIDEO_PROVIDER": "jaas",
        "JAAS_APP_ID": values["JAAS_APP_ID"],
        "JAAS_API_KEY_ID": values["JAAS_API_KEY_ID"],
        "JAAS_PRIVATE_KEY": key,
        "ALLOWED_EMAIL_DOMAIN": values.get("ALLOWED_EMAIL_DOMAIN", "hitam.org"),
    }
    for folder, project_id, settings in [
        ("backend", BACKEND, backend_values),
        ("frontend", FRONTEND, {"VITE_API_BASE_URL": "https://smart-virtual-lms-backend-gules.vercel.app"}),
    ]:
        link = json.loads((ROOT / folder / ".vercel/project.json").read_text())
        if link["projectId"] != project_id:
            raise RuntimeError("Project linkage mismatch; stopping.")
        project = json.loads(run("api", f"/v9/projects/{project_id}", "--raw", "--scope", SCOPE))
        existing = {item["key"] for item in project.get("env", []) if "production" in item.get("target", [])}
        for name, value in settings.items():
            if name in existing:
                print(f"{folder}: preserved {name}")
                continue
            secret_flag = "--sensitive" if name in {"SECRET_KEY", "JAAS_PRIVATE_KEY"} else "--no-sensitive"
            run("env", "add", name, "production", secret_flag, "--yes", "--scope", SCOPE,
                cwd=ROOT / folder, value=value)
            print(f"{folder}: configured {name}")


if __name__ == "__main__":
    try:
        configure()
    except Exception:
        print("Configuration stopped. Verify account access and local JaaS settings. Secret details were suppressed.")
        sys.exit(1)
