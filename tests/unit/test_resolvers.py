from __future__ import annotations

import pytest

from app.models.resolvers import resolve_market

# Fake fixture row: only [] access is used.
FIXTURE_2_1 = {
    "home_corners": 6, "away_corners": 4,
    "home_yellow": 2, "away_yellow": 1,
}
FIXTURE_1_1 = {
    "home_corners": 5, "away_corners": 5,
    "home_yellow": 1, "away_yellow": 1,
}


@pytest.mark.parametrize(
    "market,pred,hs,aw,expected",
    [
        ("1x2", {"home": 0.5, "draw": 0.3, "away": 0.2}, 2, 1, ("home", 0.5, "home")),
        ("1x2", {"home": 0.2, "draw": 0.3, "away": 0.5}, 1, 1, ("away", 0.5, "draw")),
        ("over_under_2.5", {"over": 0.6, "under": 0.4}, 2, 1, ("over", 0.6, "over")),
        ("over_under_2.5", {"over": 0.6, "under": 0.4}, 1, 0, ("over", 0.6, "under")),
        ("btts", {"yes": 0.6, "no": 0.4}, 2, 1, ("yes", 0.6, "yes")),
        ("btts", {"yes": 0.6, "no": 0.4}, 2, 0, ("yes", 0.6, "no")),
        ("double_chance", {"home_or_draw": 0.7, "x": 0.1}, 0, 2, ("home_or_draw", 0.7, "draw_or_away")),
        ("draw_no_bet", {"home": 0.6, "away": 0.4}, 1, 1, None),
        ("draw_no_bet", {"home": 0.6, "away": 0.4}, 2, 1, ("home", 0.6, "home")),
        ("handicap_-1", {"home": 0.5, "away": 0.5}, 2, 1, ("home", 0.5, "draw")),
        ("handicap_-1", {"home": 0.5, "away": 0.5}, 1, 1, ("home", 0.5, "away")),
        ("ht_1x2", {"home": 0.5, "draw": 0.3, "away": 0.2}, 2, 1, ("home", 0.5, "home")),
        ("ht_over_under_1.5", {"over": 0.4, "under": 0.6}, 2, 1, ("under", 0.6, "under")),
        ("both_halves", {"team_wins_both_halves": 0.3}, 2, 1, ("team_wins_both_halves", 0.3, "team_wins_both_halves")),
        ("corners_over_under_9.5", {"over": 0.7, "under": 0.3}, 2, 1, ("over", 0.7, "over")),
        ("corners_handicap_-1", {"home": 0.6, "away": 0.4}, 2, 1, ("home", 0.6, "home")),
        ("corners_total", {"8": 0.2, "10": 0.5}, 2, 1, ("10", 0.5, "10")),
        ("unknown_market", {"a": 1.0}, 2, 1, None),
        ("1x2", {}, 2, 1, None),
    ],
)
def test_resolve_market_cases(market, pred, hs, aw, expected):
    fixture = FIXTURE_2_1 if (hs, aw) == (2, 1) else FIXTURE_1_1
    assert resolve_market(market, pred, hs, aw, 1, 0, fixture) == expected


@pytest.mark.parametrize(
    "market,pred,hs,aw,expected",
    [
        # Real outcome keys, not pick-echoes: these must be able to miss.
        ("home_o25", {"home_over_2.5": 0.6, "home_under_2.5": 0.4}, 3, 0,
         ("home_over_2.5", 0.6, "home_over_2.5")),
        ("home_o25", {"home_over_2.5": 0.6, "home_under_2.5": 0.4}, 1, 0,
         ("home_over_2.5", 0.6, "home_under_2.5")),
        ("away_btts", {"away_btts_yes": 0.5, "away_btts_no": 0.5}, 1, 2,
         ("away_btts_yes", 0.5, "away_btts_yes")),
        ("draw_u25", {"draw_under_2.5": 0.5, "x": 0.1}, 1, 1,
         ("draw_under_2.5", 0.5, "draw_under_2.5")),
        ("dc_o25", {"dc_home_or_draw_over_2.5": 0.5, "dc_away_over_2.5": 0.2}, 0, 3,
         ("dc_home_or_draw_over_2.5", 0.5, "dc_away_over_2.5")),
        ("dc_u25", {"dc_home_under_2.5": 0.5, "x": 0.1}, 1, 0,
         ("dc_home_under_2.5", 0.5, "dc_home_under_2.5")),
        ("1x2_btts", {"home_yes": 0.5, "home_no": 0.4, "draw_no": 0.1}, 2, 1,
         ("home_yes", 0.5, "home_yes")),
        ("1x2_btts", {"home_yes": 0.5, "home_no": 0.4, "draw_no": 0.1}, 0, 0,
         ("home_yes", 0.5, "draw_no")),
        ("home_btts", {"home_btts_yes": 0.6, "home_btts_no": 0.1}, 2, 0,
         ("home_btts_yes", 0.6, "home_btts_no")),
        ("dc_o25", {"x": 0.1}, 0, 3, None),
    ],
)
def test_resolve_combined_markets_use_real_outcomes(market, pred, hs, aw, expected):
    fixture = FIXTURE_2_1 if (hs, aw) == (2, 1) else FIXTURE_1_1
    got = resolve_market(market, pred, hs, aw, 1, 0, fixture)
    assert got == expected
