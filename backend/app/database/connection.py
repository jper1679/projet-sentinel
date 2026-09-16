# ==============================================================================
# Projet Sentinel — Driver Neo4j & Initialisation de la base
# ==============================================================================

from neo4j import AsyncGraphDatabase, AsyncDriver
from neo4j.exceptions import ServiceUnavailable
import structlog

from app.config import get_settings
from app.auth.hashing import hash_password

logger = structlog.get_logger()
settings = get_settings()

# Driver global (singleton)
_driver: AsyncDriver | None = None


# ==============================================================================
# Gestion du driver
# ==============================================================================

async def get_driver() -> AsyncDriver:
    global _driver
    if _driver is None:
        _driver = AsyncGraphDatabase.driver(
            settings.neo4j_uri,
            auth=(settings.neo4j_user, settings.neo4j_password),
            max_connection_pool_size=20,
        )
    return _driver


async def get_session():
    """Dependency FastAPI : session Neo4j injectable via Depends()."""
    driver = await get_driver()
    async with driver.session(database="neo4j") as session:
        yield session


# ==============================================================================
# Initialisation : contraintes & index
# ==============================================================================

CONSTRAINTS = [
    # Unicité User
    "CREATE CONSTRAINT user_id_unique IF NOT EXISTS FOR (u:User) REQUIRE u.id IS UNIQUE",
    "CREATE CONSTRAINT user_email_unique IF NOT EXISTS FOR (u:User) REQUIRE u.email IS UNIQUE",
    # Unicité Item
    "CREATE CONSTRAINT item_id_unique IF NOT EXISTS FOR (i:Item) REQUIRE i.id IS UNIQUE",
]

INDEXES = [
    "CREATE INDEX item_statut_idx IF NOT EXISTS FOR (i:Item) ON (i.statut)",
    "CREATE INDEX item_type_idx   IF NOT EXISTS FOR (i:Item) ON (i.type)",
    "CREATE INDEX item_priorite_idx IF NOT EXISTS FOR (i:Item) ON (i.priorite)",
]


async def init_db() -> None:
    """Crée les contraintes et index Neo4j au démarrage."""
    driver = await get_driver()
    try:
        async with driver.session(database="neo4j") as session:
            for cypher in CONSTRAINTS + INDEXES:
                await session.run(cypher)
        logger.info("Neo4j constraints and indexes applied")
    except ServiceUnavailable as e:
        logger.error("Neo4j not reachable", error=str(e))
        raise


async def close_db() -> None:
    """Ferme le driver proprement."""
    global _driver
    if _driver:
        await _driver.close()
        _driver = None


# ==============================================================================
# Création du compte ADMIN initial
# ==============================================================================

async def create_admin_user() -> None:
    """
    Crée l'utilisateur ADMIN défini dans les variables d'environnement
    si et seulement s'il n'existe pas encore.
    """
    import uuid
    from datetime import datetime, timezone

    try:
        driver = await get_driver()
        async with driver.session(database="neo4j") as session:
            result = await session.run(
                "MATCH (u:User {email: $email}) RETURN u.id AS id",
                email=settings.admin_email,
            )
            record = await result.single()
            if record:
                logger.info("Admin user already exists, skipping creation")
                return

            # Création
            admin_id = str(uuid.uuid4())
            hashed = hash_password(settings.admin_password)
            now = datetime.now(timezone.utc).isoformat()

            await session.run(
                """
                CREATE (u:User {
                    id:               $id,
                    email:            $email,
                    hashed_password:  $hashed_password,
                    nom:              $nom,
                    role:             'ADMIN',
                    created_at:       $created_at
                })
                """,
                id=admin_id,
                email=settings.admin_email,
                hashed_password=hashed,
                nom=settings.admin_nom,
                created_at=now,
            )
    except Exception as e:
        logger.warning("Admin user creation warning", error=str(e))
        logger.info("Admin user created", email=settings.admin_email)
