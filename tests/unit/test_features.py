import sqlite3
from pathlib import Path

from app.db.migrations import run_migrations
from app.features.build_features import build_features, persist_features


def _setup_db(tmp_path: Path) -> sqlite3.Connection:
    db_path = str(tmp_path / "test.db")
    run_migrations(db_path)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row

    conn.execute(
        "INSERT INTO leagues (id, name, country, tier, source_csv_code, "
        "has_odds, has_xg, season_start_month, min_seasons) "
        "VALUES ('E0', 'Premier League', 'England', 1, 'E0', 1, 0, 8, 2)"
    )
    conn.execute("INSERT INTO teams (id, canonical_name) VALUES (1, 'Arsenal')")
    conn.execute("INSERT INTO teams (id, canonical_name) VALUES (2, 'Chelsea')")
    conn.execute("INSERT INTO teams (id, canonical_name) VALUES (3, 'Liverpool')")
    conn.commit()

    fixtures = [
        ("E0", "2023-08-12", 1, 2, "post", 2, 1, 1, 0, "football_data"),
        ("E0", "2023-08-19", 2, 3, "post", 1, 1, 0, 1, "football_data"),
        ("E0", "2023-08-26", 3, 1, "post", 3, 0, 2, 0, "football_data"),
        ("E0", "2023-09-02", 1, 3, "post", 1, 2, 0, 1, "football_data"),
        ("E0", "2023-09-16", 2, 1, "post", 0, 1, 0, 0, "football_data"),
        ("E0", "2023-09-23", 3, 2, "post", 2, 2, 1, 1, "football_data"),
    ]
    for f in fixtures:
        conn.execute(
            "INSERT INTO fixtures "
            "(league, match_date, home_team_id, away_team_id, competition_type, "
            "status, home_score, away_score, ht_home_score, ht_away_score, "
            "result_checked, source, source_fixture_id) "
            "VALUES (?, ?, ?, ?, 'liga', ?, ?, ?, ?, ?, 0, ?, ?)",
            (*f, f"{f[0]}_{f[1]}_{f[2]}_{f[3]}"),
        )
    conn.commit()
    return conn


def test_build_features_returns_rows(tmp_path: Path):
    conn = _setup_db(tmp_path)
    features = build_features(conn, "E0")
    assert len(features) == 6
    assert "home_elo" in features.columns
    assert "home_form_pts_last_5" in features.columns
    conn.close()


def test_build_features_first_row_default_elo(tmp_path: Path):
    conn = _setup_db(tmp_path)
    features = build_features(conn, "E0")
    first = features.iloc[0]
    assert first["home_elo"] == 1500.0
    assert first["away_elo"] == 1500.0
    conn.close()


def test_persist_features(tmp_path: Path):
    conn = _setup_db(tmp_path)
    features = build_features(conn, "E0")
    count = persist_features(conn, features)
    assert count == 6
    result = conn.execute("SELECT COUNT(*) FROM match_features").fetchone()[0]
    assert result == 6
    conn.close()


def test_target_1x2_correct(tmp_path: Path):
    conn = _setup_db(tmp_path)
    features = build_features(conn, "E0")
    expected = ["home", "draw", "home", "away", "away", "draw"]
    actual = list(features["target_1x2"])
    assert actual == expected
    conn.close()


def test_target_1x2_not_none(tmp_path: Path):
    conn = _setup_db(tmp_path)
    features = build_features(conn, "E0")
    assert all(v is not None for v in features["target_1x2"])
    conn.close()


def test_form_points_correct(tmp_path: Path):
    conn = _setup_db(tmp_path)
    features = build_features(conn, "E0")
    first = features.iloc[0]
    assert first["home_form_pts_last_5"] == 0.0
    assert first["away_form_pts_last_5"] == 0.0
    second = features.iloc[1]
    assert second["home_form_pts_last_5"] == 0.0
    assert second["away_form_pts_last_5"] == 0.0
    third = features.iloc[2]
    assert third["home_form_pts_last_5"] == 1.0
    assert third["away_form_pts_last_5"] == 3.0
    conn.close()


def test_season_derived_from_date(tmp_path: Path):
    conn = _setup_db(tmp_path)
    features = build_features(conn, "E0")
    assert all(features["season"] == 2023)
    conn.close()
