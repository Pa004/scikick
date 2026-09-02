from __future__ import annotations

import numpy as np
from scipy.stats import poisson


def poisson_pmf(k: int, lam: float) -> float:
    return float(poisson.pmf(k, lam))


def poisson_pmf_array(max_goals: int, lam: float) -> np.ndarray:
    return np.array([poisson.pmf(k, lam) for k in range(max_goals + 1)])


def fit_poisson_rate(counts: np.ndarray) -> float:
    if len(counts) == 0:
        return 0.0
    return float(np.mean(counts))


def predict_count_distribution(home_rate: float, away_rate: float, max_count: int = 20) -> np.ndarray:
    home_pmf = poisson_pmf_array(max_count, home_rate)
    away_pmf = poisson_pmf_array(max_count, away_rate)
    matrix = np.outer(home_pmf, away_pmf)
    matrix /= matrix.sum()
    return matrix


def derive_count_over_under(matrix: np.ndarray, line: float = 9.5) -> dict:
    total_counts = np.array([i + j for i in range(matrix.shape[0]) for j in range(matrix.shape[1])])
    probs = matrix.flatten()
    over = float(np.sum(probs[total_counts > line]))
    under = float(np.sum(probs[total_counts <= line]))
    return {"over": over, "under": under}


def derive_count_total(matrix: np.ndarray, buckets: list[int] | None = None) -> dict:
    if buckets is None:
        buckets = list(range(16))
    total_counts = np.array([i + j for i in range(matrix.shape[0]) for j in range(matrix.shape[1])])
    probs = matrix.flatten()
    result = {}
    for b in buckets:
        result[str(b)] = float(np.sum(probs[total_counts == b]))
    result["16+"] = float(np.sum(probs[total_counts >= 16]))
    return result


def derive_count_handicap(matrix: np.ndarray, handicap: int = -2) -> dict:
    adjusted = np.zeros_like(matrix)
    for i in range(matrix.shape[0]):
        for j in range(matrix.shape[1]):
            new_i = i + handicap
            if 0 <= new_i < matrix.shape[0]:
                adjusted[new_i, j] += matrix[i, j]
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
