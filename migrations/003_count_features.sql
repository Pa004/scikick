-- SciKick — Migration 003: Count features (corners/cards rolling averages + targets)
-- PRAGMA user_version controls migration state

ALTER TABLE match_features ADD COLUMN home_corners_avg_last3 REAL DEFAULT 0;
ALTER TABLE match_features ADD COLUMN home_corners_avg_last5 REAL DEFAULT 0;
ALTER TABLE match_features ADD COLUMN away_corners_avg_last3 REAL DEFAULT 0;
ALTER TABLE match_features ADD COLUMN away_corners_avg_last5 REAL DEFAULT 0;
ALTER TABLE match_features ADD COLUMN home_yellow_avg_last3 REAL DEFAULT 0;
ALTER TABLE match_features ADD COLUMN home_yellow_avg_last5 REAL DEFAULT 0;
ALTER TABLE match_features ADD COLUMN away_yellow_avg_last3 REAL DEFAULT 0;
ALTER TABLE match_features ADD COLUMN away_yellow_avg_last5 REAL DEFAULT 0;
ALTER TABLE match_features ADD COLUMN target_home_corners INTEGER;
ALTER TABLE match_features ADD COLUMN target_away_corners INTEGER;
ALTER TABLE match_features ADD COLUMN target_home_yellow INTEGER;
ALTER TABLE match_features ADD COLUMN target_away_yellow INTEGER;

PRAGMA user_version = 3;
