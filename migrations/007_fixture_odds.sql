-- SciKick — Migration 007: Stored bookmaker odds per fixture
-- PRAGMA user_version controls migration state

CREATE TABLE IF NOT EXISTS fixture_odds (
    fixture_id INTEGER NOT NULL REFERENCES fixtures(id),
    bookmaker TEXT NOT NULL,
    home REAL NOT NULL,
    draw REAL NOT NULL,
    away REAL NOT NULL,
    fetched_at TEXT NOT NULL,
    PRIMARY KEY (fixture_id, bookmaker)
);
CREATE INDEX IF NOT EXISTS idx_fixture_odds_fixture ON fixture_odds(fixture_id);

PRAGMA user_version = 7;
