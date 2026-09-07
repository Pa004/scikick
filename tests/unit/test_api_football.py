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


def test_fetch_fixtures_uses_current_season(monkeypatch):
    from app.ingestion.adapters import api_football

    monkeypatch.setenv("API_FOOTBALL_KEY", "test-key")
    from app.config import get_settings
    get_settings.cache_clear()
    monkeypatch.setattr(api_football, "current_season_start", lambda: 2026)

    captured = {}

    class FakeResponse:
        def raise_for_status(self):
            pass

        def json(self):
            return {"response": []}

    def fake_get(url, headers=None, params=None, timeout=None):
        captured.update(params or {})
        return FakeResponse()

    monkeypatch.setattr(api_football.httpx, "get", fake_get)
    assert fetch_fixtures("E0") == []
    assert captured["season"] == 2026
    assert captured["status"] == "NS"
