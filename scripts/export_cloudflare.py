"""Static export of the read API for Cloudflare R2 + Worker hosting.

The free-tier Worker cannot run Python/NumPy/LightGBM, so the daily cron
precomputes every read endpoint offline into JSON files that are pushed
to R2. SHAP top features are computed here, where the ensemble exists.

Usage:
    python -m scripts.export_cloudflare --db data/futbol.db --out dist-cf
"""
from __future__ import annotations

import argparse
import json
import os
import sqlite3
from datetime import date, datetime, timezone
from pathlib import Path

LEAGUES = ("E0", "SP1", "D1", "I1", "F1", "EC1")
EXPORT_MARKET = "1x2"


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Export read API to static JSON")
    parser.add_argument("--db", required=True, help="SQLite database path")
    parser.add_argument("--out", required=True, help="Output directory")
    return parser.parse_args()


def _write(out: Path, name: str, payload: object) -> None:
    path = out / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, default=str), encoding="utf-8")


def _safe(fn, *args, **kwargs):
    from fastapi import HTTPException

    try:
        return fn(*args, **kwargs)
    except HTTPException:
        return None


def _connect(db_path: str) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path, timeout=10)
    conn.row_factory = sqlite3.Row
    return conn


def _export_fixtures(conn: sqlite3.Connection) -> list[dict]:
    today = date.today().isoformat()
    rows = conn.execute(
        "SELECT f.id, f.match_date, f.league, f.status, "
        "f.home_score, f.away_score, f.prediction, "
        "t1.canonical_name AS home_name, t2.canonical_name AS away_name, "
        "t1.crest_url AS home_crest, t2.crest_url AS away_crest "
        "FROM fixtures f "
        "JOIN teams t1 ON f.home_team_id = t1.id "
        "JOIN teams t2 ON f.away_team_id = t2.id "
        "ORDER BY f.match_date DESC"
    ).fetchall()
    fixtures = []
    for row in rows:
        markets = {}
        if row["prediction"]:
            try:
                markets = json.loads(row["prediction"]).get("markets", {})
            except ValueError:
                markets = {}
        one_x_two = markets.get("1x2")
        fixtures.append({
            "id": row["id"],
            "date": row["match_date"],
            "home": row["home_name"],
            "away": row["away_name"],
            "home_crest": row["home_crest"],
            "away_crest": row["away_crest"],
            "league": row["league"],
            "status": row["status"],
            "home_score": row["home_score"],
            "away_score": row["away_score"],
            # Feed only needs the 1x2 verdict + a null check; full
            # markets live in predictions/{id}.json.
            "prediction": {"markets": {"1x2": one_x_two}} if one_x_two else None,
            "upcoming": bool(row["status"] == "pre" and row["match_date"] >= today),
        })
    return fixtures


def _export_predictions(conn: sqlite3.Connection, out: Path) -> int:
    from app.api.routers.predict import _get_prediction

    rows = conn.execute(
        "SELECT id, league FROM fixtures WHERE prediction IS NOT NULL").fetchall()
    count = 0
    for row in rows:
        fixture_id = row["id"]
        pred = _safe(_get_prediction, fixture_id)
        if pred is None:
            continue
        payload = pred.model_dump(mode="json")
        payload["league"] = row["league"]
        _write(out, f"predictions/{fixture_id}.json", payload)
        count += 1
    return count


def _export_scorers(conn: sqlite3.Connection, out: Path) -> int:
    from app.api.routers.scorer import get_scorer

    ids = [r["id"] for r in conn.execute("SELECT id FROM fixtures").fetchall()]
    count = 0
    for fixture_id in ids:
        scorer = _safe(get_scorer, fixture_id)
        if scorer is None:
            continue
        _write(out, f"scorer/{fixture_id}.json", scorer.model_dump(mode="json"))
        count += 1
    return count


def _export_context(conn: sqlite3.Connection) -> dict:
    from app.api.routers.context import team_context

    teams = [r["canonical_name"] for r in conn.execute(
        "SELECT canonical_name FROM teams").fetchall()]
    upcoming = conn.execute(
        "SELECT t1.canonical_name AS home, t2.canonical_name AS away "
        "FROM fixtures f "
        "JOIN teams t1 ON f.home_team_id = t1.id "
        "JOIN teams t2 ON f.away_team_id = t2.id "
        "WHERE f.status = 'pre'"
    ).fetchall()
    pairs = {(r["home"], r["away"]) for r in upcoming}
    bundle: dict = {"teams": {}, "pairs": {}}
    for team in teams:
        # Keyword args: cached_endpoint keys the cache on kwargs only.
        ctx = _safe(team_context, team=team)
        if ctx is not None:
            bundle["teams"][team] = ctx
    for home, away in pairs:
        for team, opponent in ((home, away), (away, home)):
            ctx = _safe(team_context, team=team, opponent=opponent)
            if ctx is not None:
                bundle["pairs"][f"{team}|{opponent}"] = ctx
    return bundle


def _export_values(conn: sqlite3.Connection) -> dict:
    from app.api.routers.value import compute_value
    from app.api.schemas import ValueRequest

    ids = [r["id"] for r in conn.execute("SELECT id FROM fixtures").fetchall()]
    values = {}
    for fixture_id in ids:
        value = _safe(compute_value, ValueRequest(fixture_id=fixture_id))
        values[str(fixture_id)] = (
            value.model_dump(mode="json") if value is not None else None
        )
    return values


def _export_stats() -> dict:
    from app.api.routers.stats import (
        get_calibration,
        get_stats,
        get_stats_per_matchday,
    )

    bundle: dict = {"stats": {}, "per_matchday": {}, "calibration": {}}
    for league in (None, *LEAGUES):
        key = league or "all"
        bundle["stats"][key] = get_stats(league=league, market=EXPORT_MARKET)
        bundle["per_matchday"][key] = get_stats_per_matchday(
            league=league, market=EXPORT_MARKET)
        bundle["calibration"][key] = get_calibration(
            league=league, market=EXPORT_MARKET)
    return bundle


def run(db_path: str, out_dir: str) -> dict:
    os.environ["DATABASE_PATH"] = db_path
    os.environ["ENV"] = "production"
    from app.config import get_settings
    get_settings.cache_clear()

    out = Path(out_dir)
    conn = _connect(db_path)
    try:
        fixtures = _export_fixtures(conn)
        _write(out, "fixtures.json", fixtures)
        predicted = _export_predictions(conn, out)
        scorers = _export_scorers(conn, out)
        _write(out, "context_index.json", _export_context(conn))
        _write(out, "value_index.json", _export_values(conn))
    finally:
        conn.close()
    stats = _export_stats()
    _write(out, "stats.json", stats["stats"])
    _write(out, "stats_per_matchday.json", stats["per_matchday"])
    _write(out, "stats_calibration.json", stats["calibration"])
    manifest = {
        "market": EXPORT_MARKET,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "fixtures": len(fixtures),
        "predicted": predicted,
        "scorers": scorers,
    }
    _write(out, "manifest.json", manifest)
    return manifest


def main() -> None:
    args = _parse_args()
    manifest = run(args.db, args.out)
    print(f"OK: {manifest['fixtures']} fixtures, "
          f"{manifest['predicted']} predictions, "
          f"{manifest['scorers']} scorers -> {args.out}")


if __name__ == "__main__":
    main()
