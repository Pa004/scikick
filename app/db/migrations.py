from __future__ import annotations

import sqlite3
from pathlib import Path

from app.db.connection import get_connection


def get_user_version(conn: sqlite3.Connection) -> int:
    return conn.execute("PRAGMA user_version").fetchone()[0]


def set_user_version(conn: sqlite3.Connection, version: int) -> None:
    conn.execute(f"PRAGMA user_version = {version}")


def run_migrations(db_path: str | None = None, migrations_dir: str | None = None) -> int:
    if migrations_dir is None:
        migrations_dir = str(Path(__file__).resolve().parent.parent.parent / "migrations")

    conn = get_connection(db_path)
    current = get_user_version(conn)
    applied = 0

    try:
        for sql_file in sorted(Path(migrations_dir).glob("*.sql")):
            file_version = int(sql_file.stem.split("_")[0])
            if file_version > current:
                conn.executescript(sql_file.read_text(encoding="utf-8"))
                applied += 1
    finally:
        conn.close()

    return applied
