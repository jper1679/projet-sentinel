# ==============================================================================
# Projet Sentinel — Dépendances FastAPI (RBAC)
# ==============================================================================

from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from neo4j import AsyncSession

from app.auth.jwt import decode_access_token
from app.database.connection import get_session
from app.database.queries import run_single
from app.models.user import UserOut

_bearer_scheme = HTTPBearer(auto_error=True)


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(_bearer_scheme)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> UserOut:
    """
    Vérifie le JWT et retourne l'utilisateur courant.
    Levée d'une 401 si token invalide ou utilisateur inexistant.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token invalide ou expiré",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_access_token(credentials.credentials)
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    record = await run_single(
        session,
        "MATCH (u:User {id: $id}) RETURN u.id AS id, u.email AS email, "
        "u.nom AS nom, u.role AS role, u.created_at AS created_at",
        {"id": user_id},
    )
    if record is None:
        raise credentials_exception

    return UserOut(**record)


def require_role(*roles: str):
    """
    Factory de dépendance RBAC.
    Usage : Depends(require_role("ADMIN")) ou Depends(require_role("ADMIN", "USER"))
    """

    async def _check_role(
        current_user: Annotated[UserOut, Depends(get_current_user)],
    ) -> UserOut:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Accès refusé. Rôle requis : {', '.join(roles)}",
            )
        return current_user

    return _check_role


# Alias pratiques
CurrentUser = Annotated[UserOut, Depends(get_current_user)]
AdminOnly = Annotated[UserOut, Depends(require_role("ADMIN"))]
UserOrAdmin = Annotated[UserOut, Depends(require_role("ADMIN", "USER"))]
