from pathlib import Path

from app.db.connection import get_connection
from app.db.migrations import get_user_version, run_migrations


def test_run_migrations_applies_001(tmp_path: Path) -> None:
    db_path = str(tmp_path / "test.db")
    applied = run_migrations(db_path)
    assert applied == 4

    conn = get_connection(db_path)
    try:
        version = get_user_version(conn)
        assert version == 4

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
