from __future__ import annotations

import math
from dataclasses import dataclass, field

import numpy as np
from scipy.optimize import minimize
from scipy.stats import poisson


@dataclass
class CountParams:
    team_attack: dict[int, float] = field(default_factory=dict)
    team_defense: dict[int, float] = field(default_factory=dict)
    home_advantage: float = 0.0
    global_avg: float = 5.0
    max_count: int = 20


def _poisson_pmf(k: int, lam: float) -> float:
    return math.exp(-lam) * (lam ** k) / math.factorial(k)


def _neg_log_likelihood_count(
    params: np.ndarray,
    home_counts: np.ndarray,
    away_counts: np.ndarray,
    home_idx: np.ndarray,
    away_idx: np.ndarray,
    n_teams: int,
) -> float:
    attack = params[:n_teams]
    defense = params[n_teams : 2 * n_teams]
    home_adv = params[2 * n_teams]

    ll = 0.0
    for i in range(len(home_counts)):
        hi = home_idx[i]
        ai = away_idx[i]
        lam_h = math.exp(attack[hi] + defense[ai] + home_adv)
        lam_a = math.exp(attack[ai] + defense[hi])
        p_h = _poisson_pmf(int(home_counts[i]), lam_h)
        p_a = _poisson_pmf(int(away_counts[i]), lam_a)
        ll += math.log(max(p_h * p_a, 1e-15))

    return -ll


def fit_count_poisson(
    home_team_ids: np.ndarray,
    away_team_ids: np.ndarray,
    home_counts: np.ndarray,
    away_counts: np.ndarray,
    n_teams: int,
    team_id_to_idx: dict[int, int],
) -> CountParams:
    home_idx = np.array([team_id_to_idx.get(int(t), 0) for t in home_team_ids])
    away_idx = np.array([team_id_to_idx.get(int(t), 0) for t in away_team_ids])

    global_avg = float(np.mean(np.concatenate([home_counts, away_counts])))
    if global_avg < 0.1:
        global_avg = 5.0

    x0 = np.zeros(2 * n_teams + 1)
    x0[:n_teams] = math.log(max(global_avg, 0.1)) / 2
    x0[n_teams : 2 * n_teams] = 0.0
    x0[2 * n_teams] = 0.1

    result = minimize(
        _neg_log_likelihood_count,
        x0,
        args=(home_counts, away_counts, home_idx, away_idx, n_teams),
        method="L-BFGS-B",
        options={"maxiter": 500},
    )

    p = result.x
    team_attack = {}
    team_defense = {}
    sorted_ids = sorted(team_id_to_idx.keys(), key=lambda x: team_id_to_idx[x])
    for tid in sorted_ids:
        idx = team_id_to_idx[tid]
        team_attack[tid] = float(p[idx])
        team_defense[tid] = float(p[n_teams + idx])

    return CountParams(
        team_attack=team_attack,
        team_defense=team_defense,
        home_advantage=float(p[2 * n_teams]),
        global_avg=global_avg,
    )


def predict_count_rates(
    params: CountParams,
    home_team_id: int,
    away_team_id: int,
) -> tuple[float, float]:
    ha = params.team_attack.get(home_team_id, math.log(max(params.global_avg, 0.1)) / 2)
    hd = params.team_defense.get(away_team_id, 0.0)
    aa = params.team_attack.get(away_team_id, math.log(max(params.global_avg, 0.1)) / 2)
    ad = params.team_defense.get(home_team_id, 0.0)

    lam_home = math.exp(ha + hd + params.home_advantage)
    lam_away = math.exp(aa + ad)
    return lam_home, lam_away


def count_matrix(home_rate: float, away_rate: float, max_count: int = 20) -> np.ndarray:
    home_pmf = np.array([poisson.pmf(k, home_rate) for k in range(max_count + 1)])
    away_pmf = np.array([poisson.pmf(k, away_rate) for k in range(max_count + 1)])
    matrix = np.outer(home_pmf, away_pmf)
    total = matrix.sum()
    if total > 0:
        matrix /= total
    return matrix


def derive_count_over_under(matrix: np.ndarray, line: float = 9.5) -> dict:
    total_counts = np.array([i + j for i in range(matrix.shape[0]) for j in range(matrix.shape[1])])
    probs = matrix.flatten()
    over = float(np.sum(probs[total_counts > line]))
    under = float(np.sum(probs[total_counts <= line]))
    return {"over": over, "under": under}


def derive_count_total(matrix: np.ndarray) -> dict:
    total_counts = np.array([i + j for i in range(matrix.shape[0]) for j in range(matrix.shape[1])])
    probs = matrix.flatten()
    result = {}
    for n in range(16):
        result[str(n)] = float(np.sum(probs[total_counts == n]))
    result["16+"] = float(np.sum(probs[total_counts >= 16]))
    return result


def derive_count_handicap(matrix: np.ndarray, handicap: int = -2) -> dict:
    adjusted = np.zeros_like(matrix)
    for i in range(matrix.shape[0]):
        for j in range(matrix.shape[1]):
            new_i = i + handicap
            if 0 <= new_i < matrix.shape[0]:
                adjusted[new_i, j] += matrix[i, j]
    total = adjusted.sum()
    if total < 1e-15:
        return {"home": 0.33, "draw": 0.34, "away": 0.33}
    from app.models.dixon_coles import probabilities_from_matrix
    return probabilities_from_matrix(adjusted)


def derive_all_count_markets(matrix: np.ndarray, prefix: str = "corners") -> dict:
    return {
        f"{prefix}_over_under_8.5": derive_count_over_under(matrix, 8.5),
        f"{prefix}_over_under_9.5": derive_count_over_under(matrix, 9.5),
        f"{prefix}_over_under_10.5": derive_count_over_under(matrix, 10.5),
        f"{prefix}_over_under_11.5": derive_count_over_under(matrix, 11.5),
        f"{prefix}_total": derive_count_total(matrix),
        f"{prefix}_handicap_-2": derive_count_handicap(matrix, -2),
        f"{prefix}_handicap_-1": derive_count_handicap(matrix, -1),
        f"{prefix}_handicap_+1": derive_count_handicap(matrix, 1),
        f"{prefix}_handicap_+2": derive_count_handicap(matrix, 2),
    }
