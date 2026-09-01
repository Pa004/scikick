from __future__ import annotations

from fastapi import APIRouter, HTTPException

router = APIRouter()


@router.get("/stats")
def get_stats():
    raise HTTPException(status_code=501, detail="Stats not yet implemented")
