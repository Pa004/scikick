import numpy as np

from app.models.dixon_coles import DixonColesParams, score_matrix
from app.models.ht_ft import (
    ht_transition_matrix,
    joint_ht_ft_matrix,
    derive_ht_1x2,
    derive_ht_double_chance,
    derive_ht_over_under,
    derive_ft_result_given_ht,
    derive_all_ht_ft_markets,
)


def _get_params() -> DixonColesParams:
    return DixonColesParams(0.1, -0.1, 0.05, -0.05, 0.3, -0.1)


def test_transition_matrix_shape():
    t = ht_transition_matrix(max_goals=5)
    assert t.shape == (36, 36)


def test_transition_matrix_rows_sum():
    t = ht_transition_matrix(max_goals=5)
    for i in range(36):
        row_sum = t[i].sum()
        if row_sum > 0:
            assert abs(row_sum - 1.0) < 0.01, f"Row {i} sums to {row_sum}"


def test_joint_matrix_shape():
    joint = joint_ht_ft_matrix(_get_params(), max_goals=5)
    assert joint.shape == (6, 6, 6, 6)


def test_joint_matrix_sums_to_one():
    joint = joint_ht_ft_matrix(_get_params(), max_goals=5)
    assert abs(joint.sum() - 1.0) < 0.01


def test_ht_1x2_sums_to_one():
    joint = joint_ht_ft_matrix(_get_params(), max_goals=5)
    probs = derive_ht_1x2(joint)
    assert abs(sum(probs.values()) - 1.0) < 0.01


def test_ht_double_chance():
    joint = joint_ht_ft_matrix(_get_params(), max_goals=5)
    probs = derive_ht_double_chance(joint)
    assert probs["home_or_draw"] > 0.5


def test_ht_over_under():
    joint = joint_ht_ft_matrix(_get_params(), max_goals=5)
    probs = derive_ht_over_under(joint, 0.5)
    assert abs(probs["over"] + probs["under"] - 1.0) < 0.01


def test_ft_result_given_ht():
    joint = joint_ht_ft_matrix(_get_params(), max_goals=5)
    results = derive_ft_result_given_ht(joint)
    assert len(results) > 0
    for key, probs in results.items():
        assert abs(sum(probs.values()) - 1.0) < 0.01


def test_derive_all_ht_ft_markets():
    joint = joint_ht_ft_matrix(_get_params(), max_goals=5)
    markets = derive_all_ht_ft_markets(joint)
    assert "ht_1x2" in markets
    assert "ht_double_chance" in markets
    assert "ht_over_under_0.5" in markets
    assert "ft_result_given_ht" in markets
