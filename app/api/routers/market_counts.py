from __future__ import annotations

import json

from fastapi import APIRouter, HTTPException

from app.db.connection import get_connection

router = APIRouter()


def _get_fixture_markets(fixture_id: int) -> dict:
    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT f.id, f.prediction "
            "FROM fixtures f WHERE f.id = ?",
            (fixture_id,),
        ).fetchone()
        if not row or not row["prediction"]:
            return {}
        pred = json.loads(row["prediction"])
        return pred.get("markets", {})
    finally:
        conn.close()


@router.get("/predict/{fixture_id}/corners")
def predict_corners(fixture_id: int):
    markets = _get_fixture_markets(fixture_id)
    if not markets:
        raise HTTPException(status_code=404, detail="No prediction available")
    corners = {k: v for k, v in markets.items() if k.startswith("corners_")}
    if not corners:
        raise HTTPException(status_code=404, detail="Corners markets not available for this fixture")
    return {"fixture_id": fixture_id, "market": "corners", "probabilities": corners}


@router.get("/predict/{fixture_id}/cards")
def predict_cards(fixture_id: int):
    markets = _get_fixture_markets(fixture_id)
    if not markets:
        raise HTTPException(status_code=404, detail="No prediction available")
    cards = {k: v for k, v in markets.items() if k.startswith("cards_")}
    if not cards:
        raise HTTPException(status_code=404, detail="Cards markets not available for this fixture")
    return {"fixture_id": fixture_id, "market": "cards", "probabilities": cards}
