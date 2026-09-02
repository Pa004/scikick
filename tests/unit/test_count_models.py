from __future__ import annotations

import math
import sqlite3
from pathlib import Path
from datetime import timedelta, date

import numpy as np
import pytest

from app.db.migrations import run_migrations
from app.models.count_models import (
    CountParams,
    fit_count_poisson,
    predict_count_rates,
    count_matrix,
    derive_count_over_under,
    derive_count_total,
    derive_count_handicap,
    derive_all_count_markets,
)


def _make_params() -> CountParams:
    return CountParams(
        team_attack={1: 1.5, 2: 0.8, 3: 1.2},
        team_defense={1: -0.2, 2: 0.1, 3: -0.1},
        home_advantage=0.15,
        global_avg=7.5,
    )


def test_count_matrix_sums_to_one():
    matrix = count_matrix(5.0, 4.0, max_count=15)
    assert abs(matrix.sum() - 1.0) < 1e-6


def test_count_matrix_shape():
    matrix = count_matrix(5.0, 4.0, max_count=15)
    assert matrix.shape == (16, 16)


def test_count_matrix_peak():
    matrix = count_matrix(8.0, 3.0, max_count=15)
    total = np.array([i + j for i in range(16) for j in range(16)])
    probs = matrix.flatten()
    peak = total[np.argmax(probs)]
    assert 8 <= peak <= 14


def test_predict_count_rates():
    params = _make_params()
    home_rate, away_rate = predict_count_rates(params, 1, 2)
    assert home_rate > 0
    assert away_rate > 0
    assert home_rate != away_rate


def test_predict_count_rates_unknown_team():
    params = _make_params()
    home_rate, away_rate = predict_count_rates(params, 99, 100)
    assert home_rate > 0
    assert away_rate > 0


def test_derive_count_over_under():
    matrix = count_matrix(8.0, 4.0, max_count=15)
    result = derive_count_over_under(matrix, 9.5)
    assert "over" in result
    assert "under" in result
    assert abs(result["over"] + result["under"] - 1.0) < 1e-6
    assert result["over"] > 0.3


def test_derive_count_total():
    matrix = count_matrix(6.0, 4.0, max_count=15)
    result = derive_count_total(matrix)
    assert "0" in result
    assert "16+" in result
    total = sum(result.values())
    assert abs(total - 1.0) < 1e-6


def test_derive_count_handicap():
    matrix = count_matrix(8.0, 4.0, max_count=15)
    result = derive_count_handicap(matrix, -2)
    assert "home" in result
    assert "draw" in result
    assert "away" in result
    total = result["home"] + result["draw"] + result["away"]
    assert abs(total - 1.0) < 1e-6


def test_derive_all_count_markets():
    matrix = count_matrix(7.0, 5.0, max_count=15)
    markets = derive_all_count_markets(matrix, prefix="corners")
    assert "corners_over_under_8.5" in markets
    assert "corners_over_under_9.5" in markets
    assert "corners_over_under_10.5" in markets
    assert "corners_over_under_11.5" in markets
    assert "corners_total" in markets
    assert "corners_handicap_-2" in markets
    assert "corners_handicap_-1" in markets
    assert "corners_handicap_+1" in markets
    assert "corners_handicap_+2" in markets


def test_fit_count_poisson():
    rng = np.random.RandomState(42)
    n = 100
    home_ids = rng.randint(1, 6, n)
    away_ids = rng.randint(1, 6, n)
    home_counts = rng.poisson(7, n).astype(float)
    away_counts = rng.poisson(5, n).astype(float)

    team_map = {i: i - 1 for i in range(1, 6)}
    params = fit_count_poisson(home_ids, away_ids, home_counts, away_counts, 5, team_map)

    assert len(params.team_attack) == 5
    assert len(params.team_defense) == 5
    assert params.global_avg > 0

    home_rate, away_rate = predict_count_rates(params, 1, 2)
    assert home_rate > 0
    assert away_rate > 0


def test_fit_count_poisson_converges():
    rng = np.random.RandomState(123)
    n = 200
    home_ids = rng.randint(1, 4, n)
    away_ids = rng.randint(1, 4, n)

    home_lambdas = np.array([6.0, 8.0, 5.0])
    away_lambdas = np.array([5.0, 4.0, 6.0])
    home_counts = np.array([rng.poisson(home_lambdas[h - 1]) for h in home_ids], dtype=float)
    away_counts = np.array([rng.poisson(away_lambdas[a - 1]) for a in away_ids], dtype=float)

    team_map = {1: 0, 2: 1, 3: 2}
    params = fit_count_poisson(home_ids, away_ids, home_counts, away_counts, 3, team_map)

    rate1_h, _ = predict_count_rates(params, 1, 1)
    assert 3.0 < rate1_h < 12.0
