import pytest

from app.ingestion.adapters.api_football import fetch_fixtures, LEAGUE_MAP


def test_league_map_coverage():
    assert "E0" in LEAGUE_MAP
    assert "SP1" in LEAGUE_MAP
    assert "D1" in LEAGUE_MAP
    assert "I1" in LEAGUE_MAP
    assert "F1" in LEAGUE_MAP


def test_fetch_fixtures_no_key(monkeypatch):
    monkeypatch.setenv("API_FOOTBALL_KEY", "")
    from app.config import get_settings
    get_settings.cache_clear()
    result = fetch_fixtures("E0")
    assert result == []


def test_fetch_fixtures_unknown_league(monkeypatch):
    monkeypatch.setenv("API_FOOTBALL_KEY", "test-key")
    from app.config import get_settings
    get_settings.cache_clear()
    result = fetch_fixtures("UNKNOWN")
    assert result == []
