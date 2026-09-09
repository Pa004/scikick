from __future__ import annotations

import logging

import httpx

from app.config import get_settings
from app.ingestion.adapters.football_data_org import TEAM_NAMES
from app.ingestion.aliases import canonicalize
from app.ingestion.seasons import current_season_start

logger = logging.getLogger(__name__)

API_FOOTBALL_BASE = "https://v3.football.api-sports.io"

LEAGUE_MAP = {
    "E0": {"league": 39},
    "SP1": {"league": 140},
    "D1": {"league": 78},
    "I1": {"league": 135},
    "F1": {"league": 61},
}

# API-Football names that neither match our canonical short names nor the
# "<name> FC" lookup into TEAM_NAMES. Everything else resolves via the trick.
API_NAME_OVERRIDES = {
    "E0": {
        "Bournemouth": "Bournemouth",
        "Sunderland": "Sunderland",
        "Brighton and Hove Albion": "Brighton",
    },
    "SP1": {
        "Atletico Madrid": "Ath Madrid",
        "Athletic Club": "Ath Bilbao",
        "Real Sociedad": "Sociedad",
        "Real Betis": "Betis",
        "Deportivo Alaves": "Alaves",
        "Celta Vigo": "Celta",
        "Rayo Vallecano": "Vallecano",
        "Alavés": "Alaves",
        "CA Osasuna": "Osasuna",
        "Athletic Bilbao": "Ath Bilbao",
        "Levante": "Levante UD",
        "Deportivo La Coruña": "RC Deportivo La Coruña",
        "Atlético Madrid": "Ath Madrid",
        "Espanyol": "Espanol",
    },
    "D1": {
        "Borussia Dortmund": "Dortmund",
        "Borussia Monchengladbach": "M'gladbach",
        "Eintracht Frankfurt": "Ein Frankfurt",
        "TSG Hoffenheim": "Hoffenheim",
        "FC St. Pauli": "St Pauli",
        "FC Schalke 04": "Schalke 04",
        "Bayer Leverkusen": "Leverkusen",
        "SC Paderborn": "SC Paderborn 07",
        "SC Freiburg": "Freiburg",
        "FSV Mainz 05": "Mainz",
        "VfB Stuttgart": "Stuttgart",
        "Elversberg": "SV 07 Elversberg",
        "1. FC Köln": "1. FC Köln",
        "Hamburger SV": "Hamburger SV",
    },
    "I1": {
        "AC Milan": "Milan",
        "AS Roma": "Roma",
        "SS Lazio": "Lazio",
        "Hellas Verona": "Verona",
        "Frosinone": "Frosinone Calcio",
        "Atalanta BC": "Atalanta",
        "Sassuolo": "US Sassuolo Calcio",
        "Inter Milan": "Inter",
    },
    "F1": {
        "Paris Saint Germain": "PSG",
        "Olympique Marseille": "Marseille",
        "AS Monaco": "Monaco",
        "Olympique Lyonnais": "Lyon",
        "Saint Etienne": "St Etienne",
        "Troyes": "ES Troyes AC",
        "RC Lens": "Racing Club de Lens",
        "Lorient": "Lorient",
        "Le Mans": "Le Mans",
    },
}


def normalize_api_name(name: str, league_code: str) -> str:
    name = canonicalize(name)
    table = TEAM_NAMES.get(league_code, {})
    override = API_NAME_OVERRIDES.get(league_code, {}).get(name)
    if override:
        return override
    if name in table.values():
        return name
    suffixed = f"{name} FC"
    if suffixed in table:
        return table[suffixed]
    stripped = name.removesuffix(" FC").removesuffix(" CF")
    if stripped in table.values():
        return stripped
    if stripped != name:
        return stripped
    logger.warning("Unmapped API-Football name '%s' for league %s", name, league_code)
    return name


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
        "season": season or current_season_start(),
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
        if data.get("errors"):
            logger.warning("API-Football error for %s: %s", league_code, data["errors"])
            return []

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
    except Exception as exc:
        logger.warning("API-Football fixtures failed for %s: %s", league_code, exc)
        return []


def fetch_fixtures_by_date(league_code: str, date_str: str) -> list[dict]:
    settings = get_settings()
    if not settings.api_football_key:
        return []

    league_info = LEAGUE_MAP.get(league_code)
    if not league_info:
        return []

    params = {
        "league": league_info["league"],
        "season": current_season_start(),
        "date": date_str,
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
        if data.get("errors"):
            logger.warning(
                "API-Football error for %s %s: %s",
                league_code, date_str, data["errors"],
            )
            return []

        fixtures = []
        for fix in data.get("response", []):
            fixture = fix.get("fixture", {})
            teams = fix.get("teams", {})
            fixtures.append({
                "api_fixture_id": fixture.get("id"),
                "date": fixture.get("date"),
                "home_team": teams.get("home", {}).get("name"),
                "away_team": teams.get("away", {}).get("name"),
                "league": league_code,
            })
        return fixtures
    except Exception as exc:
        logger.warning(
            "API-Football fixtures by date failed for %s %s: %s",
            league_code, date_str, exc,
        )
        return []


def fetch_lineups(api_fixture_id: int) -> list[dict] | None:
    settings = get_settings()
    if not settings.api_football_key:
        return None

    try:
        resp = httpx.get(
            f"{API_FOOTBALL_BASE}/fixtures/lineups",
            headers=_get_headers(),
            params={"fixture": api_fixture_id},
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
        if data.get("errors"):
            logger.warning("API-Football lineups error: %s", data["errors"])
            return None

        players = []
        for team_data in data.get("response", []):
            for xi in team_data.get("startXI", []):
                p = xi.get("player", {})
                players.append({
                    "player_id_api": p.get("id"),
                    "name": p.get("name", ""),
                    "position": p.get("pos", ""),
                    "status": "starting",
                })
            for sub in team_data.get("substitutes", []):
                p = sub.get("player", {})
                players.append({
                    "player_id_api": p.get("id"),
                    "name": p.get("name", ""),
                    "position": p.get("pos", ""),
                    "status": "sub",
                })
        return players if players else None
    except Exception:
        return None
