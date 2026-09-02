from __future__ import annotations

import sqlite3

import numpy as np
import pandas as pd

from app.models.dixon_coles import DixonColesParams
from app.models.ht_residual import (
    HTParams,
    SecondHalfResiduals,
    fit_ht_dixon_coles,
    estimate_second_half_residuals,
    joint_ht_ft_matrix as _joint_ht_ft_matrix_residual,
    derive_all_ht_ft_markets as _derive_all_ht_ft_markets_residual,
)


def fit_ht_models(
    features_df: pd.DataFrame,
    team_map: dict[int, int],
    n_teams: int,
) -> tuple[HTParams, SecondHalfResiduals]:
    valid = features_df.dropna(subset=["target_home_ht_goals", "target_away_ht_goals"])
    if len(valid) < 20:
        default_ht = HTParams(0.1, -0.1, 0.1, -0.1, 0.15, -0.05)
        default_res = SecondHalfResiduals(1.0, 1.0, 1.0, 0)
        return default_ht, default_res

    ht_params = fit_ht_dixon_coles(
        home_team_ids=valid["home_team_id"].values,
        away_team_ids=valid["away_team_id"].values,
        home_ht_goals=valid["target_home_ht_goals"].values.astype(float),
        away_ht_goals=valid["target_away_ht_goals"].values.astype(float),
        n_teams=n_teams,
        team_id_to_idx=team_map,
    )

    residuals = estimate_second_half_residuals(
        home_team_ids=valid["home_team_id"].values,
        away_team_ids=valid["away_team_id"].values,
        home_ht_goals=valid["target_home_ht_goals"].values.astype(float),
        away_ht_goals=valid["target_away_ht_goals"].values.astype(float),
        home_ft_goals=valid["target_home_goals"].values.astype(float),
        away_ft_goals=valid["target_away_goals"].values.astype(float),
        home_elo=valid["home_elo"].values.astype(float),
        away_elo=valid["away_elo"].values.astype(float),
    )

    return ht_params, residuals


def joint_ht_ft_matrix(
    ht_params: HTParams,
    ft_params: DixonColesParams,
    residuals: SecondHalfResiduals,
    max_goals: int = 8,
) -> np.ndarray:
    return _joint_ht_ft_matrix_residual(ht_params, ft_params, residuals, max_goals)


def derive_all_ht_ft_markets(joint: np.ndarray) -> dict:
    return _derive_all_ht_ft_markets_residual(joint)
