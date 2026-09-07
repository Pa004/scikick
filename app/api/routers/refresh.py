from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.deps import get_current_token
from app.config import get_settings
from app.ingestion.sync import sync_all_leagues

router = APIRouter()


@router.post("/refresh")
def refresh(token: str = Depends(get_current_token)):
    settings = get_settings()
    leagues = settings.leagues_initial.split(",")
    results = sync_all_leagues(leagues, 3)

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


def _short_error(raw: str) -> str:
    text = str(raw)
    if "Not a CSV" in text:
        return "Season file not published yet by the source."
    if "Failed to download" in text:
        return "Source temporarily unreachable."
    return text.split(":")[0][:120]
