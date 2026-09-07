import json
import sqlite3
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.api.main import create_app
from app.db.migrations import run_migrations
from app.models.value import edge, evaluate_outcome, kelly_stake


def test_edge_positive_value():
    assert edge(0.52, 2.10) == pytest.approx(0.092)


def test_edge_negative():
    assert edge(0.4, 2.0) == pytest.approx(-0.2)


def test_kelly_zero_without_edge():
    assert kelly_stake(0.4, 2.0) == 0.0


def test_kelly_quarter_fraction():
    prob, odds = 0.52, 2.10
    full = (prob * odds - 1.0) / (odds - 1.0)
    assert kelly_stake(prob, odds) == pytest.approx(full * 0.25)


def test_kelly_invalid_odds():
    assert kelly_stake(0.6, 1.0) == 0.0
    assert kelly_stake(0.6, 0.5) == 0.0


def test_evaluate_outcome_shape():
    result = evaluate_outcome(0.52, 2.10)
    assert result["value"] is True
    assert result["edge"] == pytest.approx(0.092)
    assert result["kelly"] > 0


def _setup_value_db(tmp_path: Path, monkeypatch):
    db_path = str(tmp_path / "value.db")
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
    prediction = json.dumps({"markets": {"1x2": {"home": 0.52, "draw": 0.26, "away": 0.22}}})
    conn.execute(
        "INSERT INTO fixtures (league, match_date, home_team_id, away_team_id, "
        "status, source, source_fixture_id, prediction) "
        "VALUES ('E0', '2026-09-12', 1, 2, 'pre', 'football_data_org', 'fdorg_1', ?)",
        (prediction,),
    )
    conn.commit()
    conn.close()

    import app.db.connection as conn_module
    real_connect = sqlite3.connect

    def fake_connect(*args, **kwargs):
        c = real_connect(db_path)
        c.row_factory = sqlite3.Row
        return c

    monkeypatch.setattr(conn_module.sqlite3, "connect", fake_connect)
    return TestClient(create_app()), db_path


def test_value_endpoint(tmp_path: Path, monkeypatch):
    client, _ = _setup_value_db(tmp_path, monkeypatch)
    resp = client.post(
        "/api/value",
        json={"fixture_id": 1, "odds": {"home": 2.10, "draw": 3.40, "away": 3.60}},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["fixture_id"] == 1
    assert body["outcomes"]["home"]["value"] is True
    assert body["outcomes"]["home"]["edge"] == pytest.approx(0.092)
    assert body["outcomes"]["away"]["value"] is False


def test_value_endpoint_rejects_bad_odds(tmp_path: Path, monkeypatch):
    client, _ = _setup_value_db(tmp_path, monkeypatch)
    resp = client.post(
        "/api/value", json={"fixture_id": 1, "odds": {"home": 1.0, "draw": 3.4, "away": 3.6}}
    )
    assert resp.status_code == 422


def test_value_endpoint_unknown_fixture(tmp_path: Path, monkeypatch):
    client, _ = _setup_value_db(tmp_path, monkeypatch)
    resp = client.post(
        "/api/value", json={"fixture_id": 999, "odds": {"home": 2.1, "draw": 3.4, "away": 3.6}}
    )
    assert resp.status_code == 404


def test_value_endpoint_auto_odds(tmp_path: Path, monkeypatch):
    client, db_path = _setup_value_db(tmp_path, monkeypatch)
    conn = sqlite3.connect(db_path)
    conn.execute(
        "INSERT INTO fixture_odds (fixture_id, bookmaker, home, draw, away, fetched_at) "
        "VALUES (1, 'best-eu', 2.10, 3.40, 3.60, '2026-09-07T00:00:00Z')"
    )
    conn.commit()
    conn.close()
    resp = client.post("/api/value", json={"fixture_id": 1})
    assert resp.status_code == 200
    body = resp.json()
    assert body["outcomes"]["home"]["value"] is True
    assert body["outcomes"]["home"]["edge"] == pytest.approx(0.092)


def test_value_endpoint_auto_missing_odds(tmp_path: Path, monkeypatch):
    client, _ = _setup_value_db(tmp_path, monkeypatch)
    resp = client.post("/api/value", json={"fixture_id": 1})
    assert resp.status_code == 404


def test_value_endpoint_auto_no_key_message(tmp_path: Path, monkeypatch):
    monkeypatch.setenv("ODDS_API_KEY", "")
    from app.config import get_settings
    get_settings.cache_clear()
    client, _ = _setup_value_db(tmp_path, monkeypatch)
    resp = client.post("/api/value", json={"fixture_id": 1})
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Automatic odds not configured for this fixture yet"
