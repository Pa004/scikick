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

        by_league_filter = "WHERE t.market = ?"
        by_league_params: list = [market]

        by_league_rows = conn.execute(
            f"SELECT t.league, COUNT(*) as total, "
            f"SUM(CASE WHEN t.hit = 1 THEN 1 ELSE 0 END) as hits "
            f"FROM tracked t {by_league_filter} "
            f"GROUP BY t.league "
            f"ORDER BY total DESC",
            by_league_params,
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

        market_breakdown_filter = "WHERE 1=1"
        market_breakdown_params: list = []
        if league:
            market_breakdown_filter += " AND t.league = ?"
            market_breakdown_params.append(league)

        by_market_rows = conn.execute(
            f"SELECT t.market, COUNT(*) as total, "
            f"SUM(CASE WHEN t.hit = 1 THEN 1 ELSE 0 END) as hits "
            f"FROM tracked t {market_breakdown_filter} "
            f"GROUP BY t.market "
            f"ORDER BY total DESC",
            market_breakdown_params,
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


@router.get("/stats/per-matchday")
def get_stats_per_matchday(league: str | None = None, market: str = "1x2"):
    conn = get_connection()
    try:
        base_filter = "WHERE t.market = ?"
        params: list = [market]
        if league:
            base_filter += " AND t.league = ?"
            params.append(league)

        rows = conn.execute(
            f"SELECT DATE(t.resolved_at) as matchday, "
            f"COUNT(*) as total, "
            f"SUM(CASE WHEN t.hit = 1 THEN 1 ELSE 0 END) as hits, "
            f"AVG(t.confidence) as avg_confidence "
            f"FROM tracked t {base_filter} "
            f"GROUP BY DATE(t.resolved_at) "
            f"ORDER BY DATE(t.resolved_at)",
            params,
        ).fetchall()

        result = []
        for r in rows:
            total = r["total"]
            hits = r["hits"] or 0
            accuracy = round(hits / total, 4) if total > 0 else 0
            avg_conf = r["avg_confidence"] or 0
            brier = round((1 - accuracy) ** 2 + (1 - avg_conf) ** 2, 4) if total > 0 else 0
            result.append({
                "matchday": r["matchday"],
                "total": total,
                "hits": hits,
                "accuracy": accuracy,
                "brier": brier,
            })

        return {
            "market": market,
            "league": league,
            "cold_start": len(result) < 5,
            "data": result,
        }
    finally:
        conn.close()


@router.get("/stats/calibration")
def get_calibration(league: str | None = None, market: str = "1x2"):
    conn = get_connection()
    try:
        base_filter = "WHERE t.market = ?"
        params: list = [market]
        if league:
            base_filter += " AND t.league = ?"
            params.append(league)

        rows = conn.execute(
            f"SELECT t.confidence, t.hit "
            f"FROM tracked t {base_filter}",
            params,
        ).fetchall()

        if len(rows) < 30:
            return {
                "market": market,
                "league": league,
                "cold_start": True,
                "message": "Need at least 30 resolved predictions for calibration data",
                "data": [],
            }

        bins = [0.0] * 10
        bin_hits = [0.0] * 10
        bin_counts = [0] * 10

        for r in rows:
            conf = r["confidence"]
            hit = r["hit"] or 0
            bin_idx = min(int(conf * 10), 9)
            bins[bin_idx] += conf
            bin_hits[bin_idx] += hit
            bin_counts[bin_idx] += 1

        result = []
        for i in range(10):
            if bin_counts[i] > 0:
                avg_predicted = round(bins[i] / bin_counts[i], 4)
                actual_accuracy = round(bin_hits[i] / bin_counts[i], 4)
                result.append({
                    "bin_center": round((i + 0.5) / 10, 2),
                    "avg_predicted": avg_predicted,
                    "actual_accuracy": actual_accuracy,
                    "count": bin_counts[i],
                })

        return {
            "market": market,
            "league": league,
            "cold_start": False,
            "data": result,
        }
    finally:
        conn.close()
