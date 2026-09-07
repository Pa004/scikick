from __future__ import annotations

import json

from fastapi import APIRouter, HTTPException

from app.api.schemas import ValueRequest, ValueResponse
from app.db.connection import get_connection
from app.models.value import evaluate_outcome

router = APIRouter()


@router.post("/value", response_model=ValueResponse)
def compute_value(req: ValueRequest):
    if req.odds is not None and min(req.odds.home, req.odds.draw, req.odds.away) <= 1.0:
        raise HTTPException(status_code=422, detail="Odds must be greater than 1.0")

    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT prediction FROM fixtures WHERE id = ?", (req.fixture_id,)
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Fixture not found")
        if not row["prediction"]:
            raise HTTPException(
                status_code=404,
                detail="No prediction available for this fixture yet",
            )
        probs = json.loads(row["prediction"]).get("markets", {}).get("1x2")
        if not probs:
            raise HTTPException(status_code=404, detail="No 1x2 probabilities stored")

        if req.odds is not None:
            given = {"home": req.odds.home, "draw": req.odds.draw, "away": req.odds.away}
        else:
            stored = conn.execute(
                "SELECT home, draw, away, bookmaker FROM fixture_odds "
                "WHERE fixture_id = ? ORDER BY fetched_at DESC LIMIT 1",
                (req.fixture_id,),
            ).fetchone()
            if not stored:
                raise HTTPException(
                    status_code=404, detail="No stored odds for this fixture yet"
                )
            given = {"home": stored["home"], "draw": stored["draw"], "away": stored["away"]}
    finally:
        conn.close()

    outcomes = {
        side: evaluate_outcome(float(probs[side]), float(given[side]))
        for side in ("home", "draw", "away")
    }
    return ValueResponse(fixture_id=req.fixture_id, outcomes=outcomes)
