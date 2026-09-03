from __future__ import annotations

import math
from dataclasses import dataclass


@dataclass
class ScorerPlayer:
    player_id: int
    name: str
    team_name: str
    position: str
    xg90: float
    npxg90: float
    minutes_total: int
    games: int
    home_away: str
    min_expected: float
    opponent_xga: float | None
    source: str


@dataclass
class ScorerProb:
    player_id: int
    name: str
    team_name: str
    position: str
    xg90: float
    min_expected: float
    prob_anytime: float
    home_away: str


_SHRINK_K = 900.0

_POSITION_MEANS: dict[str, float] = {
    "F": 0.35,
    "F S": 0.35,
    "F W": 0.30,
    "M S": 0.15,
    "M C": 0.12,
    "D S": 0.05,
    "D C": 0.04,
}


def _position_group(position: str | None) -> str:
    if not position:
        return "F"
    pos_upper = position.upper().strip()
    if pos_upper.startswith("F"):
        return "F"
    if pos_upper.startswith("M"):
        return "M"
    if pos_upper.startswith("D"):
        return "D"
    return "F"


def _position_mean(position: str | None) -> float:
    group = _position_group(position)
    return _POSITION_MEANS.get(group, 0.15)


def shrink_xg90(player_xg90: float, minutes: int, position: str | None) -> float:
    mean = _position_mean(position)
    weight = minutes / (minutes + _SHRINK_K)
    return mean + weight * (player_xg90 - mean)


def expected_goals(xg90: float, min_expected: float) -> float:
    return xg90 * min_expected / 90.0


def p_anytime(lambda_goals: float) -> float:
    if lambda_goals <= 0:
        return 0.0
    return 1.0 - math.exp(-lambda_goals)


def rank_scorers(players: list[ScorerPlayer], min_minutes: int = 450) -> list[ScorerProb]:
    scored = []
    for p in players:
        if p.minutes_total < min_minutes:
            continue
        adj_xg90 = shrink_xg90(p.xg90, p.minutes_total, p.position)
        lam = expected_goals(adj_xg90, p.min_expected)
        prob = p_anytime(lam)
        scored.append(ScorerProb(
            player_id=p.player_id,
            name=p.name,
            team_name=p.team_name,
            position=p.position or "F",
            xg90=adj_xg90,
            min_expected=p.min_expected,
            prob_anytime=prob,
            home_away=p.home_away,
        ))
    scored.sort(key=lambda s: s.prob_anytime, reverse=True)
    return scored
