from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone

import numpy as np
import pandas as pd

from app.models.pipeline import (
    _build_team_id_map,
    _derive_all_markets_for_fixture,
    _reconstruct_blended_matrix,
    RUNS_DIR,
)
from app.models.dixon_coles import (
    DixonColesParams,
    fit_dixon_coles,
    score_matrix,
    probabilities_from_matrix,
)
from app.models.lightgbm_model import (
    LightGBMEnsemble,
    _FEATURE_COLS,
    get_feature_matrix,
    train_lightgbm,
    predict_lightgbm,
)
from app.models.blend import blend_predictions
from pathlib import Path


def _load_latest_run(league: str) -> dict | None:
    run_dir = Path(RUNS_DIR) / league
    if not run_dir.exists():
        return None
    run_files = sorted(run_dir.glob("pipeline_*.json"), reverse=True)
    if not run_files:
        return None
    return json.loads(run_files[0].read_text(encoding="utf-8"))


def predict_future(conn: sqlite3.Connection, league: str) -> dict:
    fixtures = conn.execute(
        "SELECT f.id, f.home_team_id, f.away_team_id, "
        "t1.canonical_name as home_name, t2.canonical_name as away_name "
        "FROM fixtures f "
        "JOIN teams t1 ON f.home_team_id = t1.id "
        "JOIN teams t2 ON f.away_team_id = t2.id "
        "WHERE f.league = ? AND f.status = 'pre' AND f.prediction IS NULL",
        (league,),
    ).fetchall()

    if not fixtures:
        return {"league": league, "predicted": 0}

    run_data = _load_latest_run(league)
    if not run_data:
        return {"error": "No trained model found", "league": league}

    dc_params_data = run_data.get("dc_params", {})
    dc_params = DixonColesParams(
        home_attack=dc_params_data["home_attack"],
        home_defense=dc_params_data["home_defense"],
        away_attack=dc_params_data["away_attack"],
        away_defense=dc_params_data["away_defense"],
        home_advantage=dc_params_data["home_advantage"],
        rho=dc_params_data["rho"],
    )
    w = run_data.get("blend_weight_dc", 0.5)

    dc_matrix = score_matrix(dc_params)
    dc_probs = probabilities_from_matrix(dc_matrix)

    batch_updates = []
    for fix in fixtures:
        markets = _derive_all_markets_for_fixture(dc_matrix, dc_params)

        prediction = {
            "markets": markets,
            "probabilities": {"home": dc_probs["home"], "draw": dc_probs["draw"], "away": dc_probs["away"]},
            "model_version": f"ensemble_v1_{league}",
            "model_agreement": 0.0,
            "blend_weight": round(w, 3),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        prediction_json = json.dumps(prediction, default=str)
        batch_updates.append((prediction_json, fix["id"]))

    conn.executemany(
        "UPDATE fixtures SET prediction = ? WHERE id = ?",
        batch_updates,
    )
    conn.commit()

    return {"league": league, "predicted": len(batch_updates)}
