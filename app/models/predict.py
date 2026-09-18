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
    DixonColesTeams,
    fit_dixon_coles,
    params_for_match,
    score_matrix,
    probabilities_from_matrix,
)
from app.models.count_models import (
    CountParams,
    predict_count_rates,
)
from app.models.ht_ft import (
    HTParams,
    SecondHalfResiduals,
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

import joblib


def _load_latest_ensemble_models(league: str) -> LightGBMEnsemble | None:
    from app.models.runs.manager import resolve_latest

    resolved = resolve_latest(Path(RUNS_DIR) / league)
    if resolved["ensemble"] is None:
        return None
    try:
        models = joblib.load(resolved["ensemble"])
    except Exception:
        return None
    if not isinstance(models, list) or not models:
        return None
    ensemble = LightGBMEnsemble(n_seeds=len(models))
    ensemble.models = models
    return ensemble


def _lgbm_1x2_for_fixture(
    ensemble: LightGBMEnsemble, feature_row: dict
) -> np.ndarray | None:
    try:
        X = np.array(
            [[feature_row.get(f, 0.0) or 0.0 for f in _FEATURE_COLS]],
            dtype=float,
        )
        probs = np.asarray(ensemble.predict_proba(X)[0], dtype=float)
    except Exception:
        return None
    if probs.shape != (3,) or not np.all(np.isfinite(probs)) or probs.sum() <= 0:
        return None
    return probs / probs.sum()


def _load_latest_run(league: str) -> dict | None:
    from app.models.runs.manager import resolve_latest

    resolved = resolve_latest(Path(RUNS_DIR) / league)
    if resolved["pipeline"] is None:
        return None
    try:
        return json.loads(resolved["pipeline"].read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def _load_count_params(run_data: dict, key: str) -> CountParams | None:
    data = run_data.get(key)
    if not data:
        return None
    return CountParams(
        team_attack={int(k): v for k, v in data.get("team_attack", {}).items()},
        team_defense={int(k): v for k, v in data.get("team_defense", {}).items()},
        home_advantage=data.get("home_advantage", 0.0),
        global_avg=data.get("global_avg", 5.0),
    )


def _load_dc_teams(run_data: dict) -> DixonColesTeams | None:
    data = run_data.get("dc_teams")
    if not data or not data.get("teams"):
        return None
    return DixonColesTeams(
        strengths={int(k): v for k, v in data["teams"].items()},
        home_advantage=data.get("home_advantage", 0.0),
        rho=data.get("rho", 0.0),
    )


def _load_ht_params(run_data: dict) -> tuple[HTParams | None, SecondHalfResiduals | None]:
    ht_data = run_data.get("ht_params")
    res_data = run_data.get("residuals")
    if not ht_data or not res_data:
        return None, None
    ht = HTParams(
        home_attack=ht_data["home_attack"],
        home_defense=ht_data["home_defense"],
        away_attack=ht_data["away_attack"],
        away_defense=ht_data["away_defense"],
        home_advantage=ht_data["home_advantage"],
        rho=ht_data["rho"],
    )
    res = SecondHalfResiduals(
        winning_multiplier=res_data["winning_multiplier"],
        drawing_multiplier=res_data["drawing_multiplier"],
        losing_multiplier=res_data["losing_multiplier"],
        n_samples=res_data.get("n_samples", 0),
    )
    return ht, res


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
    agreement = run_data.get("model_agreement", 0.0)

    corners_params = _load_count_params(run_data, "corners_params")
    cards_params = _load_count_params(run_data, "cards_params")
    ht_params, residuals = _load_ht_params(run_data)
    dc_teams = _load_dc_teams(run_data)
    ensemble = _load_latest_ensemble_models(league)

    feature_rows: dict[int, dict] = {}
    try:
        feat_cols = ", ".join(_FEATURE_COLS)
        for row in conn.execute(
            f"SELECT fixture_id, {feat_cols} FROM match_features "  # noqa: S608
            "WHERE fixture_id IN (SELECT id FROM fixtures WHERE league = ? AND status = 'pre')",
            (league,),
        ).fetchall():
            feature_rows[int(row["fixture_id"])] = dict(row)
    except Exception:
        feature_rows = {}

    batch_updates = []
    for fix in fixtures:
        home_team_id = fix["home_team_id"]
        away_team_id = fix["away_team_id"]

        match_params = params_for_match(
            dc_params, dc_teams, home_team_id, away_team_id
        )
        dc_matrix = score_matrix(match_params)
        dc_probs = probabilities_from_matrix(dc_matrix)

        # Serve the evaluated blend, not Dixon-Coles alone: rescale the
        # score matrix so its 1x2 matches w*DC + (1-w)*LightGBM, then derive
        # every market from the blended matrix. Falls back to DC-only when
        # the ensemble or the fixture's feature row is unavailable.
        blend_applied = False
        if ensemble is not None:
            lgbm_1x2 = _lgbm_1x2_for_fixture(ensemble, feature_rows.get(fix["id"], {}))
            if lgbm_1x2 is not None:
                dc_matrix = _reconstruct_blended_matrix(match_params, lgbm_1x2, w)
                dc_probs = probabilities_from_matrix(dc_matrix)
                blend_applied = True

        home_corners_rate = None
        away_corners_rate = None
        home_cards_rate = None
        away_cards_rate = None

        if corners_params:
            home_corners_rate, away_corners_rate = predict_count_rates(
                corners_params, home_team_id, away_team_id
            )
        if cards_params:
            home_cards_rate, away_cards_rate = predict_count_rates(
                cards_params, home_team_id, away_team_id
            )

        markets = _derive_all_markets_for_fixture(
            dc_matrix, match_params,
            home_corners_rate, away_corners_rate,
            home_cards_rate, away_cards_rate,
            ht_params, residuals,
        )

        prediction = {
            "markets": markets,
            "probabilities": {"home": dc_probs["home"], "draw": dc_probs["draw"], "away": dc_probs["away"]},
            "model_version": f"ensemble_v1_{league}",
            "model_agreement": agreement,
            "blend_weight": round(w, 3),
            "blend_applied": blend_applied,
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
