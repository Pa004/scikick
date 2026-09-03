from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

import joblib

from app.players.model import (
    ScorerPlayer,
    shrink_xg90,
    expected_goals,
    p_anytime,
    rank_scorers,
)

PLAYER_RUNS_DIR = str(Path(__file__).resolve().parent.parent.parent / "data" / "player_runs")


def _get_player_season_stats(conn: sqlite3.Connection, league: str) -> list[dict]:
    rows = conn.execute(
        "SELECT p.id, p.name, p.team_name, p.position, p.xg90, p.npxg90, "
        "p.minutes_total, p.games, p.source "
        "FROM players p "
        "WHERE p.minutes_total >= 450 "
        "ORDER BY p.xg90 DESC"
    ).fetchall()
    return [dict(r) for r in rows]


def _get_lineup_for_fixture(conn: sqlite3.Connection, fixture_id: int) -> dict[int, dict]:
    rows = conn.execute(
        "SELECT l.player_id, l.status, l.position, "
        "t1.canonical_name as home_name, t2.canonical_name as away_name "
        "FROM lineups l "
        "JOIN fixtures f ON f.id = l.fixture_id "
        "JOIN teams t1 ON f.home_team_id = t1.id "
        "JOIN teams t2 ON f.away_team_id = t2.id "
        "WHERE l.fixture_id = ?",
        (fixture_id,),
    ).fetchall()
    result = {}
    for r in rows:
        result[r["player_id"]] = {
            "status": r["status"],
            "position": r["position"],
        }
    return result


def _estimate_minutes(status: str | None) -> float:
    if status == "starting":
        return 75.0
    if status == "sub":
        return 25.0
    return 60.0


def build_scorer_players(
    conn: sqlite3.Connection, fixture_id: int, league: str
) -> list[ScorerPlayer]:
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
        return []

    lineup = _get_lineup_for_fixture(conn, fixture_id)
    has_lineup = len(lineup) > 0

    players = _get_player_season_stats(conn, league)
    result = []

    for p in players:
        team_name = p["team_name"]
        if team_name == fixture["home_name"]:
            home_away = "home"
        elif team_name == fixture["away_name"]:
            home_away = "away"
        else:
            continue

        if has_lineup and p["id"] not in lineup:
            continue

        li = lineup.get(p["id"], {})
        status = li.get("status")
        min_expected = _estimate_minutes(status)

        result.append(ScorerPlayer(
            player_id=p["id"],
            name=p["name"],
            team_name=team_name,
            position=p.get("position", "F"),
            xg90=p["xg90"],
            npxg90=p["npxg90"],
            minutes_total=p["minutes_total"],
            games=p["games"],
            home_away=home_away,
            min_expected=min_expected,
            opponent_xga=None,
            source=p.get("source", "understat"),
        ))

    return result


def predict_scorer(conn: sqlite3.Connection, fixture_id: int, league: str) -> dict:
    fixture = conn.execute(
        "SELECT id, status FROM fixtures WHERE id = ?", (fixture_id,)
    ).fetchone()
    if not fixture:
        return {"error": "Fixture not found"}

    has_lineup = conn.execute(
        "SELECT COUNT(*) as cnt FROM lineups WHERE fixture_id = ?", (fixture_id,)
    ).fetchone()["cnt"] > 0

    players = build_scorer_players(conn, fixture_id, league)
    scorers = rank_scorers(players)

    return {
        "fixture_id": fixture_id,
        "status": "ok",
        "data_quality": "lineup_confirmed" if has_lineup else "lineup_unavailable",
        "scorers": [
            {
                "player_id": s.player_id,
                "name": s.name,
                "team": s.team_name,
                "position": s.position,
                "xg90": round(s.xg90, 3),
                "min_expected": s.min_expected,
                "prob_anytime": round(s.prob_anytime, 4),
                "home_away": s.home_away,
            }
            for s in scorers
        ],
    }


def save_scorer_run(league: str, result: dict) -> str:
    run_dir = Path(PLAYER_RUNS_DIR) / league
    run_dir.mkdir(parents=True, exist_ok=True)
    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    run_file = run_dir / f"scorer_{ts}.json"
    run_file.write_text(json.dumps(result, indent=2))
    return str(run_file)


def load_scorer_run(league: str) -> dict | None:
    run_dir = Path(PLAYER_RUNS_DIR) / league
    if not run_dir.exists():
        return None
    files = sorted(run_dir.glob("scorer_*.json"))
    if not files:
        return None
    try:
        return json.loads(files[-1].read_text())
    except Exception:
        return None
