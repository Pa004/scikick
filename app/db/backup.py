from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from app.config import get_settings


def backup_database(backup_dir: str | None = None) -> str:
    settings = get_settings()
    if settings.env == "test":
        raise RuntimeError("Cannot backup in test environment")

    source_path = Path(settings.database_path)
    if not source_path.exists():
        raise FileNotFoundError(f"Database not found: {source_path}")

    dest_dir = Path(backup_dir or "backups")
    dest_dir.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    backup_path = dest_dir / f"scikick_{timestamp}.db"

    source = sqlite3.connect(str(source_path))
    dest = sqlite3.connect(str(backup_path))
    try:
        source.backup(dest)
    finally:
        dest.close()
        source.close()

    return str(backup_path)


def export_tracked_json(export_dir: str | None = None) -> str:
    settings = get_settings()
    if settings.env == "test":
        raise RuntimeError("Cannot export in test environment")

    conn = sqlite3.connect(settings.database_url)
    try:
        rows = conn.execute(
            "SELECT t.*, f.match_date, f.league as fixture_league "
            "FROM tracked t JOIN fixtures f ON t.fixture_id = f.id"
        ).fetchall()
    finally:
        conn.close()

    dest_dir = Path(export_dir or "backups")
    dest_dir.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    export_path = dest_dir / f"tracked_{timestamp}.json"

    columns = ["id", "fixture_id", "league", "market", "pick", "confidence",
               "prob_home", "prob_draw", "prob_away", "predicted_market_prob",
               "outcome", "hit", "resolved_at", "match_date", "fixture_league"]

    data = [dict(zip(columns, row)) for row in rows]
    export_path.write_text(json.dumps(data, indent=2, default=str), encoding="utf-8")

    return str(export_path)
