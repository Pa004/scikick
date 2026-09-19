from unittest.mock import patch

from app.ingestion.adapters import espn


def _event(home="LDU Quito", away="Emelec", state="pre", completed=False,
           home_score="0", away_score="0", day="2026-09-20T00:00Z"):
    def team(name):
        return {"displayName": name, "abbreviation": name[:3].upper(),
                "logo": "https://a.espncdn.com/i/teamlogos/soccer/500/1.png"}
    return {
        "id": "401921387",
        "date": day,
        "competitions": [{
            "status": {"type": {"state": state, "completed": completed}},
            "competitors": [
                {"homeAway": "home", "score": home_score, "team": team(home)},
                {"homeAway": "away", "score": away_score, "team": team(away)},
            ],
        }],
    }


def test_fetch_scheduled_normalizes_names():
    payload = {"events": [_event()]}
    with patch("curl_cffi.requests.get") as mock_get:
        mock_get.return_value.json.return_value = payload
        mock_get.return_value.raise_for_status.return_value = None
        fixtures = espn.fetch_scheduled("EC1")
    assert len(fixtures) == 1
    assert fixtures[0]["home_team"] == "Liga de Quito"
    assert fixtures[0]["away_team"] == "Emelec"
    assert fixtures[0]["league"] == "EC1"
    assert fixtures[0]["home_crest"].startswith("http")


def test_fetch_scheduled_unknown_league():
    assert espn.fetch_scheduled("XX") == []


def test_completed_to_row_derives_ftr():
    row = espn._completed_to_row(
        _event(state="post", completed=True, home_score="2", away_score="1"), "EC1")
    assert row is not None
    assert row["FTR"] == "H"
    assert row["Date"] == "20/09/2026"
    assert row["HomeTeam"] == "Liga de Quito"


def test_completed_to_row_skips_scheduled():
    assert espn._completed_to_row(_event(), "EC1") is None


def test_download_history_writes_csv(tmp_path):
    jan = {"events": [_event(state="post", completed=True, home_score="1", away_score="1")]}
    with patch("app.ingestion.adapters.espn._get_json", return_value=jan) as mock_json:
        path = espn.download_history("EC1", 2026, tmp_path, force=True)
    assert path.name == "EC12026.csv"
    assert mock_json.call_count == 1
    content = path.read_text(encoding="utf-8")
    assert content.splitlines()[0] == "Div,Date,HomeTeam,AwayTeam,FTHG,FTAG,FTR"
    assert "Liga de Quito" in content


def test_download_history_empty_year(tmp_path):
    import pytest

    with patch("app.ingestion.adapters.espn._get_json", return_value={"events": []}):
        with pytest.raises(ConnectionError, match="No completed"):
            espn.download_history("EC1", 2026, tmp_path, force=True)
    assert not (tmp_path / "EC12026.csv").exists()


def test_download_history_unknown_league(tmp_path):
    import pytest

    with pytest.raises(ValueError, match="Unknown league code"):
        espn.download_history("XX", 2026, tmp_path)
