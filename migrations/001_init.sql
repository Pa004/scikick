-- SciKick — Migration 001: Initial schema (Fase 1)
-- PRAGMA user_version controls migration state

-- Metadata de ligas (códigos football-data: E0, SP1, D1, I1, F1)
CREATE TABLE IF NOT EXISTS leagues (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    country TEXT NOT NULL,
    tier INTEGER NOT NULL,
    source_csv_code TEXT NOT NULL,
    has_odds INTEGER NOT NULL DEFAULT 1,
    has_xg INTEGER NOT NULL DEFAULT 0,
    season_start_month INTEGER NOT NULL,
    min_seasons INTEGER NOT NULL DEFAULT 2
);

-- IDs canónicos de equipos (una fila por equipo real, sin importar la fuente)
CREATE TABLE IF NOT EXISTS teams (
    id INTEGER PRIMARY KEY,
    canonical_name TEXT NOT NULL UNIQUE
);

-- Resolución de identidad entre fuentes (fuzzy matching → confirmación manual)
CREATE TABLE IF NOT EXISTS team_aliases (
    id INTEGER PRIMARY KEY,
    canonical_team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    source TEXT NOT NULL,
    source_name TEXT,
    source_id TEXT,
    UNIQUE(source, source_id)
);

-- Partidos (regenerable desde la fuente de datos)
CREATE TABLE IF NOT EXISTS fixtures (
    id INTEGER PRIMARY KEY,
    league TEXT NOT NULL REFERENCES leagues(id),
    match_date TEXT NOT NULL,
    home_team_id INTEGER NOT NULL REFERENCES teams(id),
    away_team_id INTEGER NOT NULL REFERENCES teams(id),
    competition_type TEXT NOT NULL DEFAULT 'liga'
        CHECK (competition_type IN ('liga', 'copa', 'copa-neutral')),
    status TEXT NOT NULL CHECK (status IN ('pre', 'post')),
    home_score INTEGER,
    away_score INTEGER,
    ht_home_score INTEGER,
    ht_away_score INTEGER,
    prediction TEXT,
    result_checked INTEGER NOT NULL DEFAULT 0,
    source TEXT NOT NULL,
    source_fixture_id TEXT,
    UNIQUE(source, source_fixture_id),
    UNIQUE(league, match_date, home_team_id, away_team_id),
    CHECK (home_score IS NULL OR (
        home_score BETWEEN 0 AND 15 AND away_score BETWEEN 0 AND 15
    ))
);
CREATE INDEX IF NOT EXISTS idx_fixtures_league_date ON fixtures(league, match_date);
CREATE INDEX IF NOT EXISTS idx_fixtures_status ON fixtures(status);

-- Predicciones resueltas (NO regenerable — backup prioritario)
CREATE TABLE IF NOT EXISTS tracked (
    id INTEGER PRIMARY KEY,
    fixture_id INTEGER NOT NULL REFERENCES fixtures(id) ON DELETE CASCADE,
    league TEXT NOT NULL,
    market TEXT NOT NULL DEFAULT '1x2',
    pick TEXT,
    confidence REAL,
    prob_home REAL,
    prob_draw REAL,
    prob_away REAL,
    predicted_market_prob REAL,
    outcome TEXT,
    hit INTEGER,
    resolved_at TEXT NOT NULL,
    UNIQUE(fixture_id, market)
);
CREATE INDEX IF NOT EXISTS idx_tracked_league_resolved ON tracked(league, resolved_at);
CREATE INDEX IF NOT EXISTS idx_tracked_fixture ON tracked(fixture_id);

-- Features por partido (regenerable, una fila por fixture)
CREATE TABLE IF NOT EXISTS match_features (
    fixture_id INTEGER PRIMARY KEY REFERENCES fixtures(id) ON DELETE CASCADE,
    feature_version TEXT NOT NULL,
    league TEXT NOT NULL,
    season INTEGER NOT NULL,
    match_date TEXT NOT NULL,
    competition_type TEXT NOT NULL,
    home_team_id INTEGER NOT NULL,
    away_team_id INTEGER NOT NULL,
    home_elo REAL NOT NULL,
    away_elo REAL NOT NULL,
    home_elo_margin REAL NOT NULL,
    home_form_pts_last_5 REAL NOT NULL,
    away_form_pts_last_5 REAL NOT NULL,
    home_rest_days REAL NOT NULL,
    away_rest_days REAL NOT NULL,
    h2h_home_wins_last_5 REAL NOT NULL,
    h2h_draws_last_5 REAL NOT NULL,
    referee_cards_avg REAL NOT NULL,
    home_xg_last5_avg REAL,
    away_xg_last5_avg REAL,
    home_xg_missing INTEGER NOT NULL DEFAULT 0,
    away_xg_missing INTEGER NOT NULL DEFAULT 0,
    target_home_goals INTEGER,
    target_away_goals INTEGER,
    target_1x2 TEXT,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_match_features_league_date ON match_features(league, match_date);

PRAGMA user_version = 1;
