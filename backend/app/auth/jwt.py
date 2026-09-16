# ==============================================================================
# Projet Sentinel — JWT (python-jose)
# ==============================================================================

from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt

from app.config import get_settings

settings = get_settings()


def create_access_token(data: dict[str, Any]) -> str:
    """
    Crée un JWT signé avec les claims fournis + expiration.
    `data` doit contenir au minimum {"sub": user_id, "role": role}.
    """
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.jwt_access_token_expire_minutes
    )
    to_encode["exp"] = expire
    to_encode["iat"] = datetime.now(timezone.utc)

    return jwt.encode(
        to_encode,
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )


def decode_access_token(token: str) -> dict[str, Any]:
    """
    Décode et vérifie un JWT.
    Lève JWTError si invalide ou expiré.
    """
    return jwt.decode(
        token,
        settings.jwt_secret_key,
        algorithms=[settings.jwt_algorithm],
    )


def is_token_valid(token: str) -> bool:
    """Retourne True si le token est valide, False sinon."""
    try:
        decode_access_token(token)
        return True
    except JWTError:
        return False
