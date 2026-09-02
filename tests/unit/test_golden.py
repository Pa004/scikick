import json
import sqlite3
import random
from pathlib import Path
from datetime import timedelta, date

import pytest

from app.db.migrations import run_migrations
from app.db.connection import get_connection
from app.models.golden import get_golden_fixtures, mark_golden
from app.models.pipeline import train_league


def _setup_db(tmp_path: Path):
    db_path = str(tmp_path / "test.db")
    run_migrations(db_path)
    conn = get_connection(db_path)
    conn.execute(
        "INSERT INTO leagues (id, name, country, tier, source_csv_code, "
        "has_odds, has_xg, season_start_month, min_seasons) "
        "VALUES ('E0', 'Premier League', 'England', 1, 'E0', 1, 0, 8, 2)"
    )
    conn.execute("INSERT INTO teams (id, canonical_name) VALUES (1, 'Arsenal')")
    conn.execute("INSERT INTO teams (id, canonical_name) VALUES (2, 'Chelsea')")
    conn.execute(
        "INSERT INTO fixtures "
        "(league, match_date, home_team_id, away_team_id, competition_type, "
        "status, home_score, away_score, result_checked, source, source_fixture_id) "
        "VALUES ('E0', '2023-08-12', 1, 2, 'liga', 'post', 2, 1, 1, 'test', 'f1')"
    )
    conn.commit()
    return conn, db_path


def test_get_golden_fixtures(tmp_path):
    conn, _ = _setup_db(tmp_path)
    df = get_golden_fixtures(conn)
    assert len(df) == 1
    conn.close()


def test_mark_golden(tmp_path):
    conn, _ = _setup_db(tmp_path)
    fixture_id = conn.execute("SELECT id FROM fixtures LIMIT 1").fetchone()[0]
    count = mark_golden(conn, [fixture_id])
    assert count == 1
    conn.commit()
    row = conn.execute("SELECT result_checked FROM fixtures WHERE id = ?", (fixture_id,)).fetchone()
    assert row[0] == 2
    conn.close()


def _setup_golden_db(tmp_path: Path) -> sqlite3.Connection:
    db_path = str(tmp_path / "test.db")
    run_migrations(db_path)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row

    conn.execute(
        "INSERT OR IGNORE INTO leagues (id, name, country, tier, source_csv_code, "
        "has_odds, has_xg, season_start_month, min_seasons) "
        "VALUES ('E0', 'Premier League', 'England', 1, 'E0', 1, 0, 8, 2)"
    )
    teams = [(i, f"Team{i}") for i in range(1, 11)]
    for tid, tname in teams:
        conn.execute("INSERT OR IGNORE INTO teams (id, canonical_name) VALUES (?, ?)", (tid, tname))

    rng = random.Random(42)
    base = date(2023, 8, 1)
    for md in range(20):
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
                "INSERT OR IGNORE INTO fixtures "
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


def test_golden_predictions_regression(tmp_path: Path):
    golden_path = Path(__file__).resolve().parent.parent / "fixtures" / "golden_predictions.json"
    if not golden_path.exists():
        pytest.skip("Golden predictions not generated yet")

    golden = json.loads(golden_path.read_text(encoding="utf-8"))
    TOLERANCE = 0.05

    conn = _setup_golden_db(tmp_path)
    result = train_league(conn, "E0", mode="light", min_train_matches=80)
    assert "error" not in result, result.get("error")

    assert abs(result["overall_brier"] - golden["overall_brier"]) < TOLERANCE, (
        f"overall_brier drifted: {result['overall_brier']:.4f} vs golden {golden['overall_brier']:.4f}"
    )

    rows = conn.execute(
        "SELECT id, prediction FROM fixtures WHERE prediction IS NOT NULL AND status = 'post' ORDER BY id LIMIT 5"
    ).fetchall()

    for row in rows:
        fid = str(row["id"])
        if fid not in golden["fixtures"]:
            continue
        pred = json.loads(row["prediction"])
        g = golden["fixtures"][fid]

        assert abs(pred["markets"]["1x2"]["home"] - g["1x2_home"]) < TOLERANCE, (
            f"Fixture {fid} 1x2_home drifted"
        )
        assert abs(pred["markets"]["btts"]["yes"] - g["btts_yes"]) < TOLERANCE, (
            f"Fixture {fid} btts_yes drifted"
        )
        assert abs(pred["markets"]["over_under_2.5"]["over"] - g["ou25_over"]) < TOLERANCE, (
            f"Fixture {fid} ou25_over drifted"
        )

        for key in g:
            if key.startswith("corners_over_under_") or key.startswith("cards_over_under_"):
                assert key in pred["markets"], f"Fixture {fid} missing {key}"
                assert abs(pred["markets"][key]["over"] - g[key]["over"]) < TOLERANCE, (
                    f"Fixture {fid} {key} drifted"
                )

    conn.close()
