import sqlite3
from pathlib import Path

from app.db.migrations import run_migrations
from app.ingestion import sync as sync_module


def _make_conn(tmp_path: Path) -> sqlite3.Connection:
    db_path = str(tmp_path / "future.db")
    run_migrations(db_path)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


def _fdorg_fixtures():
    return [
        {
            "api_fixture_id": 101,
            "date": "2026-09-12T14:00:00Z",
            "home_team": "Arsenal",
            "away_team": "Chelsea",
            "league": "E0",
        },
        {
            "api_fixture_id": 102,
            "date": "2026-09-13T16:30:00Z",
            "home_team": "Liverpool",
            "away_team": "",
            "league": "E0",
        },
    ]


def test_primary_source_used_and_fallback_skipped(tmp_path, monkeypatch):
    calls = []
    monkeypatch.setattr(
        sync_module, "fetch_fdorg_fixtures", lambda code: _fdorg_fixtures()
    )
    monkeypatch.setattr(
        sync_module,
        "fetch_api_football_fixtures",
        lambda code: calls.append(code) or [{"api_fixture_id": 9}],
    )
    conn = _make_conn(tmp_path)
    try:
        counts = sync_module._sync_future_fixtures(conn, "E0")
        conn.commit()
        assert counts == {"football_data_org": 1, "api_football": 0}
        assert calls == []
        rows = conn.execute(
            "SELECT match_date, status, source, source_fixture_id FROM fixtures"
        ).fetchall()
        assert len(rows) == 1
        assert rows[0][1] == "pre"
        assert rows[0][2] == "football_data_org"
        assert rows[0][3] == "football_data_org_101"
    finally:
        conn.close()


def test_fallback_used_when_primary_empty(tmp_path, monkeypatch):
    monkeypatch.setattr(sync_module, "fetch_fdorg_fixtures", lambda code: [])
    monkeypatch.setattr(
        sync_module,
        "fetch_api_football_fixtures",
        lambda code: [_fdorg_fixtures()[0]],
    )
    conn = _make_conn(tmp_path)
    try:
        counts = sync_module._sync_future_fixtures(conn, "E0")
        conn.commit()
        assert counts == {"football_data_org": 0, "api_football": 1}
        row = conn.execute("SELECT source FROM fixtures").fetchone()
        assert row[0] == "api_football"
    finally:
        conn.close()

def test_no_duplicates_on_resync(tmp_path, monkeypatch):
    monkeypatch.setattr(
        sync_module, "fetch_fdorg_fixtures", lambda code: [_fdorg_fixtures()[0]]
    )
    monkeypatch.setattr(sync_module, "fetch_api_football_fixtures", lambda code: [])
    conn = _make_conn(tmp_path)
    try:
        sync_module._sync_future_fixtures(conn, "E0")
        sync_module._sync_future_fixtures(conn, "E0")
        conn.commit()
        total = conn.execute("SELECT COUNT(*) FROM fixtures").fetchone()[0]
        assert total == 1
    finally:
        conn.close()


def test_resolve_team_fuzzy_matches_canonical(tmp_path, capsys):
    conn = _make_conn(tmp_path)
    try:
        conn.execute("INSERT INTO teams (canonical_name) VALUES ('Hull City')")
        canonical_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
        conn.execute(
            "INSERT INTO team_aliases (canonical_team_id, source, source_name)"
            " VALUES (?, 'football_data', 'Hull City')",
            (canonical_id,),
        )
        resolved = sync_module._resolve_team(conn, "Hull City AFC")
        assert resolved == canonical_id
        teams = conn.execute("SELECT COUNT(*) FROM teams").fetchone()[0]
        assert teams == 1
        assert "Aliased" in capsys.readouterr().out
    finally:
        conn.close()

def test_resolve_team_creates_unknown(tmp_path):
    conn = _make_conn(tmp_path)
    try:
        resolved = sync_module._resolve_team(conn, "Zxq Qwerty United")
        row = conn.execute(
            "SELECT canonical_name FROM teams WHERE id = ?", (resolved,)
        ).fetchone()
        assert row[0] == "Zxq Qwerty United"
    finally:
        conn.close()


def test_resolve_team_exact_canonical_no_alias(tmp_path, capsys):
    conn = _make_conn(tmp_path)
    try:
        conn.execute("INSERT INTO teams (canonical_name) VALUES ('Hull City')")
        canonical_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
        resolved = sync_module._resolve_team(conn, "Hull City")
        assert resolved == canonical_id
        assert capsys.readouterr().out == ""
    finally:
        conn.close()
