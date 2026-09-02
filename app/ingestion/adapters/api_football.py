from __future__ import annotations

import httpx

from app.config import get_settings

API_FOOTBALL_BASE = "https://v3.football.api-sports.io"

LEAGUE_MAP = {
    "E0": {"league": 39, "season": 2024},
    "SP1": {"league": 140, "season": 2024},
    "D1": {"league": 78, "season": 2024},
    "I1": {"league": 135, "season": 2024},
    "F1": {"league": 61, "season": 2024},
}


def _get_headers() -> dict:
    settings = get_settings()
    return {
        "x-rapidapi-key": settings.api_football_key,
        "x-rapidapi-host": "v3.football.api-sports.io",
    }


def fetch_fixtures(league_code: str, season: int | None = None) -> list[dict]:
    settings = get_settings()
    if not settings.api_football_key:
        return []

    league_info = LEAGUE_MAP.get(league_code)
    if not league_info:
        return []

    params = {
        "league": league_info["league"],
        "season": season or league_info["season"],
        "status": "NS",
    }

    try:
        resp = httpx.get(
            f"{API_FOOTBALL_BASE}/fixtures",
            headers=_get_headers(),
            params=params,
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()

        fixtures = []
        for fix in data.get("response", []):
            fixture = fix.get("fixture", {})
            teams = fix.get("teams", {})
            fixtures.append({
                "api_fixture_id": fixture.get("id"),
                "date": fixture.get("date"),
                "home_team": teams.get("home", {}).get("name"),
                "away_team": teams.get("away", {}).get("name"),
                "home_team_id": teams.get("home", {}).get("id"),
                "away_team_id": teams.get("away", {}).get("id"),
                "league": league_code,
            })
        return fixtures
    except Exception:
        return []
