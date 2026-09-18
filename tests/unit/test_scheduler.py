from unittest.mock import patch, MagicMock

from app.scheduler import odds_review_job, sync_job, start_scheduler


def test_sync_job():
    with patch("app.scheduler.sync_all_leagues") as mock_sync:
        sync_job()
        mock_sync.assert_called_once()


def test_odds_review_job_reports_flagged():
    flagged = [{
        "fixture_id": 1, "league": "E0", "match": "A vs B",
        "bookmaker": "best-eu", "side": "away", "prob": 0.22,
        "odds": 19.5, "edge": 3.29,
    }]
    with patch("app.scheduler.get_connection"), patch(
        "app.models.odds_review.review_stored_odds", return_value=flagged
    ) as mock_review:
        assert odds_review_job() == flagged
        mock_review.assert_called_once()


def test_start_scheduler_registers_weekly_odds_review():
    captured = {}

    class FakeScheduler:
        def add_job(self, fn, trigger, id, name):
            captured[id] = (fn, trigger, name)

        def start(self):
            pass

    with patch("app.scheduler.BlockingScheduler", return_value=FakeScheduler()):
        start_scheduler()
    assert set(captured) == {"daily_sync", "lineups_fetch", "odds_review"}
    assert "day_of_week='mon'" in str(captured["odds_review"][1])
