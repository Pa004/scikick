import numpy as np
import pandas as pd

from app.models.lightgbm_model import train_lightgbm, _FEATURE_COLS
from app.models.explain import build_explainer, top_features


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


def test_build_explainer():
    df = _make_train_data(200)
    model = train_lightgbm(df)
    explainer = build_explainer(model.models)
    assert explainer is not None


def test_top_features_returns_n():
    df = _make_train_data(200)
    model = train_lightgbm(df)
    explainer = build_explainer(model.models)
    X = df[_FEATURE_COLS].iloc[:1].values
    result = top_features(explainer, X, _FEATURE_COLS, n=5)
    assert len(result) == 5
    assert all("feature" in f and "shap_importance" in f for f in result)


def test_top_features_sorted_by_importance():
    df = _make_train_data(200)
    model = train_lightgbm(df)
    explainer = build_explainer(model.models)
    X = df[_FEATURE_COLS].iloc[:1].values
    result = top_features(explainer, X, _FEATURE_COLS, n=5)
    importances = [f["shap_importance"] for f in result]
    assert importances == sorted(importances, reverse=True)
