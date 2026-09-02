from __future__ import annotations

from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.cron import CronTrigger

from app.config import get_settings
from app.ingestion.sync import sync_all_leagues


def sync_job():
    settings = get_settings()
    leagues = settings.leagues_initial.split(",")
    sync_all_leagues(leagues, 3)


def start_scheduler():
    settings = get_settings()
    scheduler = BlockingScheduler()
    scheduler.add_job(
        sync_job,
        CronTrigger(hour=settings.scheduler_sync_hour),
        id="daily_sync",
        name="Daily fixture sync",
    )
    scheduler.start()
