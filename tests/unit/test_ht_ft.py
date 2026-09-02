import numpy as np

from app.models.dixon_coles import DixonColesParams
from app.models.ht_residual import (
    HTParams,
    SecondHalfResiduals,
    joint_ht_ft_matrix,
    derive_ht_1x2,
    derive_ht_double_chance,
    derive_ht_over_under,
    derive_ft_result_given_ht,
    derive_both_halves_markets,
    derive_all_ht_ft_markets,
)


def _get_ht_params() -> HTParams:
    return HTParams(0.1, -0.1, 0.05, -0.05, 0.3, -0.1)


def _get_ft_params() -> DixonColesParams:
    return DixonColesParams(0.1, -0.1, 0.05, -0.05, 0.3, -0.1)


def _get_residuals() -> SecondHalfResiduals:
    return SecondHalfResiduals(1.1, 1.0, 0.9, 200)


def test_joint_matrix_shape():
    joint = joint_ht_ft_matrix(_get_ht_params(), _get_ft_params(), _get_residuals(), max_goals=5)
    assert joint.shape == (6, 6, 6, 6)


def test_joint_matrix_sums_to_one():
    joint = joint_ht_ft_matrix(_get_ht_params(), _get_ft_params(), _get_residuals(), max_goals=5)
    assert abs(joint.sum() - 1.0) < 0.01


def test_ht_1x2_sums_to_one():
    joint = joint_ht_ft_matrix(_get_ht_params(), _get_ft_params(), _get_residuals(), max_goals=5)
    probs = derive_ht_1x2(joint)
    assert abs(sum(probs.values()) - 1.0) < 0.01


def test_ht_double_chance():
    joint = joint_ht_ft_matrix(_get_ht_params(), _get_ft_params(), _get_residuals(), max_goals=5)
    probs = derive_ht_double_chance(joint)
    assert probs["home_or_draw"] > 0.5


def test_ht_over_under():
    joint = joint_ht_ft_matrix(_get_ht_params(), _get_ft_params(), _get_residuals(), max_goals=5)
    probs = derive_ht_over_under(joint, 0.5)
    assert abs(probs["over"] + probs["under"] - 1.0) < 0.01


def test_ft_result_given_ht():
    joint = joint_ht_ft_matrix(_get_ht_params(), _get_ft_params(), _get_residuals(), max_goals=5)
    results = derive_ft_result_given_ht(joint)
    assert len(results) > 0
    for key, probs in results.items():
        assert abs(sum(probs.values()) - 1.0) < 0.01


def test_both_halves_markets():
    joint = joint_ht_ft_matrix(_get_ht_params(), _get_ft_params(), _get_residuals(), max_goals=5)
    bh = derive_both_halves_markets(joint)
    assert "team_wins_both_halves" in bh
    assert "draw_both_halves" in bh
    assert bh["ht_over_0.5_ft_over_0.5"] > 0


def test_derive_all_ht_ft_markets():
    joint = joint_ht_ft_matrix(_get_ht_params(), _get_ft_params(), _get_residuals(), max_goals=5)
    markets = derive_all_ht_ft_markets(joint)
    assert "ht_1x2" in markets
    assert "ht_double_chance" in markets
    assert "ht_over_under_0.5" in markets
    assert "ft_result_given_ht" in markets
    assert "both_halves" in markets


def test_residuals_affect_distribution():
    base = SecondHalfResiduals(1.0, 1.0, 1.0, 200)
    high_winning = SecondHalfResiduals(1.5, 1.0, 0.8, 200)
    joint_base = joint_ht_ft_matrix(_get_ht_params(), _get_ft_params(), base, max_goals=5)
    joint_high = joint_ht_ft_matrix(_get_ht_params(), _get_ft_params(), high_winning, max_goals=5)
    ht_base = derive_ht_1x2(joint_base)
    ht_high = derive_ht_1x2(joint_high)
    assert ht_base != ht_high
