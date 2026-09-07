from __future__ import annotations

import logging
import time
import sqlite3

from rapidfuzz import fuzz

from app.ingestion.adapters.understat import (
    fetch_league_players_stats,
    fetch_league_xg,
    fetch_match_player_xg,
)
from app.ingestion.adapters.football_data_org import TEAM_NAMES
from app.ingestion.aliases import find_best_match
from app.players.model import effective_min_minutes
from app.db.connection import get_connection

logger = logging.getLogger(__name__)

UNDERSTAT_SLUG_MAP = {
    "E0": "epl",
    "SP1": "la_liga",
    "D1": "bundesliga",
    "I1": "serie_a",
    "F1": "ligue_1",
}

# Understat team titles -> our canonical short names, for cases the
# "<name> FC" lookup into TEAM_NAMES cannot resolve.
UNDERSTAT_OVERRIDES = {
    "E0": {
        "Manchester City": "Man City",
        "Manchester United": "Man United",
        "Newcastle United": "Newcastle",
        "Tottenham": "Spurs",
        "Nottingham Forest": "Nott'm Forest",
        "Hull": "Hull City",
        "Leeds United": "Leeds",
    },
}


def normalize_understat_team(
    title: str, league: str, canonical_names: list[str]
) -> str | None:
    if "," in title:
        return None
    if title in canonical_names:
        return title
    table = TEAM_NAMES.get(league, {})
    if title in table:
        return table[title]
    override = UNDERSTAT_OVERRIDES.get(league, {}).get(title)
    if override:
        return override
    suffixed = f"{title} FC"
    if suffixed in table:
        return table[suffixed]
    return find_best_match(title, canonical_names, threshold=85)


def _find_understat_match_id(
    dates_data: list[dict], home_name: str, away_name: str, match_date: str
) -> int | None:
    date_str = match_date[:10]
    for m in dates_data:
        m_date = m.get("datetime", "")[:10]
        if m_date != date_str:
            continue
        h_title = m.get("h", {}).get("title", "").lower() if isinstance(m.get("h"), dict) else ""
        a_title = m.get("a", {}).get("title", "").lower() if isinstance(m.get("a"), dict) else ""
        if fuzz.WRatio(home_name.lower(), h_title) >= 80 and fuzz.WRatio(away_name.lower(), a_title) >= 80:
            return m.get("id")
    return None


def ingest_league_players(conn: sqlite3.Connection, league: str) -> dict:
    understat_slug = UNDERSTAT_SLUG_MAP.get(league)
    if not understat_slug:
        return {"league": league, "error": f"No Understat slug for {league}"}

    league_xg = fetch_league_xg(understat_slug)
    if not league_xg:
        return {"league": league, "error": "Could not fetch Understat datesData"}

    time.sleep(6)

    players_stats = fetch_league_players_stats(understat_slug)

    time.sleep(6)

    max_minutes = max((p["minutes"] for p in players_stats), default=0)
    min_minutes = effective_min_minutes(max_minutes)
    canonical_names = [
        r["canonical_name"] for r in conn.execute("SELECT canonical_name FROM teams").fetchall()
    ]

    players_inserted = 0
    for p in players_stats:
        if p["minutes"] < min_minutes:
            continue
        team_name = normalize_understat_team(p["team"], league, canonical_names)
        if not team_name:
            logger.warning("Unmapped Understat team '%s' for league %s", p["team"], league)
            continue
        conn.execute(
            "INSERT OR REPLACE INTO players "
            "(name, team_name, position, xg90, npxg90, minutes_total, games, source, source_player_id) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, 'understat', ?)",
            (
                p["name"],
                team_name,
                p["position"],
                (p["xg"] / p["minutes"] * 90) if p["minutes"] > 0 else 0.0,
                (p["npxg"] / p["minutes"] * 90) if p["minutes"] > 0 else 0.0,
                p["minutes"],
                p["games"],
                p["player_id"],
            ),
        )
        players_inserted += 1

    fixtures = conn.execute(
        "SELECT f.id, f.match_date, f.home_team_id, f.away_team_id, f.status, "
        "t1.canonical_name as home_name, t2.canonical_name as away_name "
        "FROM fixtures f "
        "JOIN teams t1 ON f.home_team_id = t1.id "
        "JOIN teams t2 ON f.away_team_id = t2.id "
        "WHERE f.league = ? AND f.status = 'post'",
        (league,),
    ).fetchall()

    fixtures_updated = 0
    for fix in fixtures:
        understat_id = _find_understat_match_id(
            league_xg, fix["home_name"], fix["away_name"], fix["match_date"]
        )
        if not understat_id:
            continue

        player_xg = fetch_match_player_xg(understat_id)
        if not player_xg:
            continue

        time.sleep(6)

        home_away_map = {}
        for rec in player_xg:
            h_a = rec.get("h_a", "")
            if h_a == "h":
                home_away_map[rec["player"]] = "home"
            elif h_a == "a":
                home_away_map[rec["player"]] = "away"

        for rec in player_xg:
            player_name = rec["player"]
            h_a = home_away_map.get(player_name, "home")

            row = conn.execute(
                "SELECT id FROM players WHERE name = ? AND source = 'understat'",
                (player_name,),
            ).fetchone()
            if not row:
                continue

            conn.execute(
                "INSERT OR IGNORE INTO player_features "
                "(fixture_id, player_id, team_name, xg90, npxg90, minutes_played, "
                "min_expected, position, home_away, opponent_xga) "
                "VALUES (?, ?, '', ?, ?, NULL, NULL, NULL, ?, NULL)",
                (fix["id"], row["id"], rec["xg_total"], rec["xg_total"], h_a),
            )
            fixtures_updated += 1

    conn.commit()
    return {
        "league": league,
        "players_inserted": players_inserted,
        "fixtures_processed": fixtures_updated,
    }
