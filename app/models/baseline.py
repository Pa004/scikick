from __future__ import annotations

import sqlite3

import numpy as np
import pandas as pd
from sklearn.calibration import CalibratedClassifierCV
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler

_FEATURE_COLS = [
    "home_elo", "away_elo", "home_elo_margin",
    "home_form_pts_last_5", "away_form_pts_last_5",
    "home_rest_days", "away_rest_days",
    "h2h_home_wins_last_5", "h2h_draws_last_5",
]


def get_feature_matrix(df: pd.DataFrame) -> tuple[np.ndarray, np.ndarray | None]:
    X = df[_FEATURE_COLS].fillna(0).values
    y = df["target_1x2"].map({"home": 0, "draw": 1, "away": 2}).values if "target_1x2" in df.columns else None
    return X, y


class BaselineLogistic:
    def __init__(self):
        self.scaler = StandardScaler()
        self.model = LogisticRegression(
            max_iter=1000, C=1.0, random_state=42
        )
        self.calibrated: CalibratedClassifierCV | None = None

    def fit(self, X: np.ndarray, y: np.ndarray, calibrate: bool = True) -> None:
        X_scaled = self.scaler.fit_transform(X)
        self.model.fit(X_scaled, y)

        if calibrate and len(y) >= 100:
            self.calibrated = CalibratedClassifierCV(
                self.model, cv=3, method="isotonic"
            )
            self.calibrated.fit(X_scaled, y)
        else:
            self.calibrated = None

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        X_scaled = self.scaler.transform(X)
        if self.calibrated:
            return self.calibrated.predict_proba(X_scaled)
        return self.model.predict_proba(X_scaled)

    def predict(self, X: np.ndarray) -> np.ndarray:
        proba = self.predict_proba(X)
        return np.argmax(proba, axis=1)


def train_baseline(
    train_df: pd.DataFrame,
    calibrate: bool = True,
) -> BaselineLogistic:
    X, y = get_feature_matrix(train_df)
    model = BaselineLogistic()
    model.fit(X, y, calibrate=calibrate)
    return model


def predict_baseline(
    model: BaselineLogistic,
    test_df: pd.DataFrame,
) -> np.ndarray:
    X, _ = get_feature_matrix(test_df)
    return model.predict_proba(X)
