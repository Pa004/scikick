# AGENTS.md — SciKick

## What this is

Football probability estimation platform using classical ML (LightGBM + Dixon-Coles). **Not a betting tool** — an analytical instrument for calibrated probability estimation. Full spec: `analisis-plataforma-prediccion-ml.md`.

## Stack

- **Python 3.13.12**, FastAPI, SQLite (WAL mode), APScheduler
- **ML**: LightGBM (5-seed ensemble), Dixon-Coles (own impl via `scipy.optimize`), Logistic baseline
- **Calibration**: Isotonic regression (default), Platt scaling (< 500 samples)
- **Frontend**: React + TypeScript + Vite + Recharts (under `frontend/`)
- **No Docker** — CPU-only (i7-1255U, 16GB RAM, no GPU)

## Repo

https://github.com/Pa004/scikick.git

## Git workflow

**Todo el desarrollo se hace por ramas.** Nunca commitear directamente a `main`.

```bash
git checkout main && git pull
git checkout -b feat/nombre-descriptivo   # o fix/, refactor/, docs/
# ... trabajo ...
git add -A && git commit -m "feat(scope): descripción"
git push -u origin feat/nombre-descriptivo
```

Naming de ramas: `feat/`, `fix/`, `refactor/`, `docs/`, `chore/` — descriptors cortos en kebab-case.

## Dev commands

```bash
# Activate venv (Windows)
.venv\Scripts\activate

# Run tests (pytest auto-sets ENV=test, DATABASE_PATH=:memory: via conftest)
python -m pytest
python -m pytest tests/unit/           # unit only
python -m pytest -m "not slow"         # skip slow tests

# Run the API
uvicorn app.api.main:app --reload

# CLI commands (sync data, train models)
python -m app.cli sync --league E0 --seasons 3
python -m app.cli train --league E0 --mode complete
```

## Environment

Copy `.env.example` → `.env`. Key vars:
- `SERVICE_TOKEN` — required for `POST /api/refresh`
- `API_FOOTBALL_KEY` — free tier, 100 req/day hard ceiling
- `XG_ENABLED` — toggle Understat xG features
- `ENV=test` — auto-set by pytest conftest (uses `:memory:` DB)

**Never commit `.env`** (blocked by `.gitignore`).

## Architecture

```
app/
  config.py       — Settings via pydantic-settings (reads .env, singleton)
  db/             — SQLite connection, migrations, backup
  ingestion/      — Data adapters (football-data.co.uk, Understat, API-Football)
  features/       — Feature engineering (Elo, form, xG, match_features table)
  models/         — LightGBM, Dixon-Coles, blend, calibration, runs/
  api/            — FastAPI endpoints (predict, fixtures, stats, refresh)
  phase2/         — HT/FT residual multiplier (Fase 2)
```

**5 core tables**: `leagues`, `teams`, `team_aliases`, `fixtures`, `tracked` (keyed on `fixture_id, market`)
**1 regenerable table**: `match_features` (ML features per fixture)
Schema: `migrations/001_init.sql` (user_version=1)

## Key conventions

- **Migrations**: numbered SQL files in `migrations/`, applied via `PRAGMA user_version`
- **Backups**: `tracked` table is NOT regenerable — always backup before destructive ops
- **Tests**: use `:memory:` DB (conftest auto-patches), no filesystem side effects
- **Coverage**: `app/phase2/*` and `app/models/runs/*` excluded from coverage
- **3 phases**: Phase 1 = Motor 1 (~25 markets from score matrix); Phase 2 = HT/FT; Phase 3 = player-level (gated)

## Gotchas

- `app/config.py:get_settings()` is `lru_cache`'d — in tests, monkeypatch env vars BEFORE calling it
- SQLite `:memory:` — conftest handles this automatically; don't create real DB files in tests
- Football-data.co.uk CSVs are the primary data source — Understat xG and API-Football fixtures are nullable/supplementary
- API-Football free tier = 100 req/day — respect the quota in ingestion adapters
- Windows paths: `.venv\Scripts\activate` (not `.venv/bin/`)
