from __future__ import annotations

import hashlib
import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

from app.features.build_features import build_features, persist_features
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
from app.models.blend import blend_predictions, find_optimal_blend_weight
from app.models.calibration import calibrate
from app.models.evaluation import brier_score, log_loss_score, accuracy, evaluate_model
from app.models.walkforward import expanding_window, Fold
RUNS_DIR = str(Path(__file__).resolve().parent.parent.parent / "data" / "runs")


def _build_team_id_map(train_df: pd.DataFrame) -> tuple[dict[int, int], int]:
    team_ids = set(train_df["home_team_id"].tolist() + train_df["away_team_id"].tolist())
    sorted_ids = sorted(team_ids)
    mapping = {tid: idx for idx, tid in enumerate(sorted_ids)}
    return mapping, len(mapping)


def _fit_dc_fold(train_df: pd.DataFrame) -> DixonColesParams:
    team_map, n_teams = _build_team_id_map(train_df)
    return fit_dixon_coles(
        home_team_ids=train_df["home_team_id"].values,
        away_team_ids=train_df["away_team_id"].values,
        home_goals=train_df["target_home_goals"].values,
        away_goals=train_df["target_away_goals"].values,
        n_teams=n_teams,
        team_id_to_idx=team_map,
    )


def _dc_predict_1x2(params: DixonColesParams, test_df: pd.DataFrame) -> np.ndarray:
    matrix = score_matrix(params)
    probs = probabilities_from_matrix(matrix)
    return np.tile([probs["home"], probs["draw"], probs["away"]], (len(test_df), 1))


def _resolve_to_tracked(
    conn: sqlite3.Connection,
    fixtures_df: pd.DataFrame,
    predictions: np.ndarray,
    model_version: str,
) -> int:
    written = 0
    for i, (_, row) in enumerate(fixtures_df.iterrows()):
        fixture_id = int(row["fixture_id"])
        probs = predictions[i]
        pick_idx = int(np.argmax(probs))
        pick = ["home", "draw", "away"][pick_idx]
        confidence = float(probs[pick_idx])

        conn.execute(
            "INSERT OR IGNORE INTO tracked "
            "(fixture_id, league, market, pick, confidence, "
            "prob_home, prob_draw, prob_away, predicted_market_prob, "
            "outcome, hit, resolved_at) "
            "VALUES (?, ?, '1x2', ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                fixture_id,
                row["league"],
                pick,
                confidence,
                float(probs[0]),
                float(probs[1]),
                float(probs[2]),
                confidence,
                row.get("target_1x2"),
                1 if pick == row.get("target_1x2") else 0,
                datetime.now(timezone.utc).isoformat(),
            ),
        )
        written += 1
    return written


def train_league(
    conn: sqlite3.Connection,
    league: str,
    mode: str = "complete",
    min_train_matches: int = 380,
    n_holdout_folds: int = 5,
) -> dict:
    features_df = build_features(conn, league)
    if features_df.empty:
        return {"error": "No features built", "league": league}

    persist_features(conn, features_df)

    odds_df = pd.read_sql_query(
        "SELECT id as fixture_id, avg_home_odds, avg_draw_odds, avg_away_odds "
        "FROM fixtures WHERE league = ? AND status = 'post'",
        conn, params=(league,),
    )
    features_df = features_df.merge(odds_df, on="fixture_id", how="left")

    features_df = features_df.sort_values("match_date").reset_index(drop=True)

    folds = expanding_window(features_df, min_train_matches=min_train_matches)
    if len(folds) < 2:
        return {"error": f"Not enough folds ({len(folds)})", "league": league}

    all_predictions = []
    all_targets = []
    all_fixture_ids = []
    all_match_dates = []
    fold_metrics = []

    for fold_idx, fold in enumerate(folds):
        train_df = features_df.loc[fold.train_idx]
        test_df = features_df.loc[fold.test_idx]

        if len(train_df) < 10:
            continue

        dc_params = _fit_dc_fold(train_df)
        dc_preds = _dc_predict_1x2(dc_params, test_df)

        lgbm_model = train_lightgbm(train_df)
        lgbm_preds, lgbm_std = predict_lightgbm(lgbm_model, test_df)

        if fold_idx < len(folds) - n_holdout_folds:
            w, _ = find_optimal_blend_weight(dc_preds, lgbm_preds, test_df["target_1x2"].map({"home": 0, "draw": 1, "away": 2}).values)
        else:
            w = 0.5

        blended = blend_predictions(dc_preds, lgbm_preds, w)
        y_true = test_df["target_1x2"].map({"home": 0, "draw": 1, "away": 2}).values

        metrics = evaluate_model(y_true, blended, f"fold_{fold_idx}")
        fold_metrics.append(metrics)

        all_predictions.append(blended)
        all_targets.append(y_true)
        all_fixture_ids.extend(test_df["fixture_id"].tolist())
        all_match_dates.extend(test_df["match_date"].tolist())

    if not all_predictions:
        return {"error": "No folds produced predictions", "league": league}

    all_preds = np.vstack(all_predictions)
    all_tgts = np.concatenate(all_targets)

    overall = evaluate_model(all_tgts, all_preds, "overall")

    calibrated, _ = calibrate(all_preds, all_tgts)
    cal_metrics = evaluate_model(all_tgts, calibrated, "calibrated")

    has_odds = all(
        pd.notna(features_df.loc[fid, "avg_home_odds"])
        for fid in all_fixture_ids
        if fid in features_df.index
    ) if all_fixture_ids else False
    vs_market = None
    if has_odds:
        odds_h = features_df.loc[all_fixture_ids, "avg_home_odds"].values.astype(float)
        odds_d = features_df.loc[all_fixture_ids, "avg_draw_odds"].values.astype(float)
        odds_a = features_df.loc[all_fixture_ids, "avg_away_odds"].values.astype(float)
        valid = np.isfinite(odds_h) & np.isfinite(odds_d) & np.isfinite(odds_a)
        if valid.sum() > 10:
            from app.models.evaluation import market_implied
            mkt = market_implied(odds_h[valid], odds_d[valid], odds_a[valid])
            vs_market = evaluate_model(all_tgts[valid], all_preds[valid], "model")
            mkt_eval = evaluate_model(all_tgts[valid], mkt, "market")
            vs_market = {"model": vs_market, "market": mkt_eval}

    run_data = {
        "league": league,
        "mode": mode,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "n_folds": len(fold_metrics),
        "n_samples": int(len(all_tgts)),
        "blend_weight_dc": round(w, 3),
        "overall_metrics": overall,
        "calibrated_metrics": cal_metrics,
        "fold_metrics": fold_metrics,
        "vs_market": vs_market,
        "feature_cols": _FEATURE_COLS,
    }

    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    run_dir = Path(RUNS_DIR) / league
    run_dir.mkdir(parents=True, exist_ok=True)
    run_file = run_dir / f"pipeline_{mode}_{ts}.json"
    run_file.write_text(json.dumps(run_data, indent=2, default=str), encoding="utf-8")

    return {
        "league": league,
        "run_id": str(run_file),
        "n_folds": len(fold_metrics),
        "n_samples": int(len(all_tgts)),
        "overall_brier": overall["brier"],
        "overall_log_loss": overall["log_loss"],
        "calibrated_brier": cal_metrics["brier"],
        "blend_weight": round(w, 3),
    }


def resolve_predictions(conn: sqlite3.Connection, league: str | None = None) -> int:
    query = """
        SELECT f.id as fixture_id, f.league, f.prediction
        FROM fixtures f
        WHERE f.status = 'post' AND f.result_checked = 0 AND f.prediction IS NOT NULL
    """
    params = ()
    if league:
        query += " AND f.league = ?"
        params = (league,)

    rows = conn.execute(query, params).fetchall()
    written = 0
    for row in rows:
        fixture_id = row["fixture_id"]
        prediction = json.loads(row["prediction"])
        probs = prediction.get("probabilities", {})
        pick = max(probs, key=probs.get)
        confidence = probs[pick]

        conn.execute(
            "INSERT OR IGNORE INTO tracked "
            "(fixture_id, league, market, pick, confidence, "
            "prob_home, prob_draw, prob_away, predicted_market_prob, "
            "outcome, hit, resolved_at) "
            "VALUES (?, ?, '1x2', ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                fixture_id,
                row["league"],
                pick,
                confidence,
                probs.get("home", 0),
                probs.get("draw", 0),
                probs.get("away", 0),
                confidence,
                None,
                None,
                datetime.now(timezone.utc).isoformat(),
            ),
        )
        written += 1

    conn.execute(
        "UPDATE fixtures SET result_checked = 1 "
        "WHERE status = 'post' AND result_checked = 0 AND prediction IS NOT NULL"
    )
    return written
