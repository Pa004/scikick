from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.db.connection import get_connection

router = APIRouter()


@router.get("/predict/{fixture_id}/first-half")
def predict_first_half(fixture_id: int):
    conn = get_connection()
    row = conn.execute(
        "SELECT id, prediction FROM fixtures WHERE id = ?", (fixture_id,)
    ).fetchone()
    conn.close()

    if not row:
        raise HTTPException(404, "Fixture not found")

    prediction = row["prediction"]
    if not prediction:
        raise HTTPException(404, "No prediction yet")

    import json
    pred = json.loads(prediction) if isinstance(prediction, str) else prediction
    markets = pred.get("markets", {})

    ht_keys = ["ht_1x2", "ht_double_chance", "ht_over_under_0.5", "ht_over_under_1.5", "ht_over_under_2.5"]
    ht_markets = {k: markets[k] for k in ht_keys if k in markets}

    if not ht_markets:
        raise HTTPException(404, "No first-half markets available")

    return {"fixture_id": fixture_id, "half": "first", "markets": ht_markets}


@router.get("/predict/{fixture_id}/half-time-full-time")
def predict_half_time_full_time(fixture_id: int):
    conn = get_connection()
    row = conn.execute(
        "SELECT id, prediction FROM fixtures WHERE id = ?", (fixture_id,)
    ).fetchone()
    conn.close()

    if not row:
        raise HTTPException(404, "Fixture not found")

    prediction = row["prediction"]
    if not prediction:
        raise HTTPException(404, "No prediction yet")

    import json
    pred = json.loads(prediction) if isinstance(prediction, str) else prediction
    markets = pred.get("markets", {})

    htft_keys = [k for k in markets if k.startswith("ft_result_given_ht") or k.startswith("ht_") and "_ft_" in k]
    htft_markets = {k: markets[k] for k in htft_keys}

    if not htft_markets:
        raise HTTPException(404, "No half-time/full-time markets available")

    return {"fixture_id": fixture_id, "type": "ht-ft", "markets": htft_markets}


@router.get("/predict/{fixture_id}/combo/{tipo}")
def predict_combo(fixture_id: int, tipo: str):
    conn = get_connection()
    row = conn.execute(
        "SELECT id, prediction FROM fixtures WHERE id = ?", (fixture_id,)
    ).fetchone()
    conn.close()

    if not row:
        raise HTTPException(404, "Fixture not found")

    prediction = row["prediction"]
    if not prediction:
        raise HTTPException(404, "No prediction yet")

    import json
    pred = json.loads(prediction) if isinstance(prediction, str) else prediction
    markets = pred.get("markets", {})

    if tipo == "ht-ft":
        htft_keys = [k for k in markets if k.startswith("ft_result_given_ht") or (k.startswith("ht_") and "_ft_" in k)]
        return {"fixture_id": fixture_id, "type": "ht-ft", "markets": {k: markets[k] for k in htft_keys}}
    elif tipo == "both-halves":
        bh = markets.get("both_halves", {})
        return {"fixture_id": fixture_id, "type": "both-halves", "markets": bh}
    else:
        raise HTTPException(400, f"Unknown combo type: {tipo}")
