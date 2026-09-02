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
