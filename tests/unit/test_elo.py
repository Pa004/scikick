from app.features.elo import EloSystem


def test_elo_initial_rating():
    elo = EloSystem()
    assert elo.get(1) == 1500.0


def test_elo_expected():
    elo = EloSystem()
    exp = elo.expected(1, 2)
    assert 0.4 < exp < 0.6


def test_elo_update_home_win():
    elo = EloSystem()
    elo.update(1, 2, 2, 0)
    assert elo.get(1) > 1500.0
    assert elo.get(2) < 1500.0


def test_elo_update_away_win():
    elo = EloSystem()
    elo.update(1, 2, 0, 2)
    assert elo.get(1) < 1500.0
    assert elo.get(2) > 1500.0


def test_elo_draw():
    elo = EloSystem()
    elo.update(1, 2, 1, 1)
    assert abs(elo.get(1) - 1500.0) < 5
    assert abs(elo.get(2) - 1500.0) < 5


def test_elo_set():
    elo = EloSystem()
    elo.set(1, 1800.0)
    assert elo.get(1) == 1800.0
