from __future__ import annotations

import argparse
import sys

from app.config import get_settings
from app.db.migrations import run_migrations
from app.ingestion.sync import sync_league, sync_all_leagues


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
    print(f"Training {args.mode} for {args.league}...")
    print("Training not yet implemented")


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

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
