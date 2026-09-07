from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.api.main import create_app


def _client() -> TestClient:
    return TestClient(create_app())


def test_resolve_requires_token():
    resp = _client().post("/api/resolve")
    assert resp.status_code in (401, 403)


def test_resolve_with_token(monkeypatch, tmp_path: Path):
    import sqlite3

    from app.db.migrations import run_migrations

    db_path = str(tmp_path / "resolve.db")
    run_migrations(db_path)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute(
        "INSERT INTO leagues (id, name, country, tier, source_csv_code, "
        "has_odds, has_xg, season_start_month, min_seasons) "
        "VALUES ('E0', 'PL', 'England', 1, 'E0', 1, 0, 8, 2)"
    )
    conn.execute("INSERT INTO teams (id, canonical_name) VALUES (1, 'Arsenal')")
    conn.execute("INSERT INTO teams (id, canonical_name) VALUES (2, 'Chelsea')")
    conn.execute(
        "INSERT INTO fixtures (league, match_date, home_team_id, away_team_id, "
        "status, home_score, away_score, result_checked, source, source_fixture_id) "
        "VALUES ('E0', '2024-08-12', 1, 2, 'post', 2, 1, 0, 'fd', 'E0_1')"
    )
    conn.commit()
    conn.close()

    import app.db.connection as conn_module

    real_connect = sqlite3.connect

    def fake_connect(*args, **kwargs):
        c = real_connect(db_path)
        c.row_factory = sqlite3.Row
        return c

    monkeypatch.setenv("SERVICE_TOKEN", "secret-token")
    from app.config import get_settings
    get_settings.cache_clear()
    monkeypatch.setattr(conn_module.sqlite3, "connect", fake_connect)

    resp = _client().post(
        "/api/resolve", headers={"Authorization": "Bearer secret-token"}
    )
    assert resp.status_code == 200
    assert resp.json()["league"] == "all"
    assert isinstance(resp.json()["resolved"], int)


def test_refresh_error_shape(monkeypatch):
    from app.api.routers import refresh as refresh_module

    monkeypatch.setattr(
        refresh_module, "sync_all_leagues",
        lambda leagues, n: [
            {"league": "E0", "season": 2024, "inserted": 10},
            {"league": "E0", "season": 2026, "error": "Not a CSV (season file missing?)"},
        ],
    )
    monkeypatch.setenv("SERVICE_TOKEN", "secret-token")
    from app.config import get_settings
    get_settings.cache_clear()
    resp = _client().post(
        "/api/refresh", headers={"Authorization": "Bearer secret-token"}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["synced"] == 1
    assert body["errors"] == 1
    assert body["error_details"][0]["error"] == "Season file not published yet by the source."
    assert "message" in body
