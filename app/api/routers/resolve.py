from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.deps import get_current_token
from app.db.connection import get_connection
from app.models.pipeline import resolve_predictions

router = APIRouter()


@router.post("/resolve")
def resolve(token: str = Depends(get_current_token), league: str | None = None):
    conn = get_connection()
    try:
        count = resolve_predictions(conn, league)
        return {"resolved": count, "league": league or "all"}
    finally:
        conn.close()
