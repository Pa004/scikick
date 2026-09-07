from __future__ import annotations

import logging

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)

FDORG_BASE = "https://api.football-data.org/v4"

COMPETITION_MAP = {
    "E0": "PL",
    "SP1": "PD",
    "D1": "BL1",
    "I1": "SA",
    "F1": "FL1",
}

# football-data.org full names -> football-data.co.uk short names used as
# canonical team names in our DB. Explicit on purpose: a wrong mapping
# silently attaches predictions to the wrong team.
TEAM_NAMES = {
    "E0": {
        "Arsenal FC": "Arsenal",
        "Aston Villa FC": "Aston Villa",
        "AFC Bournemouth": "Bournemouth",
        "Brentford FC": "Brentford",
        "Brighton & Hove Albion FC": "Brighton",
        "Burnley FC": "Burnley",
        "Chelsea FC": "Chelsea",
        "Crystal Palace FC": "Crystal Palace",
        "Everton FC": "Everton",
        "Fulham FC": "Fulham",
        "Leeds United FC": "Leeds",
        "Liverpool FC": "Liverpool",
        "Manchester City FC": "Man City",
        "Manchester United FC": "Man United",
        "Newcastle United FC": "Newcastle",
        "Nottingham Forest FC": "Nott'm Forest",
        "Sunderland AFC": "Sunderland",
        "Tottenham Hotspur FC": "Spurs",
        "West Ham United FC": "West Ham",
        "Wolverhampton Wanderers FC": "Wolves",
    },
    "SP1": {
        "Real Madrid CF": "Real Madrid",
        "FC Barcelona": "Barcelona",
        "Club Atlético de Madrid": "Ath Madrid",
        "Sevilla FC": "Sevilla",
        "Villarreal CF": "Villarreal",
        "Real Sociedad de Fútbol": "Sociedad",
        "Athletic Club": "Ath Bilbao",
        "Real Betis Balompié": "Betis",
        "Valencia CF": "Valencia",
        "Girona FC": "Girona",
        "Getafe CF": "Getafe",
        "CA Osasuna": "Osasuna",
        "RC Celta de Vigo": "Celta",
        "Rayo Vallecano de Madrid": "Vallecano",
        "RCD Mallorca": "Mallorca",
        "UD Las Palmas": "Las Palmas",
        "Deportivo Alavés": "Alaves",
        "RCD Espanyol de Barcelona": "Espanyol",
        "CD Leganés": "Leganes",
        "Real Valladolid CF": "Valladolid",
    },
    "D1": {
        "FC Bayern München": "Bayern Munich",
        "Borussia Dortmund": "Dortmund",
        "RB Leipzig": "RB Leipzig",
        "Bayer 04 Leverkusen": "Leverkusen",
        "VfB Stuttgart": "Stuttgart",
        "Borussia Mönchengladbach": "M'gladbach",
        "Eintracht Frankfurt": "Ein Frankfurt",
        "TSG 1899 Hoffenheim": "Hoffenheim",
        "VfL Wolfsburg": "Wolfsburg",
        "SC Freiburg": "Freiburg",
        "1. FSV Mainz 05": "Mainz",
        "FC Augsburg": "Augsburg",
        "SV Werder Bremen": "Werder Bremen",
        "1. FC Union Berlin": "Union Berlin",
        "VfL Bochum 1848": "Bochum",
        "FC St. Pauli 1910": "St Pauli",
        "Holstein Kiel": "Holstein Kiel",
        "1. FC Heidenheim 1846": "Heidenheim",
    },
    "I1": {
        "FC Internazionale Milano": "Inter",
        "AC Milan": "Milan",
        "Juventus FC": "Juventus",
        "SSC Napoli": "Napoli",
        "AS Roma": "Roma",
        "SS Lazio": "Lazio",
        "Atalanta BC": "Atalanta",
        "ACF Fiorentina": "Fiorentina",
        "Bologna FC 1909": "Bologna",
        "Torino FC": "Torino",
        "Udinese Calcio": "Udinese",
        "Empoli FC": "Empoli",
        "Genoa CFC": "Genoa",
        "Cagliari Calcio": "Cagliari",
        "Hellas Verona FC": "Verona",
        "US Lecce": "Lecce",
        "Parma Calcio 1913": "Parma",
        "Como 1907": "Como",
        "Venezia FC": "Venezia",
        "AC Monza": "Monza",
    },
    "F1": {
        "Paris Saint-Germain FC": "PSG",
        "Olympique de Marseille": "Marseille",
        "AS Monaco FC": "Monaco",
        "Olympique Lyonnais": "Lyon",
        "Lille OSC": "Lille",
        "OGC Nice": "Nice",
        "RC Lens": "Lens",
        "Stade Rennais FC 1901": "Rennes",
        "RC Strasbourg Alsace": "Strasbourg",
        "FC Nantes": "Nantes",
        "Montpellier HSC": "Montpellier",
        "Toulouse FC": "Toulouse",
        "AJ Auxerre": "Auxerre",
        "Angers SCO": "Angers",
        "Le Havre AC": "Le Havre",
        "Stade de Reims": "Reims",
        "AS Saint-Étienne": "St Etienne",
        "Stade Brestois 29": "Brest",
    },
}


def normalize_team_name(name: str, league_code: str) -> str:
    mapped = TEAM_NAMES.get(league_code, {}).get(name)
    if mapped:
        return mapped
    logger.warning("Unmapped team name '%s' for league %s", name, league_code)
    return name.removesuffix(" FC").removesuffix(" CF")


def fetch_scheduled(league_code: str) -> list[dict]:
    settings = get_settings()
    if not settings.football_data_org_key:
        logger.warning("FOOTBALL_DATA_ORG_KEY missing, skipping %s", league_code)
        return []

    competition = COMPETITION_MAP.get(league_code)
    if not competition:
        logger.warning("Unknown league code: %s", league_code)
        return []

    try:
        resp = httpx.get(
            f"{FDORG_BASE}/competitions/{competition}/matches",
            headers={"X-Auth-Token": settings.football_data_org_key},
            params={"status": "SCHEDULED"},
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception as exc:
        logger.warning("football-data.org request failed for %s: %s", league_code, exc)
        return []

    fixtures = []
    for match in data.get("matches", []):
        home = (match.get("homeTeam") or {}).get("name")
        away = (match.get("awayTeam") or {}).get("name")
        date = (match.get("utcDate") or "")[:10]
        if not home or not away or not date:
            continue
        fixtures.append({
            "api_fixture_id": match.get("id"),
            "date": match.get("utcDate"),
            "home_team": normalize_team_name(home, league_code),
            "away_team": normalize_team_name(away, league_code),
            "league": league_code,
        })
    return fixtures
