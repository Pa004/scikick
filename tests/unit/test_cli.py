from unittest.mock import patch, MagicMock

from app.cli import cmd_sync, cmd_train


def test_cmd_sync(monkeypatch):
    args = MagicMock()
    args.league = "E0"
    args.seasons = 1
    with patch("app.cli.sync_all_leagues", return_value=[{"league": "E0", "inserted": 100}]):
        cmd_sync(args)


def test_cmd_train(capsys):
    args = MagicMock()
    args.league = "E0"
    args.mode = "complete"
    with patch("app.cli.train_league", return_value={
        "league": "E0", "run_id": "test.json", "n_folds": 5,
        "n_samples": 100, "overall_brier": 0.2, "overall_log_loss": 0.8,
        "calibrated_brier": 0.19, "blend_weight": 0.5,
    }):
        cmd_train(args)
    captured = capsys.readouterr()
    assert "OK" in captured.out
