# Monthly retrain playbook

Models go stale as new matches are played. This checklist keeps them current.
Run it once a month (or when `football-data.co.uk` publishes a new season file).
No automation: full retrains take hours on CPU.

## 0. Check for the new season file (5 seconds, weekly)

```powershell
curl.exe --insecure -s -o NUL -w "%{http_code}" https://www.football-data.co.uk/mmz4281/2627/E0.csv
```

- `200` → season file published, proceed below.
- `503` → not published yet. Stop here; everything else can wait.

## 1. Sync history + futures (all leagues)

```powershell
.\.venv\Scripts\python.exe -m app.cli sync --league E0,SP1,D1,I1,F1 --seasons 3
```

Expected: `OK <league>: N fixtures synced` per league. `Not a CSV (season file
missing?)` for the in-progress season is normal until step 0 returns 200.

## 2. Refresh scorer squads (free, Understat)

```powershell
.\.venv\Scripts\python.exe -m app.cli scorer-ingest --league E0
.\.venv\Scripts\python.exe -m app.cli scorer-ingest --league SP1
.\.venv\Scripts\python.exe -m app.cli scorer-ingest --league D1
.\.venv\Scripts\python.exe -m app.cli scorer-ingest --league I1
.\.venv\Scripts\python.exe -m app.cli scorer-ingest --league F1
```

Understat throttles: on `Could not fetch datesData`, wait 2 minutes and retry
that league. Expect triple-digit player counts per league once the season has
3+ matchdays; near-zero early on is normal (dynamic minutes gate).

## 3. Retrain (overnight, one league at a time)

```powershell
.\.venv\Scripts\python.exe -m app.cli train --league E0
```

Record `overall_brier` per league and compare with the table below. A new run
must beat (or tie) the previous brier; if it regresses, keep serving the old
run (rollback = delete the new `data/runs/<league>/pipeline_*` files, the
loader picks the newest remaining by mtime).

| League | Last brier | Date | Samples |
|--------|-----------|------|---------|
| E0 | 0.5959 | 2026-09-07 | 37 |
| SP1 | 0.5270 | 2026-09-07 | 34 |
| D1 | 0.4701 | 2026-09-07 | 27 |
| I1 | 0.6258 | 2026-09-07 | 30 |
| F1 | 0.6029 | 2026-09-07 | 34 |

Note: test sets are small (27–37 matches), so single retrains are noisy. Judge
trends over 2–3 cycles, not one number.

## 4. Repredict upcoming fixtures

```powershell
.\.venv\Scripts\python.exe -m app.cli predict --league E0
```

Repeat per league. `predict` only fills fixtures with `prediction IS NULL`; to
force regeneration after a retrain, clear first:

```powershell
.\.venv\Scripts\python.exe -c "import sqlite3; c = sqlite3.connect('data/futbol.db'); c.execute(\"UPDATE fixtures SET prediction = NULL WHERE league = 'E0' AND status = 'pre'\"); c.commit(); c.close()"
```

## 5. Resolve played predictions (biweekly, feeds calibration)

```powershell
.\.venv\Scripts\python.exe -m app.cli resolve --league E0
```

`resolve` writes `tracked` rows; the Calibration dashboard needs 30+ resolved
predictions before it leaves the cold-start state.

## Quota budget (free tiers, per day)

| Source | Daily use |
|--------|-----------|
| football-data.org (fixtures sync, 5 leagues) | ~8 req (10/min limit, no pool) |
| API-Football | reserved: free plan covers seasons 2022–2024 only, useless for current data until Pro |
| Understat (scraper, no key) | ~15 req + 6s delays; throttles when rushed |

## If scores look wrong after a retrain

1. `SELECT COUNT(*) FROM fixtures WHERE status = 'pre'` — sync may have failed silently (check logs, never silent since PR #23).
2. Duplicate team names (`GROUP BY canonical_name HAVING COUNT(*) > 1`) — promoted teams need map entries (`TEAM_NAMES`) or fuzzy aliases.
3. `data/runs/<league>/`: the loader serves the newest by mtime — test runs no longer pollute it (`persist_run=False` in tests).
