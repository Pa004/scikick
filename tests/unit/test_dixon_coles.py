import math
import numpy as np

from app.models.dixon_coles import (
    DixonColesParams, _poisson_pmf, _tau, score_matrix,
    probabilities_from_matrix, fit_dixon_coles,
)


def test_poisson_pmf():
    assert abs(_poisson_pmf(0, 1.0) - math.exp(-1)) < 1e-10
    assert abs(_poisson_pmf(1, 1.0) - math.exp(-1)) < 1e-10
    assert _poisson_pmf(5, 0.1) < 0.001


def test_tau_formula():
    # tau(0,0) = 1 - lambda*mu*rho
    assert abs(_tau(0, 0, 1.0, 1.0, -0.2) - 1.2) < 1e-10
    # tau(1,1) = lambda*mu*(1-rho)
    assert abs(_tau(1, 1, 1.0, 1.0, -0.2) - 1.2) < 1e-10


def test_score_matrix_positive():
    params = DixonColesParams(0.1, -0.1, 0.05, -0.05, 0.3, -0.1)
    matrix = score_matrix(params, max_goals=10)
    assert matrix.sum() > 0
    assert np.all(matrix >= 0)


def test_probabilities_from_matrix():
    params = DixonColesParams(0.1, -0.1, 0.05, -0.05, 0.3, -0.1)
    matrix = score_matrix(params, max_goals=10)
    probs = probabilities_from_matrix(matrix)
    assert abs(sum(probs.values()) - 1.0) < 1e-6
    assert probs["home"] > probs["away"]


def test_fit_dixon_coles():
    rng = np.random.RandomState(42)
    n = 200
    home_ids = rng.randint(1, 5, n)
    away_ids = rng.randint(1, 5, n)
    home_goals = rng.poisson(1.5, n)
    away_goals = rng.poisson(1.2, n)

    team_ids = np.unique(np.concatenate([home_ids, away_ids]))
    team_id_to_idx = {int(t): i for i, t in enumerate(team_ids)}

    params = fit_dixon_coles(home_ids, away_ids, home_goals, away_goals, len(team_ids), team_id_to_idx)
    assert isinstance(params, DixonColesParams)
    assert -1 < params.rho < 1
