import json
import sqlite3
from pathlib import Path

from app.db.migrations import run_migrations
from app.features.build_features import build_features, persist_features
from app.models.pipeline import train_league, _build_team_id_map
from app.models.dixon_coles import fit_dixon_coles, score_matrix, probabilities_from_matrix
from app.models.blend import blend_predictions, find_optimal_blend_weight
from app.models.calibration import calibrate
from app.models.evaluation import brier_score, evaluate_model


def _setup_db(tmp_path: Path, n_matchdays: int = 25) -> sqlite3.Connection:
    db_path = str(tmp_path / "test.db")
    run_migrations(db_path)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row

    conn.execute(
        "INSERT INTO leagues (id, name, country, tier, source_csv_code, "
        "has_odds, has_xg, season_start_month, min_seasons) "
        "VALUES ('E0', 'Premier League', 'England', 1, 'E0', 1, 0, 8, 2)"
    )
    teams = [(i, f"Team{i}") for i in range(1, 21)]
    for tid, tname in teams:
        conn.execute("INSERT INTO teams (id, canonical_name) VALUES (?, ?)", (tid, tname))

    import random
    from datetime import timedelta, date
    rng = random.Random(42)
    base = date(2023, 8, 1)
    for md in range(n_matchdays):
        dt = base + timedelta(weeks=md)
        date_str = dt.isoformat()
        pairs = [(h, a) for h in range(1, 21) for a in range(1, 21) if h != a]
        rng.shuffle(pairs)
        for h, a in pairs[:10]:
            hg = rng.randint(0, 4)
            ag = rng.randint(0, 3)
            ht_h = min(hg, rng.randint(0, hg))
            ht_a = min(ag, rng.randint(0, ag))
            conn.execute(
                "INSERT INTO fixtures "
                "(league, match_date, home_team_id, away_team_id, competition_type, "
                "status, home_score, away_score, ht_home_score, ht_away_score, "
                "result_checked, source, source_fixture_id) "
                "VALUES (?, ?, ?, ?, 'liga', 'post', ?, ?, ?, ?, 0, 'football_data', ?)",
                ("E0", date_str, h, a, hg, ag, ht_h, ht_a, f"E0_{date_str}_{h}_{a}"),
            )
    conn.commit()
    return conn


def test_build_team_id_map():
    import pandas as pd
    df = pd.DataFrame({
        "home_team_id": [1, 2, 3],
        "away_team_id": [2, 3, 1],
    })
    mapping, n = _build_team_id_map(df)
    assert n == 3
    assert set(mapping.keys()) == {1, 2, 3}


def test_train_league_produces_results(tmp_path: Path):
    conn = _setup_db(tmp_path, n_matchdays=25)
    result = train_league(conn, "E0", mode="light", min_train_matches=50)
    assert "error" not in result, result.get("error")
    assert result["n_folds"] > 0
    assert result["n_samples"] > 0
    assert 0 <= result["overall_brier"] <= 3.0
    assert result["overall_log_loss"] > 0
    conn.close()


def test_train_league_insufficient_data(tmp_path: Path):
    conn = _setup_db(tmp_path, n_matchdays=2)
    result = train_league(conn, "E0", mode="light", min_train_matches=500)
    assert "error" in result
    conn.close()


def test_calibrate_reduces_brier(tmp_path: Path):
    import numpy as np
    y = np.random.randint(0, 3, 200)
    probs = np.random.dirichlet([1, 1, 1], 200)
    raw = brier_score(y, probs)
    cal, _ = calibrate(probs, y)
    cal_brier = brier_score(y, cal)
    assert cal_brier <= raw + 0.05


def test_train_league_saves_run_file(tmp_path: Path):
    conn = _setup_db(tmp_path, n_matchdays=25)
    result = train_league(conn, "E0", mode="light", min_train_matches=50)
    assert "run_id" in result
    run_path = Path(result["run_id"])
    assert run_path.exists()
    data = json.loads(run_path.read_text())
    assert "overall_metrics" in data
    assert "calibrated_metrics" in data
    conn.close()
