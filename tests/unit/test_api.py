import json
import sqlite3
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.api.main import create_app
from app.db.migrations import run_migrations


def _setup_db(tmp_path: Path) -> str:
    db_path = str(tmp_path / "test.db")
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
        "INSERT INTO fixtures "
        "(league, match_date, home_team_id, away_team_id, competition_type, "
        "status, home_score, away_score, result_checked, source, source_fixture_id) "
        "VALUES ('E0', '2023-08-12', 1, 2, 'liga', 'post', 2, 1, 0, 'fd', 'E0_1')",
    )

    prediction = json.dumps({
        "probabilities": {
            "home": 0.55, "draw": 0.25, "away": 0.20,
            "double_chance": {"home_or_draw": 0.80, "draw_or_away": 0.45, "home_or_away": 0.75},
            "over_under_2.5": {"over": 0.60, "under": 0.40},
            "btts": {"yes": 0.65, "no": 0.35},
        },
        "model_agreement": 0.05,
        "model_version": "test_v1",
    })
    conn.execute("UPDATE fixtures SET prediction = ? WHERE id = 1", (prediction,))

    conn.execute(
        "INSERT INTO tracked "
        "(fixture_id, league, market, pick, confidence, prob_home, prob_draw, prob_away, "
        "predicted_market_prob, outcome, hit, resolved_at) "
        "VALUES (1, 'E0', '1x2', 'home', 0.55, 0.55, 0.25, 0.20, 0.55, 'home', 1, '2023-08-13T00:00:00Z')"
    )

    conn.commit()
    conn.close()
    return db_path


def _make_get_conn(db_path: str):
    def _get_conn():
        conn = sqlite3.connect(db_path, timeout=10)
        conn.row_factory = sqlite3.Row
        return conn
    return _get_conn


def test_health():
    app = create_app()
    client = TestClient(app)
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


def test_get_prediction(tmp_path: Path):
    db_path = _setup_db(tmp_path)
    app = create_app()
    client = TestClient(app)
    with patch("app.api.routers.predict.get_connection", side_effect=_make_get_conn(db_path)):
        resp = client.get("/api/predict/1")
    assert resp.status_code == 200
    data = resp.json()
    assert data["fixture_id"] == 1
    assert "1x2" in data["probabilities"]
    assert data["probabilities"]["1x2"]["home"] == 0.55


def test_get_prediction_not_found(tmp_path: Path):
    db_path = _setup_db(tmp_path)
    app = create_app()
    client = TestClient(app)
    with patch("app.api.routers.predict.get_connection", side_effect=_make_get_conn(db_path)):
        resp = client.get("/api/predict/999")
    assert resp.status_code == 404


def test_get_prediction_no_prediction(tmp_path: Path):
    db_path = _setup_db(tmp_path)
    conn = sqlite3.connect(db_path)
    conn.execute("UPDATE fixtures SET prediction = NULL WHERE id = 1")
    conn.commit()
    conn.close()
    app = create_app()
    client = TestClient(app)
    with patch("app.api.routers.predict.get_connection", side_effect=_make_get_conn(db_path)):
        resp = client.get("/api/predict/1")
    assert resp.status_code == 404


def test_list_fixtures(tmp_path: Path):
    db_path = _setup_db(tmp_path)
    app = create_app()
    client = TestClient(app)
    with patch("app.api.routers.fixtures.get_connection", side_effect=_make_get_conn(db_path)):
        resp = client.get("/api/fixtures?league=E0")
    assert resp.status_code == 200
    data = resp.json()
    assert data["count"] == 1
    assert data["fixtures"][0]["home"] == "Arsenal"


def test_get_stats(tmp_path: Path):
    db_path = _setup_db(tmp_path)
    app = create_app()
    client = TestClient(app)
    with patch("app.api.routers.stats.get_connection", side_effect=_make_get_conn(db_path)):
        resp = client.get("/api/stats")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_predictions"] == 1
    assert data["accuracy"] == 1.0


def test_get_stats_cold_start(tmp_path: Path):
    db_path = _setup_db(tmp_path)
    conn = sqlite3.connect(db_path)
    conn.execute("DELETE FROM tracked")
    conn.commit()
    conn.close()
    app = create_app()
    client = TestClient(app)
    with patch("app.api.routers.stats.get_connection", side_effect=_make_get_conn(db_path)):
        resp = client.get("/api/stats")
    assert resp.status_code == 200
    assert resp.json()["cold_start"] is True


def test_refresh_requires_token(tmp_path: Path):
    app = create_app()
    client = TestClient(app)
    resp = client.post("/api/refresh")
    assert resp.status_code == 401
