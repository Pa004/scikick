-- SciKick — Migration 009: hot-path indexes, fixture_odds FK cascade, odds guards
-- PRAGMA user_version controls migration state

CREATE INDEX IF NOT EXISTS idx_fixtures_league_status_date ON fixtures(league, status, match_date);
CREATE INDEX IF NOT EXISTS idx_fixtures_referee ON fixtures(referee);
CREATE INDEX IF NOT EXISTS idx_team_aliases_source ON team_aliases(source, source_name);
CREATE INDEX IF NOT EXISTS idx_tracked_market_league ON tracked(market, league);

-- Rebuild fixture_odds to add ON DELETE CASCADE plus sanity CHECKs.
-- (SQLite cannot ALTER constraints; the table is small and fully derived.)
CREATE TABLE IF NOT EXISTS fixture_odds_new (
    fixture_id INTEGER NOT NULL REFERENCES fixtures(id) ON DELETE CASCADE,
    bookmaker TEXT NOT NULL,
    home REAL NOT NULL CHECK (home > 1.0),
    draw REAL NOT NULL CHECK (draw > 1.0),
    away REAL NOT NULL CHECK (away > 1.0),
    fetched_at TEXT NOT NULL,
    PRIMARY KEY (fixture_id, bookmaker)
);
INSERT OR IGNORE INTO fixture_odds_new
    SELECT fixture_id, bookmaker, home, draw, away, fetched_at FROM fixture_odds;
DROP TABLE IF EXISTS fixture_odds;
ALTER TABLE fixture_odds_new RENAME TO fixture_odds;
CREATE INDEX IF NOT EXISTS idx_fixture_odds_fixture ON fixture_odds(fixture_id);

PRAGMA user_version = 9;
