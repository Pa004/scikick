import logging

from app.api import main as api_main


def test_create_app_has_lifespan():
    app = api_main.create_app()
    assert app.router.lifespan is not None


def test_startup_sync_logs_summary(monkeypatch, caplog):
    results = [
        {"league": "E0", "future_by_source": {"football_data_org": 8, "api_football": 0}},
        {"league": "SP1", "error": "boom"},
    ]
    monkeypatch.setattr(
        api_main, "sync_all_leagues", lambda leagues, n: results
    )
    with caplog.at_level(logging.INFO):
        api_main._startup_sync()
    assert "8 future fixtures" in caplog.text
    assert "1 league errors" in caplog.text


def test_startup_sync_failure_logged(monkeypatch, caplog):
    def boom(leagues, n):
        raise ConnectionError("dns down")

    monkeypatch.setattr(api_main, "sync_all_leagues", boom)
    with caplog.at_level(logging.WARNING):
        api_main._startup_sync()
    assert "Startup sync failed" in caplog.text
