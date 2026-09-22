# ==============================================================================
# Projet Sentinel — Router Nodes (Items du graphe)
# CRUD complet + mise à jour de position (X/Y) pour React Flow
# ==============================================================================

import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from neo4j import AsyncSession

from app.auth.dependencies import CurrentUser, UserOrAdmin
from app.database.connection import get_session
from app.database.queries import run_query, run_single
from app.models.item import NodeCreate, NodeOut, NodeUpdate
from app.services.xmind_parser import parse_xmind_bytes

router = APIRouter()


def _row_to_node(row: dict) -> NodeOut:
    """Convertit un record Neo4j en NodeOut de manière totalement résiliente."""
    n = row.get("n", row) if isinstance(row, dict) else {}

    raw_type = str(n.get("type") or "IDEE").upper().strip()
    valid_types = {"IDEE", "TACHE", "PROJET", "COMPOSANT", "PROCEDURE", "ETAPE"}
    node_type = raw_type if raw_type in valid_types else "IDEE"

    raw_statut = str(n.get("statut") or "A_FAIRE").upper().strip()
    if "BLOQ" in raw_statut:
        node_statut = "BLOQUE"
    elif "EN_COURS" in raw_statut or "COURS" in raw_statut or "DOING" in raw_statut:
        node_statut = "EN_COURS"
    elif "TERMINE" in raw_statut or "DONE" in raw_statut or "FINI" in raw_statut:
        node_statut = "TERMINE"
    elif "BACKLOG" in raw_statut:
        node_statut = "BACKLOG"
    else:
        node_statut = "A_FAIRE"

    raw_prio = str(n.get("priorite") or "NORMALE").upper().strip()
    valid_prios = {"BASSE", "NORMALE", "HAUTE", "CRITIQUE"}
    node_prio = raw_prio if raw_prio in valid_prios else "NORMALE"

    now = datetime.now(timezone.utc).isoformat()

    return NodeOut(
        id=str(n.get("id") or uuid.uuid4()),
        titre=str(n.get("titre") or "Sans titre"),
        description=n.get("description"),
        type=node_type,
        statut=node_statut,
        priorite=node_prio,
        temps_estime_h=float(n["temps_estime_h"]) if n.get("temps_estime_h") is not None else None,
        cout_estime=float(n["cout_estime"]) if n.get("cout_estime") is not None else None,
        pos_x=float(n.get("pos_x", 0.0)),
        pos_y=float(n.get("pos_y", 0.0)),
        created_at=str(n.get("created_at") or now),
        updated_at=str(n.get("updated_at") or now),
    )


# ------------------------------------------------------------------------------
# GET /api/nodes — Liste tous les nœuds
# ------------------------------------------------------------------------------
@router.get("/", response_model=list[NodeOut], summary="Lister tous les nœuds")
async def list_nodes(
    _user: CurrentUser,
    session: Annotated[AsyncSession, Depends(get_session)],
    statut: str | None = None,
    type: str | None = None,
):
    where_clauses = []
    params: dict = {}
    if statut:
        where_clauses.append("i.statut = $statut")
        params["statut"] = statut
    if type:
        where_clauses.append("i.type = $type")
        params["type"] = type

    where = ("WHERE " + " AND ".join(where_clauses)) if where_clauses else ""
    records = await run_query(
        session,
        f"""
        MATCH (i:Item)
        {where}
        RETURN i {{
            .id, .titre, .description, .type, .statut, .priorite,
            .temps_estime_h, .cout_estime, .pos_x, .pos_y,
            .created_at, .updated_at
        }} AS n
        ORDER BY i.created_at DESC
        """,
        params,
    )
    return [_row_to_node(r) for r in records]


# ------------------------------------------------------------------------------
# POST /api/nodes — Créer un nœud
# ------------------------------------------------------------------------------
@router.post(
    "/",
    response_model=NodeOut,
    status_code=status.HTTP_201_CREATED,
    summary="Créer un nouveau nœud",
)
async def create_node(
    body: NodeCreate,
    _user: CurrentUser,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    now = datetime.now(timezone.utc).isoformat()
    node_id = str(uuid.uuid4())

    record = await run_single(
        session,
        """
        CREATE (i:Item {
            id:             $id,
            titre:          $titre,
            description:    $description,
            type:           $type,
            statut:         $statut,
            priorite:       $priorite,
            temps_estime_h: $temps_estime_h,
            cout_estime:    $cout_estime,
            pos_x:          $pos_x,
            pos_y:          $pos_y,
            created_at:     $created_at,
            updated_at:     $updated_at
        })
        RETURN i {
            .id, .titre, .description, .type, .statut, .priorite,
            .temps_estime_h, .cout_estime, .pos_x, .pos_y,
            .created_at, .updated_at
        } AS n
        """,
        {
            "id": node_id,
            "titre": body.titre,
            "description": body.description,
            "type": body.type.value,
            "statut": body.statut.value,
            "priorite": body.priorite.value,
            "temps_estime_h": body.temps_estime_h,
            "cout_estime": body.cout_estime,
            "pos_x": body.pos_x,
            "pos_y": body.pos_y,
            "created_at": now,
            "updated_at": now,
        },
    )
    if not record:
        raise HTTPException(status_code=500, detail="Échec de la création du nœud")
    return _row_to_node(record)


# ------------------------------------------------------------------------------
# GET /api/nodes/{node_id} — Détail d'un nœud
# ------------------------------------------------------------------------------
@router.get("/{node_id}", response_model=NodeOut, summary="Récupérer un nœud")
async def get_node(
    node_id: str,
    _user: CurrentUser,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    record = await run_single(
        session,
        """
        MATCH (i:Item {id: $id})
        RETURN i {
            .id, .titre, .description, .type, .statut, .priorite,
            .temps_estime_h, .cout_estime, .pos_x, .pos_y,
            .created_at, .updated_at
        } AS n
        """,
        {"id": node_id},
    )
    if not record:
        raise HTTPException(status_code=404, detail="Nœud introuvable")
    return _row_to_node(record)


# ------------------------------------------------------------------------------
# PUT /api/nodes/{node_id} — Mettre à jour un nœud (champs + position)
# ------------------------------------------------------------------------------
@router.put("/{node_id}", response_model=NodeOut, summary="Mettre à jour un nœud")
async def update_node(
    node_id: str,
    body: NodeUpdate,
    _user: CurrentUser,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    # Construire les SET dynamiques (seulement les champs fournis)
    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=422, detail="Aucun champ à mettre à jour")

    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    # Convertir les enums en string
    for key in ("type", "statut", "priorite"):
        if key in updates and hasattr(updates[key], "value"):
            updates[key] = updates[key].value

    set_clause = ", ".join(f"i.{k} = ${k}" for k in updates)

    record = await run_single(
        session,
        f"""
        MATCH (i:Item {{id: $node_id}})
        SET {set_clause}
        RETURN i {{
            .id, .titre, .description, .type, .statut, .priorite,
            .temps_estime_h, .cout_estime, .pos_x, .pos_y,
            .created_at, .updated_at
        }} AS n
        """,
        {"node_id": node_id, **updates},
    )
    if not record:
        raise HTTPException(status_code=404, detail="Nœud introuvable")
    return _row_to_node(record)


# ------------------------------------------------------------------------------
# DELETE /api/nodes/{node_id}
# ------------------------------------------------------------------------------
@router.delete(
    "/{node_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Supprimer un nœud et ses relations",
)
async def delete_node(
    node_id: str,
    _user: UserOrAdmin,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    result = await session.run(
        "MATCH (i:Item {id: $id}) DETACH DELETE i RETURN count(i) AS deleted",
        {"id": node_id},
    )
    record = await result.single()
    if not record or record["deleted"] == 0:
        raise HTTPException(status_code=404, detail="Nœud introuvable")


# ------------------------------------------------------------------------------
# POST /api/nodes/import/xmind — Importer un fichier XMind (.xmind)
# ------------------------------------------------------------------------------
@router.post("/import/xmind", summary="Importer un fichier XMind (.xmind)")
async def import_xmind(
    _user: CurrentUser,
    session: Annotated[AsyncSession, Depends(get_session)],
    file: UploadFile = File(...),
):
    try:
        contents = await file.read()
        nodes_data, links_data = parse_xmind_bytes(contents)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Fichier XMind invalide : {str(e)}")

    if not nodes_data:
        raise HTTPException(status_code=422, detail="Aucun sujet/nœud trouvé dans le fichier XMind.")

    now = datetime.now(timezone.utc).isoformat()
    for n in nodes_data:
        n["created_at"] = now
        n["updated_at"] = now

    for l in links_data:
        l["created_at"] = now

    # Bulk create nodes in Neo4j
    res_nodes = await session.run(
        """
        UNWIND $nodes AS row
        MERGE (i:Item {id: row.id})
        SET i.titre = row.titre,
            i.description = row.description,
            i.type = row.type,
            i.statut = row.statut,
            i.priorite = row.priorite,
            i.pos_x = row.pos_x,
            i.pos_y = row.pos_y,
            i.created_at = row.created_at,
            i.updated_at = row.updated_at
        RETURN count(i) AS cnt
        """,
        {"nodes": nodes_data},
    )
    await res_nodes.consume()

    # Bulk create links in Neo4j
    if links_data:
        res_links = await session.run(
            """
            UNWIND $links AS row
            MATCH (a:Item {id: row.source_id})
            MATCH (b:Item {id: row.target_id})
            MERGE (a)-[r:REL {id: row.id}]->(b)
            SET r.type = row.type,
                r.created_at = row.created_at
            RETURN count(r) AS cnt
            """,
            {"links": links_data},
        )
        await res_links.consume()

    return {
        "status": "success",
        "created_nodes": len(nodes_data),
        "created_links": len(links_data),
        "message": f"{len(nodes_data)} nœuds et {len(links_data)} relations créés avec succès.",
    }

