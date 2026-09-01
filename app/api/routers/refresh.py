from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import get_current_token

router = APIRouter()


@router.post("/refresh")
def refresh(token: str = Depends(get_current_token)):
    if not token:
        raise HTTPException(status_code=401, detail="Service token required")
    raise HTTPException(status_code=501, detail="Refresh not yet implemented")
