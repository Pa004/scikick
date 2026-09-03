from __future__ import annotations

import sqlite3
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.db.migrations import run_migrations
from app.api.main import app


def _apply_migrations(db_path: str) -> None:
    run_migrations(db_path)


def _setup_db(tmp_path: Path) -> str:
    db_path = str(tmp_path / "test.db")
    _apply_migrations(db_path)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row

    conn.execute("INSERT INTO leagues (id, name, country, tier, source_csv_code, has_odds, season_start_month, min_seasons) "
                 "VALUES ('E0', 'PL', 'England', 1, 'E0', 1, 8, 2)")
    conn.execute("INSERT INTO teams (id, canonical_name) VALUES (1, 'TeamA')")
    conn.execute("INSERT INTO teams (id, canonical_name) VALUES (2, 'TeamB')")
    conn.execute(
        "INSERT INTO fixtures (league, match_date, home_team_id, away_team_id, status, source, source_fixture_id) "
        "VALUES ('E0', '2024-12-01', 1, 2, 'pre', 'football_data', 'E0_2024-12-01_1_2')"
    )
    for i in range(5):
        team = 'TeamA' if i < 3 else 'TeamB'
        conn.execute(
            "INSERT INTO players (name, team_name, position, xg90, npxg90, minutes_total, games, source, source_player_id) "
            "VALUES (?, ?, 'F', 0.5, 0.45, 2500, 30, 'understat', ?)",
            (f"Player{i}", team, f"p{i}"),
        )

    conn.commit()
    conn.close()
    return db_path


def test_scorer_endpoint_returns_data(tmp_path: Path):
    db_path = _setup_db(tmp_path)

    with patch("app.db.connection.get_settings") as mock_settings:
        mock_settings.return_value.database_url = db_path
        client = TestClient(app)
        resp = client.get("/api/predict/scorer/1")
        assert resp.status_code == 200
        data = resp.json()
        assert data["fixture_id"] == 1
        assert data["data_quality"] == "lineup_unavailable"
        assert len(data["scorers"]) > 0


def test_scorer_endpoint_404(tmp_path: Path):
    db_path = _setup_db(tmp_path)

    with patch("app.db.connection.get_settings") as mock_settings:
        mock_settings.return_value.database_url = db_path
        client = TestClient(app)
        resp = client.get("/api/predict/scorer/999")
        assert resp.status_code == 404


def test_scorer_endpoint_has_prob_anytime(tmp_path: Path):
    db_path = _setup_db(tmp_path)

    with patch("app.db.connection.get_settings") as mock_settings:
        mock_settings.return_value.database_url = db_path
        client = TestClient(app)
        resp = client.get("/api/predict/scorer/1")
        data = resp.json()
        scorer = data["scorers"][0]
        assert "prob_anytime" in scorer
        assert 0 <= scorer["prob_anytime"] <= 1


def test_fetch_lineups_no_key():
    from app.ingestion.adapters.api_football import fetch_lineups
    with patch("app.config.get_settings") as mock:
        mock.return_value.api_football_key = ""
        result = fetch_lineups(12345)
        assert result is None
