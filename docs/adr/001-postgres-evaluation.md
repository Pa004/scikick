# ADR 001: PostgreSQL evaluation (spike, no migration)

Date: 2026-09-18. Status: **Accepted as investigation — stay on SQLite.**

## Context

Single writer (one uvicorn worker, background jobs serialized), ~2k fixtures,
WAL + 5s busy timeout, all access funneled through `get_connection()`
(`app/db/connection.py`), except two raw `sqlite3.connect` calls in
`app/db/backup.py`. Reads dominate; writes are sync/resolve/train batches.

## Findings

- Migration surface is contained but wide: every query uses `?`
  placeholders (~40 call sites across routers, ingestion, models), `PRAGMA
  user_version` drives migrations, `sqlite3.Row` is assumed everywhere,
  and `migrations/001–009` are SQLite dialect (`AUTOINCREMENT`-style DDL,
  `INSERT OR REPLACE/IGNORE`, `PRAGMA table_info` in tests).
- `pandas.read_sql_query` calls accept a SQLAlchemy URI unchanged.
- `backup.py` (`sqlite3.backup` API) and `export_tracked_json` would need a
  `pg_dump`-based rewrite; restore/retention logic along with it.
- Tests would need a Postgres service (CI + local), replacing tmp-file
  SQLite everywhere — the current suite is fast precisely because it does not.
- Nothing in the hot path needs Postgres features (no JSONB queries, no
  concurrent writers, no replicas).

## Decision

Stay on SQLite. The choke point (`get_connection`) keeps the option open:
a future migration only needs a DBAPI-compatible pool there plus query
placeholder translation.

## Migration triggers (revisit when ANY hits)

1. Second concurrent writer (multi-worker uvicorn, external cron writer).
2. Sustained `database is locked` in logs despite the 009 indexes.
3. `tracked` growth making `/stats` p95 unacceptable even with the TTL cache.
4. Hosted deploy where the platform favors managed Postgres.

## Estimated cost if triggered

- M: placeholder translation layer + `dict_row` rows + PRAGMA-free migrations.
- M: `pg_dump` backup/restore + retention.
- S: CI Postgres service + tmp-database test harness.
- Total: roughly one focused sprint, no model changes (joblib artifacts untouched).
