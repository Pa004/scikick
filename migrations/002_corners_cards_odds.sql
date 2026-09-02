-- SciKick — Migration 002: Corners, cards, referee and odds columns
-- PRAGMA user_version controls migration state

ALTER TABLE fixtures ADD COLUMN home_corners INTEGER;
ALTER TABLE fixtures ADD COLUMN away_corners INTEGER;
ALTER TABLE fixtures ADD COLUMN home_yellow INTEGER;
ALTER TABLE fixtures ADD COLUMN away_yellow INTEGER;
ALTER TABLE fixtures ADD COLUMN home_red INTEGER;
ALTER TABLE fixtures ADD COLUMN away_red INTEGER;
ALTER TABLE fixtures ADD COLUMN referee TEXT;
ALTER TABLE fixtures ADD COLUMN avg_home_odds REAL;
ALTER TABLE fixtures ADD COLUMN avg_draw_odds REAL;
ALTER TABLE fixtures ADD COLUMN avg_away_odds REAL;

PRAGMA user_version = 2;
