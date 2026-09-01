import sqlite3

from app.db.connection import get_connection, db_session


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
