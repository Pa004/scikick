# SciKick

Probability estimation engine for football match outcomes using classical ML (LightGBM + Dixon-Coles). Not a betting tool — an analytical instrument for calibrated probability estimation.

## Stack

- **Backend**: Python 3.13, FastAPI, SQLite (WAL mode)
- **ML**: LightGBM, Dixon-Coles (own implementation via `scipy.optimize`), Logistic Regression baseline
- **Calibration**: Isotonic regression (default), Platt scaling (< 500 samples)
- **Frontend**: React + TypeScript + Vite + Recharts
- **Orchestration**: APScheduler (standalone process)

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

## Project status

Fase 1 in progress. See `analisis-plataforma-prediccion-ml.md` for the full specification.

## License

Private — not licensed for distribution.
