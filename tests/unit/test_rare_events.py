import pytest
from app.models.rare_events import fit_rare_events, predict_rare_events, RareEventParams


def test_fit_rare_events_returns_params():
    params = fit_rare_events("E0")
    assert isinstance(params, RareEventParams)
    assert 0 < params.penalty_rate < 1
    assert 0 < params.own_goal_rate < 1


def test_fit_rare_events_fallback():
    params = fit_rare_events("UNKNOWN_LEAGUE")
    assert params.penalty_rate == 0.22
    assert params.own_goal_rate == 0.06


def test_predict_rare_events_keys():
    params = fit_rare_events("E0")
    result = predict_rare_events(params)
    assert "penalty" in result
    assert "own_goal" in result
    assert result["data_quality"] == "constant_league"


def test_predict_rare_events_probabilities():
    params = fit_rare_events("SP1")
    result = predict_rare_events(params)
    assert abs(result["penalty"]["yes"] + result["penalty"]["no"] - 1.0) < 1e-6
    assert abs(result["own_goal"]["yes"] + result["own_goal"]["no"] - 1.0) < 1e-6
