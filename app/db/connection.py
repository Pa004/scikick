from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from typing import Generator

from app.config import get_settings

_PRAGMAS = [
    "PRAGMA journal_mode = WAL",
    "PRAGMA foreign_keys = ON",
    "PRAGMA busy_timeout = 5000",
]


def get_connection(db_path: str | None = None) -> sqlite3.Connection:
    path = db_path or get_settings().database_url
    conn = sqlite3.connect(path, timeout=10)
    conn.row_factory = sqlite3.Row
    for pragma in _PRAGMAS:
        conn.execute(pragma)
    return conn


@contextmanager
def db_session(db_path: str | None = None) -> Generator[sqlite3.Connection, None, None]:
    conn = get_connection(db_path)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
