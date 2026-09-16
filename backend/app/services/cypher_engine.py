# ==============================================================================
# Projet Sentinel — Moteur Cypher (helpers graphe avancés)
# ==============================================================================

from neo4j import AsyncSession
from app.database.queries import run_query


async def get_node_with_relations(session: AsyncSession, node_id: str) -> dict:
    """
    Retourne un nœud avec toutes ses relations entrantes et sortantes.
    Utile pour le panneau de détail enrichi.
    """
    records = await run_query(
        session,
        """
        MATCH (i:Item {id: $id})
        OPTIONAL MATCH (i)-[r_out]->(t:Item)
        OPTIONAL MATCH (s:Item)-[r_in]->(i)
        RETURN
            i { .id, .titre, .description, .type, .statut, .priorite,
                .temps_estime_h, .cout_estime, .pos_x, .pos_y,
                .created_at, .updated_at } AS node,
            collect(DISTINCT {
                id: r_out.id,
                target_id: t.id,
                target_titre: t.titre,
                type: type(r_out)
            }) AS outgoing,
            collect(DISTINCT {
                id: r_in.id,
                source_id: s.id,
                source_titre: s.titre,
                type: type(r_in)
            }) AS incoming
        """,
        {"id": node_id},
    )
    return records[0] if records else {}


async def get_full_graph(session: AsyncSession) -> dict:
    """
    Retourne tous les nœuds et toutes les relations pour le canevas Mindmap.
    Optimisé pour le chargement initial de React Flow.
    """
    nodes_records = await run_query(
        session,
        """
        MATCH (i:Item)
        RETURN i {
            .id, .titre, .description, .type, .statut, .priorite,
            .temps_estime_h, .cout_estime, .pos_x, .pos_y,
            .created_at, .updated_at
        } AS n
        ORDER BY i.created_at ASC
        """,
    )

    edges_records = await run_query(
        session,
        """
        MATCH (s:Item)-[r]->(t:Item)
        WHERE type(r) IN ['BLOQUEE_PAR', 'RATTACHE_A', 'LIE_A']
        RETURN r.id AS id, s.id AS source_id, t.id AS target_id,
               type(r) AS type, r.created_at AS created_at
        """,
    )

    return {
        "nodes": [r["n"] for r in nodes_records],
        "edges": edges_records,
    }
