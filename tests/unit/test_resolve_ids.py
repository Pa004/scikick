import logging
import sqlite3
from datetime import date, timedelta
from pathlib import Path

from app.db.migrations import run_migrations
from app.ingestion.adapters.api_football import normalize_api_name
from app.players import lineups as lineups_module


def _setup_db(tmp_path: Path, match_date: str) -> sqlite3.Connection:
    db_path = str(tmp_path / "resolve.db")
    run_migrations(db_path)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute(
        "INSERT INTO leagues (id, name, country, tier, source_csv_code, "
        "has_odds, has_xg, season_start_month, min_seasons) "
        "VALUES ('E0', 'Premier League', 'England', 1, 'E0', 1, 0, 8, 2)"
    )
    conn.execute("INSERT INTO teams (id, canonical_name) VALUES (1, 'Arsenal')")
    conn.execute("INSERT INTO teams (id, canonical_name) VALUES (2, 'Chelsea')")
    conn.execute(
        "INSERT INTO fixtures (league, match_date, home_team_id, away_team_id, "
        "status, source, source_fixture_id) "
        "VALUES ('E0', ?, 1, 2, 'pre', 'football_data_org', 'football_data_org_9')",
        (match_date,),
    )
    conn.commit()
    return conn


def _api_payload():
    return [
        {
            "api_fixture_id": 12345,
            "date": "2026-09-12T14:00:00Z",
            "home_team": "Arsenal",
            "away_team": "Chelsea",
            "league": "E0",
        }
    ]


def test_normalize_api_name():
    assert normalize_api_name("Arsenal", "E0") == "Arsenal"
    assert normalize_api_name("Manchester City", "E0") == "Man City"
    assert normalize_api_name("Tottenham Hotspur", "E0") == "Spurs"
    assert normalize_api_name("Atletico Madrid", "SP1") == "Ath Madrid"
    assert normalize_api_name("Paris Saint Germain", "F1") == "PSG"


def test_normalize_api_name_unmapped_passthrough(caplog):
    with caplog.at_level(logging.WARNING):
        assert normalize_api_name("Bedford Town", "E0") == "Bedford Town"
    assert "Unmapped API-Football name" in caplog.text


def test_resolve_sets_api_id(tmp_path, monkeypatch):
    monkeypatch.setenv("API_FOOTBALL_KEY", "test-key")
    tomorrow = (date.today() + timedelta(days=1)).isoformat()
    conn = _setup_db(tmp_path, tomorrow)
    monkeypatch.setattr(
        lineups_module, "fetch_fixtures_by_date", lambda league, day: _api_payload()
    )
    try:
        result = lineups_module.resolve_api_ids_for_upcoming(conn, "E0")
        assert result["resolved"] == 1
        row = conn.execute("SELECT api_football_id FROM fixtures").fetchone()
        assert row[0] == 12345
    finally:
        conn.close()


def test_resolve_skips_outside_window(tmp_path, monkeypatch):
    monkeypatch.setenv("API_FOOTBALL_KEY", "test-key")
    far = (date.today() + timedelta(days=30)).isoformat()
    conn = _setup_db(tmp_path, far)
    called = []
    monkeypatch.setattr(
        lineups_module, "fetch_fixtures_by_date",
        lambda league, day: called.append(day) or [],
    )
    try:
        result = lineups_module.resolve_api_ids_for_upcoming(conn, "E0")
        assert result["resolved"] == 0
        assert called == []
    finally:
        conn.close()


def test_resolve_no_key(tmp_path, monkeypatch):
    monkeypatch.setenv("API_FOOTBALL_KEY", "")
    conn = _setup_db(tmp_path, date.today().isoformat())
    try:
        result = lineups_module.resolve_api_ids_for_upcoming(conn, "E0")
        assert result["skipped"] == "no_api_key"
    finally:
        conn.close()


def test_fetch_by_date_surfaces_plan_errors(monkeypatch, caplog):
    import logging

    from app.ingestion.adapters import api_football

    monkeypatch.setenv("API_FOOTBALL_KEY", "test-key")
    from app.config import get_settings
    get_settings.cache_clear()

    class FakeResponse:
        def raise_for_status(self):
            pass

        def json(self):
            return {"response": [], "errors": {"plan": "blocked"}}

    monkeypatch.setattr(
        api_football.httpx, "get", lambda *a, **k: FakeResponse()
    )
    with caplog.at_level(logging.WARNING):
        assert api_football.fetch_fixtures_by_date("E0", "2026-09-07") == []
    assert "blocked" in caplog.text
