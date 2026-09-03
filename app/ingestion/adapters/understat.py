from __future__ import annotations

import json
import re
from pathlib import Path

import httpx


UNDERSTAT_MATCH_URL = "https://understat.com/match/{}"
UNDERSTAT_TEAM_URL = "https://understat.com/team/{}"
UNDERSTAT_LEAGUE_URL = "https://understat.com/league/{}"

_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
}


def _extract_json(html: str, var_name: str) -> dict | list | None:
    pattern = rf"var\s+{var_name}\s*=\s*JSON\.parse\('(.+?)'\)"
    match = re.search(pattern, html)
    if match:
        raw = match.group(1).encode().decode("unicode_escape")
        return json.loads(raw)
    return None


def fetch_match_xg(match_id: int) -> dict | None:
    try:
        resp = httpx.get(
            UNDERSTAT_MATCH_URL.format(match_id),
            headers=_HEADERS,
            timeout=15,
        )
        resp.raise_for_status()
        data = _extract_json(resp.text, "shotsData")
        if not data:
            return None

        home_xg = sum(float(s.get("xG", 0)) for s in data if s.get("h_a") == "h")
        away_xg = sum(float(s.get("xG", 0)) for s in data if s.get("h_a") == "a")
        return {"home_xg": home_xg, "away_xg": away_xg}
    except Exception:
        return None


def fetch_team_xg_history(team_slug: str, n_matches: int = 5) -> list[dict]:
    try:
        resp = httpx.get(
            UNDERSTAT_TEAM_URL.format(team_slug),
            headers=_HEADERS,
            timeout=15,
        )
        resp.raise_for_status()
        data = _extract_json(resp.text, "datesData")
        if not data:
            return []

        results = []
        for match in data[-n_matches:]:
            result = match.get("result", {})
            xG = json.loads(match.get("xG", "{}")) if isinstance(match.get("xG"), str) else match.get("xG", {})
            results.append({
                "date": match.get("datetime", ""),
                "home_xg": float(xG.get("h", 0)),
                "away_xg": float(xG.get("a", 0)),
                "opponent": match.get("h", {}).get("title") if match.get("a", {}).get("title") == team_slug else match.get("a", {}).get("title"),
            })
        return results
    except Exception:
        return []


def fetch_league_xg(league_slug: str) -> list[dict]:
    try:
        resp = httpx.get(
            UNDERSTAT_LEAGUE_URL.format(league_slug),
            headers=_HEADERS,
            timeout=15,
        )
        resp.raise_for_status()
        data = _extract_json(resp.text, "datesData")
        if not data:
            return []
        return data
    except Exception:
        return []


def fetch_match_player_xg(match_id: int) -> list[dict] | None:
    try:
        resp = httpx.get(
            UNDERSTAT_MATCH_URL.format(match_id),
            headers=_HEADERS,
            timeout=15,
        )
        resp.raise_for_status()
        shots = _extract_json(resp.text, "shotsData")
        if not shots:
            return None

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

        result = []
        for rec in players.values():
            result.append(rec)
        return result
    except Exception:
        return None


def fetch_league_players_stats(league_slug: str) -> list[dict]:
    try:
        resp = httpx.get(
            UNDERSTAT_LEAGUE_URL.format(league_slug),
            headers=_HEADERS,
            timeout=15,
        )
        resp.raise_for_status()
        players_data = _extract_json(resp.text, "playersData")
        if not players_data:
            return []

        result = []
        for p in players_data:
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
    except Exception:
        return []
