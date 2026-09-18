from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException

from app.api.deps import get_current_token
from app.api.jobs import complete_job, create_job, get_job
from app.config import get_settings
from app.ingestion.sync import sync_all_leagues

router = APIRouter()


def _summarize(results: list[dict]) -> dict:
    synced = [r for r in results if "error" not in r]
    errors = [
        {
            "league": r.get("league"),
            "season": r.get("season"),
            "error": _short_error(r.get("error", "")),
        }
        for r in results if "error" in r
    ]
    return {
        "synced": len(synced),
        "errors": len(errors),
        "error_details": errors,
        "results": synced,
        "message": (
            "Sync completed with errors. Retry later; sources may be temporarily unavailable."
            if errors else "Sync completed."
        ),
    }


def _do_refresh(job_id: str, leagues: list[str]) -> None:
    try:
        complete_job(job_id, result=_summarize(sync_all_leagues(leagues, 3)))
    except Exception as exc:  # noqa: BLE001 - surfaced via status endpoint
        complete_job(job_id, error=str(exc))


@router.post("/refresh", status_code=202)
def refresh(background: BackgroundTasks, token: str = Depends(get_current_token)):
    settings = get_settings()
    job_id, fresh = create_job("refresh")
    if fresh:
        background.add_task(_do_refresh, job_id, settings.leagues_initial.split(","))
    return {"job_id": job_id, "status": "queued" if fresh else get_job(job_id)["status"]}


@router.get("/refresh/status/{job_id}")
def refresh_status(job_id: str, token: str = Depends(get_current_token)):
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Unknown job")
    return job


def _short_error(raw: str) -> str:
    text = str(raw)
    if "Not a CSV" in text:
        return "Season file not published yet by the source."
    if "Failed to download" in text:
        return "Source temporarily unreachable."
    return text.split(":")[0][:120]
