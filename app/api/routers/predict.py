from __future__ import annotations

import json
from pathlib import Path

import joblib
import numpy as np
from fastapi import APIRouter, HTTPException

from app.db.connection import get_connection
from app.api.schemas import (
    PredictRequest,
    PredictResponse,
    MarketProb,
    DoubleChance,
    OverUnder,
    BTTS,
    TopFeature,
)
from app.models.explain import build_explainer, top_features
from app.models.lightgbm_model import _FEATURE_COLS

router = APIRouter()

_RUNS_DIR = Path(__file__).resolve().parent.parent.parent.parent / "data" / "runs"


def _load_latest_ensemble(league: str):
    run_dir = _RUNS_DIR / league
    if not run_dir.exists():
        return None
    ensemble_files = sorted(run_dir.glob("ensemble_*.joblib"))
    if not ensemble_files:
        return None
    try:
        return joblib.load(ensemble_files[-1])
    except Exception:
        return None


def _get_feature_row(conn, fixture_id: int, league: str, home_team_id: int, away_team_id: int):
    feat_row = conn.execute(
        "SELECT * FROM match_features WHERE fixture_id = ?",
        (fixture_id,),
    ).fetchone()
    if not feat_row:
        return None
    return {col: feat_row[col] for col in feat_row.keys() if col in _FEATURE_COLS}


def _get_probable_score(probs: dict) -> dict[str, int] | None:
    exact = probs.get("exact_score", {})
    if not exact:
        return None
    best = max(exact.items(), key=lambda kv: kv[1])
    score_str = best[0]
    parts = score_str.split("-")
    if len(parts) == 2:
        try:
            return {"home": int(parts[0]), "away": int(parts[1])}
        except ValueError:
            return None
    return None


def _compute_top_features(league: str, feature_row: dict) -> list[TopFeature] | None:
    ensemble = _load_latest_ensemble(league)
    if not ensemble or not feature_row:
        return None
    try:
        explainer = build_explainer(ensemble)
        X_row = np.array([[feature_row.get(f, 0.0) for f in _FEATURE_COLS]], dtype=float)
        raw = top_features(explainer, X_row, _FEATURE_COLS, n=5)
        return [TopFeature(**f) for f in raw]
    except Exception:
        return None


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
        model_agreement = pred.get("model_agreement", 0.0)
        model_version = pred.get("model_version", "unknown")

        probs = pred.get("markets", pred.get("probabilities", {}))
        probabilities: dict = {}

        if "1x2" in probs:
            p = probs["1x2"]
            probabilities["1x2"] = MarketProb(
                home=p.get("home", 0), draw=p.get("draw", 0), away=p.get("away", 0),
            )
        elif "home" in probs and "draw" in probs and "away" in probs:
            probabilities["1x2"] = MarketProb(
                home=probs["home"], draw=probs["draw"], away=probs["away"],
            )

        if "double_chance" in probs:
            dc = probs["double_chance"]
            probabilities["double_chance"] = DoubleChance(
                home_or_draw=dc.get("home_or_draw", 0),
                draw_or_away=dc.get("draw_or_away", 0),
                home_or_away=dc.get("home_or_away", 0),
            )

        for key in ("over_under_0.5", "over_under_1.5", "over_under_2.5", "over_under_3.5", "over_under_4.5"):
            if key in probs:
                ou = probs[key]
                probabilities[key] = OverUnder(over=ou.get("over", 0), under=ou.get("under", 0))

        if "btts" in probs:
            btts = probs["btts"]
            probabilities["btts"] = BTTS(yes=btts.get("yes", 0), no=btts.get("no", 0))

        for key in ("handicap_-2", "handicap_-1", "handicap_+1", "handicap_+2"):
            if key in probs:
                h = probs[key]
                probabilities[key] = MarketProb(
                    home=h.get("home", 0), draw=h.get("draw", 0), away=h.get("away", 0),
                )

        for key in ("asian_handicap_-0.5", "asian_handicap_+0.5"):
            if key in probs:
                ah = probs[key]
                probabilities[key] = MarketProb(
                    home=ah.get("home", 0), draw=ah.get("draw", 0), away=ah.get("away", 0),
                )

        if "draw_no_bet" in probs:
            dnb = probs["draw_no_bet"]
            probabilities["draw_no_bet"] = MarketProb(
                home=dnb.get("home", 0), draw=0, away=dnb.get("away", 0),
            )

        if "win_to_nil" in probs:
            wtn = probs["win_to_nil"]
            probabilities["win_to_nil"] = MarketProb(
                home=wtn.get("home", 0), draw=0, away=wtn.get("away", 0),
            )

        if "clean_sheet" in probs:
            cs = probs["clean_sheet"]
            probabilities["clean_sheet"] = {
                "home_yes": cs.get("home_yes", 0), "home_no": cs.get("home_no", 0),
                "away_yes": cs.get("away_yes", 0), "away_no": cs.get("away_no", 0),
            }

        if "exact_score" in probs:
            probabilities["exact_score"] = probs["exact_score"]

        if "total_goals" in probs:
            probabilities["total_goals"] = probs["total_goals"]

        if "goal_bands" in probs:
            probabilities["goal_bands"] = probs["goal_bands"]

        if "odd_even" in probs:
            probabilities["odd_even"] = probs["odd_even"]

        if "highest_scoring_half" in probs:
            probabilities["highest_scoring_half"] = probs["highest_scoring_half"]

        for key in probs:
            if key.startswith("corners_") or key.startswith("cards_"):
                probabilities[key] = probs[key]

        for key in probs:
            if key.startswith("ht_") or key.startswith("ft_result_given_ht") or key.startswith("both_halves"):
                probabilities[key] = probs[key]

        feature_row = _get_feature_row(conn, fixture_id, row["league"], row["home_team_id"], row["away_team_id"])
        top_feats = _compute_top_features(row["league"], feature_row)

        return PredictResponse(
            fixture_id=fixture_id,
            model_version=model_version,
            model_agreement=model_agreement,
            probabilities=probabilities,
            probable_score=_get_probable_score(probs),
            top_features=top_feats,
        )
    finally:
        conn.close()
