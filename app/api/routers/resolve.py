from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException

from app.api.deps import get_current_token
from app.api.jobs import complete_job, create_job, get_job
from app.db.connection import get_connection
from app.models.pipeline import resolve_predictions

router = APIRouter()


def _do_resolve(job_id: str, league: str | None) -> None:
    conn = get_connection()
    try:
        count = resolve_predictions(conn, league)
        conn.commit()
        complete_job(job_id, result={"resolved": count, "league": league or "all"})
    except Exception as exc:  # noqa: BLE001 - surfaced via status endpoint
        conn.rollback()
        complete_job(job_id, error=str(exc))
    finally:
        conn.close()


@router.post("/resolve", status_code=202)
def resolve(
    background: BackgroundTasks,
    token: str = Depends(get_current_token),
    league: str | None = None,
):
    job_id, fresh = create_job(f"resolve:{league or 'all'}")
    if fresh:
        background.add_task(_do_resolve, job_id, league)
    job = get_job(job_id)
    return {"job_id": job_id, "status": "queued" if fresh else job["status"]}


@router.get("/resolve/status/{job_id}")
def resolve_status(job_id: str, token: str = Depends(get_current_token)):
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Unknown job")
    return job
