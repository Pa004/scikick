from __future__ import annotations

import argparse
import sys

from app.config import get_settings
from app.db.migrations import run_migrations
from app.db.connection import get_connection
from app.ingestion.sync import sync_league, sync_all_leagues
from app.models.pipeline import train_league, resolve_predictions
from app.models.predict import predict_future


def cmd_sync(args):
    settings = get_settings()
    leagues = args.league.split(",") if args.league else settings.leagues_initial.split(",")
    results = sync_all_leagues(leagues, args.seasons, db_path=None)
    for r in results:
        if "error" in r:
            print(f"ERROR {r['league']}: {r['error']}")
        else:
            print(f"OK {r['league']}: {r['inserted']} fixtures synced")


def cmd_train(args):
    settings = get_settings()
    conn = get_connection()
    try:
        result = train_league(conn, args.league, mode=args.mode)
        if "error" in result:
            print(f"ERROR: {result['error']}")
        else:
            print(f"OK {result['league']}: brier={result['overall_brier']:.4f}, "
                  f"log_loss={result['overall_log_loss']:.4f}, "
                  f"folds={result['n_folds']}, samples={result['n_samples']}")
    finally:
        conn.close()


def cmd_predict(args):
    conn = get_connection()
    try:
        result = predict_future(conn, args.league)
        if "error" in result:
            print(f"ERROR: {result['error']}")
        else:
            print(f"OK {result['league']}: {result['predicted']} fixtures predicted")
    finally:
        conn.close()


def cmd_resolve(args):
    conn = get_connection()
    try:
        count = resolve_predictions(conn, args.league)
        print(f"Resolved {count} market predictions")
    finally:
        conn.close()


def cmd_scorer_ingest(args):
    from app.players.ingest import ingest_league_players
    conn = get_connection()
    try:
        result = ingest_league_players(conn, args.league)
        if "error" in result:
            print(f"ERROR: {result['error']}")
        else:
            print(f"OK {result['league']}: {result['players_inserted']} players, "
                  f"{result['fixtures_processed']} fixture-player records")
    finally:
        conn.close()


def main():
    parser = argparse.ArgumentParser(description="SciKick CLI")
    subparsers = parser.add_subparsers(dest="command", required=True)

    sync_parser = subparsers.add_parser("sync", help="Sync fixtures from data sources")
    sync_parser.add_argument("--league", type=str, default=None, help="League codes (comma-separated)")
    sync_parser.add_argument("--seasons", type=int, default=3, help="Number of seasons to sync")
    sync_parser.set_defaults(func=cmd_sync)

    train_parser = subparsers.add_parser("train", help="Train models")
    train_parser.add_argument("--league", type=str, required=True, help="League code")
    train_parser.add_argument("--mode", type=str, default="complete", choices=["complete", "light"])
    train_parser.set_defaults(func=cmd_train)

    predict_parser = subparsers.add_parser("predict", help="Predict future fixtures")
    predict_parser.add_argument("--league", type=str, required=True, help="League code")
    predict_parser.set_defaults(func=cmd_predict)

    resolve_parser = subparsers.add_parser("resolve", help="Resolve played predictions")
    resolve_parser.add_argument("--league", type=str, default=None, help="League code (optional)")
    resolve_parser.set_defaults(func=cmd_resolve)

    scorer_parser = subparsers.add_parser("scorer-ingest", help="Ingest player xG data from Understat")
    scorer_parser.add_argument("--league", type=str, required=True, help="League code")
    scorer_parser.set_defaults(func=cmd_scorer_ingest)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
