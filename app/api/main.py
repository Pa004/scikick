from __future__ import annotations

import logging
import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.api.routers import predict, fixtures, stats, refresh, market_counts, markets_htft, rare_events, scorer, value, context, resolve
from app.ingestion.sync import sync_all_leagues

logger = logging.getLogger(__name__)


def _startup_sync() -> None:
    try:
        settings = get_settings()
        leagues = settings.leagues_initial.split(",")
        results = sync_all_leagues(leagues, 3)
        future_total = sum(
            sum(r.get("future_by_source", {}).values())
            for r in results if "error" not in r
        )
        errors = sum(1 for r in results if "error" in r)
        logger.info(
            "Startup sync done: %d future fixtures, %d league errors",
            future_total, errors,
        )
        _startup_odds(leagues)
    except Exception as exc:
        logger.warning("Startup sync failed: %s", exc)


def _startup_odds(leagues: list[str]) -> None:
    from app.db.connection import get_connection
    from app.ingestion.odds_sync import sync_odds_for_league

    conn = get_connection()
    try:
        for league in leagues:
            result = sync_odds_for_league(conn, league)
            logger.info(
                "Odds sync %s: %d/%d matched",
                league, result["matched"], result["events"],
            )
    except Exception as exc:
        logger.warning("Startup odds sync failed: %s", exc)
    finally:
        conn.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    thread = threading.Thread(target=_startup_sync, daemon=True, name="startup-sync")
    thread.start()
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="SciKick",
        description="Football probability estimation engine",
        version="0.1.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(predict.router, prefix="/api", tags=["predict"])
    app.include_router(market_counts.router, prefix="/api", tags=["predict"])
    app.include_router(markets_htft.router, prefix="/api", tags=["predict"])
    app.include_router(fixtures.router, prefix="/api", tags=["fixtures"])
    app.include_router(stats.router, prefix="/api", tags=["stats"])
    app.include_router(refresh.router, prefix="/api", tags=["refresh"])
    app.include_router(rare_events.router, prefix="/api", tags=["predict"])
    app.include_router(scorer.router, prefix="/api", tags=["predict"])
    app.include_router(value.router, prefix="/api", tags=["value"])
    app.include_router(context.router, prefix="/api", tags=["context"])
    app.include_router(resolve.router, prefix="/api", tags=["resolve"])

    @app.get("/health")
    def health():
        return {"status": "ok", "version": "0.1.0"}

    return app


app = create_app()
