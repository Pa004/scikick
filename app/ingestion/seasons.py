from __future__ import annotations

from datetime import datetime

# European league seasons start in August: from August on, the current
# season started this year; before that it started last year.
SEASON_START_MONTH = 8


def current_season_start(now: datetime | None = None) -> int:
    today = now or datetime.now()
    if today.month >= SEASON_START_MONTH:
        return today.year
    return today.year - 1
