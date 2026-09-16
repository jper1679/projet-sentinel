# ==============================================================================
# Projet Sentinel — Router Auth
# POST /api/auth/login  → TokenResponse
# GET  /api/auth/me     → UserOut
# POST /api/auth/register (ADMIN seulement)
# ==============================================================================

import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from neo4j import AsyncSession

from app.auth.dependencies import AdminOnly, CurrentUser, get_current_user
from app.auth.hashing import hash_password, verify_password
from app.auth.jwt import create_access_token
from app.database.connection import get_session
from app.database.queries import run_single
from app.models.user import LoginRequest, TokenResponse, UserCreate, UserOut

router = APIRouter()


# ------------------------------------------------------------------------------
# POST /api/auth/login
# ------------------------------------------------------------------------------
@router.post("/login", response_model=TokenResponse, summary="Connexion utilisateur")
async def login(
    body: LoginRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    record = await run_single(
        session,
        """
        MATCH (u:User {email: $email})
        RETURN u.id AS id, u.email AS email, u.nom AS nom,
               u.role AS role, u.created_at AS created_at,
               u.hashed_password AS hashed_password
        """,
        {"email": body.email},
    )

    if not record or not verify_password(body.password, record["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou mot de passe incorrect",
        )

    token = create_access_token({"sub": record["id"], "role": record["role"]})
    user = UserOut(
        id=record["id"],
        email=record["email"],
        nom=record["nom"],
        role=record["role"],
        created_at=record["created_at"],
    )
    return TokenResponse(access_token=token, user=user)


# ------------------------------------------------------------------------------
# GET /api/auth/me
# ------------------------------------------------------------------------------
@router.get("/me", response_model=UserOut, summary="Profil de l'utilisateur connecté")
async def get_me(current_user: CurrentUser):
    return current_user


# ------------------------------------------------------------------------------
# POST /api/auth/register (ADMIN uniquement)
# ------------------------------------------------------------------------------
@router.post(
    "/register",
    response_model=UserOut,
    status_code=status.HTTP_201_CREATED,
    summary="Créer un nouvel utilisateur (ADMIN)",
)
async def register_user(
    body: UserCreate,
    _admin: AdminOnly,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    # Vérifier unicité email
    existing = await run_single(
        session,
        "MATCH (u:User {email: $email}) RETURN u.id AS id",
        {"email": body.email},
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Un utilisateur avec cet email existe déjà",
        )

    now = datetime.now(timezone.utc).isoformat()
    user_id = str(uuid.uuid4())

    await session.run(
        """
        CREATE (u:User {
            id:              $id,
            email:           $email,
            hashed_password: $hashed_password,
            nom:             $nom,
            role:            $role,
            created_at:      $created_at
        })
        """,
        {
            "id": user_id,
            "email": body.email,
            "hashed_password": hash_password(body.password),
            "nom": body.nom,
            "role": body.role.value,
            "created_at": now,
        },
    )

    return UserOut(id=user_id, email=body.email, nom=body.nom, role=body.role, created_at=now)
