from __future__ import annotations

import json
import hashlib
from pathlib import Path
from datetime import datetime, timezone

import lightgbm as lgb
import numpy as np
import pandas as pd

_FEATURE_COLS = [
    "home_elo", "away_elo", "home_elo_margin",
    "home_form_pts_last_5", "away_form_pts_last_5",
    "home_rest_days", "away_rest_days",
    "h2h_home_wins_last_5", "h2h_draws_last_5",
]

_N_SEEDS = 5
_SEEDS = list(range(_N_SEEDS))


class LightGBMEnsemble:
    def __init__(self, n_seeds: int = _N_SEEDS):
        self.n_seeds = n_seeds
        self.models: list[lgb.Booster] = []

    def fit(self, X: np.ndarray, y: np.ndarray) -> None:
        self.models.clear()
        for seed in _SEEDS[: self.n_seeds]:
            params = {
                "objective": "multiclass",
                "num_class": 3,
                "metric": "multi_logloss",
                "num_leaves": 31,
                "learning_rate": 0.05,
                "feature_fraction": 0.8,
                "bagging_fraction": 0.8,
                "bagging_freq": 5,
                "verbose": -1,
                "seed": seed,
            }
            train_data = lgb.Dataset(X, label=y)
            model = lgb.train(params, train_data, num_boost_round=200)
            self.models.append(model)

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        preds = np.array([model.predict(X) for model in self.models])
        return preds.mean(axis=0)

    def predict_with_std(self, X: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
        preds = np.array([model.predict(X) for model in self.models])
        mean = preds.mean(axis=0)
        std = preds.std(axis=0)
        return mean, std


def get_feature_matrix(df: pd.DataFrame) -> tuple[np.ndarray, np.ndarray | None]:
    X = df[_FEATURE_COLS].fillna(0).values
    y = df["target_1x2"].map({"home": 0, "draw": 1, "away": 2}).values if "target_1x2" in df.columns else None
    return X, y


def train_lightgbm(train_df: pd.DataFrame) -> LightGBMEnsemble:
    X, y = get_feature_matrix(train_df)
    model = LightGBMEnsemble()
    model.fit(X, y)
    return model


def predict_lightgbm(model: LightGBMEnsemble, test_df: pd.DataFrame) -> tuple[np.ndarray, np.ndarray]:
    X, _ = get_feature_matrix(test_df)
    return model.predict_with_std(X)
