import numpy as np

from app.models.poisson_counts import (
    poisson_pmf,
    poisson_pmf_array,
    fit_poisson_rate,
    predict_count_distribution,
    derive_count_over_under,
    derive_count_total,
    derive_count_handicap,
    derive_all_count_markets,
)


def test_poisson_pmf():
    assert abs(poisson_pmf(0, 3.0) - np.exp(-3.0)) < 1e-10
    assert poisson_pmf(0, 0.0) == 1.0


def test_poisson_pmf_array():
    arr = poisson_pmf_array(5, 2.0)
    assert len(arr) == 6
    assert abs(sum(arr) - 1.0) < 0.02


def test_fit_poisson_rate():
    counts = np.array([5, 7, 8, 6, 9])
    assert abs(fit_poisson_rate(counts) - 7.0) < 1e-10


def test_fit_poisson_rate_empty():
    assert fit_poisson_rate(np.array([])) == 0.0


def test_predict_distribution_sums_to_one():
    matrix = predict_count_distribution(5.0, 4.0, max_count=15)
    assert abs(matrix.sum() - 1.0) < 0.001


def test_predict_distribution_shape():
    matrix = predict_count_distribution(3.0, 3.0, max_count=10)
    assert matrix.shape == (11, 11)


def test_count_over_under():
    matrix = predict_count_distribution(6.0, 5.0, max_count=15)
    ou = derive_count_over_under(matrix, 10.5)
    assert abs(ou["over"] + ou["under"] - 1.0) < 0.001


def test_count_total():
    matrix = predict_count_distribution(4.0, 4.0, max_count=15)
    total = derive_count_total(matrix)
    assert abs(sum(total.values()) - 1.0) < 0.01


def test_count_handicap():
    matrix = predict_count_distribution(6.0, 4.0, max_count=15)
    hc = derive_count_handicap(matrix, -2)
    assert abs(sum(hc.values()) - 1.0) < 0.01


def test_derive_all_count_markets():
    matrix = predict_count_distribution(5.0, 4.0, max_count=15)
    markets = derive_all_count_markets(matrix, prefix="corners")
    assert "corners_over_under_9.5" in markets
    assert "corners_total" in markets
    assert len(markets) == 9


def test_derive_all_cards():
    matrix = predict_count_distribution(2.0, 2.5, max_count=10)
    markets = derive_all_count_markets(matrix, prefix="cards")
    assert "cards_over_under_8.5" in markets
    assert "cards_total" in markets
    assert len(markets) == 9
