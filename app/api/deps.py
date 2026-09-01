from __future__ import annotations

from fastapi import Depends, HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.config import get_settings

security = HTTPBearer(auto_error=False)


def get_current_token(
    credentials: HTTPAuthorizationCredentials | None = Security(security),
) -> str:
    settings = get_settings()
    if not settings.service_token:
        return ""
    if not credentials:
        raise HTTPException(status_code=401, detail="Missing authorization token")
    if credentials.credentials != settings.service_token:
        raise HTTPException(status_code=403, detail="Invalid token")
    return credentials.credentials
