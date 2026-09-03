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


class TopFeature(BaseModel):
    feature: str
    value: float
    shap_importance: float


class PredictResponse(BaseModel):
    fixture_id: int
    model_version: str
    model_agreement: float
    probabilities: dict[str, MarketProb | DoubleChance | OverUnder | BTTS | dict]
    probable_score: dict[str, int] | None = None
    top_features: list[TopFeature] | None = None
    market_odds: dict[str, MarketProb] | None = None


class ScorerPlayer(BaseModel):
    player_id: int
    name: str
    team: str
    position: str
    xg90: float
    min_expected: float
    prob_anytime: float
    home_away: str


class ScorerPrediction(BaseModel):
    fixture_id: int
    data_quality: str
    scorers: list[ScorerPlayer]
