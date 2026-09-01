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
    df = load_csv(path)
    assert len(df) > 100
    assert all(c in df.columns for c in REQUIRED_COLUMNS)
