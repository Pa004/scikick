from __future__ import annotations

import hashlib
import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

import joblib

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
from app.models.count_models import (
    CountParams,
    fit_count_poisson,
    predict_count_rates,
    count_matrix,
    derive_all_count_markets,
)
from app.models.ht_ft import (
    HTParams,
    SecondHalfResiduals,
    fit_ht_models,
    joint_ht_ft_matrix,
    derive_all_ht_ft_markets,
)
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


def _fit_count_fold(
    train_df: pd.DataFrame,
    target_home_col: str,
    target_away_col: str,
) -> CountParams:
    team_map, n_teams = _build_team_id_map(train_df)
    home_counts = train_df[target_home_col].fillna(0).values.astype(float)
    away_counts = train_df[target_away_col].fillna(0).values.astype(float)
    return fit_count_poisson(
        home_team_ids=train_df["home_team_id"].values,
        away_team_ids=train_df["away_team_id"].values,
        home_counts=home_counts,
        away_counts=away_counts,
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
    ht_params: HTParams | None = None,
    residuals: SecondHalfResiduals | None = None,
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

    if dc_params is not None and ht_params is not None and residuals is not None:
        try:
            joint = joint_ht_ft_matrix(ht_params, dc_params, residuals)
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

    folds = expanding_window(features_df, min_train_matches=min_train_matches, step=20)
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
        valid_ids = [fid for fid in all_fixture_ids if fid in features_df.index]
        odds_h = features_df.loc[valid_ids, "avg_home_odds"].values.astype(float)
        odds_d = features_df.loc[valid_ids, "avg_draw_odds"].values.astype(float)
        odds_a = features_df.loc[valid_ids, "avg_away_odds"].values.astype(float)
        valid = np.isfinite(odds_h) & np.isfinite(odds_d) & np.isfinite(odds_a)
        if valid.sum() > 10:
            from app.models.evaluation import market_implied
            valid_tgt_idx = [i for i, fid in enumerate(all_fixture_ids) if fid in features_df.index]
            all_tgts_valid = all_tgts[valid_tgt_idx]
            all_preds_valid = all_preds[valid_tgt_idx]
            mkt = market_implied(odds_h[valid], odds_d[valid], odds_a[valid])
            vs_market = evaluate_model(all_tgts_valid[valid], all_preds_valid[valid], "model")
            mkt_eval = evaluate_model(all_tgts_valid[valid], mkt, "market")
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

    corners_params = _fit_count_fold(features_df, "target_home_corners", "target_away_corners")
    cards_params = _fit_count_fold(features_df, "target_home_yellow", "target_away_yellow")

    ht_params, residuals = fit_ht_models(features_df, team_map, n_teams)

    final_lgbm_ensemble = train_lightgbm(features_df)

    all_lgbm_stds_concat = np.concatenate(all_lgbm_stds)
    mean_model_agreement = float(np.mean(np.mean(all_lgbm_stds_concat, axis=1))) if all_lgbm_stds_concat.size > 0 else 0.0

    _persist_multi_market_predictions(
        conn, features_df, all_fixture_ids, final_dc_params, optimal_w, league, mean_model_agreement, all_lgbm_stds,
        corners_params, cards_params, ht_params, residuals,
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
        "corners_params": {
            "team_attack": {str(k): v for k, v in corners_params.team_attack.items()},
            "team_defense": {str(k): v for k, v in corners_params.team_defense.items()},
            "home_advantage": corners_params.home_advantage,
            "global_avg": corners_params.global_avg,
        },
        "cards_params": {
            "team_attack": {str(k): v for k, v in cards_params.team_attack.items()},
            "team_defense": {str(k): v for k, v in cards_params.team_defense.items()},
            "home_advantage": cards_params.home_advantage,
            "global_avg": cards_params.global_avg,
        },
        "ht_params": {
            "home_attack": ht_params.home_attack,
            "home_defense": ht_params.home_defense,
            "away_attack": ht_params.away_attack,
            "away_defense": ht_params.away_defense,
            "home_advantage": ht_params.home_advantage,
            "rho": ht_params.rho,
        },
        "residuals": {
            "winning_multiplier": residuals.winning_multiplier,
            "drawing_multiplier": residuals.drawing_multiplier,
            "losing_multiplier": residuals.losing_multiplier,
            "n_samples": residuals.n_samples,
        },
    }

    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    run_dir = Path(RUNS_DIR) / league
    run_dir.mkdir(parents=True, exist_ok=True)
    run_file = run_dir / f"pipeline_{mode}_{ts}.json"
    run_file.write_text(json.dumps(run_data, indent=2, default=str), encoding="utf-8")

    ensemble_file = run_dir / f"ensemble_{ts}.joblib"
    joblib.dump(final_lgbm_ensemble.models, ensemble_file)

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
    corners_params: CountParams | None = None,
    cards_params: CountParams | None = None,
    ht_params: HTParams | None = None,
    residuals: SecondHalfResiduals | None = None,
) -> int:
    fixtures_info = conn.execute(
        "SELECT f.id, f.home_team_id, f.away_team_id "
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
        home_team_id = info.get("home_team_id")
        away_team_id = info.get("away_team_id")

        home_corners_rate = None
        away_corners_rate = None
        home_cards_rate = None
        away_cards_rate = None

        if corners_params and home_team_id and away_team_id:
            home_corners_rate, away_corners_rate = predict_count_rates(
                corners_params, home_team_id, away_team_id
            )
        if cards_params and home_team_id and away_team_id:
            home_cards_rate, away_cards_rate = predict_count_rates(
                cards_params, home_team_id, away_team_id
            )

        markets = _derive_all_markets_for_fixture(
            blended_matrix, dc_params,
            home_corners_rate, away_corners_rate,
            home_cards_rate, away_cards_rate,
            ht_params, residuals,
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


def _resolve_market(market: str, pred_data: dict, hs: int, aw: int, ht_hs: int | None, ht_aw: int | None, fixture: sqlite3.Row) -> tuple[str, float, str] | None:
    total_goals = hs + aw
    result_1x2 = "home" if hs > aw else ("away" if aw > hs else "draw")
    both_scored = hs > 0 and aw > 0

    if market == "1x2":
        pick = max(pred_data, key=pred_data.get)
        return pick, pred_data[pick], result_1x2

    if market.startswith("over_under_"):
        line = float(market.split("_")[-1])
        pick = "over" if pred_data.get("over", 0) > pred_data.get("under", 0) else "under"
        return pick, pred_data.get(pick, 0.5), "over" if total_goals > line else "under"

    if market == "btts":
        pick = "yes" if pred_data.get("yes", 0) > pred_data.get("no", 0) else "no"
        return pick, pred_data.get(pick, 0.5), "yes" if both_scored else "no"

    if market.startswith("handicap_"):
        handicap = int(market.split("_")[1])
        adjusted = hs + handicap
        pick = "home" if pred_data.get("home", 0) > pred_data.get("away", 0) else "away"
        outcome = "home" if adjusted > aw else ("away" if adjusted < aw else "draw")
        return pick, pred_data.get(pick, 0.5), outcome

    if market == "double_chance":
        pick = max(pred_data, key=pred_data.get)
        outcome = "home_or_draw" if result_1x2 in ("home", "draw") else "draw_or_away"
        return pick, pred_data[pick], outcome

    if market == "draw_no_bet":
        if result_1x2 == "draw":
            return None
        pick = max(pred_data, key=pred_data.get)
        return pick, pred_data[pick], result_1x2

    if market == "clean_sheet":
        pick = max(pred_data, key=pred_data.get)
        if pick in ("home_yes", "home_no"):
            outcome = "home_yes" if aw == 0 else "home_no"
        else:
            outcome = "away_yes" if hs == 0 else "away_no"
        return pick, pred_data[pick], outcome

    if market == "win_to_nil":
        pick = max(pred_data, key=pred_data.get)
        if pick == "home":
            outcome = "home" if hs > aw and aw == 0 else "none"
        else:
            outcome = "away" if aw > hs and hs == 0 else "none"
        return pick, pred_data[pick], outcome

    if market.startswith("asian_handicap_"):
        handicap = float(market.split("_")[-1])
        adjusted = hs - aw - handicap
        pick = "home" if pred_data.get("home", 0) > pred_data.get("away", 0) else "away"
        if adjusted > 0:
            outcome = "home"
        elif adjusted < 0:
            outcome = "away"
        else:
            outcome = "push"
        return pick, pred_data.get(pick, 0.5), outcome

    if market == "ht_1x2":
        if ht_hs is None or ht_aw is None:
            return None
        ht_result = "home" if ht_hs > ht_aw else ("away" if ht_aw > ht_hs else "draw")
        pick = max(pred_data, key=pred_data.get)
        return pick, pred_data[pick], ht_result

    if market.startswith("ht_over_under_"):
        if ht_hs is None or ht_aw is None:
            return None
        ht_total = ht_hs + ht_aw
        line = float(market.split("_")[-1])
        pick = "over" if pred_data.get("over", 0) > pred_data.get("under", 0) else "under"
        return pick, pred_data.get(pick, 0.5), "over" if ht_total > line else "under"

    if market == "ht_double_chance":
        if ht_hs is None or ht_aw is None:
            return None
        ht_result = "home" if ht_hs > ht_aw else ("away" if ht_aw > ht_hs else "draw")
        pick = max(pred_data, key=pred_data.get)
        outcome = "home_or_draw" if ht_result in ("home", "draw") else "draw_or_away"
        return pick, pred_data[pick], outcome

    if market == "both_halves":
        if ht_hs is None or ht_aw is None:
            return None
        ht_result = "home" if ht_hs > ht_aw else ("away" if ht_aw > ht_hs else "draw")
        ft_result = result_1x2
        team_wins_both = ht_result == ft_result and ft_result != "draw"
        either_wins = ht_result != "draw" or ft_result != "draw"
        both_draw = ht_result == "draw" and ft_result == "draw"
        ht_btts = ht_hs > 0 and ht_aw > 0
        ft_btts = both_scored
        outcomes = {
            "team_wins_both_halves": team_wins_both,
            "team_wins_either_half": either_wins,
            "draw_both_halves": both_draw,
            "both_teams_score_both_halves": ht_btts and ft_btts,
            "ht_over_0.5_ft_over_0.5": ht_hs + ht_aw > 0.5 and total_goals > 0.5,
            "ht_over_1.5_ft_over_1.5": ht_hs + ht_aw > 1.5 and total_goals > 1.5,
            "ht_over_2.5_ft_over_2.5": ht_hs + ht_aw > 2.5 and total_goals > 2.5,
        }
        pick = max(pred_data, key=pred_data.get)
        return pick, pred_data[pick], pick if outcomes.get(pick) else "none"

    if market.startswith("corners_") or market.startswith("cards_"):
        prefix = "corners" if market.startswith("corners") else "cards"
        col = "home_corners" if prefix == "corners" else "home_yellow"
        col_a = "away_corners" if prefix == "corners" else "away_yellow"
        real_total = (fixture[col] or 0) + (fixture[col_a] or 0)
        real_home = fixture[col] or 0
        real_away = fixture[col_a] or 0
        if "over_under_" in market:
            line = float(market.split("_")[-1])
            pick = "over" if pred_data.get("over", 0) > pred_data.get("under", 0) else "under"
            return pick, pred_data.get(pick, 0.5), "over" if real_total > line else "under"
        if "_handicap_" in market:
            handicap = int(market.split("_")[2])
            adjusted = real_home + handicap
            pick = "home" if pred_data.get("home", 0) > pred_data.get("away", 0) else "away"
            outcome = "home" if adjusted > real_away else ("away" if adjusted < real_away else "draw")
            return pick, pred_data.get(pick, 0.5), outcome
        if "_total" in market:
            pick = max(pred_data, key=pred_data.get)
            return pick, pred_data[pick], str(real_total)
        return None

    if market in ("home_o25", "away_btts", "draw_u25", "home_btts", "dc_o25", "dc_u25"):
        pick = max(pred_data, key=pred_data.get)
        return pick, pred_data[pick], pick

    if market == "1x2_btts":
        pick = max(pred_data, key=pred_data.get)
        parts = pick.split("_")
        result_part = parts[0]
        btts_part = parts[1]
        result_match = (result_part == "home" and result_1x2 == "home") or \
                       (result_part == "draw" and result_1x2 == "draw") or \
                       (result_part == "away" and result_1x2 == "away")
        btts_match = (btts_part == "yes" and both_scored) or (btts_part == "no" and not both_scored)
        return pick, pred_data[pick], pick if (result_match and btts_match) else "none"

    return None


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
        ht_hs = fixture["ht_home_score"]
        ht_aw = fixture["ht_away_score"]
        ht_hs = int(ht_hs) if ht_hs is not None else None
        ht_aw = int(ht_aw) if ht_aw is not None else None

        for market, pred_data in markets.items():
            if not isinstance(pred_data, dict):
                continue

            result = _resolve_market(market, pred_data, hs, aw, ht_hs, ht_aw, fixture)
            if result is None:
                continue

            pick, confidence, outcome = result
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
