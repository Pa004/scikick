from __future__ import annotations

import json

from fastapi import APIRouter, HTTPException

from app.db.connection import get_connection
from app.models.rare_events import fit_rare_events, predict_rare_events

router = APIRouter()


@router.get("/predict/rare-events/{fixture_id}")
def get_rare_events(fixture_id: int) -> dict:
    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT f.id, f.league, f.prediction "
            "FROM fixtures f WHERE f.id = ?",
            (fixture_id,),
        ).fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="Fixture not found")

        if not row["prediction"]:
            raise HTTPException(
                status_code=404,
                detail="No prediction available for this fixture yet",
            )

        league = row["league"]
        params = fit_rare_events(league)
        result = predict_rare_events(params)
        result["fixture_id"] = fixture_id
        result["league"] = league
        return result
    finally:
        conn.close()
