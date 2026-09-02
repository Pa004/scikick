from __future__ import annotations

import sqlite3
from datetime import datetime, timezone

import pandas as pd

from app.features.elo import EloSystem


def _get_fixtures(conn: sqlite3.Connection, league: str) -> pd.DataFrame:
    query = """
        SELECT f.id, f.match_date, f.league, f.home_team_id, f.away_team_id,
               f.home_score, f.away_score, f.ht_home_score, f.ht_away_score,
               f.home_corners, f.away_corners, f.home_yellow, f.away_yellow,
               f.referee, f.competition_type, f.status
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
        "SELECT AVG(home_yellow + away_yellow) as avg_cards FROM fixtures f "
        "WHERE f.referee = ? AND f.source = 'football_data' "
        "AND f.home_corners IS NOT NULL "
        "ORDER BY f.match_date DESC LIMIT ?",
        (referee, n),
    ).fetchone()
    return row["avg_cards"] if row and row["avg_cards"] else 2.5


def _rolling_avg(history: list[float], n: int) -> float:
    recent = history[-n:]
    if not recent:
        return 0.0
    return sum(recent) / len(recent)


def _derive_ftr(home_goals: int | None, away_goals: int | None) -> str | None:
    if home_goals is None or away_goals is None:
        return None
    if home_goals > away_goals:
        return "home"
    elif home_goals < away_goals:
        return "away"
    return "draw"


def _derive_season(match_date: str) -> int:
    try:
        dt = datetime.strptime(match_date, "%Y-%m-%d")
        return dt.year if dt.month >= 8 else dt.year - 1
    except (ValueError, TypeError):
        return 0


def build_features(conn: sqlite3.Connection, league: str) -> pd.DataFrame:
    df = _get_fixtures(conn, league)
    if df.empty:
        return df

    elo = EloSystem()
    form_history: dict[int, list[float]] = {}
    last_match: dict[int, datetime] = {}
    h2h: list[dict] = []

    corners_history: dict[int, list[float]] = {t: [] for t in df["home_team_id"].unique()}
    yellow_history: dict[int, list[float]] = {t: [] for t in df["home_team_id"].unique()}

    feature_rows = []
    for _, row in df.iterrows():
        home_id = int(row["home_team_id"])
        away_id = int(row["away_team_id"])
        match_date = row["match_date"]
        hg = int(row["home_score"]) if pd.notna(row["home_score"]) else None
        ag = int(row["away_score"]) if pd.notna(row["away_score"]) else None

        home_elo = elo.get(home_id)
        away_elo = elo.get(away_id)
        elo_diff = home_elo - away_elo

        home_form = _compute_form(form_history, home_id)
        away_form = _compute_form(form_history, away_id)

        home_rest = _compute_rest_days(last_match, home_id, datetime.strptime(match_date, "%Y-%m-%d"))
        away_rest = _compute_rest_days(last_match, away_id, datetime.strptime(match_date, "%Y-%m-%d"))

        h2h_home_wins, h2h_draws = _compute_h2h(h2h, home_id, away_id)

        hc = int(row["home_corners"]) if pd.notna(row.get("home_corners")) else 0
        ac = int(row["away_corners"]) if pd.notna(row.get("away_corners")) else 0
        hy = int(row["home_yellow"]) if pd.notna(row.get("home_yellow")) else 0
        ay = int(row["away_yellow"]) if pd.notna(row.get("away_yellow")) else 0
        referee = str(row["referee"]) if pd.notna(row.get("referee")) else None

        referee_cards = _compute_referee_cards(conn, referee)

        home_corners = corners_history.get(home_id, [])
        away_corners = corners_history.get(away_id, [])
        home_yellow = yellow_history.get(home_id, [])
        away_yellow = yellow_history.get(away_id, [])

        feature_rows.append({
            "fixture_id": int(row["id"]),
            "feature_version": "2.0",
            "league": league,
            "season": _derive_season(match_date),
            "match_date": match_date,
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
            "referee_cards_avg": round(referee_cards, 3),
            "home_xg_last5_avg": None,
            "away_xg_last5_avg": None,
            "home_xg_missing": 1,
            "away_xg_missing": 1,
            "home_corners_avg_last3": round(_rolling_avg(home_corners, 3), 2),
            "home_corners_avg_last5": round(_rolling_avg(home_corners, 5), 2),
            "away_corners_avg_last3": round(_rolling_avg(away_corners, 3), 2),
            "away_corners_avg_last5": round(_rolling_avg(away_corners, 5), 2),
            "home_yellow_avg_last3": round(_rolling_avg(home_yellow, 3), 2),
            "home_yellow_avg_last5": round(_rolling_avg(home_yellow, 5), 2),
            "away_yellow_avg_last3": round(_rolling_avg(away_yellow, 3), 2),
            "away_yellow_avg_last5": round(_rolling_avg(away_yellow, 5), 2),
            "target_home_goals": hg,
            "target_away_goals": ag,
            "target_1x2": _derive_ftr(hg, ag),
            "target_home_corners": hc,
            "target_away_corners": ac,
            "target_home_yellow": hy,
            "target_away_yellow": ay,
            "target_home_ht_goals": int(row["ht_home_score"]) if pd.notna(row.get("ht_home_score")) else None,
            "target_away_ht_goals": int(row["ht_away_score"]) if pd.notna(row.get("ht_away_score")) else None,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

        elo.update(home_id, away_id, hg, ag)

        form_history.setdefault(home_id, []).append(
            3.0 if _derive_ftr(hg, ag) == "home" else (1.0 if _derive_ftr(hg, ag) == "draw" else 0.0)
        )
        form_history.setdefault(away_id, []).append(
            3.0 if _derive_ftr(hg, ag) == "away" else (1.0 if _derive_ftr(hg, ag) == "draw" else 0.0)
        )

        last_match[home_id] = datetime.strptime(match_date, "%Y-%m-%d")
        last_match[away_id] = datetime.strptime(match_date, "%Y-%m-%d")

        h2h.append({
            "home_id": home_id,
            "away_id": away_id,
            "home_goals": hg,
            "away_goals": ag,
        })

        corners_history.setdefault(home_id, []).append(hc)
        corners_history.setdefault(away_id, []).append(ac)
        yellow_history.setdefault(home_id, []).append(hy)
        yellow_history.setdefault(away_id, []).append(ay)

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
