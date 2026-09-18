from __future__ import annotations

import json
import sqlite3
from pathlib import Path

import numpy as np

from app.db.migrations import run_migrations
from app.models import predict as predict_module
from app.models.lightgbm_model import _FEATURE_COLS


def _setup_db(tmp_path: Path) -> str:
    from app.features.build_features import build_features, persist_features

    db_path = str(tmp_path / "blend.db")
    run_migrations(db_path)
    conn = sqlite3.connect(db_path)
    conn.execute(
        "INSERT INTO leagues (id, name, country, tier, source_csv_code, "
        "has_odds, has_xg, season_start_month, min_seasons) "
        "VALUES ('E0', 'Premier League', 'England', 1, 'E0', 1, 0, 8, 2)"
    )
    conn.execute("INSERT INTO teams (id, canonical_name) VALUES (1, 'TeamA')")
    conn.execute("INSERT INTO teams (id, canonical_name) VALUES (2, 'TeamB')")
    conn.execute(
        "INSERT INTO fixtures (league, match_date, home_team_id, away_team_id, "
        "status, home_score, away_score, source, source_fixture_id) "
        "VALUES ('E0', '2026-09-10', 1, 2, 'post', 2, 0, 'football_data', 'post_1_2')"
    )
    conn.execute(
        "INSERT INTO fixtures (league, match_date, home_team_id, away_team_id, "
        "status, source, source_fixture_id) "
        "VALUES ('E0', '2026-09-20', 1, 2, 'pre', 'football_data', 'pre_1_2')"
    )
    df = build_features(conn, "E0")
    assert len(df) == 2
    persist_features(conn, df)
    conn.commit()
    conn.close()
    return db_path


def _run_data() -> dict:
    team = {"games": 10, "home_attack": 0.3, "home_defense": -0.1,
            "away_attack": 0.1, "away_defense": 0.2}
    return {
        "blend_weight_dc": 0.6,
        "model_agreement": 0.1,
        "dc_params": {"home_attack": 0.2, "home_defense": -0.1,
                      "away_attack": 0.1, "away_defense": 0.0,
                      "home_advantage": 0.25, "rho": -0.1},
        "dc_teams": {"home_advantage": 0.25, "rho": -0.1,
                     "teams": {"1": team, "2": team}},
    }


class _StubEnsemble:
    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        return np.array([[0.0, 0.0, 1.0]])


def _prediction(db_path: str) -> dict:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    try:
        conn.execute("UPDATE fixtures SET prediction = NULL WHERE id = 2")
        conn.commit()
        predict_module.predict_future(conn, "E0")
        row = conn.execute(
            "SELECT prediction FROM fixtures WHERE id = 2"
        ).fetchone()
        return json.loads(row["prediction"])
    finally:
        conn.close()


def test_predict_future_blends_ensemble_when_available(tmp_path: Path, monkeypatch) -> None:
    db_path = _setup_db(tmp_path)
    monkeypatch.setattr(predict_module, "_load_latest_run", lambda league: _run_data())
    monkeypatch.setattr(
        predict_module, "_load_latest_ensemble_models", lambda league: None
    )
    dc_only = _prediction(db_path)["probabilities"]
    monkeypatch.setattr(
        predict_module, "_load_latest_ensemble_models", lambda league: _StubEnsemble()
    )
    pred = _prediction(db_path)
    assert pred["blend_applied"] is True
    probs = pred["probabilities"]
    # All-away stub with w=0.6 must pull the 1x2 off pure DC.
    assert probs["away"] > dc_only["away"]
    assert probs["home"] < dc_only["home"]
    assert abs(probs["home"] + probs["draw"] + probs["away"] - 1.0) < 1e-6


def test_predict_future_falls_back_to_dc_only(tmp_path: Path, monkeypatch) -> None:
    db_path = _setup_db(tmp_path)
    monkeypatch.setattr(predict_module, "_load_latest_run", lambda league: _run_data())
    monkeypatch.setattr(
        predict_module, "_load_latest_ensemble_models", lambda league: None
    )
    pred = _prediction(db_path)
    assert pred["blend_applied"] is False
    probs = pred["probabilities"]
    assert abs(probs["home"] + probs["draw"] + probs["away"] - 1.0) < 1e-6


def test_reconstruct_blended_matrix_matches_blend() -> None:
    from app.models.dixon_coles import DixonColesParams, probabilities_from_matrix
    from app.models.pipeline import _reconstruct_blended_matrix

    params = DixonColesParams(
        home_attack=0.2, home_defense=-0.1, away_attack=0.1,
        away_defense=0.0, home_advantage=0.25, rho=-0.1,
    )
    out = _reconstruct_blended_matrix(params, np.array([0.0, 0.0, 1.0]), 0.6)
    probs = probabilities_from_matrix(out)
    assert abs(probs["home"] + probs["draw"] + probs["away"] - 1.0) < 1e-9
    # All-away LightGBM with w=0.6 must dominate the DC home lean.
    assert probs["away"] > probs["home"]
    assert probs["away"] > 0.4


def test_build_features_includes_pre_without_polluting_history(tmp_path: Path) -> None:
    from app.features.build_features import build_features

    db_path = _setup_db(tmp_path)
    conn = sqlite3.connect(db_path)
    try:
        df = build_features(conn, "E0")
        assert len(df) == 2
        pre = df[df["fixture_id"] == 2].iloc[0]
        assert pre["target_1x2"] is None or str(pre["target_1x2"]) == "nan"
        # Form reflects only the resolved win (3 pts), not a phantom loss.
        assert pre["home_form_pts_last_5"] == 3.0
    finally:
        conn.close()
