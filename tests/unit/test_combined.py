import numpy as np

from app.models.dixon_coles import DixonColesParams, score_matrix
from app.models.combined import (
    derive_combined_home_o25,
    derive_combined_away_btts,
    derive_combined_draw_u25,
    derive_combined_home_btts,
    derive_combined_dc_o25,
    derive_combined_dc_u25,
    derive_combined_1x2_btts,
    derive_all_combined_markets,
)


def _get_matrix() -> np.ndarray:
    params = DixonColesParams(0.1, -0.1, 0.05, -0.05, 0.3, -0.1)
    return score_matrix(params, max_goals=10)


def test_home_o25():
    result = derive_combined_home_o25(_get_matrix())
    assert result["home_over_2.5"] > 0
    assert result["home_under_2.5"] > 0
    assert abs(sum(result.values()) - 1.0) < 0.01


def test_away_btts():
    result = derive_combined_away_btts(_get_matrix())
    assert result["away_btts_yes"] >= 0
    assert result["away_btts_no"] >= 0
    assert abs(sum(result.values()) - 1.0) < 0.01


def test_draw_u25():
    result = derive_combined_draw_u25(_get_matrix())
    assert result["draw_under_2.5"] > 0
    assert abs(sum(result.values()) - 1.0) < 0.01


def test_home_btts():
    result = derive_combined_home_btts(_get_matrix())
    assert result["home_btts_yes"] >= 0
    assert result["home_btts_no"] >= 0
    assert abs(sum(result.values()) - 1.0) < 0.01


def test_dc_o25():
    result = derive_combined_dc_o25(_get_matrix())
    assert result["dc_home_or_draw_over_2.5"] >= 0
    assert result["dc_home_or_draw_under_2.5"] >= 0
    assert abs(sum(result.values()) - 1.0) < 0.01


def test_dc_u25():
    result = derive_combined_dc_u25(_get_matrix())
    assert result["dc_draw_or_away_under_2.5"] >= 0
    assert result["dc_draw_or_away_over_2.5"] >= 0
    assert abs(sum(result.values()) - 1.0) < 0.01


def test_1x2_btts():
    result = derive_combined_1x2_btts(_get_matrix())
    assert result["home_yes"] >= 0
    assert result["home_no"] >= 0
    assert result["draw_yes"] >= 0
    assert result["draw_no"] >= 0
    assert result["away_yes"] >= 0
    assert result["away_no"] >= 0
    assert abs(sum(result.values()) - 1.0) < 0.01


def test_all_combined_markets():
    result = derive_all_combined_markets(_get_matrix())
    assert "home_o25" in result
    assert "away_btts" in result
    assert "draw_u25" in result
    assert "home_btts" in result
    assert "dc_o25" in result
    assert "dc_u25" in result
    assert "1x2_btts" in result
    assert len(result) == 7
