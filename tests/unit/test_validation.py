import pandas as pd

from app.ingestion.validation import validate_ranges, validate_no_duplicates, validate_all


def test_validate_ranges_ok():
    df = pd.DataFrame({"FTHG": [1, 2, 0], "FTAG": [0, 1, 3]})
    result = validate_ranges(df)
    assert result.rejected_rows == 0
    assert result.errors == []


def test_validate_ranges_out_of_range():
    df = pd.DataFrame({"FTHG": [1, 20, 3]})
    result = validate_ranges(df)
    assert result.rejected_rows == 1
    assert any("FTHG" in e for e in result.errors)


def test_validate_no_duplicates():
    df = pd.DataFrame({
        "match_date": ["2023-08-12", "2023-08-12"],
        "HomeTeam": ["Arsenal", "Arsenal"],
        "AwayTeam": ["Chelsea", "Chelsea"],
    })
    dupes = validate_no_duplicates(df)
    assert len(dupes) == 1
    assert "1 duplicate" in dupes[0]


def test_validate_no_duplicates_clean():
    df = pd.DataFrame({
        "match_date": ["2023-08-12", "2023-08-13"],
        "HomeTeam": ["Arsenal", "Chelsea"],
        "AwayTeam": ["Chelsea", "Arsenal"],
    })
    dupes = validate_no_duplicates(df)
    assert len(dupes) == 0


def test_validate_all_combined():
    df = pd.DataFrame({
        "match_date": ["2023-08-12", "2023-08-12"],
        "HomeTeam": ["Arsenal", "Arsenal"],
        "AwayTeam": ["Chelsea", "Chelsea"],
        "FTHG": [2, 20],
        "FTAG": [1, 1],
    })
    result = validate_all(df)
    assert result.rejected_rows >= 1
    assert len(result.errors) >= 1
