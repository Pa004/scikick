from __future__ import annotations

import logging
import sqlite3
from datetime import datetime, timezone

from app.ingestion.adapters.odds_api import fetch_h2h
from app.ingestion.adapters.api_football import normalize_api_name

logger = logging.getLogger(__name__)


def sync_odds_for_league(
    conn: sqlite3.Connection, league: str
) -> dict:
    events = fetch_h2h(league)
    if not events:
        return {"league": league, "matched": 0, "events": 0}

    rows = conn.execute(
        "SELECT f.id, f.match_date, t1.canonical_name AS home_name, "
        "t2.canonical_name AS away_name "
        "FROM fixtures f "
        "JOIN teams t1 ON f.home_team_id = t1.id "
        "JOIN teams t2 ON f.away_team_id = t2.id "
        "WHERE f.league = ? AND f.status = 'pre'",
        (league,),
    ).fetchall()

    by_date: dict[str, list] = {}
    for fix in rows:
        by_date.setdefault(fix["match_date"], []).append(fix)

    now = datetime.now(timezone.utc).isoformat()
    matched = 0
    for event in events:
        candidates = by_date.get(event["date"], [])
        fixture_id = _match_event(candidates, league, event)
        if fixture_id is None:
            logger.warning(
                "Odds event without fixture: %s %s vs %s "
                "(available %s dates: %s)",
                event.get("date"), event.get("home_team"), event.get("away_team"),
                league, sorted(by_date.keys())[:8],
            )
            continue
        best = _to_1x2(event)
        if not best:
            continue
        conn.execute(
            "INSERT OR REPLACE INTO fixture_odds "
            "(fixture_id, bookmaker, home, draw, away, fetched_at) "
            "VALUES (?, 'best-eu', ?, ?, ?, ?)",
            (fixture_id, best["home"], best["draw"], best["away"], now),
        )
        matched += 1

    conn.commit()
    return {"league": league, "matched": matched, "events": len(events)}


def _match_event(candidates: list, league: str, event: dict) -> int | None:
    api_home = normalize_api_name(event.get("home_team") or "", league)
    api_away = normalize_api_name(event.get("away_team") or "", league)
    for fix in candidates:
        if api_home == fix["home_name"] and api_away == fix["away_name"]:
            return fix["id"]
    logger.warning(
        "Odds event without fixture: %s %s vs %s",
        event.get("date"), event.get("home_team"), event.get("away_team"),
    )
    return None


def _to_1x2(event: dict) -> dict | None:
    best = event.get("best", {})
    try:
        return {
            "home": float(best[event["home_team"]]["price"]),
            "draw": float(best["Draw"]["price"]),
            "away": float(best[event["away_team"]]["price"]),
        }
    except (KeyError, TypeError, ValueError):
        return None
