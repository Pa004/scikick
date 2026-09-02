from __future__ import annotations

import json

from fastapi import APIRouter, HTTPException

from app.db.connection import get_connection
from app.api.schemas import (
    PredictRequest,
    PredictResponse,
    MarketProb,
    DoubleChance,
    OverUnder,
    BTTS,
)

router = APIRouter()


@router.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest):
    return _get_prediction(req.fixture_id)


@router.get("/predict/{fixture_id}", response_model=PredictResponse)
def get_prediction(fixture_id: int):
    return _get_prediction(fixture_id)


def _get_prediction(fixture_id: int) -> PredictResponse:
    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT f.id, f.league, f.prediction, f.home_team_id, f.away_team_id, "
            "t1.canonical_name as home_name, t2.canonical_name as away_name "
            "FROM fixtures f "
            "JOIN teams t1 ON f.home_team_id = t1.id "
            "JOIN teams t2 ON f.away_team_id = t2.id "
            "WHERE f.id = ?",
            (fixture_id,),
        ).fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="Fixture not found")

        if not row["prediction"]:
            raise HTTPException(
                status_code=404,
                detail="No prediction available for this fixture yet",
            )

        pred = json.loads(row["prediction"])
        probs = pred.get("probabilities", {})
        model_agreement = pred.get("model_agreement", 0.0)
        model_version = pred.get("model_version", "unknown")

        probabilities = {
            "1x2": MarketProb(
                home=probs.get("home", 0),
                draw=probs.get("draw", 0),
                away=probs.get("away", 0),
            ),
        }

        if "double_chance" in probs:
            dc = probs["double_chance"]
            probabilities["double_chance"] = DoubleChance(
                home_or_draw=dc.get("home_or_draw", 0),
                draw_or_away=dc.get("draw_or_away", 0),
                home_or_away=dc.get("home_or_away", 0),
            )

        if "over_under_2.5" in probs:
            ou = probs["over_under_2.5"]
            probabilities["over_under_2.5"] = OverUnder(
                over=ou.get("over", 0),
                under=ou.get("under", 0),
            )

        if "btts" in probs:
            btts = probs["btts"]
            probabilities["btts"] = BTTS(
                yes=btts.get("yes", 0),
                no=btts.get("no", 0),
            )

        for key in probs:
            if key not in ("home", "draw", "away", "double_chance", "over_under_2.5", "btts"):
                probabilities[key] = probs[key]

        return PredictResponse(
            fixture_id=fixture_id,
            model_version=model_version,
            model_agreement=model_agreement,
            probabilities=probabilities,
        )
    finally:
        conn.close()
