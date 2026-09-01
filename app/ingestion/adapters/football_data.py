from __future__ import annotations

from pathlib import Path

import pandas as pd

_BASE_URL = "https://www.football-data.co.uk/mmz4281"

REQUIRED_COLUMNS = [
    "Div", "Date", "HomeTeam", "AwayTeam", "FTHG", "FTAG", "FTR",
]

OPTIONAL_COLUMNS = [
    "HTHG", "HTAG", "HTR",
    "HS", "AS", "HST", "AST",
    "HC", "AC", "HF", "AF",
    "HY", "AY", "HR", "AR",
    "Referee",
    "B365H", "B365D", "B365A",
    "BWH", "BWD", "BWA",
    "IWH", "IWD", "IWA",
    "PSH", "PSD", "PSA",
    "WHH", "WHD", "WHA",
    "VCH", "VCD", "VCA",
    "MaxH", "MaxD", "MaxA",
    "AvgH", "AvgD", "AvgA",
]


def build_url(league_code: str, season: str) -> str:
    return f"{_BASE_URL}/{season}/{league_code}.csv"


def season_code(start_year: int) -> str:
    return f"{start_year % 100:02d}{(start_year + 1) % 100:02d}"


def download_csv(league_code: str, start_year: int, dest_dir: str | Path) -> Path:
    sc = season_code(start_year)
    url = build_url(league_code, sc)
    dest = Path(dest_dir) / f"{league_code}_{sc}.csv"
    dest.parent.mkdir(parents=True, exist_ok=True)

    df = pd.read_csv(url, encoding="utf-8", encoding_errors="replace")
    df.to_csv(dest, index=False)
    return dest


def load_csv(path: str | Path) -> pd.DataFrame:
    df = pd.read_csv(path, encoding="utf-8", encoding_errors="replace")
    missing = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing:
        raise ValueError(f"Missing required columns: {missing}")
    return df


def parse_dates_utc(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    if "Date" in df.columns:
        df["match_date"] = pd.to_datetime(
            df["Date"], dayfirst=True, errors="coerce"
        ).dt.strftime("%Y-%m-%d")
    return df


def map_results(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    result_map = {"H": "home", "D": "draw", "A": "away"}
    df["ftr"] = df["FTR"].map(result_map)
    return df
