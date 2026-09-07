from __future__ import annotations

import json

from fastapi import APIRouter, HTTPException, Query

from app.db.connection import get_connection

router = APIRouter()

LEAGUES = ("E0", "SP1", "D1", "I1", "F1")


@router.get("/fixtures")
def list_fixtures(
    league: str = "E0",
    limit: int = Query(default=100, ge=1, le=200),
):
    if league != "all" and league not in LEAGUES:
        raise HTTPException(
            status_code=422,
            detail=f"Unknown league '{league}'. Valid: all, {', '.join(LEAGUES)}",
        )
    clause = "" if league == "all" else "AND f.league = ?"
    params: tuple = () if league == "all" else (league,)
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
            f"WHERE 1 = 1 {clause} "
            "ORDER BY CASE WHEN f.status = 'pre' THEN 0 ELSE 1 END, "
            "CASE WHEN f.status = 'pre' THEN f.match_date ELSE '9999' END ASC, "
            "f.match_date DESC "
            "LIMIT ?",
            (*params, limit),
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
