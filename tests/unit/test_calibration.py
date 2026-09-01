import numpy as np

from app.models.calibration import IsotonicCalibrator, PlattCalibrator, calibrate


def _make_data(n: int = 200):
    rng = np.random.RandomState(42)
    y_true = rng.randint(0, 3, n)
    y_prob = np.eye(3)[y_true] * 0.7 + 0.1
    y_prob = y_prob / y_prob.sum(axis=1, keepdims=True)
    return y_prob, y_true


def test_isotonic_calibrator():
    y_prob, y_true = _make_data()
    calibrator = IsotonicCalibrator()
    calibrator.fit(y_prob, y_true)
    calibrated = calibrator.transform(y_prob)
    assert calibrated.shape == y_prob.shape
    assert np.allclose(calibrated.sum(axis=1), 1.0, atol=1e-6)


def test_platt_calibrator():
    y_prob, y_true = _make_data()
    calibrator = PlattCalibrator()
    calibrator.fit(y_prob, y_true)
    calibrated = calibrator.transform(y_prob)
    assert calibrated.shape == y_prob.shape
    assert np.allclose(calibrated.sum(axis=1), 1.0, atol=1e-6)


def test_calibrate_function():
    y_prob, y_true = _make_data()
    calibrated, calibrator = calibrate(y_prob, y_true, "isotonic")
    assert calibrated.shape == y_prob.shape
