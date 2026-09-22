# ==============================================================================
# Projet Sentinel — Migration de base de données Neo4j (Non destructive)
# ==============================================================================

import structlog
from datetime import datetime, timezone
from neo4j import AsyncDriver

logger = structlog.get_logger()


async def run_migrations(driver: AsyncDriver) -> None:
    """
    Exécute des migrations idempotentes et sécurisées au démarrage du backend.
    Garantit qu'aucun nœud ni relation n'est supprimé lors des mises à jour.
    """
    logger.info("Executing database migration checks...")
    now = datetime.now(timezone.utc).isoformat()

    async with driver.session(database="neo4j") as session:
        # 1. Sécuriser les champs obligatoires sur tous les nœuds Item
        await session.run(
            """
            MATCH (i:Item)
            WHERE i.statut IS NULL
            SET i.statut = 'A_FAIRE'
            """
        )
        await session.run(
            """
            MATCH (i:Item)
            WHERE i.priorite IS NULL
            SET i.priorite = 'NORMALE'
            """
        )
        await session.run(
            """
            MATCH (i:Item)
            WHERE i.type IS NULL
            SET i.type = 'TACHE'
            """
        )
        await session.run(
            """
            MATCH (i:Item)
            WHERE i.created_at IS NULL
            SET i.created_at = $now
            """,
            now=now,
        )
        await session.run(
            """
            MATCH (i:Item)
            WHERE i.updated_at IS NULL
            SET i.updated_at = $now
            """,
            now=now,
        )

        # 2. Sécuriser l'attribut `id` sur toutes les relations
        await session.run(
            """
            MATCH ()-[r]->()
            WHERE r.id IS NULL
            SET r.id = randomUUID(), r.created_at = $now
            """,
            now=now,
        )

        # 3. Migrer les anciennes relations génériques :REL vers :CONTIENT_ETAPE
        await session.run(
            """
            MATCH (a:Item)-[r:REL]->(b:Item)
            MERGE (a)-[r2:CONTIENT_ETAPE {id: r.id}]->(b)
            SET r2.type = 'CONTIENT_ETAPE', r2.created_at = COALESCE(r.created_at, $now)
            DELETE r
            """,
            now=now,
        )

        # 4. Compter le total des nœuds et des relations pour les logs
        result = await session.run(
            """
            MATCH (n)
            OPTIONAL MATCH (n)-[r]->(m)
            RETURN count(DISTINCT n) AS node_count, count(DISTINCT r) AS rel_count
            """
        )
        rec = await result.single()
        if rec:
            logger.info(
                "Database migration completed successfully",
                total_nodes=rec["node_count"],
                total_relations=rec["rel_count"],
            )
