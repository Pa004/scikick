-- SciKick — Migration 008: Team crest URLs (football-data.org, hotlinked)
-- PRAGMA user_version controls migration state

ALTER TABLE teams ADD COLUMN crest_url TEXT;

PRAGMA user_version = 8;
