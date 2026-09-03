# SciKick Frontend

React + TypeScript + Vite dashboard for the [SciKick](../README.md) probability engine. Visualizes fixtures, per-match predictions across ~70 markets, and player-level goalscorer probabilities served by the FastAPI backend.

## Stack

- **React 19** + TypeScript
- **Vite 8** (dev server + build)
- **Recharts** — probability visualizations
- **Oxlint** — linting
- **Vitest + Testing Library** — unit tests

## Scripts

```bash
npm run dev       # dev server → http://localhost:5173
npm run build     # type-check + production build
npm run lint      # oxlint
npm test          # vitest
npm run preview   # preview the production build
```

## Features

- **Fixtures feed** — scrollable list of matches with date, teams, and final score, filterable by league
- **Match prediction panel** — select any fixture to see the predicted probability for the current market, the most-likely score line, the underlying model/agreement, and the top contributing features (e.g. Elo, form)
- **~70 markets** — switch the active market (1x2, double chance, over/under, handicap, BTTS, corners, cards, HT/FT, and more) from a dropdown
- **Goalscorer tab** — player-level anytime-scorer probabilities (xG90 + position + minutes); projects lineups from historical starters when confirmed lineups are unavailable
- **Stats panel** — model training/calibration status (shows once fixtures have been evaluated)

## API

The dashboard talks to the SciKick backend, which by default runs at `http://localhost:8000`. Key endpoints:

- `GET /api/fixtures` — upcoming/recent fixtures
- `GET /api/predict/{fixture_id}?market=...` — prediction for a fixture/market
- `GET /api/predict/scorer/{fixture_id}` — goalscorer probabilities
- `GET /api/stats` — calibration / model status

Point the app at a different backend via the Vite dev server proxy or the API base setting in [`src/api.ts`](src/api.ts).

## Getting started

```bash
cd frontend
npm ci
npm run dev
```

Make sure the backend is running first (see the [root README](../README.md#quick-start)).
