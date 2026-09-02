import json
import sqlite3

import pytest

from app.ingestion.adapters.understat import (
    _extract_json,
    fetch_match_xg,
    fetch_team_xg_history,
    fetch_league_xg,
)
from app.ingestion.xg_enricher import _match_xg_to_fixtures, enrich_xg_for_fixtures
from app.db.migrations import run_migrations


def test_extract_json():
    html = 'var shotsData = JSON.parse(\'{"key": "value"}\');'
    result = _extract_json(html, "shotsData")
    assert result == {"key": "value"}


def test_extract_json_not_found():
    html = "var otherData = 123;"
    result = _extract_json(html, "shotsData")
    assert result is None


@pytest.mark.slow
def test_fetch_match_xg_real():
    result = fetch_match_xg(1)
    if result:
        assert "home_xg" in result
        assert "away_xg" in result
        assert result["home_xg"] >= 0


def test_match_xg_exact_date():
    fixtures = [
        {"fixture_id": 1, "home_name": "Arsenal", "away_name": "Chelsea", "match_date": "2023-08-12"}
    ]
    league_xg = [
        {
            "h": {"title": "Arsenal"},
            "a": {"title": "Chelsea"},
            "datetime": "2023-08-12 15:00:00",
            "xG": {"h": 1.5, "a": 0.8},
        }
    ]
    matched = _match_xg_to_fixtures(fixtures, league_xg)
    assert 1 in matched
    assert matched[1]["home_xg"] == 1.5
    assert matched[1]["away_xg"] == 0.8


def test_match_xg_fuzzy_away():
    fixtures = [
        {"fixture_id": 2, "home_name": "Arsenal", "away_name": "Man United", "match_date": "2023-08-12"}
    ]
    league_xg = [
        {
            "h": {"title": "Arsenal"},
            "a": {"title": "Manchester United"},
            "datetime": "2023-08-12 15:00:00",
            "xG": {"h": 2.1, "a": 0.3},
        }
    ]
    matched = _match_xg_to_fixtures(fixtures, league_xg)
    assert 2 in matched
    assert matched[2]["home_xg"] == 2.1


def test_match_xg_no_match():
    fixtures = [
        {"fixture_id": 3, "home_name": "Burnley", "away_name": "Sheffield Utd", "match_date": "2023-08-12"}
    ]
    league_xg = [
        {
            "h": {"title": "Arsenal"},
            "a": {"title": "Chelsea"},
            "datetime": "2023-08-12 15:00:00",
            "xG": {"h": 1.5, "a": 0.8},
        }
    ]
    matched = _match_xg_to_fixtures(fixtures, league_xg)
    assert 3 not in matched


def test_enrich_xg_unknown_league():
    db_path = ":memory:"
    run_migrations(db_path)
    conn = sqlite3.connect(db_path)
    updated = enrich_xg_for_fixtures(conn, "ZZ")
    assert updated == 0


def test_enrich_xg_no_data(tmp_path):
    db_path = str(tmp_path / "test.db")
    run_migrations(db_path)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row

    conn.execute("INSERT INTO teams (id, canonical_name) VALUES (1, 'Arsenal')")
    conn.execute("INSERT INTO teams (id, canonical_name) VALUES (2, 'Chelsea')")
    conn.execute(
        "INSERT INTO fixtures "
        "(league, match_date, home_team_id, away_team_id, competition_type, "
        "status, source, source_fixture_id) "
        "VALUES ('E0', '2023-08-12', 1, 2, 'liga', 'post', 'fd', 'E0_1')"
    )
    conn.execute(
        "INSERT INTO match_features "
        "(fixture_id, feature_version, league, season, match_date, competition_type, "
        "home_team_id, away_team_id, home_elo, away_elo, home_elo_margin, "
        "home_form_pts_last_5, away_form_pts_last_5, home_rest_days, away_rest_days, "
        "h2h_home_wins_last_5, h2h_draws_last_5, referee_cards_avg, "
        "home_xg_missing, away_xg_missing, created_at) "
        "VALUES (1, 'v1', 'E0', 1, '2023-08-12', 'liga', 1, 2, 1500, 1500, 0, "
        "0, 0, 3, 3, 0, 0, 0, 1, 1, '2023-08-12T00:00:00Z')"
    )
    conn.commit()

    from unittest.mock import patch

    with patch("app.ingestion.xg_enricher.fetch_league_xg", return_value=[]):
        updated = enrich_xg_for_fixtures(conn, "E0")

    assert updated == 0
