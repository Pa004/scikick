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
from app.models.markets import derive_all_markets
from app.models.combined import derive_all_combined_markets
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


def _reconstruct_blended_matrix(
    dc_params: DixonColesParams,
    lgbm_1x2: np.ndarray,
    w: float,
) -> np.ndarray:
    dc_matrix = score_matrix(dc_params)
    dc_1x2 = np.array([
        probabilities_from_matrix(dc_matrix)["home"],
        probabilities_from_matrix(dc_matrix)["draw"],
        probabilities_from_matrix(dc_matrix)["away"],
    ])
    blended_1x2 = w * dc_1x2 + (1 - w) * lgbm_1x2
    blended_1x2 = np.clip(blended_1x2, 1e-15, None)
    blended_1x2 /= blended_1x2.sum()
    scale = blended_1x2 / dc_1x2
    scale = np.where(dc_1x2 > 1e-15, scale, 1.0)
    return dc_matrix * scale[:, np.newaxis]


def _derive_all_markets_for_fixture(
    blended_matrix: np.ndarray,
    dc_params: DixonColesParams | None = None,
    home_corners_rate: float | None = None,
    away_corners_rate: float | None = None,
    home_cards_rate: float | None = None,
    away_cards_rate: float | None = None,
) -> dict:
    markets = derive_all_markets(blended_matrix)
    markets.update(derive_all_combined_markets(blended_matrix))

    if home_corners_rate is not None and away_corners_rate is not None:
        from app.models.poisson_counts import predict_count_distribution, derive_all_count_markets
        corners_matrix = predict_count_distribution(home_corners_rate, away_corners_rate)
        markets.update(derive_all_count_markets(corners_matrix, prefix="corners"))

    if home_cards_rate is not None and away_cards_rate is not None:
        from app.models.poisson_counts import predict_count_distribution, derive_all_count_markets
        cards_matrix = predict_count_distribution(home_cards_rate, away_cards_rate, max_count=11)
        markets.update(derive_all_count_markets(cards_matrix, prefix="cards"))

    if dc_params is not None:
        try:
            from app.models.ht_ft import joint_ht_ft_matrix, derive_all_ht_ft_markets
            joint = joint_ht_ft_matrix(dc_params)
            markets.update(derive_all_ht_ft_markets(joint))
        except Exception:
            pass

    return markets


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

    corners_df = pd.read_sql_query(
        "SELECT id as fixture_id, home_corners, away_corners, home_yellow, away_yellow "
        "FROM fixtures WHERE league = ? AND status = 'post'",
        conn, params=(league,),
    )
    features_df = features_df.merge(corners_df, on="fixture_id", how="left")

    features_df = features_df.sort_values("match_date").reset_index(drop=True)

    folds = expanding_window(features_df, min_train_matches=min_train_matches)
    if len(folds) < 2:
        return {"error": f"Not enough folds ({len(folds)})", "league": league}

    n_opt_folds = max(1, len(folds) - n_holdout_folds)

    all_predictions = []
    all_targets = []
    all_fixture_ids = []
    all_match_dates = []
    all_lgbm_stds = []
    fold_metrics = []
    optimal_w = 0.5

    for fold_idx, fold in enumerate(folds):
        train_df = features_df.loc[fold.train_idx]
        test_df = features_df.loc[fold.test_idx]

        if len(train_df) < 10:
            continue

        dc_params = _fit_dc_fold(train_df)
        dc_preds = _dc_predict_1x2(dc_params, test_df)

        lgbm_model = train_lightgbm(train_df)
        lgbm_preds, lgbm_std = predict_lightgbm(lgbm_model, test_df)

        if fold_idx < n_opt_folds:
            w, _ = find_optimal_blend_weight(dc_preds, lgbm_preds, test_df["target_1x2"].map({"home": 0, "draw": 1, "away": 2}).values)
            optimal_w = w

        blended = blend_predictions(dc_preds, lgbm_preds, optimal_w)
        y_true = test_df["target_1x2"].map({"home": 0, "draw": 1, "away": 2}).values

        metrics = evaluate_model(y_true, blended, f"fold_{fold_idx}")
        fold_metrics.append(metrics)

        all_predictions.append(blended)
        all_targets.append(y_true)
        all_fixture_ids.extend(test_df["fixture_id"].tolist())
        all_match_dates.extend(test_df["match_date"].tolist())
        all_lgbm_stds.append(lgbm_std)

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

    team_map, n_teams = _build_team_id_map(features_df)
    final_dc_params = fit_dixon_coles(
        home_team_ids=features_df["home_team_id"].values,
        away_team_ids=features_df["away_team_id"].values,
        home_goals=features_df["target_home_goals"].values,
        away_goals=features_df["target_away_goals"].values,
        n_teams=n_teams,
        team_id_to_idx=team_map,
    )

    all_lgbm_stds_concat = np.concatenate(all_lgbm_stds)
    mean_model_agreement = float(np.mean(np.mean(all_lgbm_stds_concat, axis=1))) if all_lgbm_stds_concat.size > 0 else 0.0

    _persist_multi_market_predictions(
        conn, features_df, all_fixture_ids, final_dc_params, optimal_w, league, mean_model_agreement, all_lgbm_stds,
    )

    run_data = {
        "league": league,
        "mode": mode,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "n_folds": len(fold_metrics),
        "n_samples": int(len(all_tgts)),
        "blend_weight_dc": round(optimal_w, 3),
        "overall_metrics": overall,
        "calibrated_metrics": cal_metrics,
        "fold_metrics": fold_metrics,
        "vs_market": vs_market,
        "feature_cols": _FEATURE_COLS,
        "dc_params": {
            "home_attack": final_dc_params.home_attack,
            "home_defense": final_dc_params.home_defense,
            "away_attack": final_dc_params.away_attack,
            "away_defense": final_dc_params.away_defense,
            "home_advantage": final_dc_params.home_advantage,
            "rho": final_dc_params.rho,
        },
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
        "blend_weight": round(optimal_w, 3),
    }


def _persist_multi_market_predictions(
    conn: sqlite3.Connection,
    features_df: pd.DataFrame,
    fixture_ids: list[int],
    dc_params: DixonColesParams,
    w: float,
    league: str,
    model_agreement: float,
    all_lgbm_stds: list[np.ndarray],
) -> int:
    fixtures_info = conn.execute(
        "SELECT f.id, f.home_score, f.away_score, f.ht_home_score, f.ht_away_score, "
        "f.home_corners, f.away_corners, f.home_yellow, f.away_yellow "
        "FROM fixtures f WHERE f.id IN ({})".format(",".join("?" * len(fixture_ids))),
        fixture_ids,
    ).fetchall()
    fixtures_map = {r["id"]: dict(r) for r in fixtures_info}

    dc_matrix = score_matrix(dc_params)
    dc_probs = probabilities_from_matrix(dc_matrix)

    std_idx = 0
    batch_updates = []
    for fid in fixture_ids:
        blended_matrix = dc_matrix

        info = fixtures_map.get(fid, {})
        home_corners_rate = float(info["home_corners"]) if info.get("home_corners") is not None else None
        away_corners_rate = float(info["away_corners"]) if info.get("away_corners") is not None else None
        home_cards_rate = float(info["home_yellow"]) if info.get("home_yellow") is not None else None
        away_cards_rate = float(info["away_yellow"]) if info.get("away_yellow") is not None else None

        markets = _derive_all_markets_for_fixture(
            blended_matrix, dc_params,
            home_corners_rate, away_corners_rate,
            home_cards_rate, away_cards_rate,
        )

        fixture_std = all_lgbm_stds[min(std_idx, len(all_lgbm_stds) - 1)]
        fixture_model_agreement = float(np.mean(fixture_std)) if len(fixture_std) > 0 else model_agreement
        std_idx += 1

        prediction = {
            "markets": markets,
            "probabilities": {"home": dc_probs["home"], "draw": dc_probs["draw"], "away": dc_probs["away"]},
            "model_version": f"ensemble_v1_{league}",
            "model_agreement": round(fixture_model_agreement, 4),
            "blend_weight": round(w, 3),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        prediction_json = json.dumps(prediction, default=str)
        batch_updates.append((prediction_json, fid))

    conn.executemany(
        "UPDATE fixtures SET prediction = ? WHERE id = ?",
        batch_updates,
    )
    conn.commit()
    return len(batch_updates)


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
        markets = prediction.get("markets", {})

        fixture = conn.execute(
            "SELECT home_score, away_score, ht_home_score, ht_away_score, "
            "home_corners, away_corners, home_yellow, away_yellow "
            "FROM fixtures WHERE id = ?",
            (fixture_id,),
        ).fetchone()

        if not fixture or fixture["home_score"] is None:
            continue

        hs = int(fixture["home_score"])
        aw = int(fixture["away_score"])
        total_goals = hs + aw
        result_1x2 = "home" if hs > aw else ("away" if aw > hs else "draw")

        for market, pred_data in markets.items():
            if isinstance(pred_data, dict):
                if market == "1x2":
                    pick = max(pred_data, key=pred_data.get)
                    confidence = pred_data[pick]
                    outcome = result_1x2
                elif market.startswith("over_under_"):
                    line = float(market.split("_")[-1])
                    pick = "over" if pred_data.get("over", 0) > pred_data.get("under", 0) else "under"
                    confidence = pred_data.get(pick, 0.5)
                    outcome = "over" if total_goals > line else "under"
                elif market == "btts":
                    pick = "yes" if pred_data.get("yes", 0) > pred_data.get("no", 0) else "no"
                    confidence = pred_data.get(pick, 0.5)
                    outcome = "yes" if hs > 0 and aw > 0 else "no"
                elif market.startswith("handicap_"):
                    handicap = int(market.split("_")[1])
                    adjusted = hs + handicap
                    pick = "home" if pred_data.get("home", 0) > pred_data.get("away", 0) else "away"
                    confidence = pred_data.get(pick, 0.5)
                    outcome = "home" if adjusted > aw else ("away" if adjusted < aw else "draw")
                elif market == "double_chance":
                    pick = max(pred_data, key=pred_data.get)
                    confidence = pred_data[pick]
                    outcomes_1x2 = {"home": result_1x2 == "home", "draw": result_1x2 == "draw", "away": result_1x2 == "away"}
                    outcome = "home_or_draw" if (outcomes_1x2["home"] or outcomes_1x2["draw"]) else "draw_or_away"
                elif market.startswith("corners_") or market.startswith("cards_"):
                    prefix = "corners" if market.startswith("corners") else "cards"
                    col = "home_corners" if prefix == "corners" else "home_yellow"
                    col_a = "away_corners" if prefix == "corners" else "away_yellow"
                    real_total = (fixture[col] or 0) + (fixture[col_a] or 0)
                    if "over_under_" in market:
                        line = float(market.split("_")[-1])
                        pick = "over" if pred_data.get("over", 0) > pred_data.get("under", 0) else "under"
                        confidence = pred_data.get(pick, 0.5)
                        outcome = "over" if real_total > line else "under"
                    else:
                        continue
                else:
                    continue

                hit = 1 if pick == outcome else 0

                conn.execute(
                    "INSERT OR IGNORE INTO tracked "
                    "(fixture_id, league, market, pick, confidence, "
                    "predicted_market_prob, outcome, hit, resolved_at) "
                    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    (
                        fixture_id, row["league"], market, pick,
                        confidence, confidence, outcome, hit,
                        datetime.now(timezone.utc).isoformat(),
                    ),
                )
                written += 1

    conn.execute(
        "UPDATE fixtures SET result_checked = 1 "
        "WHERE status = 'post' AND result_checked = 0 AND prediction IS NOT NULL"
    )
    conn.commit()
    return written
