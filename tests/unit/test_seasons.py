from datetime import datetime

import pytest

from app.ingestion.seasons import current_season_start


@pytest.mark.parametrize(("month", "expected"), [
    (1, 2025),
    (7, 2025),
    (8, 2026),
    (9, 2026),
    (12, 2026),
])
def test_current_season_start(month, expected):
    assert current_season_start(datetime(2026, month, 15)) == expected
