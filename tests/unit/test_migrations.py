from pathlib import Path

from app.db.connection import get_connection
from app.db.migrations import get_user_version, run_migrations


def test_run_migrations_applies_001(tmp_path: Path) -> None:
    db_path = str(tmp_path / "test.db")
    applied = run_migrations(db_path)
    assert applied == 9

    conn = get_connection(db_path)
    try:
        version = get_user_version(conn)
        assert version == 9

        tables = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        ).fetchall()
        table_names = [row["name"] for row in tables]
        assert "leagues" in table_names
        assert "teams" in table_names
        assert "team_aliases" in table_names
        assert "fixtures" in table_names
        assert "tracked" in table_names
        assert "match_features" in table_names
    finally:
        conn.close()


def test_run_migrations_idempotent(tmp_path: Path) -> None:
    db_path = str(tmp_path / "test.db")
    run_migrations(db_path)
    applied = run_migrations(db_path)
    assert applied == 0


def test_run_migrations_resumes_after_partial_apply(tmp_path: Path) -> None:
    import sqlite3

    db_path = str(tmp_path / "test.db")
    run_migrations(db_path)
    # Simulate an interrupted past run: 002 columns present, version stuck at 1.
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA user_version = 1")
    conn.commit()
    conn.close()
    applied = run_migrations(db_path)
    conn = get_connection(db_path)
    try:
        assert get_user_version(conn) == 9
        cols = [row[1] for row in conn.execute("PRAGMA table_info(fixtures)").fetchall()]
        assert "home_corners" in cols
    finally:
        conn.close()
    assert applied == 8


def test_migration_009_indexes_and_odds_cascade(tmp_path: Path) -> None:
    import sqlite3

    db_path = str(tmp_path / "test.db")
    run_migrations(db_path)
    conn = get_connection(db_path)
    try:
        indexes = {row["name"] for row in conn.execute(
            "SELECT name FROM sqlite_master WHERE type = 'index'"
        ).fetchall()}
        assert "idx_fixtures_league_status_date" in indexes
        assert "idx_tracked_market_league" in indexes
        conn.execute(
            "INSERT INTO leagues (id, name, country, tier, source_csv_code, "
            "has_odds, has_xg, season_start_month, min_seasons) "
            "VALUES ('E0', 'PL', 'England', 1, 'E0', 1, 0, 8, 2)"
        )
        conn.execute("INSERT INTO teams (id, canonical_name) VALUES (1, 'A')")
        conn.execute("INSERT INTO teams (id, canonical_name) VALUES (2, 'B')")
        conn.execute(
            "INSERT INTO fixtures (league, match_date, home_team_id, away_team_id, "
            "status, source, source_fixture_id) "
            "VALUES ('E0', '2026-09-20', 1, 2, 'pre', 'fd', 'x1')"
        )
        conn.execute(
            "INSERT INTO fixture_odds (fixture_id, bookmaker, home, draw, away, fetched_at) "
            "VALUES (1, 'best-eu', 2.0, 3.0, 4.0, '2026-09-18T00:00:00Z')"
        )
        conn.execute("DELETE FROM fixtures WHERE id = 1")
        assert conn.execute("SELECT COUNT(*) FROM fixture_odds").fetchone()[0] == 0
        conn.execute(
            "INSERT INTO fixtures (league, match_date, home_team_id, away_team_id, "
            "status, source, source_fixture_id) "
            "VALUES ('E0', '2026-09-21', 1, 2, 'pre', 'fd', 'x2')"
        )
        rejected = False
        try:
            conn.execute(
                "INSERT INTO fixture_odds (fixture_id, bookmaker, home, draw, away, fetched_at) "
                "VALUES (2, 'best-eu', 1.0, 3.0, 4.0, '2026-09-18T00:00:00Z')"
            )
        except sqlite3.IntegrityError:
            rejected = True
        assert rejected
    finally:
        conn.close()


def test_each_migration_leaves_its_artifacts(tmp_path: Path) -> None:
    import sqlite3

    db_path = str(tmp_path / "test.db")
    run_migrations(db_path)
    conn = sqlite3.connect(db_path)
    try:
        tables = {row[0] for row in conn.execute(
            "SELECT name FROM sqlite_master WHERE type = 'table'"
        ).fetchall()}

        def cols(table: str) -> set[str]:
            return {row[1] for row in conn.execute(f"PRAGMA table_info({table})").fetchall()}

        assert {"players", "player_features", "lineups"} <= tables  # 005
        assert "fixture_odds" in tables  # 007
        assert "home_corners_avg_last5" in cols("match_features")  # 003
        assert "target_home_ht_goals" in cols("match_features")  # 004
        assert "api_football_id" in cols("fixtures")  # 006
        assert "crest_url" in cols("teams")  # 008
    finally:
        conn.close()


def test_migration_002_adds_corners_cards_odds_columns(tmp_path: Path) -> None:
    db_path = str(tmp_path / "test.db")
    run_migrations(db_path)
    conn = get_connection(db_path)
    try:
        cols = [row[1] for row in conn.execute("PRAGMA table_info(fixtures)").fetchall()]
        assert "home_corners" in cols
        assert "away_corners" in cols
        assert "home_yellow" in cols
        assert "away_yellow" in cols
        assert "home_red" in cols
        assert "away_red" in cols
        assert "referee" in cols
        assert "avg_home_odds" in cols
        assert "avg_draw_odds" in cols
        assert "avg_away_odds" in cols
    finally:
        conn.close()
