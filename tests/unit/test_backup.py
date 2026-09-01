import json
from pathlib import Path
from unittest.mock import patch, MagicMock

import pytest

from app.db.backup import backup_database, export_tracked_json
from app.db.connection import get_connection
from app.db.migrations import run_migrations


@pytest.fixture
def real_db(tmp_path: Path) -> str:
    db_path = str(tmp_path / "real.db")
    run_migrations(db_path)
    conn = get_connection(db_path)
    conn.execute(
        "INSERT INTO leagues (id, name, country, tier, source_csv_code, "
        "has_odds, has_xg, season_start_month, min_seasons) "
        "VALUES ('E0', 'Premier League', 'England', 1, 'E0', 1, 0, 8, 2)"
    )
    conn.commit()
    conn.close()
    return db_path


def _mock_settings(env: str, database_url: str) -> MagicMock:
    s = MagicMock()
    s.env = env
    s.database_url = database_url
    s.database_path = database_url
    return s


def test_backup_database_raises_in_test_env() -> None:
    with pytest.raises(RuntimeError, match="test environment"):
        backup_database()


def test_export_tracked_json_raises_in_test_env() -> None:
    with pytest.raises(RuntimeError, match="test environment"):
        export_tracked_json()


def test_backup_database_success(tmp_path: Path, real_db: str) -> None:
    with patch("app.db.backup.get_settings", return_value=_mock_settings("production", real_db)):
        backup_path = backup_database(str(tmp_path / "backups"))
        assert Path(backup_path).exists()
        assert Path(backup_path).suffix == ".db"

        conn = get_connection(backup_path)
        try:
            count = conn.execute("SELECT COUNT(*) FROM leagues").fetchone()[0]
            assert count == 1
        finally:
            conn.close()


def test_export_tracked_json_success(tmp_path: Path, real_db: str) -> None:
    with patch("app.db.backup.get_settings", return_value=_mock_settings("production", real_db)):
        export_path = export_tracked_json(str(tmp_path / "backups"))
        assert Path(export_path).exists()
        assert Path(export_path).suffix == ".json"

        data = json.loads(Path(export_path).read_text(encoding="utf-8"))
        assert isinstance(data, list)
