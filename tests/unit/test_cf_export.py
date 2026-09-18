import json
import sqlite3
from pathlib import Path

from app.db.migrations import run_migrations
from scripts.export_cloudflare import run


def _setup_db(tmp_path: Path) -> str:
    db_path = str(tmp_path / "export.db")
    run_migrations(db_path)
    conn = sqlite3.connect(db_path)
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
        "VALUES ('E0', '2099-08-12', 1, 2, 'liga', 'pre', NULL, NULL, 0, 'fd', 'E0_1')",
    )
    prediction = json.dumps({
        "markets": {
            "1x2": {"home": 0.55, "draw": 0.25, "away": 0.20},
            "over_under_2.5": {"over": 0.60, "under": 0.40},
            "btts": {"yes": 0.65, "no": 0.35},
        },
        "model_agreement": 0.05,
        "model_version": "test_v1",
    })
    conn.execute("UPDATE fixtures SET prediction = ? WHERE id = 1", (prediction,))
    conn.execute(
        "INSERT INTO fixture_odds (fixture_id, bookmaker, home, draw, away, fetched_at) "
        "VALUES (1, 'test-book', 2.0, 3.5, 4.0, '2026-09-18T00:00:00Z')"
    )
    conn.commit()
    conn.close()
    return db_path


def _read(out: Path, name: str):
    return json.loads((out / name).read_text(encoding="utf-8"))


def test_export_bundle_shape(tmp_path: Path):
    db_path = _setup_db(tmp_path)
    out = tmp_path / "dist-cf"
    manifest = run(db_path, str(out))

    assert manifest["fixtures"] == 1
    assert manifest["predicted"] == 1
    assert manifest["market"] == "1x2"

    fixtures = _read(out, "fixtures.json")
    assert len(fixtures) == 1
    assert fixtures[0]["upcoming"] is True
    assert fixtures[0]["prediction"]["markets"]["1x2"]["home"] == 0.55

    pred = _read(out, "predictions/1.json")
    assert pred["fixture_id"] == 1
    assert pred["league"] == "E0"
    assert pred["probabilities"]["1x2"]["home"] == 0.55

    values = _read(out, "value_index.json")
    assert values["1"]["outcomes"]["home"]["prob"] == 0.55
    assert values["1"]["source"] == "test-book"

    stats = _read(out, "stats.json")
    assert "all" in stats and "E0" in stats

    context = _read(out, "context_index.json")
    assert "Arsenal" in context["teams"]
    assert "Arsenal|Chelsea" in context["pairs"]
    # cached_endpoint keys on kwargs: values must match their keys.
    assert context["teams"]["Arsenal"]["team"] == "Arsenal"
    assert context["teams"]["Chelsea"]["team"] == "Chelsea"
    assert context["pairs"]["Arsenal|Chelsea"]["team"] == "Arsenal"
    assert context["pairs"]["Arsenal|Chelsea"]["opponent"] == "Chelsea"

    scorer = _read(out, "scorer/1.json")
    assert scorer["fixture_id"] == 1
    assert scorer["scorers"] == []


def test_export_skips_fixture_without_prediction(tmp_path: Path):
    db_path = _setup_db(tmp_path)
    conn = sqlite3.connect(db_path)
    conn.execute("UPDATE fixtures SET prediction = NULL WHERE id = 1")
    conn.commit()
    conn.close()
    out = tmp_path / "dist-cf"
    manifest = run(db_path, str(out))

    assert manifest["predicted"] == 0
    assert not (out / "predictions" / "1.json").exists()
    values = _read(out, "value_index.json")
    assert values["1"] is None
