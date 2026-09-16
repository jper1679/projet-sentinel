# ==============================================================================
# Projet Sentinel — Configuration (Pydantic Settings)
# Lit automatiquement le fichier .env via pydantic-settings
# ==============================================================================

from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # --------------------------------------------------------------------------
    # Application
    # --------------------------------------------------------------------------
    app_env: str = "production"
    app_debug: bool = False
    cors_origins: str = "http://localhost:9080"

    # --------------------------------------------------------------------------
    # Neo4j
    # --------------------------------------------------------------------------
    neo4j_uri: str = "bolt://neo4j:7687"
    neo4j_user: str = "neo4j"
    neo4j_password: str

    # --------------------------------------------------------------------------
    # JWT
    # --------------------------------------------------------------------------
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 480

    # --------------------------------------------------------------------------
    # Compte ADMIN initial
    # --------------------------------------------------------------------------
    admin_email: str = "admin@sentinel.local"
    admin_password: str
    admin_nom: str = "Administrateur"

    # --------------------------------------------------------------------------
    # Brevo SMTP
    # --------------------------------------------------------------------------
    brevo_api_key: str = ""
    brevo_sender_email: str = "noreply@sentinel.local"
    brevo_sender_name: str = "Sentinel App"

    # --------------------------------------------------------------------------
    # Gemini AI
    # --------------------------------------------------------------------------
    gemini_api_key: str = ""

    # --------------------------------------------------------------------------
    # GitHub Integration
    # --------------------------------------------------------------------------
    github_token: str = ""
    github_repo: str = ""

    # --------------------------------------------------------------------------
    # Discord Integration
    # --------------------------------------------------------------------------
    discord_bot_token: str = ""

    @property
    def cors_origins_list(self) -> list[str]:
        """Convertit la chaîne CORS_ORIGINS en liste."""
        if "*" in self.cors_origins:
            return ["*"]
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache()
def get_settings() -> Settings:
    """Singleton : les settings ne sont parsés qu'une seule fois."""
    return Settings()
