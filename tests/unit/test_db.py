import sqlite3
from pathlib import Path

from app.db.connection import get_connection, db_session
from app.db.migrations import get_user_version, run_migrations


def test_connection_row_factory() -> None:
    with db_session() as conn:
        conn.execute("CREATE TABLE t (a INTEGER)")
        conn.execute("INSERT INTO t VALUES (42)")
        row = conn.execute("SELECT * FROM t").fetchone()
        assert row["a"] == 42


def test_db_session_commits(tmp_db) -> None:
    with db_session(str(tmp_db)) as conn:
        conn.execute("CREATE TABLE t (a INTEGER)")
        conn.execute("INSERT INTO t VALUES (1)")
    with db_session(str(tmp_db)) as conn:
        result = conn.execute("SELECT COUNT(*) FROM t").fetchone()[0]
        assert result == 1


def test_db_session_rolls_back_on_error(tmp_db) -> None:
    with db_session(str(tmp_db)) as conn:
        conn.execute("CREATE TABLE t (a INTEGER)")
    try:
        with db_session(str(tmp_db)) as conn:
            conn.execute("INSERT INTO t VALUES (1)")
            raise ValueError("boom")
    except ValueError:
        pass
    with db_session(str(tmp_db)) as conn:
        result = conn.execute("SELECT COUNT(*) FROM t").fetchone()[0]
        assert result == 0


def test_connection_fk_enabled(tmp_db) -> None:
    with db_session(str(tmp_db)) as conn:
        result = conn.execute("PRAGMA foreign_keys").fetchone()[0]
        assert result == 1


def test_migrations_reach_v8_with_crest_column(tmp_path: Path) -> None:
    db_path = str(tmp_path / "mig.db")
    applied = run_migrations(db_path)
    assert applied >= 1
    conn = sqlite3.connect(db_path)
    try:
        assert get_user_version(conn) == 8
        cols = [r[1] for r in conn.execute("PRAGMA table_info(teams)").fetchall()]
        assert "crest_url" in cols
    finally:
        conn.close()
