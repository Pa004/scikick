import numpy as np
import pandas as pd

from app.models.lightgbm_model import LightGBMEnsemble, train_lightgbm, predict_lightgbm, _FEATURE_COLS


def _make_train_data(n: int = 200) -> pd.DataFrame:
    rng = np.random.RandomState(42)
    return pd.DataFrame({
        "home_elo": rng.uniform(1300, 1700, n),
        "away_elo": rng.uniform(1300, 1700, n),
        "home_elo_margin": rng.uniform(-200, 200, n),
        "home_form_pts_last_5": rng.uniform(0, 1, n),
        "away_form_pts_last_5": rng.uniform(0, 1, n),
        "home_rest_days": rng.uniform(3, 14, n),
        "away_rest_days": rng.uniform(3, 14, n),
        "h2h_home_wins_last_5": rng.uniform(0, 1, n),
        "h2h_draws_last_5": rng.uniform(0, 0.5, n),
        "target_1x2": rng.choice(["home", "draw", "away"], n),
    })


def test_lightgbm_ensemble_train():
    df = _make_train_data(200)
    model = train_lightgbm(df)
    assert len(model.models) == 5


def test_lightgbm_ensemble_predict():
    df = _make_train_data(200)
    model = train_lightgbm(df)
    proba, std = predict_lightgbm(model, df)
    assert proba.shape == (200, 3)
    assert std.shape == (200, 3)
    assert np.allclose(proba.sum(axis=1), 1.0, atol=1e-6)


def test_lightgbm_ensemble_std():
    df = _make_train_data(200)
    model = train_lightgbm(df)
    proba, std = predict_lightgbm(model, df)
    assert np.all(std >= 0)
