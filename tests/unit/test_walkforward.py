import pandas as pd

from app.models.walkforward import expanding_window, get_matchday_groups


def _make_df(n_matchdays: int = 10, matches_per_day: int = 5) -> pd.DataFrame:
    rows = []
    matchday_dates = [f"2023-08-{1 + i * 7:02d}" for i in range(n_matchdays)]
    for i, date in enumerate(matchday_dates):
        for j in range(matches_per_day):
            rows.append({
                "match_date": date,
                "home_team_id": j + 1,
                "away_team_id": j + 2,
                "target_1x2": ["home", "draw", "away"][j % 3],
            })
    return pd.DataFrame(rows)


def test_get_matchday_groups():
    df = _make_df(3, 2)
    groups = get_matchday_groups(df)
    assert len(groups) == 3


def test_expanding_window_folds():
    df = _make_df(5, 3)
    folds = expanding_window(df, min_train_matches=0)
    assert len(folds) == 4
    assert folds[0].test_matchdays


def test_expanding_window_min_train():
    df = _make_df(3, 2)
    folds = expanding_window(df, min_train_matches=100)
    assert len(folds) == 0
