import time

import httpx

from app.config import settings


LANGUAGE_IDS = {"c": 50, "c++": 54, "java": 62, "javascript": 63, "python": 71}


def execute_code(language: str, source_code: str, stdin: str = "") -> dict:
    headers = {}
    api_key = settings.code_runner_api_key.get_secret_value()
    if api_key:
        headers["X-Auth-Token"] = api_key
    try:
        base = settings.code_runner_url.rstrip("/")
        response = httpx.post(f"{base}/submissions?base64_encoded=false&wait=false", headers=headers, json={
            "language_id": LANGUAGE_IDS[language], "source_code": source_code, "stdin": stdin,
            "cpu_time_limit": settings.code_runner_timeout_ms / 1000,
            "wall_time_limit": max(2, settings.code_runner_timeout_ms / 1000 + 1),
        }, timeout=15.0)
        response.raise_for_status()
        token = response.json()["token"]
        payload = None
        for _ in range(20):
            time.sleep(0.35)
            result = httpx.get(f"{base}/submissions/{token}?fields=stdout,stderr,compile_output,message,status_id,status", headers=headers, timeout=15.0)
            result.raise_for_status()
            payload = result.json()
            if payload.get("status_id") not in (1, 2):
                break
        if not payload or payload.get("status_id") in (1, 2):
            raise RuntimeError("Code execution did not finish in time")
    except httpx.HTTPError as error:
        raise RuntimeError("The code runner is temporarily unavailable") from error
    return {
        "output": payload.get("stdout") or "",
        "stderr": payload.get("stderr") or payload.get("message") or "",
        "compile_output": payload.get("compile_output") or "",
        "status": (payload.get("status") or {}).get("description"),
        "exit_code": 0 if payload.get("status_id") == 3 else 1,
    }
