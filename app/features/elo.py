from __future__ import annotations

import math
from collections import defaultdict

_DEFAULT_K = 32
_DEFAULT_HOME_ADV = 65
_DEFAULT_BASE = 1500


class EloSystem:
    def __init__(
        self,
        k: float = _DEFAULT_K,
        home_advantage: float = _DEFAULT_HOME_ADV,
        base: float = _DEFAULT_BASE,
    ):
        self.k = k
        self.home_advantage = home_advantage
        self.base = base
        self.ratings: dict[int, float] = defaultdict(lambda: self.base)

    def expected(self, home_id: int, away_id: int) -> float:
        r_home = self.ratings[home_id] + self.home_advantage
        r_away = self.ratings[away_id]
        return 1.0 / (1.0 + 10 ** ((r_away - r_home) / 400))

    def update(self, home_id: int, away_id: int, home_goals: int, away_goals: int) -> None:
        expected = self.expected(home_id, away_id)
        if home_goals > away_goals:
            actual = 1.0
        elif home_goals == away_goals:
            actual = 0.5
        else:
            actual = 0.0

        margin = math.log(max(abs(home_goals - away_goals), 1) + 1) * 2.2 / (
            (self.ratings[home_id] - self.ratings[away_id]) * 0.001 + 2.2
        )
        adjustment = self.k * margin * (actual - expected)
        self.ratings[home_id] += adjustment
        self.ratings[away_id] -= adjustment

    def get(self, team_id: int) -> float:
        return self.ratings[team_id]

    def set(self, team_id: int, rating: float) -> None:
        self.ratings[team_id] = rating
