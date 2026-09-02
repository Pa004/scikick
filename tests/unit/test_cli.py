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
    cmd_train(args)
    captured = capsys.readouterr()
    assert "Training" in captured.out
