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


def derive_draw_no_bet(matrix: np.ndarray) -> dict:
    p_home, _p_draw, p_away = probabilities_from_matrix(matrix).values()
    total = p_home + p_away
    return {"home": p_home / total, "away": p_away / total}


def derive_win_to_nil(matrix: np.ndarray) -> dict:
    home_win_nil = float(np.sum(matrix[1:, 0]))
    away_win_nil = float(np.sum(matrix[0, 1:]))
    return {"home": home_win_nil, "away": away_win_nil}


def derive_clean_sheet(matrix: np.ndarray) -> dict:
    home_clean = float(np.sum(matrix[:, 0]))
    away_clean = float(np.sum(matrix[0, :]))
    return {"home_yes": home_clean, "home_no": 1 - home_clean,
            "away_yes": away_clean, "away_no": 1 - away_clean}


def derive_goal_bands(matrix: np.ndarray) -> dict:
    goals = np.array([i + j for i in range(matrix.shape[0]) for j in range(matrix.shape[1])])
    probs = matrix.flatten()
    return {
        "0": float(np.sum(probs[goals == 0])),
        "1-2": float(np.sum(probs[(goals >= 1) & (goals <= 2)])),
        "3-4": float(np.sum(probs[(goals >= 3) & (goals <= 4)])),
        "5+": float(np.sum(probs[goals >= 5])),
    }


def derive_asian_handicap(matrix: np.ndarray, handicap: float = -0.5) -> dict:
    home_prob = 0.0
    draw_prob = 0.0
    away_prob = 0.0
    for i in range(matrix.shape[0]):
        for j in range(matrix.shape[1]):
            adjusted = (i + handicap) - j
            if adjusted > 0:
                home_prob += matrix[i, j]
            elif adjusted < 0:
                away_prob += matrix[i, j]
            else:
                draw_prob += matrix[i, j]
    return {"home": home_prob, "draw": draw_prob, "away": away_prob}


def derive_second_half_winner(matrix: np.ndarray) -> dict:
    p_home, p_draw, p_away = probabilities_from_matrix(matrix).values()
    return {"home": p_home, "draw": p_draw, "away": p_away}


def derive_highest_scoring_half(matrix: np.ndarray) -> dict:
    first_half_goals = np.array([i for i in range(matrix.shape[0])])
    second_half_goals = np.array([j for j in range(matrix.shape[1])])

    first_higher = 0.0
    second_higher = 0.0
    equal = 0.0
    for i in range(matrix.shape[0]):
        for j in range(matrix.shape[1]):
            ft_goals = i + j
            for h1 in range(ft_goals + 1):
                h2 = ft_goals - h1
                p_h1 = matrix[i, j] * (1.0 / (ft_goals + 1)) if ft_goals > 0 else matrix[i, j]
                if h1 > h2:
                    first_higher += p_h1
                elif h2 > h1:
                    second_higher += p_h1
                else:
                    equal += p_h1
    total = first_higher + second_higher + equal
    if total > 0:
        return {"first": first_higher / total, "second": second_higher / total, "equal": equal / total}
    return {"first": 0.33, "second": 0.33, "equal": 0.34}


def derive_all_markets(matrix: np.ndarray) -> dict:
    return {
        "1x2": derive_1x2(matrix),
        "double_chance": derive_double_chance(matrix),
        "over_under_0.5": derive_over_under(matrix, 0.5),
        "over_under_1.5": derive_over_under(matrix, 1.5),
        "over_under_2.5": derive_over_under(matrix, 2.5),
        "over_under_3.5": derive_over_under(matrix, 3.5),
        "over_under_4.5": derive_over_under(matrix, 4.5),
        "btts": derive_btts(matrix),
        "handicap_-1": derive_handicap(matrix, -1),
        "handicap_+1": derive_handicap(matrix, 1),
        "handicap_-2": derive_handicap(matrix, -2),
        "handicap_+2": derive_handicap(matrix, 2),
        "asian_handicap_-0.5": derive_asian_handicap(matrix, -0.5),
        "asian_handicap_+0.5": derive_asian_handicap(matrix, 0.5),
        "draw_no_bet": derive_draw_no_bet(matrix),
        "win_to_nil": derive_win_to_nil(matrix),
        "clean_sheet": derive_clean_sheet(matrix),
        "exact_score": derive_exact_score(matrix),
        "total_goals": derive_total_goals(matrix),
        "goal_bands": derive_goal_bands(matrix),
        "odd_even": derive_odd_even(matrix),
        "highest_scoring_half": derive_highest_scoring_half(matrix),
    }
