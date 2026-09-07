from __future__ import annotations

import sqlite3
from pathlib import Path

from app.db.migrations import run_migrations
from app.players.model import (
    effective_min_minutes,
    shrink_xg90,
    expected_goals,
    p_anytime,
    rank_scorers,
    ScorerPlayer,
)
from app.players.pipeline import predict_scorer, build_scorer_players, save_scorer_run, load_scorer_run


def _apply_migrations(db_path: str) -> None:
    run_migrations(db_path)


def _setup_db(tmp_path: Path, n_players: int = 8) -> str:
    db_path = str(tmp_path / "test.db")
    _apply_migrations(db_path)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row

    conn.execute("INSERT INTO leagues (id, name, country, tier, source_csv_code, has_odds, season_start_month, min_seasons) "
                 "VALUES ('E0', 'PL', 'England', 1, 'E0', 1, 8, 2)")
    conn.execute("INSERT INTO teams (id, canonical_name) VALUES (1, 'TeamA')")
    conn.execute("INSERT INTO teams (id, canonical_name) VALUES (2, 'TeamB')")
    conn.execute(
        "INSERT INTO fixtures (league, match_date, home_team_id, away_team_id, status, source, source_fixture_id) "
        "VALUES ('E0', '2024-12-01', 1, 2, 'pre', 'football_data', 'E0_2024-12-01_1_2')"
    )

    for i in range(n_players):
        team = 'TeamA' if i < n_players // 2 else 'TeamB'
        conn.execute(
            "INSERT INTO players (name, team_name, position, xg90, npxg90, minutes_total, games, source, source_player_id) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, 'understat', ?)",
            (f"Player{i}", team, "F", 0.3 + i * 0.05, 0.25 + i * 0.04, 2000 + i * 100, 25 + i, f"p{i}"),
        )

    conn.commit()
    conn.close()
    return db_path


def test_shrink_xg90_high_minutes():
    result = shrink_xg90(0.8, 3000, "F")
    assert 0.5 < result < 0.85
    assert result > 0.35


def test_shrink_xg90_low_minutes():
    result = shrink_xg90(0.8, 100, "F")
    assert result < 0.5
    assert result > 0.2


def test_shrink_xg90_zero_minutes():
    result = shrink_xg90(0.8, 0, "F")
    assert result == 0.35


def test_shrink_xg90_midfielder():
    result = shrink_xg90(0.5, 2000, "M C")
    assert 0.1 < result < 0.5


def test_expected_goals_basic():
    assert abs(expected_goals(0.5, 90) - 0.5) < 0.001
    assert abs(expected_goals(0.5, 45) - 0.25) < 0.001


def test_p_anytime_basic():
    assert abs(p_anytime(0.0) - 0.0) < 0.001
    assert abs(p_anytime(1.0) - (1 - 2.71828 ** (-1))) < 0.01
    assert 0 < p_anytime(0.5) < 1


def test_rank_scorers_sorted(tmp_path: Path):
    db_path = _setup_db(tmp_path)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row

    players = build_scorer_players(conn, 1, "E0")
    scorers = rank_scorers(players)

    assert len(scorers) > 0
    probs = [s.prob_anytime for s in scorers]
    assert probs == sorted(probs, reverse=True)
    conn.close()


def test_rank_scorers_filters_low_minutes():
    players = [
        ScorerPlayer(1, "A", "Team", "F", 0.8, 0.7, 500, 10, "home", 75, None, "understat"),
        ScorerPlayer(2, "B", "Team", "F", 0.5, 0.4, 100, 3, "home", 75, None, "understat"),
    ]
    scorers = rank_scorers(players)
    ids = [s.player_id for s in scorers]
    assert 1 in ids
    assert 2 not in ids


def test_predict_scorer_no_lineup(tmp_path: Path):
    db_path = _setup_db(tmp_path)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row

    result = predict_scorer(conn, 1, "E0")
    assert result["data_quality"] == "lineup_projected"
    assert len(result["scorers"]) > 0
    assert all(s["projected"] is True for s in result["scorers"])
    conn.close()


def test_projected_xi_marks_top11_and_bench(tmp_path: Path):
    from app.players.pipeline import _mark_projected_xi

    players = [
        {"id": i, "team_name": "TeamA", "minutes_total": 1000 - i * 10}
        for i in range(15)
    ]
    marked = _mark_projected_xi(players)
    starters = [p for p in marked if "minutes_expected" not in p]
    bench = [p for p in marked if p.get("minutes_expected") == 15.0]
    assert len(starters) == 11
    assert len(bench) == 4
    assert all(p["projected"] for p in marked)
    assert starters[0]["id"] == 0


def test_predict_scorer_not_found(tmp_path: Path):
    db_path = _setup_db(tmp_path)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row

    result = predict_scorer(conn, 999, "E0")
    assert "error" in result
    conn.close()

def test_save_load_scorer_run(tmp_path: Path, monkeypatch):
    monkeypatch.setattr("app.players.pipeline.PLAYER_RUNS_DIR", str(tmp_path / "player_runs"))
    result = {"fixture_id": 1, "scorers": []}
    path = save_scorer_run("E0", result)
    assert Path(path).exists()
    loaded = load_scorer_run("E0")
    assert loaded is not None
    assert loaded["fixture_id"] == 1


def test_effective_min_minutes():
    assert effective_min_minutes(3000) == 450
    assert effective_min_minutes(450) == 337
    assert effective_min_minutes(270) == 202
    assert effective_min_minutes(89) == 450
    assert effective_min_minutes(0) == 450


def test_normalize_understat_team():
    from app.players.ingest import normalize_understat_team

    canonicals = ["Man City", "Newcastle", "Spurs", "Arsenal", "Hull City"]
    assert normalize_understat_team("Arsenal", "E0", canonicals) == "Arsenal"
    assert normalize_understat_team("Manchester City", "E0", canonicals) == "Man City"
    assert normalize_understat_team("Tottenham", "E0", canonicals) == "Spurs"
    assert normalize_understat_team("Hull", "E0", canonicals) == "Hull City"
    assert normalize_understat_team("Manchester City FC", "E0", canonicals) == "Man City"
    assert normalize_understat_team("A, B", "E0", canonicals) is None
    assert normalize_understat_team("Bedford Town", "E0", canonicals) is None


def test_ingest_early_season_includes_regulars(tmp_path: Path, monkeypatch):
    from unittest.mock import patch

    from app.players import ingest as ingest_module

    db_path = str(tmp_path / "early.db")
    run_migrations(db_path)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute(
        "INSERT INTO leagues (id, name, country, tier, source_csv_code, "
        "has_odds, has_xg, season_start_month, min_seasons) "
        "VALUES ('E0', 'PL', 'England', 1, 'E0', 1, 0, 8, 2)"
    )
    conn.commit()

    stats = [
        {"player_id": "1", "name": "Star", "team": "Arsenal", "position": "F",
         "games": 3, "minutes": 270, "goals": 2, "assists": 0, "xg": 1.5, "npxg": 1.2},
        {"player_id": "2", "name": "Fringe", "team": "Arsenal", "position": "F",
         "games": 1, "minutes": 15, "goals": 1, "assists": 0, "xg": 0.9, "npxg": 0.1},
    ]
    with patch.object(ingest_module, "fetch_league_xg", return_value=[{"id": 1}]), \
         patch.object(ingest_module, "fetch_league_players_stats", return_value=stats), \
         patch.object(ingest_module.time, "sleep", return_value=None):
        result = ingest_module.ingest_league_players(conn, "E0")
    conn.close()
    assert result["players_inserted"] == 1
