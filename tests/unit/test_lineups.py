from __future__ import annotations

import sqlite3
from pathlib import Path
from unittest.mock import patch

import pytest

from app.db.migrations import run_migrations


def _setup_db(tmp_path: Path) -> str:
    db_path = str(tmp_path / "test.db")
    run_migrations(db_path)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row

    conn.execute(
        "INSERT INTO leagues (id, name, country, tier, source_csv_code, has_odds, season_start_month, min_seasons) "
        "VALUES ('E0', 'PL', 'England', 1, 'E0', 1, 8, 2)"
    )
    conn.execute("INSERT INTO teams (id, canonical_name) VALUES (1, 'Arsenal')")
    conn.execute("INSERT INTO teams (id, canonical_name) VALUES (2, 'Chelsea')")

    conn.execute(
        "INSERT INTO fixtures (league, match_date, home_team_id, away_team_id, status, source, source_fixture_id) "
        "VALUES ('E0', '2025-09-10', 1, 2, 'pre', 'api_football', 'api_football_12345')"
    )

    players = [
        ("Bukayo Saka", "Arsenal", "F", 0.6, 0.55, 2800, 32, "u1"),
        ("Martin Odegaard", "Arsenal", "M", 0.35, 0.30, 2600, 30, "u2"),
        ("Cole Palmer", "Chelsea", "M", 0.45, 0.40, 2700, 31, "u3"),
        ("Nicolas Jackson", "Chelsea", "F", 0.4, 0.35, 2500, 29, "u4"),
        ("William Saliba", "Arsenal", "D", 0.05, 0.04, 2900, 33, "u5"),
    ]
    for name, team, pos, xg90, npxg90, mins, games, pid in players:
        conn.execute(
            "INSERT INTO players (name, team_name, position, xg90, npxg90, minutes_total, games, source, source_player_id) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, 'understat', ?)",
            (name, team, pos, xg90, npxg90, mins, games, pid),
        )

    conn.commit()
    conn.close()
    return db_path


def test_persist_lineups_matches_by_name(tmp_path: Path):
    db_path = _setup_db(tmp_path)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row

    from app.players.lineups import persist_lineups

    raw_players = [
        {"name": "B. Saka", "position": "F", "status": "starting", "player_id_api": 1001},
        {"name": "M. Odegaard", "position": "M", "status": "starting", "player_id_api": 1002},
        {"name": "C. Palmer", "position": "M", "status": "starting", "player_id_api": 2001},
        {"name": "N. Jackson", "position": "F", "status": "sub", "player_id_api": 2002},
    ]

    result = persist_lineups(conn, 1, raw_players)

    assert result["matched"] == 4
    assert result["unmatched"] == 0

    rows = conn.execute(
        "SELECT player_id, status FROM lineups WHERE fixture_id = 1 ORDER BY player_id"
    ).fetchall()
    assert len(rows) == 4

    statuses = {r["player_id"]: r["status"] for r in rows}
    saka_id = conn.execute("SELECT id FROM players WHERE name = 'Bukayo Saka'").fetchone()["id"]
    assert statuses[saka_id] == "starting"

    conn.close()


def test_persist_lineups_unknown_name_skipped(tmp_path: Path):
    db_path = _setup_db(tmp_path)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row

    from app.players.lineups import persist_lineups

    raw_players = [
        {"name": "B. Saka", "position": "F", "status": "starting", "player_id_api": 1001},
        {"name": "Totally Unknown Player", "position": "F", "status": "starting", "player_id_api": 9999},
    ]

    result = persist_lineups(conn, 1, raw_players)

    assert result["matched"] == 1
    assert result["unmatched"] == 1

    rows = conn.execute("SELECT player_id FROM lineups WHERE fixture_id = 1").fetchall()
    assert len(rows) == 1
    conn.close()


def test_persist_lineups_fixture_not_found(tmp_path: Path):
    db_path = _setup_db(tmp_path)
    conn = sqlite3.connect(db_path)

    from app.players.lineups import persist_lineups

    result = persist_lineups(conn, 999, [{"name": "X", "status": "starting"}])
    assert result["matched"] == 0
    assert result["unmatched"] == 0
    conn.close()


def test_ingest_lineups_no_api_key(tmp_path: Path):
    db_path = _setup_db(tmp_path)
    conn = sqlite3.connect(db_path)

    from app.players.lineups import ingest_lineups_for_upcoming

    with patch("app.players.lineups.get_settings") as mock:
        mock.return_value.api_football_key = ""
        result = ingest_lineups_for_upcoming(conn, "E0")
        assert result["skipped"] == "no_api_key"
        assert result["fixtures_updated"] == 0

    conn.close()


def test_ingest_lineups_calls_api(tmp_path: Path):
    db_path = _setup_db(tmp_path)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row

    fake_lineup = [
        {"name": "Bukayo Saka", "position": "F", "status": "starting", "player_id_api": 1001},
        {"name": "Cole Palmer", "position": "M", "status": "starting", "player_id_api": 2001},
    ]

    with patch("app.players.lineups.get_settings") as mock_settings, \
         patch("app.players.lineups.fetch_lineups") as mock_fetch:
        mock_settings.return_value.api_football_key = "test-key"
        mock_fetch.return_value = fake_lineup

        from app.players.lineups import ingest_lineups_for_upcoming
        result = ingest_lineups_for_upcoming(conn, "E0")

        assert result["fixtures_updated"] == 1
        mock_fetch.assert_called_once_with(12345)

    rows = conn.execute("SELECT player_id FROM lineups WHERE fixture_id = 1").fetchall()
    assert len(rows) == 2
    conn.close()


def test_persist_lineups_idempotent(tmp_path: Path):
    db_path = _setup_db(tmp_path)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row

    from app.players.lineups import persist_lineups

    raw = [{"name": "Bukayo Saka", "position": "F", "status": "starting", "player_id_api": 1001}]
    persist_lineups(conn, 1, raw)
    persist_lineups(conn, 1, raw)

    rows = conn.execute("SELECT * FROM lineups WHERE fixture_id = 1").fetchall()
    assert len(rows) == 1
    conn.close()
