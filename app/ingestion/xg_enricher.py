from __future__ import annotations

import sqlite3
from datetime import datetime

from rapidfuzz import fuzz

from app.ingestion.adapters.understat import fetch_league_xg


UNDERSTAT_SLUG_MAP = {
    "E0": "premier-league",
    "SP1": "la-liga",
    "D1": "bundesliga",
    "I1": "serie-a",
    "F1": "ligue-1",
}


def _match_xg_to_fixtures(
    fixtures: list[dict], league_xg: list[dict]
) -> dict[int, dict]:
    indexed_xg: list[tuple[str, str, str, dict]] = []
    for match in league_xg:
        home = match.get("h", {})
        away = match.get("a", {})
        home_title = home.get("title", "").lower() if isinstance(home, dict) else ""
        away_title = away.get("title", "").lower() if isinstance(away, dict) else ""
        date_str = match.get("datetime", "")[:10]
        if not home_title or not away_title or not date_str:
            continue
        xg = {
            "home_xg": float(match.get("xG", {}).get("h", 0))
            if isinstance(match.get("xG"), dict)
            else 0.0,
            "away_xg": float(match.get("xG", {}).get("a", 0))
            if isinstance(match.get("xG"), dict)
            else 0.0,
        }
        indexed_xg.append((home_title, away_title, date_str, xg))

    all_away_titles = list({e[1] for e in indexed_xg})

    matched: dict[int, dict] = {}
    for fix in fixtures:
        fid = fix["fixture_id"]
        home_name = fix["home_name"].lower()
        away_name = fix["away_name"].lower()
        date_str = fix["match_date"][:10]

        for h_title, a_title, xg_date, xg in indexed_xg:
            if xg_date != date_str:
                continue
            home_ok = fuzz.WRatio(home_name, h_title) >= 80
            away_ok = fuzz.WRatio(away_name, a_title) >= 80
            if home_ok and away_ok:
                matched[fid] = xg
                break

    return matched


def enrich_xg_for_fixtures(conn: sqlite3.Connection, league: str) -> int:
    understat_slug = UNDERSTAT_SLUG_MAP.get(league)
    if not understat_slug:
        return 0

    league_xg = fetch_league_xg(understat_slug)
    if not league_xg:
        return 0

    rows = conn.execute(
        "SELECT f.id as fixture_id, f.match_date, "
        "t1.canonical_name as home_name, t2.canonical_name as away_name "
        "FROM fixtures f "
        "JOIN teams t1 ON f.home_team_id = t1.id "
        "JOIN teams t2 ON f.away_team_id = t2.id "
        "WHERE f.league = ? AND f.status = 'post'",
        (league,),
    ).fetchall()

    fixtures = [
        {
            "fixture_id": r["fixture_id"],
            "match_date": r["match_date"],
            "home_name": r["home_name"],
            "away_name": r["away_name"],
        }
        for r in rows
    ]

    matched = _match_xg_to_fixtures(fixtures, league_xg)

    updated = 0
    for fid, xg in matched.items():
        conn.execute(
            "UPDATE match_features SET "
            "home_xg_last5_avg = ?, away_xg_last5_avg = ?, "
            "home_xg_missing = 0, away_xg_missing = 0 "
            "WHERE fixture_id = ?",
            (xg["home_xg"], xg["away_xg"], fid),
        )
        updated += 1

    conn.commit()
    return updated
