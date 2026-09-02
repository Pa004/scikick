from __future__ import annotations

import math
from dataclasses import dataclass, field

import numpy as np
from scipy.optimize import minimize
from scipy.stats import poisson

from app.models.dixon_coles import DixonColesParams, score_matrix


@dataclass
class HTParams:
    home_attack: float
    home_defense: float
    away_attack: float
    away_defense: float
    home_advantage: float
    rho: float


@dataclass
class SecondHalfResiduals:
    winning_multiplier: float = 1.0
    drawing_multiplier: float = 1.0
    losing_multiplier: float = 1.0
    n_samples: int = 0


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


def fit_ht_dixon_coles(
    home_team_ids: np.ndarray,
    away_team_ids: np.ndarray,
    home_ht_goals: np.ndarray,
    away_ht_goals: np.ndarray,
    n_teams: int,
    team_id_to_idx: dict[int, int],
) -> HTParams:
    home_idx = np.array([team_id_to_idx.get(int(t), 0) for t in home_team_ids])
    away_idx = np.array([team_id_to_idx.get(int(t), 0) for t in away_team_ids])

    x0 = np.zeros(4 * n_teams + 2)
    x0[4 * n_teams] = 0.2
    x0[4 * n_teams + 1] = -0.05

    def objective(params):
        ha = params[:n_teams]
        hd = params[n_teams: 2 * n_teams]
        aa = params[2 * n_teams: 3 * n_teams]
        ad = params[3 * n_teams: 4 * n_teams]
        home_adv = params[4 * n_teams]
        rho = params[4 * n_teams + 1]

        ll = 0.0
        for i in range(len(home_ht_goals)):
            hi = home_idx[i]
            ai = away_idx[i]
            lam = math.exp(ha[hi] + ad[ai] + home_adv)
            mu = math.exp(aa[ai] + hd[hi])
            p = _poisson_pmf(int(home_ht_goals[i]), lam) * _poisson_pmf(int(away_ht_goals[i]), mu) * _tau(int(home_ht_goals[i]), int(away_ht_goals[i]), lam, mu, rho)
            ll += math.log(max(p, 1e-15))
        return -ll

    result = minimize(objective, x0, method="L-BFGS-B", options={"maxiter": 500})
    p = result.x

    return HTParams(
        home_attack=float(np.mean(p[:n_teams])),
        home_defense=float(np.mean(p[n_teams: 2 * n_teams])),
        away_attack=float(np.mean(p[2 * n_teams: 3 * n_teams])),
        away_defense=float(np.mean(p[3 * n_teams: 4 * n_teams])),
        home_advantage=float(p[4 * n_teams]),
        rho=float(p[4 * n_teams + 1]),
    )


def estimate_second_half_residuals(
    home_team_ids: np.ndarray,
    away_team_ids: np.ndarray,
    home_ht_goals: np.ndarray,
    away_ht_goals: np.ndarray,
    home_ft_goals: np.ndarray,
    away_ft_goals: np.ndarray,
    home_elo: np.ndarray,
    away_elo: np.ndarray,
) -> SecondHalfResiduals:
    winning_2h_goals = []
    drawing_2h_goals = []
    losing_2h_goals = []
    winning_expected = []
    drawing_expected = []
    losing_expected = []

    for i in range(len(home_ht_goals)):
        ht_h = int(home_ht_goals[i])
        ht_a = int(away_ht_goals[i])
        ft_h = int(home_ft_goals[i])
        ft_a = int(away_ft_goals[i])
        h2 = ft_h - ht_h
        a2 = ft_a - ht_a
        total_2h = h2 + a2

        elo_diff = float(home_elo[i] - away_elo[i])
        expected_home_2h = max(0.5, 1.0 + elo_diff / 400)
        expected_away_2h = max(0.5, 1.0 - elo_diff / 400)
        expected_total_2h = expected_home_2h + expected_away_2h

        if ht_h > ht_a:
            winning_2h_goals.append(total_2h)
            winning_expected.append(expected_total_2h)
        elif ht_h == ht_a:
            drawing_2h_goals.append(total_2h)
            drawing_expected.append(expected_total_2h)
        else:
            losing_2h_goals.append(total_2h)
            losing_expected.append(expected_total_2h)

    def calc_residual(observed, expected):
        if not observed or not expected:
            return 1.0
        obs_avg = np.mean(observed)
        exp_avg = np.mean(expected)
        if exp_avg < 0.1:
            return 1.0
        return obs_avg / exp_avg

    n_total = len(winning_2h_goals) + len(drawing_2h_goals) + len(losing_2h_goals)

    return SecondHalfResiduals(
        winning_multiplier=calc_residual(winning_2h_goals, winning_expected),
        drawing_multiplier=calc_residual(drawing_2h_goals, drawing_expected),
        losing_multiplier=calc_residual(losing_2h_goals, losing_expected),
        n_samples=n_total,
    )


def _get_residual_multiplier(
    residuals: SecondHalfResiduals,
    ht_h: int,
    ht_a: int,
) -> float:
    if ht_h > ht_a:
        return residuals.winning_multiplier
    elif ht_h == ht_a:
        return residuals.drawing_multiplier
    else:
        return residuals.losing_multiplier


def joint_ht_ft_matrix(
    ht_params: HTParams,
    ft_params: DixonColesParams,
    residuals: SecondHalfResiduals,
    max_goals: int = 8,
) -> np.ndarray:
    n = max_goals + 1
    joint = np.zeros((n, n, n, n))

    for ht_h in range(n):
        for ht_a in range(n):
            lam_ht = math.exp(ht_params.home_attack + ht_params.away_defense + ht_params.home_advantage)
            mu_ht = math.exp(ht_params.away_attack + ht_params.home_defense)
            p_ht = _poisson_pmf(ht_h, lam_ht) * _poisson_pmf(ht_a, mu_ht) * _tau(ht_h, ht_a, lam_ht, mu_ht, ht_params.rho)
            if p_ht < 1e-12:
                continue

            multiplier = _get_residual_multiplier(residuals, ht_h, ht_a)
            base_ft = math.exp(ft_params.home_attack + ft_params.away_defense + ft_params.home_advantage)
            base_away = math.exp(ft_params.away_attack + ft_params.home_defense)
            lam_2h = max(0.1, base_ft * multiplier)
            mu_2h = max(0.1, base_away * multiplier)

            for h2 in range(n - ht_h):
                for a2 in range(n - ht_a):
                    ft_h = ht_h + h2
                    ft_a = ht_a + a2
                    p_h2 = _poisson_pmf(h2, lam_2h)
                    p_a2 = _poisson_pmf(a2, mu_2h)
                    p_ft_given_ht = p_h2 * p_a2
                    joint[ht_h, ht_a, ft_h, ft_a] = p_ht * p_ft_given_ht

    total = joint.sum()
    if total > 0:
        joint /= total
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


def derive_both_halves_markets(joint: np.ndarray) -> dict:
    n = joint.shape[0]
    team_wins_both = 0.0
    team_wins_either = 0.0
    draw_both = 0.0
    both_score_both = 0.0
    ht_over05_ft_over05 = 0.0
    ht_over15_ft_over15 = 0.0
    ht_over25_ft_over25 = 0.0

    for ht_h in range(n):
        for ht_a in range(n):
            ht_prob = joint[ht_h, ht_a, :, :].sum()
            ht_total = ht_h + ht_a
            ht_result = "home" if ht_h > ht_a else ("draw" if ht_h == ht_a else "away")

            for ft_h in range(n):
                for ft_a in range(n):
                    p = joint[ht_h, ht_a, ft_h, ft_a]
                    if p < 1e-12:
                        continue
                    ft_result = "home" if ft_h > ft_a else ("draw" if ft_h == ft_a else "away")

                    if ht_result == "home" and ft_result == "home":
                        team_wins_both += p
                    if ht_result == "home" or ft_result == "home":
                        team_wins_either += p
                    if ht_result == "draw" and ft_result == "draw":
                        draw_both += p
                    if ht_h > 0 and ht_a > 0 and ft_h > ht_h and ft_a > ht_a:
                        both_score_both += p
                    if ht_total > 0.5 and (ft_h + ft_a) > 0.5:
                        ht_over05_ft_over05 += p
                    if ht_total > 1.5 and (ft_h + ft_a) > 1.5:
                        ht_over15_ft_over15 += p
                    if ht_total > 2.5 and (ft_h + ft_a) > 2.5:
                        ht_over25_ft_over25 += p

    return {
        "team_wins_both_halves": team_wins_both,
        "team_wins_either_half": team_wins_either,
        "draw_both_halves": draw_both,
        "both_teams_score_both_halves": both_score_both,
        "ht_over_0.5_ft_over_0.5": ht_over05_ft_over05,
        "ht_over_1.5_ft_over_1.5": ht_over15_ft_over15,
        "ht_over_2.5_ft_over_2.5": ht_over25_ft_over25,
    }


def derive_all_ht_ft_markets(joint: np.ndarray) -> dict:
    return {
        "ht_1x2": derive_ht_1x2(joint),
        "ht_double_chance": derive_ht_double_chance(joint),
        "ht_over_under_0.5": derive_ht_over_under(joint, 0.5),
        "ht_over_under_1.5": derive_ht_over_under(joint, 1.5),
        "ht_over_under_2.5": derive_ht_over_under(joint, 2.5),
        "ft_result_given_ht": derive_ft_result_given_ht(joint),
        "both_halves": derive_both_halves_markets(joint),
    }
