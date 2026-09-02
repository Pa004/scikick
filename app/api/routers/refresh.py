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
    errors = [r for r in results if "error" in r]

    return {
        "synced": len(synced),
        "errors": len(errors),
        "results": results,
    }
