from __future__ import annotations

from pydantic import BaseModel


class PredictRequest(BaseModel):
    fixture_id: int


class MarketProb(BaseModel):
    home: float
    draw: float
    away: float


class DoubleChance(BaseModel):
    home_or_draw: float
    draw_or_away: float
    home_or_away: float


class OverUnder(BaseModel):
    over: float
    under: float


class BTTS(BaseModel):
    yes: float
    no: float


class PredictResponse(BaseModel):
    fixture_id: int
    model_version: str
    model_agreement: float
    probabilities: dict[str, MarketProb | DoubleChance | OverUnder | BTTS | dict]
    market_odds: dict[str, MarketProb] | None = None
