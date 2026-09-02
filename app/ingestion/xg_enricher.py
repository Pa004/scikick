from __future__ import annotations

import sqlite3

from app.ingestion.adapters.understat import fetch_match_xg


def enrich_xg_for_fixtures(conn: sqlite3.Connection, source_fixture_ids: list[str]) -> int:
    updated = 0
    for sfid in source_fixture_ids:
        understat_id = sfid.split("_")[-1] if "_" in sfid else None
        if not understat_id or not understat_id.isdigit():
            continue

        xg_data = fetch_match_xg(int(understat_id))
        if not xg_data:
            continue

        conn.execute(
            "UPDATE match_features SET "
            "home_xg_last5_avg = ?, away_xg_last5_avg = ?, "
            "home_xg_missing = 0, away_xg_missing = 0 "
            "WHERE fixture_id IN (SELECT id FROM fixtures WHERE source_fixture_id = ?)",
            (xg_data["home_xg"], xg_data["away_xg"], sfid),
        )
        updated += 1

    return updated
