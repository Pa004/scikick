from __future__ import annotations

from dataclasses import dataclass


_PENALTY_PER_MATCH = {
    "E0": 0.22,
    "SP1": 0.24,
    "D1": 0.20,
    "I1": 0.23,
    "F1": 0.21,
}

_OWN_GOAL_PER_MATCH = {
    "E0": 0.06,
    "SP1": 0.05,
    "D1": 0.07,
    "I1": 0.05,
    "F1": 0.06,
}


@dataclass(frozen=True)
class RareEventParams:
    penalty_rate: float
    own_goal_rate: float


def fit_rare_events(league: str) -> RareEventParams:
    return RareEventParams(
        penalty_rate=_PENALTY_PER_MATCH.get(league, 0.22),
        own_goal_rate=_OWN_GOAL_PER_MATCH.get(league, 0.06),
    )


def predict_rare_events(params: RareEventParams) -> dict:
    return {
        "penalty": {
            "yes": round(params.penalty_rate, 4),
            "no": round(1 - params.penalty_rate, 4),
        },
        "own_goal": {
            "yes": round(params.own_goal_rate, 4),
            "no": round(1 - params.own_goal_rate, 4),
        },
        "data_quality": "constant_league",
        "note": "Rates are league averages; no per-team granularity (source lacks data).",
    }
