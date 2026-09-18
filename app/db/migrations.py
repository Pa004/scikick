from __future__ import annotations

import sqlite3
from pathlib import Path

from app.db.connection import get_connection


def get_user_version(conn: sqlite3.Connection) -> int:
    return conn.execute("PRAGMA user_version").fetchone()[0]


def set_user_version(conn: sqlite3.Connection, version: int) -> None:
    conn.execute(f"PRAGMA user_version = {version}")


def _statements(text: str) -> list[str]:
    # Migration files are simple one-statement-per-chunk DDL (no triggers
    # or semicolons inside literals), so a naive split is safe here.
    chunks: list[str] = []
    for chunk in text.split(";"):
        lines = [ln for ln in chunk.splitlines() if not ln.strip().startswith("--")]
        stmt = "\n".join(lines).strip()
        if stmt:
            chunks.append(stmt)
    return chunks


def run_migrations(db_path: str | None = None, migrations_dir: str | None = None) -> int:
    if migrations_dir is None:
        migrations_dir = str(Path(__file__).resolve().parent.parent.parent / "migrations")

    conn = get_connection(db_path)
    current = get_user_version(conn)
    applied = 0

    try:
        for sql_file in sorted(Path(migrations_dir).glob("*.sql")):
            file_version = int(sql_file.stem.split("_")[0])
            if file_version <= current:
                continue
            # Statement-by-statement so a partial past run (columns already
            # added, version never bumped) resumes instead of dying on
            # "duplicate column name" forever.
            for stmt in _statements(sql_file.read_text(encoding="utf-8")):
                if stmt.strip().upper().startswith("PRAGMA"):
                    continue
                try:
                    conn.execute(stmt)
                except sqlite3.OperationalError as exc:
                    if "duplicate column name" not in str(exc).lower():
                        conn.rollback()
                        raise
            set_user_version(conn, file_version)
            conn.commit()
            current = file_version
            applied += 1
    finally:
        conn.close()

    return applied
