-- SciKick — Migration 010: recrear fixtures 'pre' con equipos sin historia
-- Parte de los partidos programados se insertaron con IDs de equipo creados
-- desde nombres divergentes en 2026-09 ("PSG" vs "Paris SG", "Paris" vs
-- "Paris FC", etc.), porque varios mappings de nombres eran incorrectos.
-- Al corregir los mappings (football_data_org.py, api_football.py), el
-- siguiente sync basta para recrear esos fixtures contra el equipo
-- canónico; antes hay que borrar los stale rows (fixture normalizadas).
-- fixture_odds es la única tabla que cuelga de fixtures sin ON DELETE
-- CASCADE, por eso se limpia primero.

DELETE FROM fixture_odds
WHERE fixture_id IN (
  SELECT id FROM fixtures
  WHERE status = 'pre'
    AND source != 'football_data'
    AND (home_team_id IN (
      SELECT id FROM teams t WHERE NOT EXISTS (
        SELECT 1 FROM fixtures f
        WHERE f.source = 'football_data'
          AND (f.home_team_id = t.id OR f.away_team_id = t.id)))
     OR away_team_id IN (
      SELECT id FROM teams t WHERE NOT EXISTS (
        SELECT 1 FROM fixtures f
        WHERE f.source = 'football_data'
          AND (f.home_team_id = t.id OR f.away_team_id = t.id))))
);

DELETE FROM fixtures
WHERE status = 'pre'
  AND source != 'football_data'
  AND (home_team_id IN (
    SELECT id FROM teams t WHERE NOT EXISTS (
      SELECT 1 FROM fixtures f
      WHERE f.source = 'football_data'
        AND (f.home_team_id = t.id OR f.away_team_id = t.id)))
   OR away_team_id IN (
    SELECT id FROM teams t WHERE NOT EXISTS (
      SELECT 1 FROM fixtures f
      WHERE f.source = 'football_data'
        AND (f.home_team_id = t.id OR f.away_team_id = t.id))));

DELETE FROM teams
WHERE id NOT IN (
  SELECT home_team_id FROM fixtures
  UNION ALL
  SELECT away_team_id FROM fixtures
);

PRAGMA user_version = 10;
