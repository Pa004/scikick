from __future__ import annotations

import logging
import sqlite3
import time
from datetime import date, timedelta

from rapidfuzz import fuzz

from app.config import get_settings
from app.ingestion.adapters.api_football import (
    fetch_fixtures_by_date,
    fetch_lineups as _fetch_lineups_raw,
    normalize_api_name,
)

logger = logging.getLogger(__name__)

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


def resolve_api_ids_for_upcoming(
    conn: sqlite3.Connection, league: str, window_hours: int = 72
) -> dict:
    settings = get_settings()
    if not settings.api_football_key:
        return {"league": league, "resolved": 0, "skipped": "no_api_key"}
    if not settings.lineups_enabled:
        return {"league": league, "resolved": 0, "skipped": "disabled"}

    since = date.today().isoformat()
    rows = conn.execute(
        "SELECT f.id, f.match_date, t1.canonical_name AS home_name, "
        "t2.canonical_name AS away_name "
        "FROM fixtures f "
        "JOIN teams t1 ON f.home_team_id = t1.id "
        "JOIN teams t2 ON f.away_team_id = t2.id "
        "WHERE f.league = ? AND f.status = 'pre' "
        "AND f.api_football_id IS NULL AND f.match_date >= ? "
        "ORDER BY f.match_date",
        (league, since),
    ).fetchall()

    cutoff = date.today() + timedelta(hours=window_hours)
    resolved = 0
    cache: dict[str, list[dict]] = {}
    for row in rows:
        match_date = row["match_date"]
        if match_date > cutoff.isoformat():
            continue
        if match_date not in cache:
            cache[match_date] = fetch_fixtures_by_date(league, match_date)
            time.sleep(6)
        api_id = _match_api_fixture(cache[match_date], league, row["home_name"], row["away_name"])
        if api_id is None:
            logger.warning(
                "No API-Football match for %s %s vs %s",
                match_date, row["home_name"], row["away_name"],
            )
            continue
        conn.execute(
            "UPDATE fixtures SET api_football_id = ? WHERE id = ?",
            (api_id, row["id"]),
        )
        resolved += 1
    conn.commit()
    return {"league": league, "resolved": resolved}


def _match_api_fixture(
    candidates: list[dict], league: str, home_name: str, away_name: str
) -> int | None:
    for fix in candidates:
        api_home = normalize_api_name(fix.get("home_team") or "", league)
        api_away = normalize_api_name(fix.get("away_team") or "", league)
        if api_home == home_name and api_away == away_name:
            return fix.get("api_fixture_id")
    return None


def ingest_lineups_for_upcoming(
    conn: sqlite3.Connection, league: str, window_hours: int = 24
) -> dict:
    settings = get_settings()
    if not settings.api_football_key:
        return {"league": league, "fixtures_updated": 0, "skipped": "no_api_key"}
    if not settings.lineups_enabled:
        return {"league": league, "fixtures_updated": 0, "skipped": "disabled"}

    resolve_api_ids_for_upcoming(conn, league, window_hours=72)

    rows = conn.execute(
        "SELECT f.id, f.api_football_id "
        "FROM fixtures f "
        "WHERE f.league = ? AND f.status = 'pre' "
        "AND f.api_football_id IS NOT NULL "
        "AND NOT EXISTS (SELECT 1 FROM lineups l WHERE l.fixture_id = f.id)",
        (league,),
    ).fetchall()

    updated = 0
    for row in rows:
        raw_players = fetch_lineups(row["api_football_id"])
        if not raw_players:
            continue
        persist_lineups(conn, row["id"], raw_players)
        updated += 1
        time.sleep(6)

    return {"league": league, "fixtures_updated": updated}
