import json
import sqlite3
from pathlib import Path
from unittest.mock import patch

from app.db.migrations import run_migrations
from app.models.pipeline import train_league, resolve_predictions
from app.models.predict import predict_future


def _setup_db(tmp_path: Path, n_matchdays: int = 20) -> sqlite3.Connection:
    db_path = str(tmp_path / "test.db")
    run_migrations(db_path)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row

    conn.execute(
        "INSERT INTO leagues (id, name, country, tier, source_csv_code, "
        "has_odds, has_xg, season_start_month, min_seasons) "
        "VALUES ('E0', 'Premier League', 'England', 1, 'E0', 1, 0, 8, 2)"
    )
    teams = [(i, f"Team{i}") for i in range(1, 11)]
    for tid, tname in teams:
        conn.execute("INSERT INTO teams (id, canonical_name) VALUES (?, ?)", (tid, tname))

    import random
    from datetime import timedelta, date
    rng = random.Random(42)
    base = date(2023, 8, 1)
    for md in range(n_matchdays):
        dt = base + timedelta(weeks=md)
        date_str = dt.isoformat()
        pairs = [(h, a) for h in range(1, 11) for a in range(1, 11) if h != a]
        rng.shuffle(pairs)
        for h, a in pairs[:5]:
            hg = rng.randint(0, 4)
            ag = rng.randint(0, 3)
            ht_h = min(hg, rng.randint(0, hg))
            ht_a = min(ag, rng.randint(0, ag))
            hc = rng.randint(0, 15)
            ac = rng.randint(0, 15)
            hy = rng.randint(0, 6)
            ay = rng.randint(0, 6)
            conn.execute(
                "INSERT INTO fixtures "
                "(league, match_date, home_team_id, away_team_id, competition_type, "
                "status, home_score, away_score, ht_home_score, ht_away_score, "
                "home_corners, away_corners, home_yellow, away_yellow, "
                "result_checked, source, source_fixture_id) "
                "VALUES (?, ?, ?, ?, 'liga', 'post', ?, ?, ?, ?, ?, ?, ?, ?, 0, 'football_data', ?)",
                ("E0", date_str, h, a, hg, ag, ht_h, ht_a, hc, ac, hy, ay,
                 f"E0_{date_str}_{h}_{a}"),
            )
    conn.commit()
    return conn


def _make_get_conn(db_path: str):
    def _get_conn():
        conn = sqlite3.connect(db_path, timeout=10)
        conn.row_factory = sqlite3.Row
        return conn
    return _get_conn


def test_train_persists_multi_market_predictions(tmp_path: Path):
    conn = _setup_db(tmp_path, n_matchdays=20)
    result = train_league(conn, "E0", mode="light", min_train_matches=80)
    assert "error" not in result, result.get("error")

    rows = conn.execute(
        "SELECT prediction FROM fixtures WHERE prediction IS NOT NULL AND status = 'post'"
    ).fetchall()
    assert len(rows) > 0

    pred = json.loads(rows[0]["prediction"])
    assert "markets" in pred
    assert "1x2" in pred["markets"]
    assert "btts" in pred["markets"]
    assert "over_under_2.5" in pred["markets"]
    assert "model_agreement" in pred
    assert "blend_weight" in pred
    conn.close()


def test_train_persists_corners_and_cards(tmp_path: Path):
    conn = _setup_db(tmp_path, n_matchdays=20)
    result = train_league(conn, "E0", mode="light", min_train_matches=80)
    assert "error" not in result, result.get("error")

    rows = conn.execute(
        "SELECT prediction FROM fixtures WHERE prediction IS NOT NULL AND status = 'post'"
    ).fetchall()
    pred = json.loads(rows[0]["prediction"])
    corners_keys = [k for k in pred["markets"] if k.startswith("corners_")]
    cards_keys = [k for k in pred["markets"] if k.startswith("cards_")]
    assert len(corners_keys) > 0, f"No corners markets found: {list(pred['markets'].keys())}"
    assert len(cards_keys) > 0, f"No cards markets found: {list(pred['markets'].keys())}"
    conn.close()


def test_resolve_multi_market(tmp_path: Path):
    conn = _setup_db(tmp_path, n_matchdays=20)
    result = train_league(conn, "E0", mode="light", min_train_matches=80)
    assert "error" not in result, result.get("error")

    count = resolve_predictions(conn, "E0")
    assert count > 0

    tracked = conn.execute(
        "SELECT market, COUNT(*) as cnt FROM tracked WHERE league = 'E0' GROUP BY market"
    ).fetchall()
    market_counts = {r["market"]: r["cnt"] for r in tracked}
    assert "1x2" in market_counts
    assert market_counts["1x2"] > 0
    assert "btts" in market_counts or "over_under_2.5" in market_counts
    conn.close()


def test_predict_future_pre_fixtures(tmp_path: Path):
    conn = _setup_db(tmp_path, n_matchdays=20)
    result = train_league(conn, "E0", mode="light", min_train_matches=80)
    assert "error" not in result, result.get("error")

    conn.execute(
        "INSERT INTO fixtures "
        "(league, match_date, home_team_id, away_team_id, competition_type, "
        "status, result_checked, source, source_fixture_id) "
        "VALUES ('E0', '2025-12-01', 1, 2, 'liga', 'pre', 0, 'api_football', 'test_1')",
    )
    conn.commit()

    predict_result = predict_future(conn, "E0")
    assert predict_result["predicted"] == 1

    fix = conn.execute(
        "SELECT prediction FROM fixtures WHERE source = 'api_football' AND status = 'pre'"
    ).fetchone()
    assert fix is not None
    assert fix["prediction"] is not None
    pred = json.loads(fix["prediction"])
    assert "markets" in pred
    assert "1x2" in pred["markets"]
    conn.close()


def test_api_serves_multi_market(tmp_path: Path):
    from fastapi.testclient import TestClient
    from app.api.main import create_app

    db_path = str(tmp_path / "test.db")
    conn = _setup_db(tmp_path, n_matchdays=20)
    result = train_league(conn, "E0", mode="light", min_train_matches=80)
    assert "error" not in result, result.get("error")

    fix = conn.execute(
        "SELECT id FROM fixtures WHERE prediction IS NOT NULL AND status = 'post' LIMIT 1"
    ).fetchone()
    conn.close()

    app = create_app()
    client = TestClient(app)
    with patch("app.api.routers.predict.get_connection", side_effect=_make_get_conn(db_path)):
        resp = client.get(f"/api/predict/{fix['id']}")
    assert resp.status_code == 200
    data = resp.json()
    assert "probabilities" in data
    assert "1x2" in data["probabilities"]
    assert "model_agreement" in data


def test_stats_by_market(tmp_path: Path):
    from fastapi.testclient import TestClient
    from app.api.main import create_app

    db_path = str(tmp_path / "test.db")
    conn = _setup_db(tmp_path, n_matchdays=20)
    result = train_league(conn, "E0", mode="light", min_train_matches=80)
    assert "error" not in result, result.get("error")
    resolve_predictions(conn, "E0")
    conn.close()

    app = create_app()
    client = TestClient(app)
    with patch("app.api.routers.stats.get_connection", side_effect=_make_get_conn(db_path)):
        resp = client.get("/api/stats")
    assert resp.status_code == 200
    data = resp.json()
    assert "by_market" in data
    assert len(data["by_market"]) > 0
    assert any(m["market"] == "1x2" for m in data["by_market"])
