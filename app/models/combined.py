from __future__ import annotations

import numpy as np


def _cross_product(matrix: np.ndarray, cond_a, cond_b) -> tuple[float, float, float, float]:
    p_a_b = 0.0
    p_a_not_b = 0.0
    p_not_a_b = 0.0
    p_not_a_not_b = 0.0
    for i in range(matrix.shape[0]):
        for j in range(matrix.shape[1]):
            a = cond_a(i, j)
            b = cond_b(i, j)
            p = matrix[i, j]
            if a and b:
                p_a_b += p
            elif a and not b:
                p_a_not_b += p
            elif not a and b:
                p_not_a_b += p
            else:
                p_not_a_not_b += p
    return p_a_b, p_a_not_b, p_not_a_b, p_not_a_not_b


def derive_combined_home_o25(matrix: np.ndarray) -> dict:
    pa_b, pa_nb, pna_b, pna_nb = _cross_product(
        matrix, lambda i, j: i > j, lambda i, j: i + j > 2.5
    )
    return {
        "home_over_2.5": pa_b,
        "home_under_2.5": pa_nb,
        "away_or_draw_over_2.5": pna_b,
        "away_or_draw_under_2.5": pna_nb,
    }


def derive_combined_away_btts(matrix: np.ndarray) -> dict:
    pa_b, pa_nb, pna_b, pna_nb = _cross_product(
        matrix, lambda i, j: j > i, lambda i, j: i > 0 and j > 0
    )
    return {
        "away_btts_yes": pa_b,
        "away_btts_no": pa_nb,
        "not_away_btts_yes": pna_b,
        "not_away_btts_no": pna_nb,
    }


def derive_combined_draw_u25(matrix: np.ndarray) -> dict:
    pa_b, pa_nb, pna_b, pna_nb = _cross_product(
        matrix, lambda i, j: i == j, lambda i, j: i + j <= 2.5
    )
    return {
        "draw_under_2.5": pa_b,
        "draw_over_2.5": pa_nb,
        "not_draw_under_2.5": pna_b,
        "not_draw_over_2.5": pna_nb,
    }


def derive_combined_home_btts(matrix: np.ndarray) -> dict:
    pa_b, pa_nb, pna_b, pna_nb = _cross_product(
        matrix, lambda i, j: i > j, lambda i, j: i > 0 and j > 0
    )
    return {
        "home_btts_yes": pa_b,
        "home_btts_no": pa_nb,
        "not_home_btts_yes": pna_b,
        "not_home_btts_no": pna_nb,
    }


def derive_combined_dc_o25(matrix: np.ndarray) -> dict:
    pa_b, pa_nb, pna_b, pna_nb = _cross_product(
        matrix, lambda i, j: i >= j, lambda i, j: i + j > 2.5
    )
    return {
        "dc_home_or_draw_over_2.5": pa_b,
        "dc_home_or_draw_under_2.5": pa_nb,
        "dc_away_over_2.5": pna_b,
        "dc_away_under_2.5": pna_nb,
    }


def derive_combined_dc_u25(matrix: np.ndarray) -> dict:
    pa_b, pa_nb, pna_b, pna_nb = _cross_product(
        matrix, lambda i, j: j >= i, lambda i, j: i + j <= 2.5
    )
    return {
        "dc_draw_or_away_under_2.5": pa_b,
        "dc_draw_or_away_over_2.5": pa_nb,
        "dc_home_under_2.5": pna_b,
        "dc_home_over_2.5": pna_nb,
    }


def derive_combined_1x2_btts(matrix: np.ndarray) -> dict:
    home_yes, home_no, draw_yes, draw_no, away_yes, away_no = 0.0, 0.0, 0.0, 0.0, 0.0, 0.0
    for i in range(matrix.shape[0]):
        for j in range(matrix.shape[1]):
            both = i > 0 and j > 0
            p = matrix[i, j]
            if i > j:
                if both:
                    home_yes += p
                else:
                    home_no += p
            elif i == j:
                if both:
                    draw_yes += p
                else:
                    draw_no += p
            else:
                if both:
                    away_yes += p
                else:
                    away_no += p
    return {
        "home_yes": home_yes,
        "home_no": home_no,
        "draw_yes": draw_yes,
        "draw_no": draw_no,
        "away_yes": away_yes,
        "away_no": away_no,
    }


def derive_all_combined_markets(matrix: np.ndarray) -> dict:
    return {
        "home_o25": derive_combined_home_o25(matrix),
        "away_btts": derive_combined_away_btts(matrix),
        "draw_u25": derive_combined_draw_u25(matrix),
        "home_btts": derive_combined_home_btts(matrix),
        "dc_o25": derive_combined_dc_o25(matrix),
        "dc_u25": derive_combined_dc_u25(matrix),
        "1x2_btts": derive_combined_1x2_btts(matrix),
    }
