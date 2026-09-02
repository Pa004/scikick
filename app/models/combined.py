from __future__ import annotations

import numpy as np

from app.models.dixon_coles import probabilities_from_matrix


def derive_combined_home_o25(matrix: np.ndarray) -> dict:
    home_o25 = 0.0
    home_u25 = 0.0
    not_home_o25 = 0.0
    not_home_u25 = 0.0
    for i in range(matrix.shape[0]):
        for j in range(matrix.shape[1]):
            total = i + j
            is_home = i > j
            if is_home and total > 2.5:
                home_o25 += matrix[i, j]
            elif is_home and total <= 2.5:
                home_u25 += matrix[i, j]
            elif not is_home and total > 2.5:
                not_home_o25 += matrix[i, j]
            else:
                not_home_u25 += matrix[i, j]
    return {
        "home_over_2.5": home_o25,
        "home_under_2.5": home_u25,
        "away_or_draw_over_2.5": not_home_o25,
        "away_or_draw_under_2.5": not_home_u25,
    }


def derive_combined_away_btts(matrix: np.ndarray) -> dict:
    away_btts_yes = 0.0
    away_btts_no = 0.0
    not_away_btts_yes = 0.0
    not_away_btts_no = 0.0
    for i in range(matrix.shape[0]):
        for j in range(matrix.shape[1]):
            is_away = j > i
            both_score = i > 0 and j > 0
            if is_away and both_score:
                away_btts_yes += matrix[i, j]
            elif is_away and not both_score:
                away_btts_no += matrix[i, j]
            elif not is_away and both_score:
                not_away_btts_yes += matrix[i, j]
            else:
                not_away_btts_no += matrix[i, j]
    return {
        "away_btts_yes": away_btts_yes,
        "away_btts_no": away_btts_no,
        "not_away_btts_yes": not_away_btts_yes,
        "not_away_btts_no": not_away_btts_no,
    }


def derive_combined_draw_u25(matrix: np.ndarray) -> dict:
    draw_u25 = 0.0
    draw_o25 = 0.0
    not_draw_u25 = 0.0
    not_draw_o25 = 0.0
    for i in range(matrix.shape[0]):
        for j in range(matrix.shape[1]):
            total = i + j
            is_draw = i == j
            if is_draw and total <= 2.5:
                draw_u25 += matrix[i, j]
            elif is_draw and total > 2.5:
                draw_o25 += matrix[i, j]
            elif not is_draw and total <= 2.5:
                not_draw_u25 += matrix[i, j]
            else:
                not_draw_o25 += matrix[i, j]
    return {
        "draw_under_2.5": draw_u25,
        "draw_over_2.5": draw_o25,
        "not_draw_under_2.5": not_draw_u25,
        "not_draw_over_2.5": not_draw_o25,
    }


def derive_all_combined_markets(matrix: np.ndarray) -> dict:
    return {
        "home_o25": derive_combined_home_o25(matrix),
        "away_btts": derive_combined_away_btts(matrix),
        "draw_u25": derive_combined_draw_u25(matrix),
    }
