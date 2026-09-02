import json
import sqlite3
import random
from datetime import timedelta, date
from pathlib import Path

import pytest

from app.db.migrations import run_migrations
from app.models.pipeline import train_league, resolve_predictions
from app.models.predict import predict_future


def _setup_e2e_db(tmp_path: Path, n_matchdays: int = 25) -> sqlite3.Connection:
    db_path = str(tmp_path / "e2e.db")
    run_migrations(db_path)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row

    conn.execute(
        "INSERT INTO leagues (id, name, country, tier, source_csv_code, "
        "has_odds, has_xg, season_start_month, min_seasons) "
        "VALUES ('E0', 'Premier League', 'England', 1, 'E0', 1, 0, 8, 2)"
    )
    teams = [(i, f"Team{i}") for i in range(1, 11)]
    for tid, tname in teams:
        conn.execute("INSERT INTO teams (id, canonical_name) VALUES (?, ?)", (tid, tname))

    rng = random.Random(42)
    base = date(2023, 8, 1)
    for md in range(n_matchdays):
        dt = base + timedelta(weeks=md)
        date_str = dt.isoformat()
        pairs = [(h, a) for h in range(1, 11) for a in range(1, 11) if h != a]
        rng.shuffle(pairs)
        for h, a in pairs[:5]:
            hg = rng.randint(0, 4)
            ag = rng.randint(0, 3)
            ht_h = min(hg, rng.randint(0, hg))
            ht_a = min(ag, rng.randint(0, ag))
            hc = rng.randint(0, 15)
            ac = rng.randint(0, 15)
            hy = rng.randint(0, 6)
            ay = rng.randint(0, 6)
            conn.execute(
                "INSERT INTO fixtures "
                "(league, match_date, home_team_id, away_team_id, competition_type, "
                "status, home_score, away_score, ht_home_score, ht_away_score, "
                "home_corners, away_corners, home_yellow, away_yellow, "
                "result_checked, source, source_fixture_id) "
                "VALUES (?, ?, ?, ?, 'liga', 'post', ?, ?, ?, ?, ?, ?, ?, ?, 0, 'football_data', ?)",
                ("E0", date_str, h, a, hg, ag, ht_h, ht_a, hc, ac, hy, ay,
                 f"E0_{date_str}_{h}_{a}"),
            )
    conn.commit()
    return conn


def _make_predict_conn(db_path: str):
    def _get_conn():
        conn = sqlite3.connect(db_path, timeout=10)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode = WAL")
        conn.execute("PRAGMA foreign_keys = ON")
        return conn
    return _get_conn


def test_e2e_train_predict_resolve_stats(tmp_path: Path):
    conn = _setup_e2e_db(tmp_path, n_matchdays=25)

    result = train_league(conn, "E0", mode="light", min_train_matches=50)
    assert "error" not in result, f"Train failed: {result}"
    assert result["n_folds"] > 0
    assert result["overall_brier"] < 1.0

    predict_future(conn, "E0")
    predicted = conn.execute(
        "SELECT COUNT(*) as cnt FROM fixtures WHERE league='E0' AND prediction IS NOT NULL"
    ).fetchone()["cnt"]
    assert predicted > 0

    written = resolve_predictions(conn, "E0")
    assert written > 0
    tracked = conn.execute("SELECT COUNT(*) as cnt FROM tracked WHERE league='E0'").fetchone()["cnt"]
    assert tracked > 0

    stats = conn.execute(
        "SELECT market, COUNT(*) as cnt, SUM(hit) as hits "
        "FROM tracked WHERE league='E0' GROUP BY market"
    ).fetchall()
    assert len(stats) > 0

    conn.close()
