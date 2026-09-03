import json
import sqlite3
from datetime import datetime

import pytest

from app.ingestion.adapters.understat import (
    fetch_match_xg,
    fetch_match_player_xg,
    fetch_league_xg,
    fetch_league_players_stats,
)
from app.ingestion.xg_enricher import _match_xg_to_fixtures, enrich_xg_for_fixtures
from app.db.migrations import run_migrations


def _mock_get(payload):
    class _Resp:
        @staticmethod
        def raise_for_status():
            pass

        @staticmethod
        def json():
            return payload

    class _MockGet:
        def __call__(self, *args, **kwargs):
            return _Resp()

    return _MockGet()


def test_fetch_league_xg_extracts_dates(monkeypatch):
    from app.ingestion.adapters import understat

    payload = {
        "teams": [],
        "players": [],
        "dates": [
            {
                "h": {"title": "Arsenal"},
                "a": {"title": "Chelsea"},
                "datetime": "2023-08-12 15:00:00",
                "xG": {"h": "1.5", "a": "0.8"},
            }
        ],
    }
    monkeypatch.setattr(understat.httpx, "get", _mock_get(payload))
    result = fetch_league_xg("epl")
    assert len(result) == 1
    assert result[0]["h"]["title"] == "Arsenal"
    assert result[0]["xG"]["h"] == "1.5"


def test_fetch_league_xg_returns_empty_on_error(monkeypatch):
    from app.ingestion.adapters import understat

    def boom(*args, **kwargs):
        raise RuntimeError("network")

    monkeypatch.setattr(understat.httpx, "get", boom)
    assert fetch_league_xg("epl") == []


def test_fetch_league_players_stats_maps_fields(monkeypatch):
    from app.ingestion.adapters import understat

    payload = {
        "players": [
            {
                "id": "8260",
                "player_name": "Erling Haaland",
                "team_title": "Manchester City",
                "position": "F S",
                "games": 35,
                "time": 2979,
                "goals": 27,
                "assists": 8,
                "xG": "28.79",
                "npxG": "25.75",
            }
        ],
        "dates": [],
    }
    monkeypatch.setattr(understat.httpx, "get", _mock_get(payload))
    result = fetch_league_players_stats("epl")
    assert len(result) == 1
    p = result[0]
    assert p["player_id"] == "8260"
    assert p["name"] == "Erling Haaland"
    assert p["team"] == "Manchester City"
    assert p["minutes"] == 2979
    assert p["npxg"] == 25.75
    assert p["xg"] == 28.79


def test_fetch_match_xg_flattens_shots(monkeypatch):
    from app.ingestion.adapters import understat

    payload = {
        "shots": {
            "h": [{"player": "A", "h_a": "h", "xG": "1.2"}, {"player": "B", "h_a": "h", "xG": "0.5"}],
            "a": [{"player": "C", "h_a": "a", "xG": "0.7"}],
        }
    }
    monkeypatch.setattr(understat.httpx, "get", _mock_get(payload))
    result = fetch_match_xg(1)
    assert result == {"home_xg": 1.7, "away_xg": 0.7}


def test_fetch_match_xg_returns_none_on_error(monkeypatch):
    from app.ingestion.adapters import understat

    def boom(*args, **kwargs):
        raise RuntimeError("network")

    monkeypatch.setattr(understat.httpx, "get", boom)
    assert fetch_match_xg(1) is None


def test_fetch_match_player_xg_groups_by_player(monkeypatch):
    from app.ingestion.adapters import understat

    payload = {
        "shots": {
            "h": [
                {"player": "A", "player_id": "1", "h_a": "h", "xG": "0.6"},
                {"player": "A", "player_id": "1", "h_a": "h", "xG": "0.4"},
            ],
            "a": [{"player": "C", "player_id": "3", "h_a": "a", "xG": "0.2"}],
        }
    }
    monkeypatch.setattr(understat.httpx, "get", _mock_get(payload))
    result = fetch_match_player_xg(1)
    assert result is not None
    by_name = {r["player"]: r for r in result}
    assert by_name["A"]["xg_total"] == 1.0
    assert by_name["A"]["shots"] == 2
    assert by_name["C"]["xg_total"] == 0.2
    assert by_name["C"]["h_a"] == "a"


def test_resolve_season_tracks_current_year(monkeypatch):
    from app.ingestion.adapters import understat

    class _FakeNow(datetime):
        @classmethod
        def now(cls, tz=None):
            return datetime(2026, 9, 3)

    monkeypatch.setattr(understat, "datetime", _FakeNow)
    assert understat._resolve_season() == 2025


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
