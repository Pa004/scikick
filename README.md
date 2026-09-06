# SciKick

**Calibrated football probability estimation with classical ML** — LightGBM ensembles + an in-house Dixon-Coles implementation.

SciKick is an **analytical instrument, not a betting tool**. It converts match history into honest, well-calibrated probability estimates across ~70 markets. Every number is auditable, from input features to calibration curves.

![CI](https://github.com/Pa004/scikick/actions/workflows/ci.yml/badge.svg)

![SciKick fixtures grid](docs/screenshots/fixtures.png)

## What it does

- **Honest probabilities**: every estimate is calibrated (isotonic regression, Platt below 500 samples) and reported with Brier scores, so a "60%" means 60%.
- **~70 markets**: 1X2, over/under, BTTS, handicaps, exact score, half-time, corners, cards, combined markets, plus player-level anytime scorer.
- **Auditable by design**: model agreement, top SHAP-style features, and reliability curves ship with every prediction.
- **Runs anywhere**: CPU-only Python backend + SQLite, dependency-free React frontend. No GPU, no cloud required.

## How it works

```
CSVs / APIs ──▶ ingestion ──▶ features ──▶ models ──▶ calibration ──▶ API ──▶ UI
football-data   adapters      Elo, form,   3 motors    isotonic /    FastAPI   React
.co.uk,           (Understat,  xG, match   + scorer    Platt         + SQLite  dashboard
Understat,        API-Football) features    module      auto-recal
API-Football
```

- **Motor 1** — Dixon-Coles score matrix (own `scipy.optimize` implementation): 1X2, double chance, over/under, BTTS, handicaps, exact score, goal bands, odd/even, clean sheet, win to nil, draw no bet.
- **Motor 2** — half-time + count models: HT/FT, HT 1X2, HT over/under, corners and cards, combined markets.
- **Motor 4** — rare events (penalty, own goal) as league-average constants.
- **Goalscorer** — player-level anytime scorer from Understat xG90, position shrink, and minutes estimates; optional API-Football lineups.
- **Retraining** — two levels: `light` (weekly, tuned params) and `complete` (monthly or on degradation: full Optuna tuning + blend-weight recalibration, auto-triggered past 15% Brier drift). A standalone APScheduler runs daily sync and model jobs.

## The interface

A dark, data-dense dashboard (EN/ES, keyboard-operable, WCAG-aware) built with React + TypeScript + Recharts and zero animation dependencies:

- **Bookmaker-style fixtures grid** with 1X2 probability columns, inline search, league tabs, and featured rails.
- **Probability/decimal toggle** (display format only) with movement indicators against last-seen values.
- **Match center**: form badges, head-to-head, momentum bars, and a display-only model combo card.
- **Pick of the day** and a **calibration trust block** (Brier reading, reliability count, sample size).
- **Sortable scorer grid** in the player-props tradition.

![SciKick dashboard](docs/screenshots/dashboard.png)

![SciKick goalscorer](docs/screenshots/goalscorer.png)

![SciKick in Spanish](docs/screenshots/dashboard-es.png)

## Engineering highlights

- **Reproducible pipeline**: Elo ratings, team form, xG enrichment, and score matrices versioned per model run (`app/models/runs/`).
- **Race-safe UI**: request-id guards on every fetch; localStorage-persisted preferences (locale, display mode, last-seen snapshots).
- **Tested**: 41 backend test files (pytest) + 60 frontend tests across 11 files (vitest); `oxlint` + `tsc` + `vite build` green on every PR via CI.
- **Self-hosted fonts, CSS design tokens, tabular numerals for data** (`frontend/src/index.css`).

## Quality metrics

| Area | Status |
|---|---|
| Backend tests | 41 files, pytest, CI green |
| Frontend tests | 60 tests / 11 files, vitest, CI green |
| Lint / types / build | `oxlint` clean, `tsc` strict, `vite build` OK |
| Model accuracy / Brier | Reported per league in the dashboard trust block — retrain to reproduce (`python -m app.cli train --league E0 --mode complete`) |

## Quick start

```bash
# 1. Environment (Windows path shown; macOS/Linux use .venv/bin/activate)
python -m venv .venv
.venv\Scripts\activate

# 2. Dependencies
pip install -r requirements.txt
cp .env.example .env          # set SERVICE_TOKEN at minimum

# 3. Sync data (football-data.co.uk CSVs)
python -m app.cli sync --league E0 --seasons 3

# 4. Train the ensemble (takes a few minutes)
python -m app.cli train --league E0 --mode complete

# 5. Run the API
uvicorn app.api.main:app --reload
```

Frontend:

```bash
cd frontend
npm ci
npm run dev      # http://localhost:5173
```

## Project structure

```
app/
  config.py       — Settings via pydantic-settings (reads .env, singleton)
  db/             — SQLite connection, migrations, backup
  ingestion/      — Data adapters (football-data.co.uk, Understat, API-Football)
  features/       — Feature engineering (Elo, form, xG, match_features table)
  models/         — LightGBM, Dixon-Coles, blend, calibration, runs/
  api/            — FastAPI endpoints (predict, fixtures, stats, refresh)
  players/        — Goalscorer module (ingest, model, lineups, prediction)
  phase2/         — HT/FT residual multiplier (Fase 2)
  scheduler.py    — APScheduler jobs (sync, retrain, lineups)
frontend/
  src/            — React + TypeScript dashboard: components, hooks, utils, i18n
migrations/       — numbered SQL files applied via PRAGMA user_version
```

**Core tables** (SQLite): `leagues`, `teams`, `team_aliases`, `fixtures`, `tracked` +
`match_features` (regenerable) and player tables (`players`, `player_features`, `lineups`).

## Development

```bash
# Backend tests (pytest auto-sets ENV=test, DATABASE_PATH=:memory:)
python -m pytest
python -m pytest tests/unit/          # unit only
python -m pytest -m "not slow"        # skip slow tests

# Frontend
cd frontend
npm run lint
npm test
npm run build
```

CI runs the backend suite and the frontend lint/test/build on every push and pull request (`.github/workflows/ci.yml`).

## Known limitations

- **Transfer windows**: the model does not capture mid-season roster changes.
- **LigaPro Ecuador** (Tier 4): limited feature set (no historical odds, no xG).
- **Rare events**: per-team penalty/own-goal data is not available from the source, so league-average constants are used.
- **In-play markets** (Motor 3): excluded — requires real-time event simulation and timestamped event data.
- **Goalscorer**: players need ≥450 min in Understat; confirmed lineups need an API-Football key (free tier, 100 req/day shared budget).

## Roadmap

- Per-team form/H2H API (client-side derivation works today from loaded fixtures).
- Full text alternatives for charts (screen-reader data tables).
- Non-color favorite indicator for 1X2 cells.

## License

[MIT](LICENSE) © 2026 Pablo Domínguez Aguilera
