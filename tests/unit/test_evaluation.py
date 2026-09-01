import numpy as np

from app.models.evaluation import (
    brier_score, log_loss_score, accuracy,
    calibration_error, market_implied, evaluate_model,
)


def test_brier_score_perfect():
    y_true = np.array([0, 1, 2, 0, 1])
    y_prob = np.eye(3)[y_true]
    assert brier_score(y_true, y_prob) == 0.0


def test_brier_score_worst():
    y_true = np.array([0, 0, 0])
    y_prob = np.array([[0, 0, 1], [0, 0, 1], [0, 0, 1]])
    assert brier_score(y_true, y_prob) > 0.5


def test_log_loss_score():
    y_true = np.array([0, 1, 2])
    y_prob = np.eye(3)
    assert log_loss_score(y_true, y_prob) < 0.01


def test_accuracy():
    y_true = np.array([0, 1, 2, 0])
    y_pred = np.array([0, 1, 2, 1])
    assert accuracy(y_true, y_pred) == 0.75


def test_market_implied():
    odds_h = np.array([2.0])
    odds_d = np.array([3.0])
    odds_a = np.array([4.0])
    probs = market_implied(odds_h, odds_d, odds_a)
    assert probs.shape == (1, 3)
    assert np.isclose(probs.sum(), 1.0, atol=1e-6)


def test_evaluate_model():
    y_true = np.array([0, 1, 2, 0, 1, 2])
    y_prob = np.eye(3)[y_true]
    result = evaluate_model(y_true, y_prob, "test")
    assert result["model"] == "test"
    assert result["brier"] == 0.0
    assert result["accuracy"] == 1.0
