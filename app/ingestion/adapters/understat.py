from __future__ import annotations

from datetime import datetime

import httpx


UNDERSTAT_API_LEAGUE = "https://understat.com/getLeagueData/{league}/{season}"
UNDERSTAT_API_MATCH = "https://understat.com/getMatchData/{match_id}"

_API_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "X-Requested-With": "XMLHttpRequest",
}


def _resolve_season() -> int:
    return datetime.now().year - 1


def _get_json(url: str) -> dict | None:
    try:
        resp = httpx.get(url, headers=_API_HEADERS, timeout=15)
        resp.raise_for_status()
        return resp.json()
    except Exception:
        return None


def _flatten_shots(shots: dict) -> list[dict]:
    if not isinstance(shots, dict):
        return []
    home = shots.get("h", [])
    away = shots.get("a", [])
    return list(home) + list(away)


def fetch_match_xg(match_id: int) -> dict | None:
    data = _get_json(UNDERSTAT_API_MATCH.format(match_id=match_id))
    if not data:
        return None

    shots = _flatten_shots(data.get("shots", {}))
    home_xg = sum(float(s.get("xG", 0)) for s in shots if s.get("h_a") == "h")
    away_xg = sum(float(s.get("xG", 0)) for s in shots if s.get("h_a") == "a")
    return {"home_xg": home_xg, "away_xg": away_xg}


def fetch_league_xg(league_slug: str) -> list[dict]:
    data = _get_json(UNDERSTAT_API_LEAGUE.format(league=league_slug, season=_resolve_season()))
    if not data:
        return []
    dates = data.get("dates", [])
    return dates if isinstance(dates, list) else []


def fetch_match_player_xg(match_id: int) -> list[dict] | None:
    data = _get_json(UNDERSTAT_API_MATCH.format(match_id=match_id))
    if not data:
        return None

    shots = _flatten_shots(data.get("shots", {}))
    players: dict[str, dict] = {}
    for shot in shots:
        player = shot.get("player", "")
        if not player:
            continue
        key = f"{player}_{shot.get('h_a', '')}"
        if key not in players:
            players[key] = {
                "player": player,
                "player_id": shot.get("player_id", ""),
                "team": "",
                "h_a": shot.get("h_a"),
                "xg_total": 0.0,
                "shots": 0,
            }
        players[key]["xg_total"] += float(shot.get("xG", 0))
        players[key]["shots"] += 1

    return list(players.values())


def fetch_league_players_stats(league_slug: str) -> list[dict]:
    data = _get_json(UNDERSTAT_API_LEAGUE.format(league=league_slug, season=_resolve_season()))
    if not data:
        return []

    result = []
    for p in data.get("players", []):
        result.append({
            "player_id": str(p.get("id", "")),
            "name": p.get("player_name", ""),
            "team": p.get("team_title", ""),
            "position": p.get("position", ""),
            "games": int(p.get("games", 0)),
            "minutes": int(p.get("time", 0)),
            "goals": int(p.get("goals", 0)),
            "assists": int(p.get("assists", 0)),
            "xg": float(p.get("xG", 0)),
            "npxg": float(p.get("npxG", 0)),
        })
    return result
