import logging

import pytest

from app.ingestion.adapters import football_data_org as fdorg
from app.ingestion.adapters.football_data_org import (
    COMPETITION_MAP,
    fetch_scheduled,
    normalize_team_name,
)


class FakeResponse:
    def __init__(self, payload, status=200):
        self._payload = payload
        self.status_code = status

    def raise_for_status(self):
        pass

    def json(self):
        return self._payload


def _settings_with_key(monkeypatch, key="test-key"):
    monkeypatch.setenv("FOOTBALL_DATA_ORG_KEY", key)
    from app.config import get_settings
    get_settings.cache_clear()


def test_competition_map_coverage():
    assert COMPETITION_MAP == {
        "E0": "PL", "SP1": "PD", "D1": "BL1", "I1": "SA", "F1": "FL1",
    }


def test_fetch_scheduled_no_key(monkeypatch, caplog):
    monkeypatch.setenv("FOOTBALL_DATA_ORG_KEY", "")
    from app.config import get_settings
    get_settings.cache_clear()
    with caplog.at_level(logging.WARNING):
        assert fetch_scheduled("E0") == []
    assert "FOOTBALL_DATA_ORG_KEY" in caplog.text


def test_fetch_scheduled_unknown_league(monkeypatch, caplog):
    _settings_with_key(monkeypatch)
    with caplog.at_level(logging.WARNING):
        assert fetch_scheduled("UNKNOWN") == []
    assert "Unknown league" in caplog.text


def test_fetch_scheduled_request_error(monkeypatch, caplog):
    _settings_with_key(monkeypatch)

    def boom(*args, **kwargs):
        raise ConnectionError("dns down")

    monkeypatch.setattr(fdorg.httpx, "get", boom)
    with caplog.at_level(logging.WARNING):
        assert fetch_scheduled("E0") == []
    assert "request failed" in caplog.text


def test_fetch_scheduled_normalizes(monkeypatch):
    _settings_with_key(monkeypatch)
    payload = {
        "matches": [
            {
                "id": 1,
                "utcDate": "2026-09-12T14:00:00Z",
                "homeTeam": {"name": "Manchester City FC"},
                "awayTeam": {"name": "Arsenal FC"},
            },
            {
                "id": 2,
                "utcDate": "2026-09-13T16:30:00Z",
                "homeTeam": {"name": "Tottenham Hotspur FC"},
                "awayTeam": {"name": "Chelsea FC"},
            },
            {"id": 3, "utcDate": "", "homeTeam": {}, "awayTeam": {}},
        ]
    }
    monkeypatch.setattr(fdorg.httpx, "get", lambda *a, **k: FakeResponse(payload))
    result = fetch_scheduled("E0")
    assert len(result) == 2
    assert result[0]["home_team"] == "Man City"
    assert result[0]["away_team"] == "Arsenal"
    assert result[0]["date"] == "2026-09-12T14:00:00Z"
    assert result[1]["home_team"] == "Spurs"


def test_fetch_scheduled_extracts_crests(monkeypatch):
    _settings_with_key(monkeypatch)
    payload = {
        "matches": [
            {
                "id": 1,
                "utcDate": "2026-09-12T14:00:00Z",
                "homeTeam": {"name": "Arsenal FC", "crest": "https://x.test/arsenal.png"},
                "awayTeam": {"name": "Chelsea FC", "crest": "https://x.test/chelsea.png"},
            },
            {
                "id": 2,
                "utcDate": "2026-09-13T16:30:00Z",
                "homeTeam": {"name": "Liverpool FC"},
                "awayTeam": {"name": "Everton FC"},
            },
        ]
    }
    monkeypatch.setattr(fdorg.httpx, "get", lambda *a, **k: FakeResponse(payload))
    result = fetch_scheduled("E0")
    assert result[0]["home_crest"] == "https://x.test/arsenal.png"
    assert result[0]["away_crest"] == "https://x.test/chelsea.png"
    assert result[1]["home_crest"] is None
    assert result[1]["away_crest"] is None


@pytest.mark.parametrize(("league", "source", "expected"), [
    ("E0", "Manchester United FC", "Man United"),
    ("E0", "Wolverhampton Wanderers FC", "Wolves"),
    ("E0", "Nottingham Forest FC", "Nott'm Forest"),
    ("SP1", "Club Atlético de Madrid", "Ath Madrid"),
    ("SP1", "Deportivo Alavés", "Alaves"),
    ("D1", "FC Bayern München", "Bayern Munich"),
    ("D1", "Borussia Mönchengladbach", "M'gladbach"),
    ("I1", "FC Internazionale Milano", "Inter"),
    ("F1", "Paris Saint-Germain FC", "PSG"),
    ("F1", "AS Saint-Étienne", "St Etienne"),
    ("SP1", "Málaga CF", "Malaga"),
    ("SP1", "Elche CF", "Elche"),
    ("SP1", "RC Deportivo La Coruña", "La Coruna"),
    ("SP1", "Real Racing Club de Santander", "Santander"),
    ("SP1", "Levante UD", "Levante"),
    ("D1", "1. FC Köln", "FC Koln"),
    ("D1", "FC Schalke 04", "Schalke 04"),
    ("D1", "Hamburger SV", "Hamburg"),
    ("D1", "SC Paderborn 07", "Paderborn"),
    ("D1", "SV 07 Elversberg", "Elversberg"),
    ("I1", "Frosinone Calcio", "Frosinone"),
    ("I1", "US Sassuolo Calcio", "Sassuolo"),
])
def test_normalize_mapped_names(league, source, expected):
    assert normalize_team_name(source, league) == expected


def test_normalize_unmapped_strips_suffix(caplog):
    with caplog.at_level(logging.WARNING):
        assert normalize_team_name("Some New Club FC", "E0") == "Some New Club"
    assert "Unmapped team name" in caplog.text


def test_normalize_unmapped_warns_once_per_name_and_league(caplog):
    with caplog.at_level(logging.WARNING):
        normalize_team_name("Once Only FC", "E0")
        assert caplog.text.count("Unmapped team name 'Once Only FC'") == 1
        caplog.clear()
        normalize_team_name("Once Only FC", "E0")
        assert "Unmapped team name" not in caplog.text


def test_fetch_scheduled_retries_rate_limit(monkeypatch):
    _settings_with_key(monkeypatch)
    responses = [FakeResponse({}, status=429), FakeResponse({"matches": []})]
    monkeypatch.setattr(fdorg.httpx, "get", lambda *a, **k: responses.pop(0))
    monkeypatch.setattr(fdorg.time, "sleep", lambda *_: None)
    assert fetch_scheduled("E0") == []
    assert responses == []


def test_fetch_scheduled_gives_up_after_rate_limit(monkeypatch, caplog):
    _settings_with_key(monkeypatch)
    monkeypatch.setattr(fdorg.httpx, "get", lambda *a, **k: FakeResponse({}, status=429))
    monkeypatch.setattr(fdorg.time, "sleep", lambda *_: None)
    with caplog.at_level(logging.WARNING):
        assert fetch_scheduled("E0") == []
    assert "rate limited" in caplog.text
