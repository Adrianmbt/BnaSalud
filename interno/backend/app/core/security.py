"""Seguridad del API interno: validación de JWT emitido en `/auth/login`."""
from typing import List, Optional

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import settings

_bearer = HTTPBearer(auto_error=False)


def get_current_user(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
) -> dict:
    """Valida el Bearer token y devuelve el payload (`sub`, `rol`, `personal_id`, ...)."""
    if creds is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Se requiere autenticación.",
        )
    try:
        payload = jwt.decode(
            creds.credentials,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
        )
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado.",
        )
    if not payload.get("sub"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido.",
        )
    return payload


def require_roles(*roles: str):
    """Crea una dependencia que exige que el usuario tenga uno de los roles (DB) dados."""

    async def _guard(user: dict = Depends(get_current_user)) -> dict:
        if user.get("rol") not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tiene permiso para esta operación.",
            )
        return user

    return _guard