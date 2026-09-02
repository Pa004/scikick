from __future__ import annotations

import math

import numpy as np
import pytest

from app.models.ht_residual import (
    HTParams,
    SecondHalfResiduals,
    fit_ht_dixon_coles,
    estimate_second_half_residuals,
    joint_ht_ft_matrix,
    derive_ht_1x2,
    derive_ht_double_chance,
    derive_ht_over_under,
    derive_ft_result_given_ht,
    derive_both_halves_markets,
    derive_all_ht_ft_markets,
    _poisson_pmf,
    _tau,
    _get_residual_multiplier,
)
from app.models.dixon_coles import DixonColesParams


def test_poisson_pmf():
    assert _poisson_pmf(0, 1.0) == pytest.approx(math.exp(-1), rel=1e-6)
    assert _poisson_pmf(1, 1.0) == pytest.approx(math.exp(-1), rel=1e-6)
    assert _poisson_pmf(2, 2.0) == pytest.approx(2 * math.exp(-2), rel=1e-6)


def test_tau_zero_zero():
    assert _tau(0, 0, 1.0, 1.0, -0.1) == pytest.approx(1 - 1.0 * 1.0 * (-0.1), rel=1e-6)


def test_tau_one_one():
    assert _tau(1, 1, 1.0, 1.0, -0.1) == pytest.approx(1.0 * 1.0 * (1 - (-0.1)), rel=1e-6)


def test_fit_ht_dixon_coles_minimal():
    rng = np.random.default_rng(42)
    n = 100
    home_ids = rng.integers(1, 5, n)
    away_ids = rng.integers(1, 5, n)
    home_ht = rng.poisson(1.2, n).astype(float)
    away_ht = rng.poisson(0.9, n).astype(float)

    params = fit_ht_dixon_coles(home_ids, away_ids, home_ht, away_ht, 4, {1: 0, 2: 1, 3: 2, 4: 3})
    assert params.home_advantage != 0
    assert params.rho != 0


def test_estimate_second_half_residuals():
    rng = np.random.default_rng(42)
    n = 200
    home_ids = rng.integers(1, 5, n)
    away_ids = rng.integers(1, 5, n)
    ht_h = rng.poisson(1, n).astype(float)
    ht_a = rng.poisson(1, n).astype(float)
    ft_h = ht_h + rng.poisson(0.5, n).astype(float)
    ft_a = ht_a + rng.poisson(0.5, n).astype(float)
    elo_h = np.full(n, 1500.0)
    elo_a = np.full(n, 1500.0)

    res = estimate_second_half_residuals(home_ids, away_ids, ht_h, ht_a, ft_h, ft_a, elo_h, elo_a)
    assert res.winning_multiplier > 0
    assert res.drawing_multiplier > 0
    assert res.losing_multiplier > 0
    assert res.n_samples == n


def test_residual_multiplier_winning():
    res = SecondHalfResiduals(winning_multiplier=1.2, drawing_multiplier=1.0, losing_multiplier=0.8, n_samples=100)
    assert _get_residual_multiplier(res, 2, 1) == 1.2
    assert _get_residual_multiplier(res, 1, 1) == 1.0
    assert _get_residual_multiplier(res, 1, 2) == 0.8


def test_joint_ht_ft_matrix():
    ht_params = HTParams(0.1, -0.1, 0.1, -0.1, 0.15, -0.05)
    ft_params = DixonColesParams(0.1, -0.1, 0.1, -0.1, 0.15, -0.05)
    residuals = SecondHalfResiduals(1.0, 1.0, 1.0, 100)

    joint = joint_ht_ft_matrix(ht_params, ft_params, residuals, max_goals=5)
    assert joint.shape == (6, 6, 6, 6)
    assert joint.sum() == pytest.approx(1.0, abs=0.01)


def test_derive_ht_1x2():
    ht_params = HTParams(0.1, -0.1, 0.1, -0.1, 0.15, -0.05)
    ft_params = DixonColesParams(0.1, -0.1, 0.1, -0.1, 0.15, -0.05)
    res = SecondHalfResiduals(1.0, 1.0, 1.0, 100)
    joint = joint_ht_ft_matrix(ht_params, ft_params, res, max_goals=5)
    result = derive_ht_1x2(joint)
    assert abs(result["home"] + result["draw"] + result["away"] - 1.0) < 0.01


def test_derive_ht_over_under():
    ht_params = HTParams(0.1, -0.1, 0.1, -0.1, 0.15, -0.05)
    ft_params = DixonColesParams(0.1, -0.1, 0.1, -0.1, 0.15, -0.05)
    res = SecondHalfResiduals(1.0, 1.0, 1.0, 100)
    joint = joint_ht_ft_matrix(ht_params, ft_params, res, max_goals=5)
    ou = derive_ht_over_under(joint, 0.5)
    assert abs(ou["over"] + ou["under"] - 1.0) < 0.01
    assert ou["over"] > 0


def test_derive_all_ht_ft_markets():
    ht_params = HTParams(0.1, -0.1, 0.1, -0.1, 0.15, -0.05)
    ft_params = DixonColesParams(0.1, -0.1, 0.1, -0.1, 0.15, -0.05)
    res = SecondHalfResiduals(1.0, 1.0, 1.0, 100)
    joint = joint_ht_ft_matrix(ht_params, ft_params, res, max_goals=5)
    all_markets = derive_all_ht_ft_markets(joint)
    assert "ht_1x2" in all_markets
    assert "ht_double_chance" in all_markets
    assert "ht_over_under_0.5" in all_markets
    assert "ft_result_given_ht" in all_markets
    assert "both_halves" in all_markets


def test_ht_1x2_sum_to_one():
    for seed in range(5):
        rng = np.random.default_rng(seed)
        n = 50
        home_ids = rng.integers(1, 4, n)
        away_ids = rng.integers(1, 4, n)
        home_ht = rng.poisson(1, n).astype(float)
        away_ht = rng.poisson(1, n).astype(float)
        ft_h = home_ht + rng.poisson(0.5, n).astype(float)
        ft_a = away_ht + rng.poisson(0.5, n).astype(float)
        elo_h = np.full(n, 1500.0)
        elo_a = np.full(n, 1500.0)

        ht_params = fit_ht_dixon_coles(home_ids, away_ids, home_ht, away_ht, 3, {1: 0, 2: 1, 3: 2})
        res = estimate_second_half_residuals(home_ids, away_ids, home_ht, away_ht, ft_h, ft_a, elo_h, elo_a)
        ft_params = DixonColesParams(0.1, -0.1, 0.1, -0.1, 0.15, -0.05)
        joint = joint_ht_ft_matrix(ht_params, ft_params, res, max_goals=4)
        ht = derive_ht_1x2(joint)
        assert abs(ht["home"] + ht["draw"] + ht["away"] - 1.0) < 0.01
