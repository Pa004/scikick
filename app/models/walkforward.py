from __future__ import annotations

import sqlite3
from dataclasses import dataclass

import pandas as pd


@dataclass
class Fold:
    train_idx: pd.Index
    test_idx: pd.Index
    test_matchdays: list[str]


def get_matchday_groups(df: pd.DataFrame) -> list[tuple[str, pd.Index]]:
    groups = []
    for matchday, group in df.groupby("match_date"):
        groups.append((str(matchday), group.index))
    return groups


def expanding_window(
    df: pd.DataFrame,
    min_train_matches: int = 380,
    gap: int = 0,
) -> list[Fold]:
    matchdays = get_matchday_groups(df)
    if len(matchdays) < 2:
        return []

    folds = []
    for i in range(1, len(matchdays)):
        train_indices = []
        for j in range(i):
            train_indices.extend(matchdays[j][1])
        train_idx = pd.Index(train_indices)

        test_idx = matchdays[i][1]

        if len(train_idx) >= min_train_matches:
            folds.append(Fold(
                train_idx=train_idx,
                test_idx=test_idx,
                test_matchdays=[matchdays[i][0]],
            ))

    return folds
