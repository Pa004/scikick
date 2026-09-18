from __future__ import annotations

import threading
import time
import uuid
from typing import Any

# Tiny in-process job registry: long ops (sync, resolve) run in a
# FastAPI BackgroundTask after the 202 response instead of blocking the
# request thread against SQLite's single writer. One live job per name.
_lock = threading.Lock()
_jobs: dict[str, dict[str, Any]] = {}
_live: dict[str, str] = {}


def create_job(name: str) -> tuple[str, bool]:
    """Create (or reuse the live) job. Returns (job_id, fresh)."""
    with _lock:
        if name in _live:
            return _live[name], False
        job_id = uuid.uuid4().hex[:12]
        _jobs[job_id] = {
            "name": name,
            "status": "queued",
            "result": None,
            "error": None,
            "started_at": time.time(),
        }
        _live[name] = job_id
        return job_id, True


def complete_job(job_id: str, result: Any = None, error: str | None = None) -> None:
    with _lock:
        job = _jobs.get(job_id)
        if not job:
            return
        job.update(
            status="failed" if error else "done",
            result=result,
            error=error[:500] if error else None,
        )
        _live.pop(job["name"], None)


def get_job(job_id: str) -> dict[str, Any] | None:
    with _lock:
        job = _jobs.get(job_id)
        return dict(job) if job else None
