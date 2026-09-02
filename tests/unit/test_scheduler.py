from unittest.mock import patch, MagicMock

from app.scheduler import sync_job, start_scheduler


def test_sync_job():
    with patch("app.scheduler.sync_all_leagues") as mock_sync:
        sync_job()
        mock_sync.assert_called_once()
