import json
import sqlite3
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from app.db.migrations import run_migrations
from app.models.dixon_coles import (
    DixonColesParams,
    DixonColesTeams,
    fit_dixon_coles,
    fit_team_strengths,
    params_for_match,
    probabilities_from_matrix,
    score_matrix,
)
from app.models.pipeline import _dc_predict_1x2, train_league
from app.models.predict import predict_future


def _synthetic(n_teams=4, seed=7):
    rng = np.random.default_rng(seed)
    home_ids, away_ids, hg, ag = [], [], [], []
    for h in range(1, n_teams + 1):
        for a in range(1, n_teams + 1):
            if h == a:
                continue
            home_ids.append(h)
            away_ids.append(a)
            hg.append(int(rng.integers(0, 4)))
            ag.append(int(rng.integers(0, 3)))
    team_map = {tid: idx for idx, tid in enumerate(sorted(set(home_ids + away_ids)))}
    return (
        np.array(home_ids), np.array(away_ids),
        np.array(hg), np.array(ag),
        len(team_map), team_map,
    )


def test_fit_team_strengths_structure():
    h, a, hg, ag, n, mapping = _synthetic()
    teams = fit_team_strengths(h, a, hg, ag, n, mapping)
    assert isinstance(teams, DixonColesTeams)
    assert set(teams.strengths) == set(mapping)
    for vals in teams.strengths.values():
        assert set(vals) == {"home_attack", "home_defense", "away_attack", "away_defense", "games"}
        assert all(isinstance(v, float) for k, v in vals.items() if k != "games")


def test_fit_dixon_coles_still_averaged():
    h, a, hg, ag, n, mapping = _synthetic()
    params = fit_dixon_coles(h, a, hg, ag, n, mapping)
    assert isinstance(params, DixonColesParams)


def test_params_for_match_known_teams():
    averaged = DixonColesParams(0.1, -0.1, 0.05, -0.05, 0.3, -0.1)
    teams = DixonColesTeams(
        strengths={
            1: {"home_attack": 0.9, "home_defense": -0.4, "away_attack": 0.2, "away_defense": 0.1, "games": 100},
            2: {"home_attack": -0.5, "home_defense": 0.3, "away_attack": -0.2, "away_defense": 0.4, "games": 100},
        },
        home_advantage=0.3,
        rho=-0.1,
    )
    params = params_for_match(averaged, teams, 1, 2)
    assert params.home_attack == pytest.approx((100 * 0.9 + 8 * 0.1) / 108)
    assert params.away_defense == pytest.approx((100 * 0.4 + 8 * -0.05) / 108)


def test_params_for_match_zero_games_is_league_mean():
    averaged = DixonColesParams(0.1, -0.1, 0.05, -0.05, 0.3, -0.1)
    teams = DixonColesTeams(
        strengths={
            1: {"home_attack": 0.9, "home_defense": -0.4, "away_attack": 0.2, "away_defense": 0.1, "games": 0},
        },
        home_advantage=0.3,
        rho=-0.1,
    )
    assert params_for_match(averaged, teams, 1, 2) == averaged


def test_fit_counts_team_games():
    h, a, hg, ag, n, mapping = _synthetic()
    teams = fit_team_strengths(h, a, hg, ag, n, mapping)
    total = sum(v["games"] for v in teams.strengths.values())
    assert total == 2 * len(hg)
    assert all(v["games"] > 0 for v in teams.strengths.values())


def test_params_for_match_unknown_falls_back_to_mean():
    averaged = DixonColesParams(0.1, -0.1, 0.05, -0.05, 0.3, -0.1)
    teams = DixonColesTeams(strengths={}, home_advantage=0.3, rho=-0.1)
    assert params_for_match(averaged, teams, 99, 100) == averaged
    assert params_for_match(averaged, None, 1, 2) == averaged


def test_dc_predict_differs_per_fixture():
    h, a, hg, ag, n, mapping = _synthetic()
    averaged = fit_dixon_coles(h, a, hg, ag, n, mapping)
    teams = fit_team_strengths(h, a, hg, ag, n, mapping)
    test_df = pd.DataFrame({"home_team_id": [1, 3], "away_team_id": [2, 4]})
    preds = _dc_predict_1x2(averaged, teams, test_df)
    assert preds.shape == (2, 3)
    assert not np.allclose(preds[0], preds[1])


def _setup_mini_db(tmp_path: Path) -> sqlite3.Connection:
    import random
    from datetime import timedelta, date

    db_path = str(tmp_path / "mini.db")
    run_migrations(db_path)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute(
        "INSERT INTO leagues (id, name, country, tier, source_csv_code, "
        "has_odds, has_xg, season_start_month, min_seasons) "
        "VALUES ('E0', 'Premier League', 'England', 1, 'E0', 1, 0, 8, 2)"
    )
    for tid in range(1, 11):
        conn.execute("INSERT INTO teams (id, canonical_name) VALUES (?, ?)", (tid, f"Team{tid}"))
    rng = random.Random(42)
    base = date(2023, 8, 1)
    for md in range(20):
        dt = (base + timedelta(weeks=md)).isoformat()
        pairs = [(h, a) for h in range(1, 11) for a in range(1, 11) if h != a]
        rng.shuffle(pairs)
        for h, a in pairs[:5]:
            hg, ag = rng.randint(0, 4), rng.randint(0, 3)
            conn.execute(
                "INSERT INTO fixtures "
                "(league, match_date, home_team_id, away_team_id, competition_type, "
                "status, home_score, away_score, result_checked, source, source_fixture_id) "
                "VALUES ('E0', ?, ?, ?, 'liga', 'post', ?, ?, 0, 'football_data', ?)",
                (dt, h, a, hg, ag, f"E0_{dt}_{h}_{a}"),
            )
    for hid, aid in [(1, 2), (3, 4)]:
        conn.execute(
            "INSERT INTO fixtures "
            "(league, match_date, home_team_id, away_team_id, competition_type, "
            "status, result_checked, source, source_fixture_id) "
            "VALUES ('E0', '2025-12-01', ?, ?, 'liga', 'pre', 0, 'api_football', ?)",
            (hid, aid, f"pre_{hid}_{aid}"),
        )
    conn.commit()
    return conn


def test_predict_future_differs_per_fixture(tmp_path: Path):
    conn = _setup_mini_db(tmp_path)
    try:
        result = train_league(conn, "E0", mode="light", min_train_matches=80)
        assert "error" not in result, result.get("error")
        predicted = predict_future(conn, "E0")
        assert predicted["predicted"] == 2
        rows = conn.execute(
            "SELECT prediction FROM fixtures WHERE status = 'pre' ORDER BY id"
        ).fetchall()
        p1 = json.loads(rows[0]["prediction"])["markets"]["1x2"]
        p2 = json.loads(rows[1]["prediction"])["markets"]["1x2"]
        assert (p1["home"], p1["draw"], p1["away"]) != (p2["home"], p2["draw"], p2["away"])
    finally:
        conn.close()
