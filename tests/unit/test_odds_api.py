import logging
import sqlite3
from pathlib import Path

from app.db.migrations import run_migrations
from app.ingestion.adapters import odds_api as odds_module
from app.ingestion.odds_sync import sync_odds_for_league


class FakeResponse:
    def __init__(self, payload, remaining="499"):
        self._payload = payload
        self.headers = {"x-requests-remaining": remaining, "x-requests-used": "1"}

    def raise_for_status(self):
        pass

    def json(self):
        return self._payload


def _payload():
    return [
        {
            "id": "evt1",
            "commence_time": "2026-09-12T14:00:00Z",
            "home_team": "Manchester City",
            "away_team": "Arsenal",
            "bookmakers": [
                {
                    "key": "pinnacle",
                    "markets": [
                        {"key": "h2h", "outcomes": [
                            {"name": "Manchester City", "price": 1.75},
                            {"name": "Draw", "price": 3.90},
                            {"name": "Arsenal", "price": 4.60},
                        ]},
                    ],
                },
                {
                    "key": "betfair",
                    "markets": [
                        {"key": "h2h", "outcomes": [
                            {"name": "Manchester City", "price": 1.72},
                            {"name": "Draw", "price": 4.00},
                            {"name": "Arsenal", "price": 4.50},
                        ]},
                    ],
                },
            ],
        }
    ]


def _settings(monkeypatch, key="test-key"):
    monkeypatch.setenv("ODDS_API_KEY", key)
    from app.config import get_settings
    get_settings.cache_clear()


def test_sport_map_coverage():
    assert set(odds_module.SPORT_MAP) == {"E0", "SP1", "D1", "I1", "F1"}


def test_fetch_h2h_no_key(monkeypatch):
    _settings(monkeypatch, "")
    assert odds_module.fetch_h2h("E0") == []


def test_fetch_h2h_best_and_quota(monkeypatch, caplog):
    _settings(monkeypatch)
    monkeypatch.setattr(
        odds_module.httpx, "get", lambda *a, **k: FakeResponse(_payload())
    )
    with caplog.at_level(logging.INFO):
        events = odds_module.fetch_h2h("E0")
    assert len(events) == 1
    assert events[0]["best"]["Manchester City"]["price"] == 1.75
    assert events[0]["best"]["Draw"]["price"] == 4.00
    assert "remaining=499" in caplog.text


def test_fetch_h2h_error_payload(monkeypatch, caplog):
    _settings(monkeypatch)

    class ErrResponse(FakeResponse):
        def json(self):
            return {"message": "invalid key"}

    def boom(*args, **kwargs):
        raise ValueError("bad key")

    monkeypatch.setattr(odds_module.httpx, "get", boom)
    with caplog.at_level(logging.WARNING):
        assert odds_module.fetch_h2h("E0") == []


def _setup_odds_db(tmp_path: Path) -> sqlite3.Connection:
    db_path = str(tmp_path / "odds.db")
    run_migrations(db_path)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute(
        "INSERT INTO leagues (id, name, country, tier, source_csv_code, "
        "has_odds, has_xg, season_start_month, min_seasons) "
        "VALUES ('E0', 'Premier League', 'England', 1, 'E0', 1, 0, 8, 2)"
    )
    conn.execute("INSERT INTO teams (id, canonical_name) VALUES (1, 'Man City')")
    conn.execute("INSERT INTO teams (id, canonical_name) VALUES (2, 'Arsenal')")
    conn.execute(
        "INSERT INTO fixtures (league, match_date, home_team_id, away_team_id, "
        "status, source, source_fixture_id) "
        "VALUES ('E0', '2026-09-12', 1, 2, 'pre', 'football_data_org', 'fdorg_1')"
    )
    conn.commit()
    return conn


def test_sync_odds_matches_fixture(tmp_path, monkeypatch):
    from app.ingestion import odds_sync as sync_module

    monkeypatch.setattr(
        sync_module, "fetch_h2h", lambda league: [
            {
                "event_id": "evt1",
                "date": "2026-09-12",
                "home_team": "Manchester City",
                "away_team": "Arsenal",
                "books": {},
                "best": {
                    "Manchester City": {"price": 1.75, "book": "pinnacle"},
                    "Draw": {"price": 4.00, "book": "betfair"},
                    "Arsenal": {"price": 4.60, "book": "pinnacle"},
                },
            }
        ]
    )
    conn = _setup_odds_db(tmp_path)
    try:
        result = sync_module.sync_odds_for_league(conn, "E0")
        assert result == {"league": "E0", "matched": 1, "events": 1}
        row = conn.execute("SELECT home, draw, away FROM fixture_odds").fetchone()
        assert (row[0], row[1], row[2]) == (1.75, 4.00, 4.60)
    finally:
        conn.close()


def test_sync_odds_skips_unmatched_date(tmp_path, monkeypatch, caplog):
    from app.ingestion import odds_sync as sync_module

    monkeypatch.setattr(
        sync_module, "fetch_h2h", lambda league: [
            {"event_id": "e", "date": "2026-09-12", "home_team": "Bedford",
             "away_team": "Nowhere", "books": {}, "best": {}}
        ]
    )
    conn = _setup_odds_db(tmp_path)
    try:
        with caplog.at_level(logging.WARNING):
            result = sync_module.sync_odds_for_league(conn, "E0")
        assert result["matched"] == 0
        assert "without fixture" in caplog.text
    finally:
        conn.close()


def test_promoted_teams_resolve_via_overrides():
    from app.ingestion.adapters.api_football import normalize_api_name

    assert normalize_api_name("1. FC Köln", "D1") == "1. FC Köln"
    assert normalize_api_name("Lorient", "F1") == "Lorient"
    assert normalize_api_name("Hamburger SV", "D1") == "Hamburger SV"
    assert normalize_api_name("Le Mans", "F1") == "Le Mans"


def test_match_event_matches_names_date_bucketed_upstream(tmp_path, monkeypatch):
    from app.ingestion import odds_sync as sync_module

    conn = _setup_odds_db(tmp_path)
    try:
        candidates = [
            {"id": 7, "match_date": "2026-09-12",
             "home_name": "Man City", "away_name": "Arsenal"},
        ]
        hit = {"date": "2026-09-12", "home_team": "Manchester City", "away_team": "Arsenal"}
        assert sync_module._match_event(candidates, "E0", hit) == 7
        wrong_name = dict(hit, away_team="Chelsea")
        assert sync_module._match_event(candidates, "E0", wrong_name) is None
    finally:
        conn.close()


def test_sync_odds_ignores_events_outside_date_bucket(tmp_path, monkeypatch):
    from app.ingestion import odds_sync as sync_module

    monkeypatch.setattr(
        sync_module, "fetch_h2h", lambda league: [
            {"event_id": "e", "date": "2026-09-13", "home_team": "Manchester City",
             "away_team": "Arsenal", "books": {},
             "best": {"Manchester City": {"price": 1.75, "book": "p"},
                      "Draw": {"price": 4.0, "book": "p"},
                      "Arsenal": {"price": 4.6, "book": "p"}}}
        ]
    )
    conn = _setup_odds_db(tmp_path)
    try:
        result = sync_module.sync_odds_for_league(conn, "E0")
        assert result == {"league": "E0", "matched": 0, "events": 1}
        assert conn.execute("SELECT COUNT(*) FROM fixture_odds").fetchone()[0] == 0
    finally:
        conn.close()
