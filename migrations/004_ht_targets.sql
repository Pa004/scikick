-- SciKick — Migration 004: HT targets for Motor 2
-- PRAGMA user_version controls migration state

ALTER TABLE match_features ADD COLUMN target_home_ht_goals INTEGER;
ALTER TABLE match_features ADD COLUMN target_away_ht_goals INTEGER;

PRAGMA user_version = 4;
