from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np
from scipy.optimize import minimize


@dataclass
class DixonColesParams:
    home_attack: float
    home_defense: float
    away_attack: float
    away_defense: float
    home_advantage: float
    rho: float


def _poisson_pmf(k: int, lam: float) -> float:
    return math.exp(-lam) * (lam ** k) / math.factorial(k)


def _tau(x: int, y: int, lambda_: float, mu: float, rho: float) -> float:
    if x == 0 and y == 0:
        return 1 - lambda_ * mu * rho
    elif x == 0 and y == 1:
        return lambda_ + mu * rho
    elif x == 1 and y == 0:
        return mu + lambda_ * rho
    elif x == 1 and y == 1:
        return lambda_ * mu * (1 - rho)
    else:
        return 1.0


def score_matrix(
    params: DixonColesParams,
    max_goals: int = 10,
) -> np.ndarray:
    matrix = np.zeros((max_goals + 1, max_goals + 1))
    for i in range(max_goals + 1):
        for j in range(max_goals + 1):
            lam = math.exp(params.home_attack + params.away_defense + params.home_advantage)
            mu = math.exp(params.away_attack + params.home_defense)
            matrix[i, j] = (
                _poisson_pmf(i, lam)
                * _poisson_pmf(j, mu)
                * _tau(i, j, lam, mu, params.rho)
            )
    total = matrix.sum()
    if total > 0:
        matrix /= total
    return matrix


def probabilities_from_matrix(matrix: np.ndarray) -> dict:
    p_home = float(np.sum(np.tril(matrix, -1)))
    p_draw = float(np.sum(np.diag(matrix)))
    p_away = float(np.sum(np.triu(matrix, 1)))
    total = p_home + p_draw + p_away
    return {
        "home": p_home / total,
        "draw": p_draw / total,
        "away": p_away / total,
    }


def _neg_log_likelihood(
    params: np.ndarray,
    home_goals: np.ndarray,
    away_goals: np.ndarray,
    n_teams: int,
) -> float:
    home_attack = params[:n_teams]
    home_defense = params[n_teams : 2 * n_teams]
    away_attack = params[2 * n_teams : 3 * n_teams]
    away_defense = params[3 * n_teams : 4 * n_teams]
    home_adv = params[4 * n_teams]
    rho = params[4 * n_teams + 1]

    ll = 0.0
    for hg, ag in zip(home_goals, away_goals):
        h_idx = int(hg) if hg < n_teams else 0
        a_idx = int(ag) if ag < n_teams else 0
        lam = math.exp(home_attack[h_idx] + away_defense[a_idx] + home_adv)
        mu = math.exp(away_attack[a_idx] + home_defense[h_idx])
        ll += math.log(
            max(_poisson_pmf(int(hg), lam) * _poisson_pmf(int(ag), mu) * _tau(int(hg), int(ag), lam, mu, rho), 1e-15)
        )

    return -ll


def fit_dixon_coles(
    home_team_ids: np.ndarray,
    away_team_ids: np.ndarray,
    home_goals: np.ndarray,
    away_goals: np.ndarray,
    n_teams: int,
    team_id_to_idx: dict[int, int],
) -> DixonColesParams:
    home_idx = np.array([team_id_to_idx.get(int(t), 0) for t in home_team_ids])
    away_idx = np.array([team_id_to_idx.get(int(t), 0) for t in away_team_ids])

    x0 = np.zeros(4 * n_teams + 2)
    x0[4 * n_teams] = 0.3
    x0[4 * n_teams + 1] = -0.1

    def objective(params):
        home_attack = params[:n_teams]
        home_defense = params[n_teams : 2 * n_teams]
        away_attack = params[2 * n_teams : 3 * n_teams]
        away_defense = params[3 * n_teams : 4 * n_teams]
        home_adv = params[4 * n_teams]
        rho = params[4 * n_teams + 1]

        ll = 0.0
        for i in range(len(home_goals)):
            hi = home_idx[i]
            ai = away_idx[i]
            lam = math.exp(home_attack[hi] + away_defense[ai] + home_adv)
            mu = math.exp(away_attack[ai] + home_defense[hi])
            p = _poisson_pmf(int(home_goals[i]), lam) * _poisson_pmf(int(away_goals[i]), mu) * _tau(int(home_goals[i]), int(away_goals[i]), lam, mu, rho)
            ll += math.log(max(p, 1e-15))

        return -ll

    result = minimize(objective, x0, method="L-BFGS-B", options={"maxiter": 1000})
    p = result.x

    return DixonColesParams(
        home_attack=float(np.mean(p[:n_teams])),
        home_defense=float(np.mean(p[n_teams : 2 * n_teams])),
        away_attack=float(np.mean(p[2 * n_teams : 3 * n_teams])),
        away_defense=float(np.mean(p[3 * n_teams : 4 * n_teams])),
        home_advantage=float(p[4 * n_teams]),
        rho=float(p[4 * n_teams + 1]),
    )
