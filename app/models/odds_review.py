from __future__ import annotations

import json
import sqlite3

from app.models.value import MAX_EDGE, edge


def review_stored_odds(
    conn: sqlite3.Connection, league: str | None = None
) -> list[dict]:
    """Flag stored odds whose model edge exceeds MAX_EDGE.

    Such rows are almost certainly bad bookmaker data (stale or mismatched),
    not real opportunities — the API already hides them from value output.
    Returns one entry per atypical (fixture, side) pair.
    """
    query = (
        "SELECT o.fixture_id, o.bookmaker, o.home, o.draw, o.away, "
        "f.league, f.prediction, t1.canonical_name AS home_name, "
        "t2.canonical_name AS away_name "
        "FROM fixture_odds o "
        "JOIN fixtures f ON f.id = o.fixture_id "
        "JOIN teams t1 ON t1.id = f.home_team_id "
        "JOIN teams t2 ON t2.id = f.away_team_id "
        "WHERE f.prediction IS NOT NULL"
    )
    params: tuple = ()
    if league:
        query += " AND f.league = ?"
        params = (league,)

    flagged: list[dict] = []
    for row in conn.execute(query, params).fetchall():
        fid, bookmaker, home_odds, draw_odds, away_odds, league, prediction, home_name, away_name = row
        try:
            markets = json.loads(prediction).get("markets", {}).get("1x2", {})
            stored = {"home": home_odds, "draw": draw_odds, "away": away_odds}
        except (ValueError, TypeError, AttributeError):
            continue
        for side in ("home", "draw", "away"):
            prob = markets.get(side)
            odds = stored[side]
            if not isinstance(prob, (int, float)) or not isinstance(odds, (int, float)):
                continue
            ev = edge(float(prob), float(odds))
            if ev > MAX_EDGE:
                flagged.append({
                    "fixture_id": fid,
                    "league": league,
                    "match": f"{home_name} vs {away_name}",
                    "bookmaker": bookmaker,
                    "side": side,
                    "prob": round(float(prob), 4),
                    "odds": float(odds),
                    "edge": round(ev, 4),
                })
    flagged.sort(key=lambda r: r["edge"], reverse=True)
    return flagged
