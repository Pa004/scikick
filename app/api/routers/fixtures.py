from __future__ import annotations

import json

from fastapi import APIRouter

from app.db.connection import get_connection

router = APIRouter()


@router.get("/fixtures")
def list_fixtures(league: str = "E0", limit: int = 100):
    conn = get_connection()
    try:
        rows = conn.execute(
            "SELECT f.id, f.match_date, f.league, f.status, "
            "f.home_score, f.away_score, f.ht_home_score, f.ht_away_score, "
            "f.prediction, f.result_checked, "
            "t1.canonical_name as home_name, t2.canonical_name as away_name "
            "FROM fixtures f "
            "JOIN teams t1 ON f.home_team_id = t1.id "
            "JOIN teams t2 ON f.away_team_id = t2.id "
            "WHERE f.league = ? "
            "ORDER BY f.match_date DESC "
            "LIMIT ?",
            (league, limit),
        ).fetchall()

        fixtures = []
        for row in rows:
            fixture = {
                "id": row["id"],
                "date": row["match_date"],
                "home": row["home_name"],
                "away": row["away_name"],
                "status": row["status"],
                "home_score": row["home_score"],
                "away_score": row["away_score"],
                "ht_home_score": row["ht_home_score"],
                "ht_away_score": row["ht_away_score"],
                "prediction": json.loads(row["prediction"]) if row["prediction"] else None,
                "result_checked": row["result_checked"],
            }
            fixtures.append(fixture)

        return {"fixtures": fixtures, "league": league, "count": len(fixtures)}
    finally:
        conn.close()
