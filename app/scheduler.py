from __future__ import annotations

from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.cron import CronTrigger

from app.config import get_settings
from app.db.connection import get_connection
from app.ingestion.sync import sync_all_leagues


def sync_job():
    settings = get_settings()
    leagues = settings.leagues_initial.split(",")
    sync_all_leagues(leagues, 3)


def lineups_job():
    settings = get_settings()
    from app.players.lineups import ingest_lineups_for_upcoming

    conn = get_connection()
    try:
        leagues = settings.leagues_initial.split(",")
        for league in leagues:
            ingest_lineups_for_upcoming(conn, league)
    finally:
        conn.close()


def start_scheduler():
    settings = get_settings()
    scheduler = BlockingScheduler()
    scheduler.add_job(
        sync_job,
        CronTrigger(hour=settings.scheduler_sync_hour),
        id="daily_sync",
        name="Daily fixture sync",
    )
    scheduler.add_job(
        lineups_job,
        CronTrigger(
            hour=settings.scheduler_lineups_hour,
            minute=settings.scheduler_lineups_minute,
        ),
        id="lineups_fetch",
        name="Fetch lineups for upcoming fixtures",
    )
    scheduler.start()
