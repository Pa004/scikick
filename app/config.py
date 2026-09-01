from __future__ import annotations

import secrets
from pathlib import Path
from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_path: str = "data/futbol.db"
    service_token: str = ""
    api_football_key: str = ""
    xg_enabled: bool = True
    leagues_initial: str = "E0"
    scheduler_sync_hour: int = 6
    scheduler_retrain_day: str = "sunday"
    env: str = "production"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    @property
    def database_url(self) -> str:
        path = Path(self.database_path)
        if self.env == "test":
            return ":memory:"
        path.parent.mkdir(parents=True, exist_ok=True)
        return str(path.resolve())

    def ensure_service_token(self) -> None:
        if self.env == "test":
            return
        if not self.service_token:
            self.service_token = secrets.token_urlsafe(32)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
