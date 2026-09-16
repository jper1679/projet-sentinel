# ==============================================================================
# Projet Sentinel — Point d'entrée FastAPI
# ==============================================================================

from contextlib import asynccontextmanager
import structlog

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database.connection import init_db, close_db, create_admin_user
from app.routers import auth, nodes, links, mailer, agent

logger = structlog.get_logger()
settings = get_settings()


# ==============================================================================
# Lifespan : démarrage & arrêt propre
# ==============================================================================
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialise Neo4j et crée le compte ADMIN au démarrage."""
    logger.info("Sentinel backend starting", env=settings.app_env)

    # 1. Connexion Neo4j + contraintes + index
    await init_db()
    logger.info("Neo4j initialized")

    # 2. Création de l'utilisateur ADMIN si inexistant
    await create_admin_user()
    logger.info("Admin user verified")

    yield  # Application active

    # Arrêt propre
    await close_db()
    logger.info("Sentinel backend stopped")


# ==============================================================================
# Application FastAPI
# ==============================================================================
app = FastAPI(
    title="Sentinel API",
    description="API de gestion de graphe PLM/ALM — Projet Sentinel",
    version="1.0.0",
    docs_url="/docs",
    openapi_url="/openapi.json",
    lifespan=lifespan,
    debug=settings.app_debug,
)

# ------------------------------------------------------------------------------
# Middleware CORS
# ------------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ------------------------------------------------------------------------------
# Routeurs
# ------------------------------------------------------------------------------
app.include_router(auth.router,   prefix="/api/auth",   tags=["Auth"])
app.include_router(nodes.router,  prefix="/api/nodes",  tags=["Nodes"])
app.include_router(links.router,  prefix="/api/links",  tags=["Links"])
app.include_router(mailer.router, prefix="/api/mailer", tags=["Mailer"])
app.include_router(agent.router,  prefix="/api/agent",    tags=["Agent"])
app.include_router(agent.router,  prefix="/api/v1/agent", tags=["Agent v1"])



# ------------------------------------------------------------------------------
# Health Check
# ------------------------------------------------------------------------------
@app.api_route("/api/health", methods=["GET", "HEAD"], tags=["System"])
async def health():
    return {"status": "ok", "version": "1.0.0", "env": settings.app_env}
