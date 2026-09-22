# ==============================================================================
# Projet Sentinel — Router Links (Relations Neo4j)
# GET    /api/links       → Lister les relations
# POST   /api/links       → Créer une relation
# DELETE /api/links/{id}  → Supprimer une relation
# ==============================================================================

import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from neo4j import AsyncSession

from app.auth.dependencies import CurrentUser
from app.database.connection import get_session
from app.database.queries import run_query, run_single
from app.models.link import LinkCreate, LinkOut

router = APIRouter()

# Relations autorisées (liste blanche sécurité Cypher injection)
VALID_RELATIONS = {
    "EXECUTE_AVANT",
    "BLOQUEE_PAR",
    "RATTACHE_A",
    "ASSIGNE_A",
    "SUIVIE_DE",
    "CONTIENT_ETAPE",
    "LIE_A",
}


def _row_to_link(row: dict) -> LinkOut:
    raw_type = str(row.get("type") or "LIE_A").upper().strip()
    valid_types = {
        "EXECUTE_AVANT", "BLOQUEE_PAR", "RATTACHE_A",
        "ASSIGNE_A", "SUIVIE_DE", "CONTIENT_ETAPE", "LIE_A"
    }
    link_type = raw_type if raw_type in valid_types else "LIE_A"
    now = datetime.now(timezone.utc).isoformat()

    return LinkOut(
        id=str(row.get("id") or uuid.uuid4()),
        source_id=str(row.get("source_id")),
        target_id=str(row.get("target_id")),
        type=link_type,
        created_at=str(row.get("created_at") or now),
    )


# ------------------------------------------------------------------------------
# GET /api/links
# ------------------------------------------------------------------------------
@router.get("/", response_model=list[LinkOut], summary="Lister toutes les relations")
async def list_links(
    _user: CurrentUser,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    records = await run_query(
        session,
        """
        MATCH (s:Item)-[r]->(t:Item)
        WHERE type(r) IN [
            'EXECUTE_AVANT', 'BLOQUEE_PAR', 'RATTACHE_A',
            'ASSIGNE_A', 'SUIVIE_DE', 'CONTIENT_ETAPE', 'LIE_A'
        ]
        RETURN r.id AS id, s.id AS source_id, t.id AS target_id,
               type(r) AS type, r.created_at AS created_at
        ORDER BY r.created_at DESC
        """,
    )
    return [_row_to_link(r) for r in records if r.get("source_id") and r.get("target_id")]


# ------------------------------------------------------------------------------
# POST /api/links
# ------------------------------------------------------------------------------
@router.post(
    "/",
    response_model=LinkOut,
    status_code=status.HTTP_201_CREATED,
    summary="Créer une relation entre deux nœuds",
)
async def create_link(
    body: LinkCreate,
    _user: CurrentUser,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    rel_type = body.type.value
    if rel_type not in VALID_RELATIONS:
        raise HTTPException(status_code=422, detail=f"Type de relation invalide: {rel_type}")

    # Vérifier que les deux nœuds existent
    src = await run_single(session, "MATCH (i:Item {id: $id}) RETURN i.id AS id", {"id": body.source_id})
    tgt = await run_single(session, "MATCH (i:Item {id: $id}) RETURN i.id AS id", {"id": body.target_id})

    if not src:
        raise HTTPException(status_code=404, detail=f"Nœud source '{body.source_id}' introuvable")
    if not tgt:
        raise HTTPException(status_code=404, detail=f"Nœud cible '{body.target_id}' introuvable")
    if body.source_id == body.target_id:
        raise HTTPException(status_code=422, detail="Un nœud ne peut pas se lier à lui-même")

    link_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    cypher_map = {
        "EXECUTE_AVANT": """
            MATCH (s:Item {id: $src}), (t:Item {id: $tgt})
            CREATE (s)-[r:EXECUTE_AVANT {id: $id, created_at: $created_at}]->(t)
            RETURN r.id AS id
        """,
        "BLOQUEE_PAR": """
            MATCH (s:Item {id: $src}), (t:Item {id: $tgt})
            CREATE (s)-[r:BLOQUEE_PAR {id: $id, created_at: $created_at}]->(t)
            RETURN r.id AS id
        """,
        "RATTACHE_A": """
            MATCH (s:Item {id: $src}), (t:Item {id: $tgt})
            CREATE (s)-[r:RATTACHE_A {id: $id, created_at: $created_at}]->(t)
            RETURN r.id AS id
        """,
        "ASSIGNE_A": """
            MATCH (s:Item {id: $src}), (t:Item {id: $tgt})
            CREATE (s)-[r:ASSIGNE_A {id: $id, created_at: $created_at}]->(t)
            RETURN r.id AS id
        """,
        "SUIVIE_DE": """
            MATCH (s:Item {id: $src}), (t:Item {id: $tgt})
            CREATE (s)-[r:SUIVIE_DE {id: $id, created_at: $created_at}]->(t)
            RETURN r.id AS id
        """,
        "CONTIENT_ETAPE": """
            MATCH (s:Item {id: $src}), (t:Item {id: $tgt})
            CREATE (s)-[r:CONTIENT_ETAPE {id: $id, created_at: $created_at}]->(t)
            RETURN r.id AS id
        """,
        "LIE_A": """
            MATCH (s:Item {id: $src}), (t:Item {id: $tgt})
            CREATE (s)-[r:LIE_A {id: $id, created_at: $created_at}]->(t)
            RETURN r.id AS id
        """,
    }

    res = await run_single(
        session,
        cypher_map[rel_type],
        {"src": body.source_id, "tgt": body.target_id, "id": link_id, "created_at": now},
    )
    if not res:
        raise HTTPException(status_code=500, detail="Échec de la création de la relation")

    return LinkOut(
        id=link_id,
        source_id=body.source_id,
        target_id=body.target_id,
        type=body.type,
        created_at=now,
    )


# ------------------------------------------------------------------------------
# DELETE /api/links/{link_id}
# ------------------------------------------------------------------------------
@router.delete(
    "/{link_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Supprimer une relation",
)
async def delete_link(
    link_id: str,
    _user: CurrentUser,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    result = await session.run(
        """
        MATCH ()-[r {id: $id}]->()
        DELETE r
        RETURN count(r) AS deleted
        """,
        {"id": link_id},
    )
    record = await result.single()
    if not record or record["deleted"] == 0:
        raise HTTPException(status_code=404, detail="Relation introuvable")
