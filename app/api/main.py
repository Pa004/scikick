from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.api.routers import predict, fixtures, stats, refresh, market_counts


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="SciKick",
        description="Football probability estimation engine",
        version="0.1.0",
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
    app.include_router(fixtures.router, prefix="/api", tags=["fixtures"])
    app.include_router(stats.router, prefix="/api", tags=["stats"])
    app.include_router(refresh.router, prefix="/api", tags=["refresh"])

    @app.get("/health")
    def health():
        return {"status": "ok", "version": "0.1.0"}

    return app


app = create_app()
