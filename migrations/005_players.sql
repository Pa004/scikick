-- SciKick — Migration 005: Players + player features (Scorer module)
-- PRAGMA user_version controls migration state

CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    team_name TEXT NOT NULL,
    position TEXT,
    xg90 REAL DEFAULT 0.0,
    npxg90 REAL DEFAULT 0.0,
    minutes_total INTEGER DEFAULT 0,
    games INTEGER DEFAULT 0,
    source TEXT NOT NULL DEFAULT 'understat',
    source_player_id TEXT,
    UNIQUE(source, source_player_id)
);

CREATE TABLE IF NOT EXISTS player_features (
    fixture_id INTEGER NOT NULL REFERENCES fixtures(id) ON DELETE CASCADE,
    player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    team_name TEXT NOT NULL,
    xg90 REAL NOT NULL DEFAULT 0.0,
    npxg90 REAL NOT NULL DEFAULT 0.0,
    minutes_played INTEGER,
    min_expected REAL,
    position TEXT,
    home_away TEXT NOT NULL CHECK (home_away IN ('home', 'away')),
    opponent_xga REAL,
    PRIMARY KEY (fixture_id, player_id)
);

CREATE TABLE IF NOT EXISTS lineups (
    fixture_id INTEGER NOT NULL REFERENCES fixtures(id) ON DELETE CASCADE,
    player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('starting', 'sub')),
    position TEXT,
    PRIMARY KEY (fixture_id, player_id)
);
CREATE INDEX IF NOT EXISTS idx_player_features_fixture ON player_features(fixture_id);
CREATE INDEX IF NOT EXISTS idx_players_team ON players(team_name);

PRAGMA user_version = 5;
