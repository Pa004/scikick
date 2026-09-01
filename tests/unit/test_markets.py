import numpy as np

from app.models.dixon_coles import DixonColesParams, score_matrix
from app.models.markets import (
    derive_1x2, derive_double_chance, derive_over_under,
    derive_btts, derive_exact_score, derive_all_markets,
)


def _get_matrix() -> np.ndarray:
    params = DixonColesParams(0.1, -0.1, 0.05, -0.05, 0.3, -0.1)
    return score_matrix(params, max_goals=10)


def test_1x2_sums_to_one():
    probs = derive_1x2(_get_matrix())
    assert abs(sum(probs.values()) - 1.0) < 0.01


def test_double_chance():
    probs = derive_double_chance(_get_matrix())
    assert probs["home_or_draw"] > 0.5


def test_over_under():
    probs = derive_over_under(_get_matrix(), 2.5)
    assert abs(probs["over"] + probs["under"] - 1.0) < 0.01


def test_btts():
    probs = derive_btts(_get_matrix())
    assert abs(probs["yes"] + probs["no"] - 1.0) < 0.01


def test_exact_score():
    scores = derive_exact_score(_get_matrix())
    assert "0-0" in scores
    assert "1-0" in scores


def test_derive_all_markets():
    all_markets = derive_all_markets(_get_matrix())
    assert "1x2" in all_markets
    assert "btts" in all_markets
    assert "exact_score" in all_markets
    assert len(all_markets) >= 10
