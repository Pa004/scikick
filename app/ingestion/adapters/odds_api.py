from __future__ import annotations

import logging

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)

ODDS_API_BASE = "https://api.the-odds-api.com/v4"

# Our league codes -> The Odds API sport keys. EPL/France/Germany confirmed
# against published sport lists; Spain/Italy follow the same convention and
# are verified via list_sports() once a key exists.
SPORT_MAP = {
    "E0": "soccer_epl",
    "SP1": "soccer_spain_la_liga",
    "D1": "soccer_germany_bundesliga",
    "I1": "soccer_italy_serie_a",
    "F1": "soccer_france_ligue_one",
}

REGION = "eu"
MARKET = "h2h"


def list_sports() -> list[dict]:
    settings = get_settings()
    if not settings.odds_api_key:
        logger.warning("ODDS_API_KEY missing, cannot list sports")
        return []
    try:
        resp = httpx.get(
            f"{ODDS_API_BASE}/sports/",
            params={"apiKey": settings.odds_api_key},
            timeout=15,
        )
        resp.raise_for_status()
        _log_quota(resp)
        data = resp.json()
        return data if isinstance(data, list) else []
    except Exception as exc:
        logger.warning("The Odds API sports listing failed: %s", exc)
        return []


def fetch_h2h(league_code: str) -> list[dict]:
    settings = get_settings()
    if not settings.odds_api_key:
        logger.warning("ODDS_API_KEY missing, skipping odds for %s", league_code)
        return []

    sport_key = SPORT_MAP.get(league_code)
    if not sport_key:
        logger.warning("Unknown league code for odds: %s", league_code)
        return []

    try:
        resp = httpx.get(
            f"{ODDS_API_BASE}/sports/{sport_key}/odds/",
            params={
                "apiKey": settings.odds_api_key,
                "regions": REGION,
                "markets": MARKET,
                "oddsFormat": "decimal",
            },
            timeout=20,
        )
        resp.raise_for_status()
        _log_quota(resp)
        data = resp.json()
    except Exception as exc:
        logger.warning("The Odds API h2h failed for %s: %s", league_code, exc)
        return []

    events = []
    for event in data if isinstance(data, list) else []:
        books = _extract_books(event.get("bookmakers", []))
        if not books:
            continue
        events.append({
            "event_id": event.get("id"),
            "date": (event.get("commence_time") or "")[:10],
            "home_team": event.get("home_team"),
            "away_team": event.get("away_team"),
            "books": books,
            "best": _best_prices(books),
        })
    return events


def _extract_books(bookmakers: list) -> dict:
    books = {}
    for book in bookmakers:
        for market in book.get("markets", []):
            if market.get("key") != MARKET:
                continue
            prices = {}
            for outcome in market.get("outcomes", []):
                prices[outcome.get("name")] = outcome.get("price")
            if prices:
                books[book.get("key", "unknown")] = prices
    return books


def _best_prices(books: dict) -> dict:
    best: dict = {}
    for _, prices in books.items():
        for name, price in prices.items():
            if not isinstance(price, (int, float)):
                continue
            if name not in best or price > best[name][0]:
                best[name] = (price, _book_of(books, name, price))
    return {name: {"price": p, "book": b} for name, (p, b) in best.items()}


def _book_of(books: dict, name: str, price: float) -> str:
    for book, prices in books.items():
        if prices.get(name) == price:
            return book
    return "unknown"


def _log_quota(resp: httpx.Response) -> None:
    remaining = resp.headers.get("x-requests-remaining")
    used = resp.headers.get("x-requests-used")
    logger.info("The Odds API quota: remaining=%s used=%s", remaining, used)
