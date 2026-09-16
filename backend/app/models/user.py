# ==============================================================================
# Projet Sentinel — Modèles Pydantic : User
# ==============================================================================

from datetime import datetime
from enum import StrEnum
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class UserRole(StrEnum):
    ADMIN = "ADMIN"
    USER = "USER"
    CLIENT = "CLIENT"


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, description="Mot de passe (min 8 caractères)")
    nom: str = Field(..., min_length=1, max_length=100)
    role: UserRole = UserRole.USER


class UserOut(BaseModel):
    id: str
    email: EmailStr
    nom: str
    role: UserRole
    created_at: str

    model_config = {"from_attributes": True}


class UserInDB(UserOut):
    hashed_password: str


class UserUpdate(BaseModel):
    nom: Optional[str] = Field(None, max_length=100)
    role: Optional[UserRole] = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
