from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.metrics import brier_score_loss, log_loss, accuracy_score


def brier_score(y_true: np.ndarray, y_prob: np.ndarray) -> float:
    return float(np.mean(np.sum((y_prob - np.eye(3)[y_true]) ** 2, axis=1)))


def log_loss_score(y_true: np.ndarray, y_prob: np.ndarray) -> float:
    return float(log_loss(y_true, y_prob))


def accuracy(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    return float(accuracy_score(y_true, y_pred))


def calibration_error(y_true: np.ndarray, y_prob: np.ndarray, n_bins: int = 10) -> float:
    bin_edges = np.linspace(0, 1, n_bins + 1)
    ece = 0.0
    for i in range(n_bins):
        mask = (y_prob.max(axis=1) >= bin_edges[i]) & (y_prob.max(axis=1) < bin_edges[i + 1])
        if mask.sum() > 0:
            bin_acc = (y_true[mask] == np.argmax(y_prob[mask], axis=1)).mean()
            bin_conf = y_prob[mask].max(axis=1).mean()
            ece += mask.sum() / len(y_true) * abs(bin_acc - bin_conf)
    return float(ece)


def market_implied(
    odds_home: np.ndarray, odds_draw: np.ndarray, odds_away: np.ndarray
) -> np.ndarray:
    overround = 1 / odds_home + 1 / odds_draw + 1 / odds_away
    p_home = (1 / odds_home) / overround
    p_draw = (1 / odds_draw) / overround
    p_away = (1 / odds_away) / overround
    return np.column_stack([p_home, p_draw, p_away])


def evaluate_model(
    y_true: np.ndarray,
    y_prob: np.ndarray,
    model_name: str = "model",
) -> dict:
    y_pred = np.argmax(y_prob, axis=1)
    return {
        "model": model_name,
        "brier": brier_score(y_true, y_prob),
        "log_loss": log_loss_score(y_true, y_prob),
        "accuracy": accuracy(y_true, y_pred),
        "calibration_error": calibration_error(y_true, y_prob),
        "n_samples": len(y_true),
    }


def evaluate_vs_market(
    y_true: np.ndarray,
    model_prob: np.ndarray,
    market_prob: np.ndarray,
) -> dict:
    model_metrics = evaluate_model(y_true, model_prob, "model")
    market_metrics = evaluate_model(y_true, market_prob, "market")
    return {
        "model": model_metrics,
        "market": market_metrics,
        "brier_diff": market_metrics["brier"] - model_metrics["brier"],
        "log_loss_diff": market_metrics["log_loss"] - model_metrics["log_loss"],
    }
