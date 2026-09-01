from __future__ import annotations

import numpy as np
from sklearn.calibration import CalibratedClassifierCV
from sklearn.isotonic import IsotonicRegression


class IsotonicCalibrator:
    def __init__(self, n_classes: int = 3):
        self.n_classes = n_classes
        self.calibrators: list[IsotonicRegression] = [
            IsotonicRegression(out_of_bounds="clip") for _ in range(n_classes)
        ]

    def fit(self, y_prob: np.ndarray, y_true: np.ndarray) -> None:
        for i in range(self.n_classes):
            binary_true = (y_true == i).astype(float)
            self.calibrators[i].fit(y_prob[:, i], binary_true)

    def transform(self, y_prob: np.ndarray) -> np.ndarray:
        calibrated = np.column_stack([
            self.calibrators[i].predict(y_prob[:, i]) for i in range(self.n_classes)
        ])
        row_sums = calibrated.sum(axis=1, keepdims=True)
        row_sums = np.where(row_sums > 0, row_sums, 1)
        return calibrated / row_sums


class PlattCalibrator:
    def __init__(self):
        self.scaler = None
        self.model = None

    def fit(self, y_prob: np.ndarray, y_true: np.ndarray) -> None:
        from sklearn.linear_model import LogisticRegression
        from sklearn.preprocessing import StandardScaler

        self.scaler = StandardScaler()
        X = self.scaler.fit_transform(y_prob)
        self.model = LogisticRegression(C=1.0, random_state=42)
        self.model.fit(X, y_true)

    def transform(self, y_prob: np.ndarray) -> np.ndarray:
        X = self.scaler.transform(y_prob)
        return self.model.predict_proba(X)


def calibrate(
    y_prob: np.ndarray,
    y_true: np.ndarray,
    method: str = "isotonic",
) -> tuple[np.ndarray, object]:
    if method == "isotonic":
        calibrator = IsotonicCalibrator()
    elif method == "platt":
        calibrator = PlattCalibrator()
    else:
        raise ValueError(f"Unknown calibration method: {method}")

    calibrator.fit(y_prob, y_true)
    calibrated = calibrator.transform(y_prob)
    return calibrated, calibrator
