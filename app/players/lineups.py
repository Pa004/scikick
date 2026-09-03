from __future__ import annotations

import sqlite3
import time

from rapidfuzz import fuzz

from app.config import get_settings
from app.ingestion.adapters.api_football import fetch_lineups as _fetch_lineups_raw

_MIN_NAME_SCORE = 80


def fetch_lineups(api_fixture_id: int) -> list[dict] | None:
    raw = _fetch_lineups_raw(api_fixture_id)
    if not raw:
        return None
    return raw


def persist_lineups(
    conn: sqlite3.Connection, fixture_id: int, raw_players: list[dict]
) -> dict:
    fixture = conn.execute(
        "SELECT f.id, f.home_team_id, f.away_team_id, "
        "t1.canonical_name as home_name, t2.canonical_name as away_name "
        "FROM fixtures f "
        "JOIN teams t1 ON f.home_team_id = t1.id "
        "JOIN teams t2 ON f.away_team_id = t2.id "
        "WHERE f.id = ?",
        (fixture_id,),
    ).fetchone()
    if not fixture:
        return {"fixture_id": fixture_id, "matched": 0, "unmatched": 0}

    home_players = conn.execute(
        "SELECT id, name FROM players WHERE team_name = ?", (fixture["home_name"],)
    ).fetchall()
    away_players = conn.execute(
        "SELECT id, name FROM players WHERE team_name = ?", (fixture["away_name"],)
    ).fetchall()

    candidates_by_team = {
        "home": [(r["id"], r["name"]) for r in home_players],
        "away": [(r["id"], r["name"]) for r in away_players],
    }

    matched = 0
    unmatched = 0

    for p in raw_players:
        api_name = p.get("name", "")
        if not api_name:
            unmatched += 1
            continue

        best_player_id = None
        best_score = 0
        for side in ("home", "away"):
            for local_id, local_name in candidates_by_team[side]:
                score = fuzz.WRatio(api_name.lower(), local_name.lower())
                if score >= _MIN_NAME_SCORE and score > best_score:
                    best_score = score
                    best_player_id = local_id

        if best_player_id is None:
            unmatched += 1
            continue

        conn.execute(
            "INSERT OR REPLACE INTO lineups (fixture_id, player_id, status, position) "
            "VALUES (?, ?, ?, ?)",
            (fixture_id, best_player_id, p.get("status", "starting"), p.get("position")),
        )
        matched += 1

    conn.commit()
    return {"fixture_id": fixture_id, "matched": matched, "unmatched": unmatched}


def ingest_lineups_for_upcoming(
    conn: sqlite3.Connection, league: str, window_hours: int = 24
) -> dict:
    settings = get_settings()
    if not settings.api_football_key:
        return {"league": league, "fixtures_updated": 0, "skipped": "no_api_key"}

    rows = conn.execute(
        "SELECT id, source_fixture_id, match_date "
        "FROM fixtures "
        "WHERE league = ? AND status = 'pre' AND source = 'api_football'",
        (league,),
    ).fetchall()

    updated = 0
    for row in rows:
        sfid = row["source_fixture_id"] or ""
        if not sfid.startswith("api_football_"):
            continue
        api_id = int(sfid.removeprefix("api_football_"))
        raw_players = fetch_lineups(api_id)
        if not raw_players:
            continue
        persist_lineups(conn, row["id"], raw_players)
        updated += 1
        time.sleep(6)

    return {"league": league, "fixtures_updated": updated}
