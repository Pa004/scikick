from __future__ import annotations

import sqlite3

import pandas as pd


def get_golden_fixtures(conn: sqlite3.Connection) -> pd.DataFrame:
    query = """
        SELECT f.id, f.match_date, f.league, f.home_team_id, f.away_team_id,
               f.home_score, f.away_score
        FROM fixtures f
        WHERE f.status = 'post' AND f.result_checked = 1
        ORDER BY f.match_date ASC
    """
    return pd.read_sql_query(query, conn)


def mark_golden(conn: sqlite3.Connection, fixture_ids: list[int]) -> int:
    if not fixture_ids:
        return 0
    placeholders = ",".join(["?"] * len(fixture_ids))
    conn.execute(
        f"UPDATE fixtures SET result_checked = 2 WHERE id IN ({placeholders})",
        fixture_ids,
    )
    return len(fixture_ids)
