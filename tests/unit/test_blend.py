import numpy as np

from app.models.blend import blend_predictions, find_optimal_blend_weight


def test_blend_predictions():
    a = np.array([[0.6, 0.2, 0.2]])
    b = np.array([[0.2, 0.2, 0.6]])
    result = blend_predictions(a, b, 0.5)
    assert np.allclose(result, [[0.4, 0.2, 0.4]])


def test_find_optimal_blend_weight():
    rng = np.random.RandomState(42)
    n = 100
    y_true = rng.randint(0, 3, n)
    model_a = np.eye(3)[y_true] * 0.8 + 0.2 / 3
    model_b = np.eye(3)[y_true] * 0.6 + 0.4 / 3
    weight, brier = find_optimal_blend_weight(model_a, model_b, y_true)
    assert 0 <= weight <= 1
    assert brier > 0
