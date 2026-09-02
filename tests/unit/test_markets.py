import numpy as np

from app.models.dixon_coles import DixonColesParams, score_matrix
from app.models.markets import (
    derive_1x2, derive_double_chance, derive_over_under,
    derive_btts, derive_exact_score, derive_all_markets,
    derive_draw_no_bet, derive_win_to_nil, derive_clean_sheet,
    derive_goal_bands, derive_asian_handicap, derive_handicap,
    derive_odd_even, derive_total_goals, derive_highest_scoring_half,
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


def test_draw_no_bet():
    probs = derive_draw_no_bet(_get_matrix())
    assert abs(probs["home"] + probs["away"] - 1.0) < 0.01


def test_win_to_nil():
    probs = derive_win_to_nil(_get_matrix())
    assert probs["home"] > 0
    assert probs["away"] > 0


def test_clean_sheet():
    probs = derive_clean_sheet(_get_matrix())
    assert abs(probs["home_yes"] + probs["home_no"] - 1.0) < 0.01
    assert abs(probs["away_yes"] + probs["away_no"] - 1.0) < 0.01


def test_goal_bands():
    probs = derive_goal_bands(_get_matrix())
    assert abs(sum(probs.values()) - 1.0) < 0.01
    assert "0" in probs
    assert "5+" in probs


def test_asian_handicap():
    probs = derive_asian_handicap(_get_matrix(), -0.5)
    assert abs(probs["home"] + probs["draw"] + probs["away"] - 1.0) < 0.01


def test_handicap():
    probs = derive_handicap(_get_matrix(), -1)
    assert abs(sum(probs.values()) - 1.0) < 0.01


def test_odd_even():
    probs = derive_odd_even(_get_matrix())
    assert abs(probs["odd"] + probs["even"] - 1.0) < 0.01


def test_total_goals():
    probs = derive_total_goals(_get_matrix())
    assert "0" in probs
    assert "7+" in probs


def test_highest_scoring_half():
    probs = derive_highest_scoring_half(_get_matrix())
    assert abs(sum(probs.values()) - 1.0) < 0.05


def test_derive_all_markets():
    all_markets = derive_all_markets(_get_matrix())
    assert "1x2" in all_markets
    assert "btts" in all_markets
    assert "exact_score" in all_markets
    assert "draw_no_bet" in all_markets
    assert "win_to_nil" in all_markets
    assert "clean_sheet" in all_markets
    assert "goal_bands" in all_markets
    assert "asian_handicap_-0.5" in all_markets
    assert len(all_markets) >= 20
