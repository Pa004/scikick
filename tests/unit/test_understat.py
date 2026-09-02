import json

import pytest

from app.ingestion.adapters.understat import (
    _extract_json,
    fetch_match_xg,
    fetch_team_xg_history,
    fetch_league_xg,
)


def test_extract_json():
    html = 'var shotsData = JSON.parse(\'{"key": "value"}\');'
    result = _extract_json(html, "shotsData")
    assert result == {"key": "value"}


def test_extract_json_not_found():
    html = "var otherData = 123;"
    result = _extract_json(html, "shotsData")
    assert result is None


@pytest.mark.slow
def test_fetch_match_xg_real():
    result = fetch_match_xg(1)
    if result:
        assert "home_xg" in result
        assert "away_xg" in result
        assert result["home_xg"] >= 0
