from pathlib import Path

import pandas as pd
import pytest

from app.ingestion.adapters.football_data import (
    build_url,
    season_code,
    load_csv,
    parse_dates_utc,
    map_results,
    REQUIRED_COLUMNS,
)


def test_build_url():
    url = build_url("E0", 2023)
    assert url == "https://www.football-data.co.uk/mmz4281/2023/E0.csv"


def test_season_code():
    assert season_code(2023) == "2324"
    assert season_code(2024) == "2425"
    assert season_code(2025) == "2526"


def test_load_csv_valid(tmp_path: Path):
    csv = tmp_path / "test.csv"
    csv.write_text("Div,Date,HomeTeam,AwayTeam,FTHG,FTAG,FTR\nE0,12/08/2023,Arsenal,Chelsea,2,1,H\n")
    df = load_csv(csv)
    assert len(df) == 1
    assert df.iloc[0]["HomeTeam"] == "Arsenal"


def test_load_csv_missing_columns(tmp_path: Path):
    csv = tmp_path / "test.csv"
    csv.write_text("Div,Date\nE0,12/08/2023\n")
    with pytest.raises(ValueError, match="Missing required columns"):
        load_csv(csv)


def test_parse_dates_utc():
    df = pd.DataFrame({"Date": ["12/08/2023", "25/12/2023"]})
    result = parse_dates_utc(df)
    assert result.iloc[0]["match_date"] == "2023-08-12"
    assert result.iloc[1]["match_date"] == "2023-12-25"


def test_map_results():
    df = pd.DataFrame({"FTR": ["H", "D", "A"]})
    result = map_results(df)
    assert list(result["ftr"]) == ["home", "draw", "away"]


@pytest.mark.slow
def test_download_csv_real(tmp_path: Path):
    """Integration test — requires network. Mark slow."""
    from app.ingestion.adapters.football_data import download_csv
    path = download_csv("E0", 2023, tmp_path)
    assert path.exists()


def test_download_csv_uses_cache(tmp_path: Path):
    from unittest.mock import patch

    from app.ingestion.adapters import football_data

    dest = tmp_path / "E0_2324.csv"
    dest.write_text("x" * 200)
    with patch("subprocess.run") as mock_run:
        path = football_data.download_csv("E0", 2023, tmp_path)
    assert path == dest
    mock_run.assert_not_called()


def test_download_csv_force_redownloads(tmp_path: Path):
    import subprocess
    from unittest.mock import patch

    from app.ingestion.adapters import football_data

    dest = tmp_path / "E0_2324.csv"
    dest.write_text("x" * 200)

    def fake_run(*args, **kwargs):
        dest.write_text("Div,Date,HomeTeam\n" + "y" * 200)
        return subprocess.CompletedProcess(args, 0)

    with patch("subprocess.run", side_effect=fake_run) as mock_run:
        path = football_data.download_csv("E0", 2023, tmp_path, force=True)
    assert path == dest
    assert mock_run.call_count == 1


def test_download_csv_rejects_non_csv(tmp_path: Path):
    import subprocess
    from unittest.mock import patch

    from app.ingestion.adapters import football_data

    def fake_run(*args, **kwargs):
        dest = tmp_path / "E0_2627.csv"
        dest.write_bytes(b"<html>Access denied</html>" + b"x" * 200)
        return subprocess.CompletedProcess(args, 0)

    with patch("subprocess.run", side_effect=fake_run):
        with pytest.raises(ConnectionError, match="Not a CSV"):
            football_data.download_csv("E0", 2026, tmp_path, force=True)
    assert not (tmp_path / "E0_2627.csv").exists()


def test_sync_all_leagues_includes_current_season(monkeypatch):
    from app.ingestion import sync as sync_module

    seen = []

    def fake_sync_league(code, year, raw_dir, db_path=None):
        seen.append((code, year))
        return {"league": code, "season": year}

    monkeypatch.setattr(sync_module, "sync_league", fake_sync_league)
    monkeypatch.setattr(sync_module, "current_season_start", lambda: 2026)
    sync_module.sync_all_leagues(["E0"], 1)
    years = [year for _, year in seen]
    assert 2026 in years
