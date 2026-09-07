from __future__ import annotations

import sqlite3

from fastapi import APIRouter

from app.db.connection import get_connection

router = APIRouter()


def _result_for(home: str, away: str, hs: int, aws: int, team: str) -> str:
    if hs == aws:
        return "D"
    home_won = hs > aws
    if (team == home and home_won) or (team == away and not home_won):
        return "W"
    return "L"


def _team_form(conn: sqlite3.Connection, team: str, n: int = 5) -> list[dict]:
    rows = conn.execute(
        "SELECT f.match_date, t1.canonical_name AS home_name, "
        "t2.canonical_name AS away_name, f.home_score, f.away_score "
        "FROM fixtures f "
        "JOIN teams t1 ON f.home_team_id = t1.id "
        "JOIN teams t2 ON f.away_team_id = t2.id "
        "WHERE f.status = 'post' AND f.home_score IS NOT NULL "
        "AND f.away_score IS NOT NULL "
        "AND (t1.canonical_name = ? OR t2.canonical_name = ?) "
        "ORDER BY f.match_date DESC LIMIT ?",
        (team, team, n),
    ).fetchall()
    return [
        {
            "date": r["match_date"],
            "opponent": r["away_name"] if r["home_name"] == team else r["home_name"],
            "result": _result_for(r["home_name"], r["away_name"], r["home_score"], r["away_score"], team),
            "score": f"{r['home_score']}-{r['away_score']}",
        }
        for r in rows
    ]


def _head_to_head(conn: sqlite3.Connection, team: str, opponent: str) -> dict:
    rows = conn.execute(
        "SELECT t1.canonical_name AS home_name, t2.canonical_name AS away_name, "
        "f.home_score, f.away_score "
        "FROM fixtures f "
        "JOIN teams t1 ON f.home_team_id = t1.id "
        "JOIN teams t2 ON f.away_team_id = t2.id "
        "WHERE f.status = 'post' AND f.home_score IS NOT NULL "
        "AND f.away_score IS NOT NULL "
        "AND ((t1.canonical_name = ? AND t2.canonical_name = ?) "
        "OR (t1.canonical_name = ? AND t2.canonical_name = ?)) "
        "ORDER BY f.match_date DESC",
        (team, opponent, opponent, team),
    ).fetchall()
    record = {"wins": 0, "draws": 0, "losses": 0, "matches": []}
    for r in rows:
        result = _result_for(r["home_name"], r["away_name"], r["home_score"], r["away_score"], team)
        if result == "W":
            record["wins"] += 1
        elif result == "D":
            record["draws"] += 1
        else:
            record["losses"] += 1
        record["matches"].append({
            "score": f"{r['home_score']}-{r['away_score']}",
            "home": r["home_name"] == team,
        })
    return record


@router.get("/context")
def team_context(team: str, opponent: str = ""):
    conn = get_connection()
    try:
        body: dict = {"team": team, "form": _team_form(conn, team)}
        if opponent:
            body["opponent"] = opponent
            body["h2h"] = _head_to_head(conn, team, opponent)
        return body
    finally:
        conn.close()
