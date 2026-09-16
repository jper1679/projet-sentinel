# ==============================================================================
# Projet Sentinel — Hachage Bcrypt (passlib)
# ==============================================================================

from passlib.context import CryptContext

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain_password: str) -> str:
    """Retourne le hash Bcrypt du mot de passe en clair."""
    return _pwd_context.hash(plain_password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Vérifie qu'un mot de passe en clair correspond au hash stocké."""
    return _pwd_context.verify(plain_password, hashed_password)
