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
    DixonColesTeams,
    fit_dixon_coles_full,
    params_for_match,
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
from app.models.resolvers import resolve_market as _resolve_market
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


def _fit_dc_fold(train_df: pd.DataFrame) -> tuple[DixonColesParams, DixonColesTeams]:
    team_map, n_teams = _build_team_id_map(train_df)
    return fit_dixon_coles_full(
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


def _dc_predict_1x2(
    averaged: DixonColesParams,
    teams: DixonColesTeams,
    test_df: pd.DataFrame,
) -> np.ndarray:
    rows = []
    for home_id, away_id in zip(test_df["home_team_id"], test_df["away_team_id"]):
        params = params_for_match(averaged, teams, int(home_id), int(away_id))
        probs = probabilities_from_matrix(score_matrix(params))
        rows.append([probs["home"], probs["draw"], probs["away"]])
    return np.array(rows)


def _reconstruct_blended_matrix(
    dc_params: DixonColesParams,
    lgbm_1x2: np.ndarray,
    w: float,
) -> np.ndarray:
    # Rescale each 1x2 region of the score matrix (home=lower triangle,
    # draw=diagonal, away=upper triangle) so the matrix 1x2 matches the
    # w*DC + (1-w)*LightGBM blend. Every derived market then stays
    # consistent with the blended headline probabilities.
    dc_matrix = score_matrix(dc_params)
    dc_1x2 = np.array([
        probabilities_from_matrix(dc_matrix)["home"],
        probabilities_from_matrix(dc_matrix)["draw"],
        probabilities_from_matrix(dc_matrix)["away"],
    ])
    blended_1x2 = w * dc_1x2 + (1 - w) * np.asarray(lgbm_1x2, dtype=float)
    blended_1x2 = np.clip(blended_1x2, 1e-15, None)
    blended_1x2 /= blended_1x2.sum()
    out = dc_matrix.copy()
    regions = (
        np.tril_indices_from(out, -1),
        np.diag_indices_from(out),
        np.triu_indices_from(out, 1),
    )
    for region, k in zip(regions, range(3)):
        if dc_1x2[k] > 1e-15:
            out[region] *= blended_1x2[k] / dc_1x2[k]
    total = out.sum()
    if total > 0:
        out /= total
    return out


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
    persist_run: bool = True,
) -> dict:
    features_df = build_features(conn, league)
    if features_df.empty:
        return {"error": "No features built", "league": league}

    persist_features(conn, features_df)

    # Train and evaluate on resolved fixtures only. Pre-match rows stay in
    # match_features (persisted above) so predict_future can serve the blend.
    features_df = features_df[features_df["target_1x2"].notna()].copy()

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

        dc_params, dc_teams = _fit_dc_fold(train_df)
        dc_preds = _dc_predict_1x2(dc_params, dc_teams, test_df)

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
    final_dc_params, final_dc_teams = fit_dixon_coles_full(
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
        conn, features_df, all_fixture_ids, final_dc_params, final_dc_teams,
        optimal_w, league, mean_model_agreement, all_lgbm_stds,
        corners_params, cards_params, ht_params, residuals,
    )

    run_data = {
        "league": league,
        "mode": mode,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "n_folds": len(fold_metrics),
        "n_samples": int(len(all_tgts)),
        "blend_weight_dc": round(optimal_w, 3),
        "model_agreement": round(mean_model_agreement, 4),
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
        "dc_teams": {
            "home_advantage": final_dc_teams.home_advantage,
            "rho": final_dc_teams.rho,
            "teams": {
                str(team_id): strengths
                for team_id, strengths in final_dc_teams.strengths.items()
            },
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
    run_id = None
    if persist_run:
        from app.models.runs.manager import write_manifest

        run_dir = Path(RUNS_DIR) / league
        run_dir.mkdir(parents=True, exist_ok=True)
        run_file = run_dir / f"pipeline_{mode}_{ts}.json"
        run_file.write_text(json.dumps(run_data, indent=2, default=str), encoding="utf-8")

        ensemble_file = run_dir / f"ensemble_{ts}.joblib"
        joblib.dump(final_lgbm_ensemble.models, ensemble_file)
        write_manifest(run_dir, {
            "run_id": str(run_file),
            "league": league,
            "mode": mode,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "pipeline_file": run_file.name,
            "ensemble_file": ensemble_file.name,
            "overall_brier": overall["brier"],
        })
        run_id = str(run_file)

    return {
        "league": league,
        "run_id": run_id,
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
    dc_teams: DixonColesTeams | None,
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

    legacy_matrix = score_matrix(dc_params)
    legacy_probs = probabilities_from_matrix(legacy_matrix)

    std_idx = 0
    batch_updates = []
    for fid in fixture_ids:
        info = fixtures_map.get(fid, {})
        home_team_id = info.get("home_team_id")
        away_team_id = info.get("away_team_id")

        if dc_teams and home_team_id and away_team_id:
            match_params = params_for_match(
                dc_params, dc_teams, home_team_id, away_team_id
            )
            blended_matrix = score_matrix(match_params)
            dc_probs = probabilities_from_matrix(blended_matrix)
        else:
            blended_matrix = legacy_matrix
            dc_probs = legacy_probs

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
