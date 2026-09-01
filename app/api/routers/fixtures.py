from __future__ import annotations

from fastapi import APIRouter, HTTPException

router = APIRouter()


@router.get("/fixtures")
def list_fixtures(league: str = "E0", limit: int = 100):
    raise HTTPException(status_code=501, detail="Fixtures not yet implemented")
