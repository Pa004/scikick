from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.api.schemas import PredictRequest, PredictResponse

router = APIRouter()


@router.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest):
    raise HTTPException(status_code=501, detail="Predict not yet implemented")


@router.get("/predict/{fixture_id}", response_model=PredictResponse)
def get_prediction(fixture_id: int):
    raise HTTPException(status_code=501, detail="Get prediction not yet implemented")
