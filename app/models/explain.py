from __future__ import annotations

from typing import TYPE_CHECKING

import numpy as np

if TYPE_CHECKING:
    import lightgbm as lgb


def build_explainer(models: list[lgb.Booster]):
    import shap

    return shap.TreeExplainer(models[0])


def top_features(
    explainer,
    X_row: np.ndarray,
    feature_names: list[str],
    n: int = 5,
) -> list[dict]:
    shap_values = explainer.shap_values(X_row)

    if isinstance(shap_values, list):
        mean_abs = np.mean([np.abs(sv) for sv in shap_values], axis=0)
    else:
        sv = np.asarray(shap_values, dtype=float)
        if sv.ndim == 3:
            mean_abs = np.mean(np.abs(sv), axis=2).squeeze(axis=0)
        elif sv.ndim == 2:
            mean_abs = np.abs(sv).squeeze(axis=0)
        else:
            mean_abs = np.abs(sv).flatten()

    mean_abs = np.asarray(mean_abs, dtype=float).flatten()
    n_features = len(feature_names)
    mean_abs = mean_abs[:n_features]

    idx = np.argsort(mean_abs)[::-1][:n]

    results = []
    for i in idx:
        results.append({
            "feature": feature_names[int(i)],
            "value": float(X_row.flatten()[int(i)]),
            "shap_importance": float(mean_abs[int(i)]),
        })
    return results
