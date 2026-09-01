from pathlib import Path

from app.db.migrations import run_migrations
from app.db.connection import get_connection
from app.models.golden import get_golden_fixtures, mark_golden


def _setup_db(tmp_path: Path):
    db_path = str(tmp_path / "test.db")
    run_migrations(db_path)
    conn = get_connection(db_path)
    conn.execute(
        "INSERT INTO leagues (id, name, country, tier, source_csv_code, "
        "has_odds, has_xg, season_start_month, min_seasons) "
        "VALUES ('E0', 'Premier League', 'England', 1, 'E0', 1, 0, 8, 2)"
    )
    conn.execute("INSERT INTO teams (id, canonical_name) VALUES (1, 'Arsenal')")
    conn.execute("INSERT INTO teams (id, canonical_name) VALUES (2, 'Chelsea')")
    conn.execute(
        "INSERT INTO fixtures "
        "(league, match_date, home_team_id, away_team_id, competition_type, "
        "status, home_score, away_score, result_checked, source, source_fixture_id) "
        "VALUES ('E0', '2023-08-12', 1, 2, 'liga', 'post', 2, 1, 1, 'test', 'f1')"
    )
    conn.commit()
    return conn, db_path


def test_get_golden_fixtures(tmp_path):
    conn, _ = _setup_db(tmp_path)
    df = get_golden_fixtures(conn)
    assert len(df) == 1
    conn.close()


def test_mark_golden(tmp_path):
    conn, _ = _setup_db(tmp_path)
    fixture_id = conn.execute("SELECT id FROM fixtures LIMIT 1").fetchone()[0]
    count = mark_golden(conn, [fixture_id])
    assert count == 1
    conn.commit()
    row = conn.execute("SELECT result_checked FROM fixtures WHERE id = ?", (fixture_id,)).fetchone()
    assert row[0] == 2
    conn.close()
