from __future__ import annotations

import sqlite3
from collections.abc import Callable


class MatchResult:
    """Resolved score facts shared by every market resolver."""

    def __init__(
        self,
        hs: int,
        aw: int,
        ht_hs: int | None,
        ht_aw: int | None,
        fixture: sqlite3.Row,
    ) -> None:
        self.hs = hs
        self.aw = aw
        self.ht_hs = ht_hs
        self.ht_aw = ht_aw
        self.fixture = fixture
        self.total_goals = hs + aw
        self.result_1x2 = "home" if hs > aw else ("away" if aw > hs else "draw")
        self.both_scored = hs > 0 and aw > 0


Resolver = Callable[[dict, MatchResult], tuple[str, float, str] | None]


def _top(pred_data: dict) -> tuple[str, float] | None:
    if not pred_data:
        return None
    pick = max(pred_data, key=pred_data.get)
    return pick, pred_data[pick]


def _resolve_1x2(pred_data: dict, ctx: MatchResult) -> tuple[str, float, str] | None:
    top = _top(pred_data)
    if top is None:
        return None
    pick, conf = top
    return pick, conf, ctx.result_1x2


def _resolve_over_under(pred_data: dict, ctx: MatchResult, line: float, total: int) -> tuple[str, float, str] | None:
    top = _top(pred_data)
    if top is None:
        return None
    pick, conf = top
    return pick, conf, "over" if total > line else "under"


def resolve_over_under(pred_data: dict, ctx: MatchResult, line: float) -> tuple[str, float, str] | None:
    return _resolve_over_under(pred_data, ctx, line, ctx.total_goals)


def _resolve_handicap(
    pred_data: dict, ctx: MatchResult, handicap: float, home_score: int, away_score: int
) -> tuple[str, float, str] | None:
    top = _top(pred_data)
    if top is None:
        return None
    pick, conf = top
    adjusted = home_score + handicap
    outcome = "home" if adjusted > away_score else ("away" if adjusted < away_score else "draw")
    return pick, conf, outcome


def resolve_btts(pred_data: dict, ctx: MatchResult) -> tuple[str, float, str] | None:
    top = _top(pred_data)
    if top is None:
        return None
    pick, conf = top
    return pick, conf, "yes" if ctx.both_scored else "no"


def resolve_double_chance(pred_data: dict, ctx: MatchResult) -> tuple[str, float, str] | None:
    top = _top(pred_data)
    if top is None:
        return None
    pick, conf = top
    outcome = "home_or_draw" if ctx.result_1x2 in ("home", "draw") else "draw_or_away"
    return pick, conf, outcome


def resolve_draw_no_bet(pred_data: dict, ctx: MatchResult) -> tuple[str, float, str] | None:
    if ctx.result_1x2 == "draw":
        return None
    top = _top(pred_data)
    if top is None:
        return None
    pick, conf = top
    return pick, conf, ctx.result_1x2


def resolve_clean_sheet(pred_data: dict, ctx: MatchResult) -> tuple[str, float, str] | None:
    top = _top(pred_data)
    if top is None:
        return None
    pick, conf = top
    if pick in ("home_yes", "home_no"):
        outcome = "home_yes" if ctx.aw == 0 else "home_no"
    else:
        outcome = "away_yes" if ctx.hs == 0 else "away_no"
    return pick, conf, outcome


def resolve_win_to_nil(pred_data: dict, ctx: MatchResult) -> tuple[str, float, str] | None:
    top = _top(pred_data)
    if top is None:
        return None
    pick, conf = top
    if pick == "home":
        outcome = "home" if ctx.hs > ctx.aw and ctx.aw == 0 else "none"
    else:
        outcome = "away" if ctx.aw > ctx.hs and ctx.hs == 0 else "none"
    return pick, conf, outcome


def resolve_asian_handicap(pred_data: dict, ctx: MatchResult, handicap: float) -> tuple[str, float, str] | None:
    top = _top(pred_data)
    if top is None:
        return None
    pick, conf = top
    adjusted = ctx.hs - ctx.aw - handicap
    if adjusted > 0:
        outcome = "home"
    elif adjusted < 0:
        outcome = "away"
    else:
        outcome = "push"
    return pick, conf, outcome


def _ht_result(ctx: MatchResult) -> str | None:
    if ctx.ht_hs is None or ctx.ht_aw is None:
        return None
    if ctx.ht_hs > ctx.ht_aw:
        return "home"
    if ctx.ht_aw > ctx.ht_hs:
        return "away"
    return "draw"


def resolve_ht_1x2(pred_data: dict, ctx: MatchResult) -> tuple[str, float, str] | None:
    ht = _ht_result(ctx)
    if ht is None:
        return None
    top = _top(pred_data)
    if top is None:
        return None
    pick, conf = top
    return pick, conf, ht


def resolve_ht_double_chance(pred_data: dict, ctx: MatchResult) -> tuple[str, float, str] | None:
    ht = _ht_result(ctx)
    if ht is None:
        return None
    top = _top(pred_data)
    if top is None:
        return None
    pick, conf = top
    outcome = "home_or_draw" if ht in ("home", "draw") else "draw_or_away"
    return pick, conf, outcome


def resolve_both_halves(pred_data: dict, ctx: MatchResult) -> tuple[str, float, str] | None:
    ht = _ht_result(ctx)
    if ht is None:
        return None
    ft_result = ctx.result_1x2
    outcomes = {
        "team_wins_both_halves": ht == ft_result and ft_result != "draw",
        "team_wins_either_half": ht != "draw" or ft_result != "draw",
        "draw_both_halves": ht == "draw" and ft_result == "draw",
        "both_teams_score_both_halves": (ctx.ht_hs or 0) > 0 and (ctx.ht_aw or 0) > 0 and ctx.both_scored,
        "ht_over_0.5_ft_over_0.5": (ctx.ht_hs or 0) + (ctx.ht_aw or 0) > 0.5 and ctx.total_goals > 0.5,
        "ht_over_1.5_ft_over_1.5": (ctx.ht_hs or 0) + (ctx.ht_aw or 0) > 1.5 and ctx.total_goals > 1.5,
        "ht_over_2.5_ft_over_2.5": (ctx.ht_hs or 0) + (ctx.ht_aw or 0) > 2.5 and ctx.total_goals > 2.5,
    }
    top = _top(pred_data)
    if top is None:
        return None
    pick, conf = top
    return pick, conf, pick if outcomes.get(pick) else "none"


def _counted(ctx: MatchResult, prefix: str) -> tuple[int, int, int]:
    col = "home_corners" if prefix == "corners" else "home_yellow"
    col_a = "away_corners" if prefix == "corners" else "away_yellow"
    real_home = ctx.fixture[col] or 0
    real_away = ctx.fixture[col_a] or 0
    return real_home + real_away, real_home, real_away


def resolve_count_over_under(
    market: str, pred_data: dict, ctx: MatchResult, prefix: str
) -> tuple[str, float, str] | None:
    line = float(market.split("_")[-1])
    real_total, _, _ = _counted(ctx, prefix)
    return _resolve_over_under(pred_data, ctx, line, real_total)


def resolve_count_handicap(
    market: str, pred_data: dict, ctx: MatchResult, prefix: str
) -> tuple[str, float, str] | None:
    handicap = int(market.split("_")[2])
    _, real_home, real_away = _counted(ctx, prefix)
    return _resolve_handicap(pred_data, ctx, handicap, real_home, real_away)


def resolve_count_total(
    pred_data: dict, ctx: MatchResult, prefix: str
) -> tuple[str, float, str] | None:
    top = _top(pred_data)
    if top is None:
        return None
    pick, conf = top
    real_total, _, _ = _counted(ctx, prefix)
    return pick, conf, str(real_total)


def _combined_outcome(market: str, ctx: MatchResult) -> str | None:
    """Real outcome key for combined markets (mirrors combined.py key space)."""
    hs, aw, total = ctx.hs, ctx.aw, ctx.total_goals
    btts = "yes" if ctx.both_scored else "no"
    over = "over_2.5" if total > 2.5 else "under_2.5"
    if market == "home_o25":
        return f"{'home' if hs > aw else 'away_or_draw'}_{over}"
    if market == "away_btts":
        return f"{'away_btts' if aw > hs else 'not_away_btts'}_{btts}"
    if market == "draw_u25":
        under = "under_2.5" if total <= 2.5 else "over_2.5"
        return f"{'draw' if hs == aw else 'not_draw'}_{under}"
    if market == "home_btts":
        return f"{'home_btts' if hs > aw else 'not_home_btts'}_{btts}"
    if market == "dc_o25":
        return f"{'dc_home_or_draw' if hs >= aw else 'dc_away'}_{over}"
    if market == "dc_u25":
        under = "under_2.5" if total <= 2.5 else "over_2.5"
        return f"{'dc_draw_or_away' if aw >= hs else 'dc_home'}_{under}"
    if market == "1x2_btts":
        return f"{ctx.result_1x2}_{btts}"
    return None


def resolve_combined(
    market: str, pred_data: dict, ctx: MatchResult
) -> tuple[str, float, str] | None:
    top = _top(pred_data)
    if top is None:
        return None
    pick, conf = top
    outcome = _combined_outcome(market, ctx)
    if outcome is None or outcome not in pred_data:
        return None
    return pick, conf, outcome


MARKET_RESOLVERS: dict[str, Callable[..., tuple[str, float, str] | None]] = {
    "1x2": lambda pd, ctx: _resolve_1x2(pd, ctx),
    "btts": resolve_btts,
    "double_chance": resolve_double_chance,
    "draw_no_bet": resolve_draw_no_bet,
    "clean_sheet": resolve_clean_sheet,
    "win_to_nil": resolve_win_to_nil,
    "ht_1x2": resolve_ht_1x2,
    "ht_double_chance": resolve_ht_double_chance,
    "both_halves": resolve_both_halves,
}


def resolve_market(
    market: str,
    pred_data: dict,
    hs: int,
    aw: int,
    ht_hs: int | None,
    ht_aw: int | None,
    fixture: sqlite3.Row,
) -> tuple[str, float, str] | None:
    """Dispatch to the per-market resolver. Unknown markets resolve to None."""
    ctx = MatchResult(hs, aw, ht_hs, ht_aw, fixture)
    if market in MARKET_RESOLVERS:
        return MARKET_RESOLVERS[market](pred_data, ctx)
    if market.startswith("over_under_"):
        return resolve_over_under(pred_data, ctx, float(market.split("_")[-1]))
    if market.startswith("handicap_"):
        return _resolve_handicap(
            pred_data, ctx, int(market.split("_")[1]), hs, aw
        )
    if market.startswith("asian_handicap_"):
        return resolve_asian_handicap(pred_data, ctx, float(market.split("_")[-1]))
    if market.startswith("ht_over_under_"):
        if ctx.ht_hs is None or ctx.ht_aw is None:
            return None
        return _resolve_over_under(
            pred_data, ctx, float(market.split("_")[-1]), ctx.ht_hs + ctx.ht_aw
        )
    if market.startswith("corners_") or market.startswith("cards_"):
        prefix = "corners" if market.startswith("corners") else "cards"
        if "over_under_" in market:
            return resolve_count_over_under(market, pred_data, ctx, prefix)
        if "_handicap_" in market:
            return resolve_count_handicap(market, pred_data, ctx, prefix)
        if "_total" in market:
            return resolve_count_total(pred_data, ctx, prefix)
        return None
    if market in ("home_o25", "away_btts", "draw_u25", "home_btts", "dc_o25", "dc_u25", "1x2_btts"):
        return resolve_combined(market, pred_data, ctx)
    return None
