from __future__ import annotations

import sqlite3
from pathlib import Path

from app.db.migrations import run_migrations


def _apply_migrations(db_path: str) -> None:
    run_migrations(db_path)


def test_migration_005_applies(tmp_path: Path):
    db_path = str(tmp_path / "test.db")
    _apply_migrations(db_path)
    conn = sqlite3.connect(db_path)
    version = conn.execute("PRAGMA user_version").fetchone()[0]
    tables = [r[0] for r in conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).fetchall()]
    conn.close()

    assert version == 5
    assert "players" in tables
    assert "player_features" in tables
    assert "lineups" in tables


def test_migration_005_idempotent(tmp_path: Path):
    db_path = str(tmp_path / "test.db")
    _apply_migrations(db_path)
    _apply_migrations(db_path)
    conn = sqlite3.connect(db_path)
    version = conn.execute("PRAGMA user_version").fetchone()[0]
    conn.close()
    assert version == 5


def test_insert_player(tmp_path: Path):
    db_path = str(tmp_path / "test.db")
    _apply_migrations(db_path)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute(
        "INSERT INTO players (name, team_name, position, xg90, npxg90, minutes_total, games, source, source_player_id) "
        "VALUES ('Erling Haaland', 'Manchester City', 'F W', 0.85, 0.78, 2500, 30, 'understat', '8260')"
    )
    row = conn.execute("SELECT * FROM players WHERE name = 'Erling Haaland'").fetchone()
    conn.close()
    assert row is not None
    assert row["team_name"] == "Manchester City"
    assert row["xg90"] == 0.85
    assert row["source"] == "understat"


def test_insert_player_features(tmp_path: Path):
    db_path = str(tmp_path / "test.db")
    _apply_migrations(db_path)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row

    conn.execute("INSERT INTO teams (id, canonical_name) VALUES (1, 'TeamA')")
    conn.execute("INSERT INTO teams (id, canonical_name) VALUES (2, 'TeamB')")
    conn.execute(
        "INSERT INTO leagues (id, name, country, tier, source_csv_code, has_odds, season_start_month, min_seasons) "
        "VALUES ('E0', 'PL', 'England', 1, 'E0', 1, 8, 2)"
    )
    conn.execute(
        "INSERT INTO fixtures (league, match_date, home_team_id, away_team_id, status, source, source_fixture_id) "
        "VALUES ('E0', '2024-01-01', 1, 2, 'post', 'football_data', 'E0_2024-01-01_1_2')"
    )

    conn.execute(
        "INSERT INTO players (name, team_name, position, xg90, minutes_total, games, source, source_player_id) "
        "VALUES ('Player1', 'TeamA', 'F', 0.6, 2000, 25, 'understat', 'p1')"
    )
    pid = conn.execute("SELECT id FROM players WHERE name = 'Player1'").fetchone()[0]
    fid = conn.execute("SELECT id FROM fixtures LIMIT 1").fetchone()[0]

    conn.execute(
        "INSERT INTO player_features (fixture_id, player_id, team_name, xg90, npxg90, home_away) "
        "VALUES (?, ?, 'TeamA', 0.6, 0.55, 'home')",
        (fid, pid),
    )
    conn.commit()

    row = conn.execute("SELECT * FROM player_features WHERE fixture_id = ? AND player_id = ?", (fid, pid)).fetchone()
    conn.close()
    assert row is not None
    assert row["home_away"] == "home"
    assert row["xg90"] == 0.6


def test_understat_parse_players_stats():
    from app.ingestion.adapters.understat import fetch_league_players_stats
    assert callable(fetch_league_players_stats)


def test_ingest_league_players_no_slug():
    from app.players.ingest import ingest_league_players

    db_path = ":memory:"
    run_migrations(db_path)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    result = ingest_league_players(conn, "INVALID")
    assert "error" in result
    conn.close()
