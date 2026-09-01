from __future__ import annotations

import sqlite3
from pathlib import Path

import pandas as pd

from app.db.connection import get_connection
from app.db.migrations import run_migrations
from app.ingestion.adapters.football_data import (
    REQUIRED_COLUMNS,
    download_csv,
    load_csv,
    parse_dates_utc,
    map_results,
)
from app.ingestion.validation import validate_all


_LEAGUE_MAP = {
    "E0": {"name": "Premier League", "country": "England", "tier": 1, "has_xg": 0},
    "SP1": {"name": "La Liga", "country": "Spain", "tier": 1, "has_xg": 0},
    "D1": {"name": "Bundesliga", "country": "Germany", "tier": 1, "has_xg": 0},
    "I1": {"name": "Serie A", "country": "Italy", "tier": 1, "has_xg": 0},
    "F1": {"name": "Ligue 1", "country": "France", "tier": 1, "has_xg": 0},
}


def _ensure_league(conn: sqlite3.Connection, league_code: str) -> None:
    info = _LEAGUE_MAP.get(league_code)
    if not info:
        raise ValueError(f"Unknown league code: {league_code}")
    conn.execute(
        "INSERT OR IGNORE INTO leagues (id, name, country, tier, source_csv_code, "
        "has_odds, has_xg, season_start_month, min_seasons) "
        "VALUES (?, ?, ?, ?, ?, 1, ?, 8, 2)",
        (league_code, info["name"], info["country"], info["tier"],
         league_code, info["has_xg"]),
    )


def _resolve_team(conn: sqlite3.Connection, team_name: str) -> int:
    row = conn.execute(
        "SELECT canonical_team_id FROM team_aliases WHERE source = 'football_data' AND source_name = ?",
        (team_name,),
    ).fetchone()
    if row:
        return row["canonical_team_id"]

    conn.execute("INSERT INTO teams (canonical_name) VALUES (?)", (team_name,))
    team_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
    conn.execute(
        "INSERT INTO team_aliases (canonical_team_id, source, source_name) VALUES (?, 'football_data', ?)",
        (team_id, team_name),
    )
    return team_id


def sync_league(
    league_code: str,
    start_year: int,
    raw_dir: str = "data/raw",
    db_path: str | None = None,
) -> dict:
    run_migrations(db_path)

    csv_path = download_csv(league_code, start_year, raw_dir)
    df = load_csv(csv_path)
    df = parse_dates_utc(df)
    df = map_results(df)

    validation = validate_all(df)
    if validation.errors:
        print(f"Validation warnings: {validation.errors}")

    conn = get_connection(db_path)
    inserted = 0
    try:
        _ensure_league(conn, league_code)

        for _, row in df.iterrows():
            home_id = _resolve_team(conn, str(row["HomeTeam"]))
            away_id = _resolve_team(conn, str(row["AwayTeam"]))

            ht_home = int(row["HTHG"]) if pd.notna(row.get("HTHG")) else None
            ht_away = int(row["HTAG"]) if pd.notna(row.get("HTAG")) else None
            fthg = int(row["FTHG"]) if pd.notna(row.get("FTHG")) else None
            ftag = int(row["FTAG"]) if pd.notna(row.get("FTAG")) else None
            status = "post" if row.get("ftr") else "pre"

            conn.execute(
                "INSERT OR IGNORE INTO fixtures "
                "(league, match_date, home_team_id, away_team_id, competition_type, "
                "status, home_score, away_score, ht_home_score, ht_away_score, "
                "result_checked, source, source_fixture_id) "
                "VALUES (?, ?, ?, ?, 'liga', ?, ?, ?, ?, ?, 0, 'football_data', ?)",
                (
                    league_code, row["match_date"], home_id, away_id,
                    status, fthg, ftag, ht_home, ht_away,
                    f"{league_code}_{row['match_date']}_{home_id}_{away_id}",
                ),
            )
            inserted += 1

        conn.commit()
    finally:
        conn.close()

    return {
        "league": league_code,
        "season": start_year,
        "csv_path": str(csv_path),
        "total_rows": len(df),
        "inserted": inserted,
        "validation": {
            "valid": validation.valid_rows,
            "rejected": validation.rejected_rows,
            "errors": validation.errors,
        },
    }


def sync_all_leagues(
    league_codes: list[str],
    start_year: int,
    raw_dir: str = "data/raw",
    db_path: str | None = None,
) -> list[dict]:
    results = []
    for code in league_codes:
        try:
            result = sync_league(code, start_year, raw_dir, db_path)
            results.append(result)
        except Exception as e:
            results.append({"league": code, "error": str(e)})
    return results
