-- SciKick — Migration 006: API-Football fixture id for lineups resolution
-- PRAGMA user_version controls migration state

ALTER TABLE fixtures ADD COLUMN api_football_id INTEGER;
CREATE INDEX IF NOT EXISTS idx_fixtures_api_id ON fixtures(api_football_id);

PRAGMA user_version = 6;
