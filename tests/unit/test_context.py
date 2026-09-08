import sqlite3
from pathlib import Path

from fastapi.testclient import TestClient

from app.api.main import create_app
from app.db.migrations import run_migrations


def _setup_db(tmp_path: Path) -> str:
    db_path = str(tmp_path / "ctx.db")
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
    results = [("2024-08-12", 2, 1), ("2024-08-19", 1, 1), ("2024-08-26", 0, 1)]
    for i, (day, hs, aws) in enumerate(results):
        conn.execute(
            "INSERT INTO fixtures (league, match_date, home_team_id, away_team_id, "
            "status, home_score, away_score, result_checked, source, source_fixture_id) "
            "VALUES ('E0', ?, 1, 2, 'post', ?, ?, 1, 'football_data', ?)",
            (day, hs, aws, f"E0_{day}"),
        )
    conn.execute(
        "INSERT INTO fixtures (league, match_date, home_team_id, away_team_id, "
        "status, source, source_fixture_id) "
        "VALUES ('E0', '2026-09-12', 2, 1, 'pre', 'football_data_org', 'fdorg_9')"
    )
    conn.commit()
    conn.close()
    return db_path


def _client(db_path: str, monkeypatch) -> TestClient:
    import app.db.connection as conn_module

    real_connect = sqlite3.connect

    def fake_connect(*args, **kwargs):
        c = real_connect(db_path)
        c.row_factory = sqlite3.Row
        return c

    monkeypatch.setattr(conn_module.sqlite3, "connect", fake_connect)
    return TestClient(create_app())


def test_context_form_and_h2h(tmp_path: Path, monkeypatch):
    client = _client(_setup_db(tmp_path), monkeypatch)
    resp = client.get("/api/context", params={"team": "Arsenal", "opponent": "Chelsea"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["team"] == "Arsenal"
    assert [m["result"] for m in body["form"]] == ["L", "D", "W"]
    assert body["form"][0]["opponent"] == "Chelsea"
    assert body["h2h"]["wins"] == 1
    assert body["h2h"]["draws"] == 1
    assert body["h2h"]["losses"] == 1


def test_context_unknown_team(tmp_path: Path, monkeypatch):
    client = _client(_setup_db(tmp_path), monkeypatch)
    resp = client.get("/api/context", params={"team": "Bedford"})
    assert resp.status_code == 200
    assert resp.json()["form"] == []


def test_fixtures_all_and_invalid(tmp_path: Path, monkeypatch):
    client = _client(_setup_db(tmp_path), monkeypatch)
    resp = client.get("/api/fixtures", params={"league": "all", "limit": 10})
    assert resp.status_code == 200
    assert resp.json()["count"] >= 3
    resp = client.get("/api/fixtures", params={"league": "XX"})
    assert resp.status_code == 422
    resp = client.get("/api/fixtures", params={"league": "E0", "limit": 500})
    assert resp.status_code == 422


def test_fixtures_expose_crests_nullable(tmp_path: Path, monkeypatch):
    db_path = _setup_db(tmp_path)
    conn = sqlite3.connect(db_path)
    try:
        conn.execute("UPDATE teams SET crest_url = 'https://x.test/arsenal.png' WHERE id = 1")
        conn.commit()
    finally:
        conn.close()
    client = _client(db_path, monkeypatch)
    resp = client.get("/api/fixtures", params={"league": "all", "limit": 10})
    assert resp.status_code == 200
    rows = resp.json()["fixtures"]
    assert len(rows) > 0
    for row in rows:
        assert "home_crest" in row and "away_crest" in row
    arsenal_home = [r for r in rows if r["home"] == "Arsenal"]
    assert arsenal_home and arsenal_home[0]["home_crest"] == "https://x.test/arsenal.png"
    assert all(r["away_crest"] is None for r in arsenal_home)


def test_context_exposes_team_crests(tmp_path: Path, monkeypatch):
    db_path = _setup_db(tmp_path)
    conn = sqlite3.connect(db_path)
    try:
        conn.execute("UPDATE teams SET crest_url = 'https://x.test/arsenal.png' WHERE id = 1")
        conn.commit()
    finally:
        conn.close()
    client = _client(db_path, monkeypatch)
    resp = client.get("/api/context", params={"team": "Arsenal", "opponent": "Chelsea"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["crest"] == "https://x.test/arsenal.png"
    assert body["opponent_crest"] is None
