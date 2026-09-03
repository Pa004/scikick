from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.db.connection import get_connection
from app.api.schemas import ScorerPrediction, ScorerPlayer
from app.players.pipeline import predict_scorer

router = APIRouter()


@router.get("/predict/scorer/{fixture_id}", response_model=ScorerPrediction)
def get_scorer(fixture_id: int):
    conn = get_connection()
    try:
        fixture = conn.execute(
            "SELECT id, league FROM fixtures WHERE id = ?", (fixture_id,)
        ).fetchone()
        if not fixture:
            raise HTTPException(status_code=404, detail="Fixture not found")

        result = predict_scorer(conn, fixture_id, fixture["league"])
        if "error" in result:
            raise HTTPException(status_code=404, detail=result["error"])

        scorers = [
            ScorerPlayer(
                player_id=s["player_id"],
                name=s["name"],
                team=s["team"],
                position=s["position"],
                xg90=s["xg90"],
                min_expected=s["min_expected"],
                prob_anytime=s["prob_anytime"],
                home_away=s["home_away"],
            )
            for s in result.get("scorers", [])
        ]

        return ScorerPrediction(
            fixture_id=fixture_id,
            data_quality=result.get("data_quality", "lineup_unavailable"),
            scorers=scorers,
        )
    finally:
        conn.close()
