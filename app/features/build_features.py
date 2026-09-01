from __future__ import annotations

import sqlite3
from datetime import datetime, timezone

import pandas as pd

from app.features.elo import EloSystem


def _get_fixtures(conn: sqlite3.Connection, league: str) -> pd.DataFrame:
    query = """
        SELECT f.id, f.match_date, f.league, f.home_team_id, f.away_team_id,
               f.home_score, f.away_score, f.ht_home_score, f.ht_away_score,
               f.competition_type, f.status
        FROM fixtures f
        WHERE f.league = ? AND f.status = 'post'
        ORDER BY f.match_date ASC
    """
    return pd.read_sql_query(query, conn, params=(league,))


def _compute_form(points_history: dict[int, list[float]], team_id: int, n: int = 5) -> float:
    history = points_history.get(team_id, [])
    recent = history[-n:]
    if not recent:
        return 0.0
    return sum(recent) / len(recent)


def _compute_rest_days(
    last_match_dates: dict[int, datetime], team_id: int, current_date: datetime
) -> float:
    last = last_match_dates.get(team_id)
    if not last:
        return 7.0
    delta = (current_date - last).days
    return max(min(delta, 21), 2)


def _compute_h2h(
    h2h_history: list[dict], home_id: int, away_id: int, n: int = 5
) -> tuple[float, float]:
    recent = h2h_history[-n:]
    if not recent:
        return 0.0, 0.0
    home_wins = sum(1 for m in recent if m["home_id"] == home_id and m["home_goals"] > m["away_goals"])
    draws = sum(1 for m in recent if m["home_goals"] == m["away_goals"])
    return home_wins / len(recent), draws / len(recent)


def _compute_referee_cards(conn: sqlite3.Connection, referee: str, n: int = 30) -> float:
    if not referee:
        return 2.5
    row = conn.execute(
        "SELECT AVG(HY + AY) as avg_cards FROM fixtures f "
        "WHERE f.source = 'football_data' "
        "AND EXISTS (SELECT 1 FROM team_aliases ta WHERE ta.canonical_team_id IN (f.home_team_id, f.away_team_id)) "
        "LIMIT ?",
        (n,),
    ).fetchone()
    return row["avg_cards"] if row and row["avg_cards"] else 2.5


def build_features(conn: sqlite3.Connection, league: str) -> pd.DataFrame:
    df = _get_fixtures(conn, league)
    if df.empty:
        return df

    elo = EloSystem()
    form_history: dict[int, list[float]] = {}
    last_match: dict[int, datetime] = {}
    h2h: list[dict] = []

    feature_rows = []
    for _, row in df.iterrows():
        home_id = int(row["home_team_id"])
        away_id = int(row["away_team_id"])
        match_date = datetime.strptime(row["match_date"], "%Y-%m-%d")
        hg = int(row["home_score"]) if pd.notna(row["home_score"]) else 0
        ag = int(row["away_score"]) if pd.notna(row["away_score"]) else 0

        home_elo = elo.get(home_id)
        away_elo = elo.get(away_id)
        elo_diff = home_elo - away_elo

        home_form = _compute_form(form_history, home_id)
        away_form = _compute_form(form_history, away_id)

        home_rest = _compute_rest_days(last_match, home_id, match_date)
        away_rest = _compute_rest_days(last_match, away_id, match_date)

        h2h_home_wins, h2h_draws = _compute_h2h(h2h, home_id, away_id)

        ftr = row.get("ftr", "")
        if ftr == "home":
            home_pts, away_pts = 3.0, 0.0
        elif ftr == "draw":
            home_pts, away_pts = 1.0, 1.0
        else:
            home_pts, away_pts = 0.0, 3.0

        feature_rows.append({
            "fixture_id": int(row["id"]),
            "feature_version": "1.0",
            "league": league,
            "season": 0,
            "match_date": row["match_date"],
            "competition_type": row.get("competition_type", "liga"),
            "home_team_id": home_id,
            "away_team_id": away_id,
            "home_elo": round(home_elo, 1),
            "away_elo": round(away_elo, 1),
            "home_elo_margin": round(elo_diff, 1),
            "home_form_pts_last_5": round(home_form, 3),
            "away_form_pts_last_5": round(away_form, 3),
            "home_rest_days": round(home_rest, 1),
            "away_rest_days": round(away_rest, 1),
            "h2h_home_wins_last_5": round(h2h_home_wins, 3),
            "h2h_draws_last_5": round(h2h_draws, 3),
            "referee_cards_avg": 2.5,
            "home_xg_last5_avg": None,
            "away_xg_last5_avg": None,
            "home_xg_missing": 1,
            "away_xg_missing": 1,
            "target_home_goals": hg,
            "target_away_goals": ag,
            "target_1x2": ftr if ftr else None,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

        elo.update(home_id, away_id, hg, ag)

        form_history.setdefault(home_id, []).append(home_pts)
        form_history.setdefault(away_id, []).append(away_pts)

        last_match[home_id] = match_date
        last_match[away_id] = match_date

        h2h.append({
            "home_id": home_id,
            "away_id": away_id,
            "home_goals": hg,
            "away_goals": ag,
        })

    return pd.DataFrame(feature_rows)


def persist_features(conn: sqlite3.Connection, features_df: pd.DataFrame) -> int:
    if features_df.empty:
        return 0

    cols = [c for c in features_df.columns if c != "fixture_id"]
    placeholders = ", ".join(["?"] * (len(cols) + 1))
    col_names = "fixture_id, " + ", ".join(cols)

    inserted = 0
    for _, row in features_df.iterrows():
        values = [int(row["fixture_id"])] + [
            None if pd.isna(row[c]) else row[c] for c in cols
        ]
        conn.execute(
            f"INSERT OR REPLACE INTO match_features ({col_names}) VALUES ({placeholders})",
            values,
        )
        inserted += 1

    return inserted
