from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

import joblib

from app.players.model import (
    ScorerPlayer,
    BENCH_MIN_EXPECTED,
    PROJECTED_XI_SIZE,
    effective_min_minutes,
    shrink_xg90,
    expected_goals,
    p_anytime,
    rank_scorers,
)

PLAYER_RUNS_DIR = str(Path(__file__).resolve().parent.parent.parent / "data" / "player_runs")


def _get_player_season_stats(
    conn: sqlite3.Connection, team_names: list[str]
) -> list[dict]:
    if not team_names:
        return []
    placeholders = ",".join("?" * len(team_names))
    max_minutes = conn.execute(
        f"SELECT MAX(minutes_total) FROM players WHERE team_name IN ({placeholders})",
        team_names,
    ).fetchone()[0] or 0
    gate = effective_min_minutes(max_minutes)
    rows = conn.execute(
        "SELECT p.id, p.name, p.team_name, p.position, p.xg90, p.npxg90, "
        "p.minutes_total, p.games, p.source "
        f"FROM players p WHERE p.team_name IN ({placeholders}) "
        "AND p.minutes_total >= ? ORDER BY p.xg90 DESC",
        (*team_names, gate),
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


def _mark_projected_xi(players: list[dict]) -> list[dict]:
    by_team: dict[str, list[dict]] = {}
    for p in players:
        by_team.setdefault(p["team_name"], []).append(p)
    marked = []
    for team_players in by_team.values():
        starters = sorted(team_players, key=lambda p: p["minutes_total"], reverse=True)
        for i, p in enumerate(starters):
            row = dict(p)
            row["projected"] = True
            if i >= PROJECTED_XI_SIZE:
                row["minutes_expected"] = BENCH_MIN_EXPECTED
            marked.append(row)
    return marked


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

    players = _get_player_season_stats(conn, [fixture["home_name"], fixture["away_name"]])
    if not has_lineup:
        players = _mark_projected_xi(players)
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
        min_expected = p.get("minutes_expected", _estimate_minutes(status))

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
            projected=p.get("projected", False),
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
    gate = effective_min_minutes(max((p.minutes_total for p in players), default=0))
    scorers = rank_scorers(players, min_minutes=gate)

    return {
        "fixture_id": fixture_id,
        "status": "ok",
        "data_quality": "lineup_confirmed" if has_lineup else "lineup_projected",
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
                "projected": s.projected,
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
