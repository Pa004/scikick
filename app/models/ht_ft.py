from __future__ import annotations

import numpy as np

from app.models.dixon_coles import DixonColesParams, score_matrix, probabilities_from_matrix


def ht_transition_matrix(max_goals: int = 10) -> np.ndarray:
    n = max_goals + 1
    size = n * n
    transition = np.zeros((size, size))
    for ht_h in range(n):
        for ht_a in range(n):
            ht_idx = ht_h * n + ht_a
            remaining = max_goals - ht_h - ht_a
            if remaining < 0:
                continue
            total_paths = 0
            for ft_h in range(ht_h, min(ht_h + remaining + 1, n)):
                for ft_a in range(ht_a, min(ht_a + remaining + 1, n)):
                    delta = (ft_h - ht_h) + (ft_a - ht_a)
                    if delta > remaining:
                        continue
                    ft_idx = ft_h * n + ft_a
                    transition[ht_idx, ft_idx] = 1.0
                    total_paths += 1
            if total_paths > 0:
                transition[ht_idx] /= total_paths
    return transition


def joint_ht_ft_matrix(dc_params: DixonColesParams, max_goals: int = 10, gamma: float = 0.5) -> np.ndarray:
    ft_matrix = score_matrix(dc_params, max_goals=max_goals)
    n = max_goals + 1

    ht_params = DixonColesParams(
        dc_params.home_attack * gamma,
        dc_params.home_defense * gamma,
        dc_params.away_attack * gamma,
        dc_params.away_defense * gamma,
        dc_params.home_advantage * gamma,
        dc_params.rho,
    )
    ht_matrix = score_matrix(ht_params, max_goals=max_goals)
    transition = ht_transition_matrix(max_goals=max_goals)

    joint = np.zeros((n, n, n, n))
    for ht_h in range(n):
        for ht_a in range(n):
            ht_prob = ht_matrix[ht_h, ht_a]
            if ht_prob < 1e-12:
                continue
            ht_idx = ht_h * n + ht_a
            for ft_h in range(n):
                for ft_a in range(n):
                    ft_idx = ft_h * n + ft_a
                    trans_prob = transition[ht_idx, ft_idx]
                    if trans_prob < 1e-12:
                        continue
                    joint[ht_h, ht_a, ft_h, ft_a] = ht_prob * trans_prob

    joint_sum = joint.sum()
    if joint_sum > 0:
        joint /= joint_sum
    return joint


def derive_ht_1x2(joint: np.ndarray) -> dict:
    n = joint.shape[0]
    p_home = 0.0
    p_draw = 0.0
    p_away = 0.0
    for ht_h in range(n):
        for ht_a in range(n):
            prob = joint[ht_h, ht_a, :, :].sum()
            if ht_h > ht_a:
                p_home += prob
            elif ht_h == ht_a:
                p_draw += prob
            else:
                p_away += prob
    return {"home": p_home, "draw": p_draw, "away": p_away}


def derive_ht_double_chance(joint: np.ndarray) -> dict:
    ht = derive_ht_1x2(joint)
    return {
        "home_or_draw": ht["home"] + ht["draw"],
        "draw_or_away": ht["draw"] + ht["away"],
        "home_or_away": ht["home"] + ht["away"],
    }


def derive_ft_result_given_ht(joint: np.ndarray) -> dict:
    n = joint.shape[0]
    results = {}
    for ht_h in range(min(4, n)):
        for ht_a in range(min(4, n)):
            ht_key = f"{ht_h}-{ht_a}"
            p_home = 0.0
            p_draw = 0.0
            p_away = 0.0
            for ft_h in range(n):
                for ft_a in range(n):
                    p = joint[ht_h, ht_a, ft_h, ft_a]
                    if ft_h > ft_a:
                        p_home += p
                    elif ft_h == ft_a:
                        p_draw += p
                    else:
                        p_away += p
            total = p_home + p_draw + p_away
            if total > 1e-6:
                results[f"ht_{ht_key}_ft_1x2"] = {
                    "home": p_home / total,
                    "draw": p_draw / total,
                    "away": p_away / total,
                }
    return results


def derive_ht_over_under(joint: np.ndarray, line: float = 0.5) -> dict:
    n = joint.shape[0]
    over = 0.0
    for ht_h in range(n):
        for ht_a in range(n):
            ht_total = ht_h + ht_a
            prob = joint[ht_h, ht_a, :, :].sum()
            if ht_total > line:
                over += prob
    return {"over": over, "under": 1 - over}


def derive_all_ht_ft_markets(joint: np.ndarray) -> dict:
    return {
        "ht_1x2": derive_ht_1x2(joint),
        "ht_double_chance": derive_ht_double_chance(joint),
        "ht_over_under_0.5": derive_ht_over_under(joint, 0.5),
        "ht_over_under_1.5": derive_ht_over_under(joint, 1.5),
        "ft_result_given_ht": derive_ft_result_given_ht(joint),
    }
