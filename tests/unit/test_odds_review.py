from __future__ import annotations

import json
import sqlite3
from pathlib import Path

from app.db.migrations import run_migrations
from app.models.odds_review import review_stored_odds


def _setup_db(tmp_path: Path) -> str:
    db_path = str(tmp_path / "review.db")
    run_migrations(db_path)
    conn = sqlite3.connect(db_path)
    conn.execute(
        "INSERT INTO leagues (id, name, country, tier, source_csv_code, "
        "has_odds, has_xg, season_start_month, min_seasons) "
        "VALUES ('E0', 'Premier League', 'England', 1, 'E0', 1, 0, 8, 2)"
    )
    conn.execute("INSERT INTO teams (id, canonical_name) VALUES (1, 'TeamA')")
    conn.execute("INSERT INTO teams (id, canonical_name) VALUES (2, 'TeamB')")
    prediction = json.dumps({"markets": {"1x2": {"home": 0.52, "draw": 0.26, "away": 0.22}}})
    conn.execute(
        "INSERT INTO fixtures (league, match_date, home_team_id, away_team_id, "
        "status, source, source_fixture_id, prediction) "
        "VALUES ('E0', '2026-09-20', 1, 2, 'pre', 'football_data', 'pre_1', ?)",
        (prediction,),
    )
    conn.execute(
        "INSERT INTO fixture_odds (fixture_id, bookmaker, home, draw, away, fetched_at) "
        "VALUES (1, 'best-eu', 2.10, 3.40, 19.50, '2026-09-18T00:00:00Z')"
    )
    conn.commit()
    conn.close()
    return db_path


def test_review_flags_only_atypical_sides(tmp_path: Path) -> None:
    conn = sqlite3.connect(_setup_db(tmp_path))
    try:
        flagged = review_stored_odds(conn)
        assert len(flagged) == 1
        row = flagged[0]
        assert (row["side"], row["odds"]) == ("away", 19.50)
        assert row["edge"] > 1.0
        assert row["match"] == "TeamA vs TeamB"
    finally:
        conn.close()


def test_review_empty_without_odds(tmp_path: Path) -> None:
    db_path = _setup_db(tmp_path)
    conn = sqlite3.connect(db_path)
    try:
        conn.execute("DELETE FROM fixture_odds")
        conn.commit()
        assert review_stored_odds(conn) == []
    finally:
        conn.close()


def test_review_accepts_league_filter(tmp_path: Path) -> None:
    conn = sqlite3.connect(_setup_db(tmp_path))
    try:
        assert review_stored_odds(conn, "E0") != []
        assert review_stored_odds(conn, "SP1") == []
    finally:
        conn.close()
