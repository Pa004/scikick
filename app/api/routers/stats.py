from __future__ import annotations

from fastapi import APIRouter

from app.db.connection import get_connection

router = APIRouter()


@router.get("/stats")
def get_stats(league: str | None = None, market: str = "1x2"):
    conn = get_connection()
    try:
        base_filter = "WHERE t.market = ?"
        params: list = [market]
        if league:
            base_filter += " AND t.league = ?"
            params.append(league)

        overall = conn.execute(
            f"SELECT COUNT(*) as total, "
            f"SUM(CASE WHEN t.hit = 1 THEN 1 ELSE 0 END) as hits, "
            f"AVG(t.confidence) as avg_confidence "
            f"FROM tracked t {base_filter}",
            params,
        ).fetchone()

        if not overall or overall["total"] == 0:
            all_markets = conn.execute(
                "SELECT DISTINCT market FROM tracked" + (" WHERE league = ?" if league else ""),
                [league] if league else [],
            ).fetchall()
            return {
                "total_predictions": 0,
                "accuracy": 0,
                "avg_confidence": 0,
                "by_confidence_band": [],
                "by_league": [],
                "by_market": [{"market": m["market"], "total": 0, "accuracy": 0, "cold_start": True} for m in all_markets],
                "cold_start": True,
                "message": "Insufficient data for evaluation (need at least 30 resolved predictions)",
            }

        total = overall["total"]
        hits = overall["hits"] or 0
        avg_confidence = overall["avg_confidence"] or 0

        bands = conn.execute(
            f"SELECT "
            f"CASE "
            f"  WHEN t.confidence >= 0.7 THEN 'high (>=70%)' "
            f"  WHEN t.confidence >= 0.5 THEN 'medium (50-70%)' "
            f"  ELSE 'low (<50%)' "
            f"END as band, "
            f"COUNT(*) as total, "
            f"SUM(CASE WHEN t.hit = 1 THEN 1 ELSE 0 END) as hits "
            f"FROM tracked t {base_filter} "
            f"GROUP BY band "
            f"ORDER BY band",
            params,
        ).fetchall()

        by_confidence = []
        for b in bands:
            band_total = b["total"]
            band_hits = b["hits"] or 0
            by_confidence.append({
                "band": b["band"],
                "total": band_total,
                "hits": band_hits,
                "accuracy": round(band_hits / band_total, 4) if band_total > 0 else 0,
            })

        by_league_rows = conn.execute(
            f"SELECT t.league, COUNT(*) as total, "
            f"SUM(CASE WHEN t.hit = 1 THEN 1 ELSE 0 END) as hits "
            f"FROM tracked t {base_filter} "
            f"GROUP BY t.league "
            f"ORDER BY total DESC",
            params,
        ).fetchall()

        by_league = []
        for lr in by_league_rows:
            league_total = lr["total"]
            league_hits = lr["hits"] or 0
            by_league.append({
                "league": lr["league"],
                "total": league_total,
                "hits": league_hits,
                "accuracy": round(league_hits / league_total, 4) if league_total > 0 else 0,
            })

        market_filter = "WHERE 1=1"
        market_params: list = []
        if league:
            market_filter += " AND t.league = ?"
            market_params.append(league)

        by_market_rows = conn.execute(
            f"SELECT t.market, COUNT(*) as total, "
            f"SUM(CASE WHEN t.hit = 1 THEN 1 ELSE 0 END) as hits "
            f"FROM tracked t {market_filter} "
            f"GROUP BY t.market "
            f"ORDER BY total DESC",
            market_params,
        ).fetchall()

        by_market = []
        for mr in by_market_rows:
            market_total = mr["total"]
            market_hits = mr["hits"] or 0
            by_market.append({
                "market": mr["market"],
                "total": market_total,
                "hits": market_hits,
                "accuracy": round(market_hits / market_total, 4) if market_total > 0 else 0,
                "cold_start": market_total < 30,
            })

        return {
            "total_predictions": total,
            "accuracy": round(hits / total, 4) if total > 0 else 0,
            "avg_confidence": round(avg_confidence, 4),
            "by_confidence_band": by_confidence,
            "by_league": by_league,
            "by_market": by_market,
            "cold_start": total < 30,
        }
    finally:
        conn.close()
