from __future__ import annotations

import numpy as np

from app.models.dixon_coles import DixonColesParams, score_matrix, probabilities_from_matrix


def derive_1x2(matrix: np.ndarray) -> dict:
    return probabilities_from_matrix(matrix)


def derive_double_chance(matrix: np.ndarray) -> dict:
    p_home, p_draw, p_away = probabilities_from_matrix(matrix).values()
    return {"home_or_draw": p_home + p_draw, "draw_or_away": p_draw + p_away, "home_or_away": p_home + p_away}


def derive_over_under(matrix: np.ndarray, line: float = 2.5) -> dict:
    goals = np.array([i + j for i in range(matrix.shape[0]) for j in range(matrix.shape[1])])
    probs = matrix.flatten()
    over = float(np.sum(probs[goals > line]))
    under = float(np.sum(probs[goals <= line]))
    return {"over": over, "under": under}


def derive_btts(matrix: np.ndarray) -> dict:
    both = float(np.sum(matrix[1:, 1:]))
    return {"yes": both, "no": 1 - both}


def derive_handicap(matrix: np.ndarray, handicap: int = -1) -> dict:
    adjusted = np.zeros_like(matrix)
    for i in range(matrix.shape[0]):
        for j in range(matrix.shape[1]):
            new_i = i + handicap
            if 0 <= new_i < matrix.shape[0]:
                adjusted[new_i, j] += matrix[i, j]
    return probabilities_from_matrix(adjusted)


def derive_exact_score(matrix: np.ndarray, max_goals: int = 6) -> dict:
    scores = {}
    for i in range(min(max_goals + 1, matrix.shape[0])):
        for j in range(min(max_goals + 1, matrix.shape[1])):
            scores[f"{i}-{j}"] = float(matrix[i, j])
    other = float(np.sum(matrix)) - sum(scores.values())
    scores["other"] = max(other, 0)
    return scores


def derive_total_goals(matrix: np.ndarray) -> dict:
    goals = np.array([i + j for i in range(matrix.shape[0]) for j in range(matrix.shape[1])])
    probs = matrix.flatten()
    result = {}
    for n in range(7):
        result[str(n)] = float(np.sum(probs[goals == n]))
    result["7+"] = float(np.sum(probs[goals >= 7]))
    return result


def derive_odd_even(matrix: np.ndarray) -> dict:
    goals = np.array([i + j for i in range(matrix.shape[0]) for j in range(matrix.shape[1])])
    probs = matrix.flatten()
    odd = float(np.sum(probs[goals % 2 == 1]))
    return {"odd": odd, "even": 1 - odd}


def derive_all_markets(matrix: np.ndarray) -> dict:
    return {
        "1x2": derive_1x2(matrix),
        "double_chance": derive_double_chance(matrix),
        "over_under_2.5": derive_over_under(matrix, 2.5),
        "over_under_1.5": derive_over_under(matrix, 1.5),
        "over_under_3.5": derive_over_under(matrix, 3.5),
        "btts": derive_btts(matrix),
        "handicap_-1": derive_handicap(matrix, -1),
        "handicap_+1": derive_handicap(matrix, 1),
        "exact_score": derive_exact_score(matrix),
        "total_goals": derive_total_goals(matrix),
        "odd_even": derive_odd_even(matrix),
    }
