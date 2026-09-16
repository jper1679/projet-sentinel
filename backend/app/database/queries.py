# ==============================================================================
# Projet Sentinel — Helpers Cypher (moteur de requêtes)
# ==============================================================================

from neo4j import AsyncSession
from typing import Any


async def run_query(
    session: AsyncSession,
    cypher: str,
    params: dict[str, Any] | None = None,
) -> list[dict]:
    """Exécute une requête Cypher et retourne les résultats sous forme de dicts."""
    result = await session.run(cypher, params or {})
    records = await result.data()
    return records


async def run_single(
    session: AsyncSession,
    cypher: str,
    params: dict[str, Any] | None = None,
) -> dict | None:
    """Retourne le premier résultat ou None."""
    result = await session.run(cypher, params or {})
    record = await result.single()
    return dict(record) if record else None
