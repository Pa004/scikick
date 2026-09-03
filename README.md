# SciKick

Probability estimation engine for football match outcomes using classical ML (LightGBM + Dixon-Coles). Not a betting tool — an analytical instrument for calibrated probability estimation.

## Stack

- **Backend**: Python 3.13, FastAPI, SQLite (WAL mode)
- **ML**: LightGBM (5-seed ensemble), Dixon-Coles (own implementation via `scipy.optimize`), Logistic Regression baseline
- **Calibration**: Isotonic regression (default), Platt scaling (< 500 samples)
- **Frontend**: React + TypeScript + Vite + Recharts
- **Orchestration**: APScheduler (standalone process)
- **Containerization**: Docker Compose (reference, not required locally)

## Quick start

```bash
python -m venv .venv
.venv\Scripts\activate        # Windows
pip install -r requirements.txt
cp .env.example .env          # fill in SERVICE_TOKEN at minimum
python -m app.cli sync --league E0 --seasons 3
python -m app.cli train --league E0 --mode complete
uvicorn app.api.main:app --reload
```

## Markets covered

~70 markets across 3 statistical motors + player-level scorer:

- **Motor 1** (Dixon-Coles score matrix): 1x2, double chance, over/under, BTTS, handicap, exact score, goal bands, odd/even, clean sheet, win to nil, draw no bet
- **Motor 2** (half-time models + count models): HT/FT, HT 1x2, HT over/under, corners over/under, cards over/under, combined markets
- **Motor 4** (rare events): penalty, own goal (league-average constants, per-team data unavailable)
- **Goalscorer** (player-level Poisson): anytime goalscorer — xG90 from Understat + position shrink + minutes estimate, lineups from API-Football (optional, improves accuracy)

Excluded: Motor 3 (in-play event simulation).

## Retraining

Two levels defined in the pipeline:

- **Light** (weekly): refit with tuned hyperparameters, no Optuna search. Low cost.
- **Complete** (monthly or on degradation): full Optuna tuning + blend weight recalibration. Triggered when Brier Score degrades >15% relative over last 10 matchdays.

## Known limitations

- **Transfer window**: model does not capture mid-season roster changes.
- **LigaPro Ecuador** (Tier 4): operates with a more limited feature set (no historical odds, no xG).
- **Rare events**: league-average constants only; source (football-data.co.uk) lacks per-team penalty/own-goal data.
- **In-play markets** (Motor 3): excluded — requires real-time event simulation and timestamped event data.
- **Goalscorer**: requires players with ≥450 min in Understat; confirmed lineups require API-Football free-tier key (100 req/day shared budget).

## License

Private — not licensed for distribution.
