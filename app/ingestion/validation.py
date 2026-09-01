from __future__ import annotations

from dataclasses import dataclass

import pandas as pd

RANGE_RULES: dict[str, tuple[int, int]] = {
    "FTHG": (0, 15),
    "FTAG": (0, 15),
    "HTHG": (0, 10),
    "HTAG": (0, 10),
    "HS": (0, 50),
    "AS": (0, 50),
    "HST": (0, 30),
    "AST": (0, 30),
    "HC": (0, 25),
    "AC": (0, 25),
    "HF": (0, 35),
    "AF": (0, 35),
    "HY": (0, 11),
    "AY": (0, 11),
    "HR": (0, 5),
    "AR": (0, 5),
}


@dataclass
class ValidationResult:
    valid_rows: int
    rejected_rows: int
    errors: list[str]


def validate_ranges(df: pd.DataFrame) -> ValidationResult:
    errors: list[str] = []
    valid_mask = pd.Series(True, index=df.index)

    for col, (lo, hi) in RANGE_RULES.items():
        if col not in df.columns:
            continue
        series = pd.to_numeric(df[col], errors="coerce")
        out_of_range = (series < lo) | (series > hi)
        bad = out_of_range.sum()
        if bad > 0:
            errors.append(f"{col}: {bad} values outside [{lo}, {hi}]")
            valid_mask &= ~out_of_range

    total = len(df)
    rejected = (~valid_mask).sum()
    return ValidationResult(
        valid_rows=int(valid_mask.sum()),
        rejected_rows=int(rejected),
        errors=errors,
    )


def validate_required_present(df: pd.DataFrame, required: list[str]) -> list[str]:
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise ValueError(f"Missing required columns: {missing}")
    return missing


def validate_no_duplicates(df: pd.DataFrame) -> list[str]:
    if "HomeTeam" in df.columns and "AwayTeam" in df.columns and "match_date" in df.columns:
        dupes = df.duplicated(subset=["match_date", "HomeTeam", "AwayTeam"], keep="first")
        n_dupes = dupes.sum()
        if n_dupes > 0:
            return [f"{n_dupes} duplicate fixtures detected (same date + teams)"]
    return []


def validate_all(df: pd.DataFrame) -> ValidationResult:
    range_result = validate_ranges(df)
    dupes = validate_no_duplicates(df)
    range_result.errors.extend(dupes)
    return range_result
