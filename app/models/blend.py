from __future__ import annotations

import numpy as np


def blend_predictions(
    model_a: np.ndarray,
    model_b: np.ndarray,
    weight_a: float,
) -> np.ndarray:
    return weight_a * model_a + (1 - weight_a) * model_b


def find_optimal_blend_weight(
    model_a: np.ndarray,
    model_b: np.ndarray,
    y_true: np.ndarray,
    n_steps: int = 20,
) -> tuple[float, float]:
    best_weight = 0.5
    best_brier = float("inf")

    for i in range(n_steps + 1):
        w = i / n_steps
        blended = blend_predictions(model_a, model_b, w)
        brier = float(np.mean(np.sum((blended - np.eye(3)[y_true]) ** 2, axis=1)))
        if brier < best_brier:
            best_brier = brier
            best_weight = w

    return best_weight, best_brier
