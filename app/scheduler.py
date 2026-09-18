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


def odds_review_job():
    import logging

    from app.models.odds_review import review_stored_odds

    logger = logging.getLogger(__name__)
    conn = get_connection()
    try:
        flagged = review_stored_odds(conn)
        if flagged:
            worst = flagged[0]
            logger.warning(
                "Odds review: %d atypical (fixture, side) pairs; worst #%s %s edge=+%.1f%%",
                len(flagged), worst["fixture_id"], worst["match"], worst["edge"] * 100,
            )
        else:
            logger.info("Odds review: no atypical stored odds")
        return flagged
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
    scheduler.add_job(
        odds_review_job,
        CronTrigger(day_of_week="mon", hour=7, minute=0),
        id="odds_review",
        name="Weekly review of atypical stored odds",
    )
    scheduler.start()
