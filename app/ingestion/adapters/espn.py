"""ESPN scoreboard adapter (currently: Ecuador Liga Pro, EC1).

Free, keyless, but bot-sensitive: use a research UA, never a full browser
string. Returns the same fixture-dict shape as the other scheduled adapters
(api_fixture_id, date, home_team, away_team, crests, league) so
_insert_future_fixtures consumes it unchanged.
"""
from __future__ import annotations

import logging
import time
from datetime import date, timedelta
from pathlib import Path

logger = logging.getLogger(__name__)

from app.ingestion.adapters.football_data_org import normalize_team_name

BASE_URL = "https://site.api.espn.com/apis/site/v2/sports/soccer"
HEADERS = {"User-Agent": "Mozilla/5.0 (research)"}

ESPN_SLUG_MAP = {
    "EC1": "ecu.1",
}

# Minimal history columns; FTR is derived so load_csv validation holds.
HISTORY_COLS = ["Div", "Date", "HomeTeam", "AwayTeam", "FTHG", "FTAG", "FTR"]


def _get_json(url: str, timeout: int = 20) -> dict:
    from curl_cffi import requests as impersonated

    last: Exception | None = None
    for _ in range(3):
        try:
            resp = impersonated.get(
                url, headers=HEADERS, timeout=timeout, impersonate="chrome120"
            )
            # HTTP 400 is deterministic (e.g. unsupported date range):
            # retrying never helps.
            if resp.status_code == 400:
                raise ConnectionError(f"ESPN bad request for {url}")
            resp.raise_for_status()
            return resp.json()
        except ConnectionError:
            raise
        except Exception as exc:
            last = exc
            time.sleep(2)
    raise ConnectionError(f"ESPN request failed for {url}: {last}")


def fetch_scheduled(league_code: str, back_days: int = 2, ahead_days: int = 14) -> list[dict]:
    slug = ESPN_SLUG_MAP.get(league_code)
    if not slug:
        logger.warning("Unknown league code for ESPN: %s", league_code)
        return []
    # Date ranges are not served (HTTP 400); walk day by day instead.
    today = date.today()
    seen: set[str] = set()
    fixtures: list[dict] = []
    for offset in range(-back_days, ahead_days + 1):
        day = (today + timedelta(days=offset)).strftime("%Y%m%d")
        try:
            data = _get_json(f"{BASE_URL}/{slug}/scoreboard?dates={day}")
        except ConnectionError as exc:
            logger.warning("ESPN day %s failed for %s: %s", day, league_code, exc)
            continue
        for ev in data.get("events", []):
            fixture = _event_to_fixture(ev, league_code)
            if fixture is not None and fixture["api_fixture_id"] not in seen:
                seen.add(fixture["api_fixture_id"])
                fixtures.append(fixture)
    return fixtures


def _competitors(ev: dict) -> tuple[dict | None, dict | None]:
    try:
        comps = ev["competitions"][0]["competitors"]
    except (KeyError, IndexError, TypeError):
        return None, None
    home = next((c for c in comps if c.get("homeAway") == "home"), None)
    away = next((c for c in comps if c.get("homeAway") == "away"), None)
    return home, away


def _logo(competitor: dict | None) -> str | None:
    if not competitor:
        return None
    team = competitor.get("team", {})
    logo = team.get("logo")
    if isinstance(logo, str) and logo.startswith("http"):
        return logo
    logos = team.get("logos") or []
    href = logos[0].get("href") if logos else None
    return href if isinstance(href, str) and href.startswith("http") else None


def _event_to_fixture(ev: dict, league_code: str) -> dict | None:
    home, away = _competitors(ev)
    if not home or not away:
        return None
    home_name = (home.get("team") or {}).get("displayName")
    away_name = (away.get("team") or {}).get("displayName")
    day = (ev.get("date") or "")[:10]
    if not home_name or not away_name or not day:
        return None
    return {
        "api_fixture_id": str(ev.get("id", "")),
        "date": ev.get("date"),
        "home_team": normalize_team_name(home_name, league_code),
        "away_team": normalize_team_name(away_name, league_code),
        "home_crest": _logo(home),
        "away_crest": _logo(away),
        "league": league_code,
    }


def _result_1x2(home_goals: int, away_goals: int) -> str:
    if home_goals > away_goals:
        return "H"
    if home_goals < away_goals:
        return "A"
    return "D"


def download_history(
    league_code: str,
    year: int,
    dest_dir: str | Path,
    force: bool = False,
) -> Path:
    """One request per calendar year into EC1{year}.csv.

    Date ranges are no longer served (HTTP 400); a whole season comes
    back with dates={year}&seasontype=2&limit=500. Past years are
    immutable once written.
    """
    slug = ESPN_SLUG_MAP.get(league_code)
    if not slug:
        raise ValueError(f"Unknown league code for ESPN history: {league_code}")
    dest = Path(dest_dir) / f"{league_code}{year}.csv"
    dest.parent.mkdir(parents=True, exist_ok=True)
    if not force and dest.exists() and dest.stat().st_size > 100:
        return dest

    import csv

    data = _get_json(f"{BASE_URL}/{slug}/scoreboard?dates={year}&seasontype=2&limit=500")
    rows = 0
    with dest.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=HISTORY_COLS)
        writer.writeheader()
        for ev in data.get("events", []):
            parsed = _completed_to_row(ev, league_code)
            if parsed is not None:
                writer.writerow(parsed)
                rows += 1
    if rows == 0:
        dest.unlink(missing_ok=True)
        raise ConnectionError(f"No completed {league_code} matches found for {year}")
    return dest


def _completed_to_row(ev: dict, league_code: str) -> dict | None:
    try:
        completed = ev["competitions"][0]["status"]["type"]["completed"]
    except (KeyError, IndexError, TypeError):
        return None
    if not completed:
        return None
    home, away = _competitors(ev)
    if not home or not away:
        return None
    try:
        home_goals = int(home.get("score", ""))
        away_goals = int(away.get("score", ""))
    except (TypeError, ValueError):
        return None
    day = (ev.get("date") or "")[:10]
    home_name = (home.get("team") or {}).get("displayName")
    away_name = (away.get("team") or {}).get("displayName")
    if not day or not home_name or not away_name:
        return None
    return {
        "Div": league_code,
        "Date": f"{day[8:10]}/{day[5:7]}/{day[:4]}",
        "HomeTeam": normalize_team_name(home_name, league_code),
        "AwayTeam": normalize_team_name(away_name, league_code),
        "FTHG": home_goals,
        "FTAG": away_goals,
        "FTR": _result_1x2(home_goals, away_goals),
    }
