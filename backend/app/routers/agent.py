# ==============================================================================
# Projet Sentinel — Router Agent (Ingestion Scratchpad, Procedures & Gemini AI)
# ==============================================================================

import os
import random
import uuid
from datetime import datetime, timezone
from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from neo4j import AsyncSession

from app.auth.dependencies import CurrentUser
from app.config import get_settings
from app.database.connection import get_session
from app.database.queries import run_query, run_single
from app.agents.ops_agent import PROCEDURE_SYSTEM_PROMPT
from app.schemas.agent import (
    IngestionAnalysisResult,
    ScratchpadApplyRequest,
    ScratchpadParseRequest,
    ActionTypeEnum,
    AgentRunTaskRequest,
    AgentRunTaskResponse,
    AgentHistoryItem,
    AgentHistoryResponse,
)
from app.services.gemini_agent import run_agent_task

logger = structlog.get_logger()
settings = get_settings()

router = APIRouter()


def _normalize_statut(val: str | None) -> str:
    if not val:
        return "A_FAIRE"
    v = val.upper().strip()
    if "BLOQ" in v:
        return "BLOQUE"
    if "EN_COURS" in v or "COURS" in v or "DOING" in v:
        return "EN_COURS"
    if "TERMINE" in v or "DONE" in v or "FINI" in v:
        return "TERMINE"
    if "BACKLOG" in v:
        return "BACKLOG"
    return "A_FAIRE"


# ------------------------------------------------------------------------------
# POST /api/agent/parse — Analyser des notes brutes ou procédures avec Gemini
# ------------------------------------------------------------------------------
@router.post(
    "/parse",
    response_model=IngestionAnalysisResult,
    summary="Analyser des notes ou procédures via Gemini 3.6 Flash",
)
async def parse_scratchpad(
    body: ScratchpadParseRequest,
    _user: CurrentUser,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    api_key = settings.gemini_api_key or os.environ.get("GEMINI_API_KEY")
    if not api_key or api_key.strip() == "":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La clé API Gemini n'est pas configurée (GEMINI_API_KEY).",
        )

    # 1. Récupérer les projets existants dans Neo4j
    records = await run_query(
        session,
        """
        MATCH (i:Item)
        WHERE i.type = 'PROJET'
        RETURN i.titre AS titre, i.statut AS statut
        ORDER BY i.titre
        LIMIT 100
        """,
    )
    
    projects_context = []
    for r in records:
        projects_context.append(f"- [PROJET] {r.get('titre')} (statut: {r.get('statut')})")
    
    context_str = "\n".join(projects_context) if projects_context else "Aucun projet existant dans le système."

    system_instruction = PROCEDURE_SYSTEM_PROMPT.format(context_projects_str=context_str)

    # Construire le prompt avec précision optionnelle de l'utilisateur
    if body.clarification_response and body.clarification_response.strip():
        prompt = (
            f"Notes brutes fournies par l'utilisateur :\n{body.raw_text}\n\n"
            f"PRÉCISION UTILISATEUR SUR LE PROJET CIBLE : {body.clarification_response.strip()}"
        )
    else:
        prompt = f"Notes brutes à analyser :\n\n{body.raw_text}"

    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=api_key)
        
        response = None
        for model_name in ["gemini-3.6-flash", "gemini-3.5-flash", "gemini-2.5-flash", "gemini-flash-latest"]:
            try:
                logger.info("Calling Gemini model for procedure parse", model=model_name)
                response = client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        system_instruction=system_instruction,
                        response_mime_type="application/json",
                        response_schema=IngestionAnalysisResult,
                        temperature=0.2,
                    ),
                )
                if response:
                    break
            except Exception as model_err:
                logger.warning(f"Model {model_name} failed: {model_err}, trying next")
                continue

        if not response:
            raise RuntimeError("Aucun modèle Gemini n'a pu traiter la demande.")

        if hasattr(response, "parsed") and isinstance(response.parsed, IngestionAnalysisResult):
            return response.parsed
        elif hasattr(response, "text") and response.text:
            return IngestionAnalysisResult.model_validate_json(response.text)
        else:
            raise ValueError("Réponse vide ou invalide reçue de Gemini.")

    except Exception as e:
        logger.error("Failed to parse procedure with Gemini", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur d'analyse Gemini : {str(e)}",
        )


# ------------------------------------------------------------------------------
# POST /api/agent/apply — Appliquer les nœuds, procédures et relations dans Neo4j
# ------------------------------------------------------------------------------
@router.post(
    "/apply",
    status_code=status.HTTP_200_OK,
    summary="Appliquer la procédure/actions validées dans Neo4j",
)
async def apply_scratchpad_actions(
    body: ScratchpadApplyRequest,
    _user: CurrentUser,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    now = datetime.now(timezone.utc).isoformat()
    created_nodes_count = 0
    updated_nodes_count = 0
    created_links_count = 0

    temp_id_map: dict[str, str] = {}

    # 1. Traitement des nœuds de procédure et étapes (mode graph)
    if body.nodes:
        target_proj_name = (body.target_project_name or "Projet Général").strip()
        target_proj_id = str(uuid.uuid4())

        # Créer/Retrouver le projet cible
        proj_record = await run_single(
            session,
            """
            MERGE (p:Item {titre: $titre})
            ON CREATE SET 
                p.id = $proj_id,
                p.type = 'PROJET',
                p.statut = 'EN_COURS',
                p.priorite = 'NORMALE',
                p.description = $proj_desc,
                p.pos_x = 0.0,
                p.pos_y = 0.0,
                p.created_at = $now,
                p.updated_at = $now
            ON MATCH SET
                p.id = coalesce(p.id, $proj_id),
                p.updated_at = $now
            RETURN p.id AS id, p.pos_x AS pos_x, p.pos_y AS pos_y
            """,
            {
                "titre": target_proj_name,
                "proj_id": target_proj_id,
                "proj_desc": f"Projet {target_proj_name}",
                "now": now,
            },
        )
        real_proj_id = proj_record["id"] if (proj_record and proj_record.get("id")) else target_proj_id
        base_x = proj_record.get("pos_x", 0.0) if proj_record else 0.0
        base_y = proj_record.get("pos_y", 0.0) if proj_record else 0.0

        temp_id_map["target_project"] = real_proj_id
        temp_id_map["proj_root"] = real_proj_id

        # Création des nœuds (PROCEDURE, ETAPE, TACHE, etc.)
        for idx, node in enumerate(body.nodes):
            real_id = str(uuid.uuid4())
            temp_id_map[node.temp_id] = real_id

            node_statut = _normalize_statut(node.statut)
            node_type = node.type.upper() if node.type else "TACHE"

            # Layout visuel calculé
            if node_type == "PROCEDURE":
                pos_x = base_x + 220.0
                pos_y = base_y
            else:
                ordre_idx = node.ordre if node.ordre is not None else (idx + 1)
                pos_x = base_x + 220.0 + (ordre_idx * 190.0)
                pos_y = base_y + ((ordre_idx % 2) * 60.0)

            await session.run(
                """
                CREATE (i:Item {
                    id: $id,
                    titre: $titre,
                    type: $type,
                    statut: $statut,
                    priorite: 'NORMALE',
                    description: $description,
                    pos_x: $pos_x,
                    pos_y: $pos_y,
                    created_at: $now,
                    updated_at: $now
                })
                """,
                {
                    "id": real_id,
                    "titre": node.titre,
                    "type": node_type,
                    "statut": node_statut,
                    "description": node.description or "",
                    "pos_x": pos_x,
                    "pos_y": pos_y,
                    "now": now,
                },
            )
            created_nodes_count += 1

            # Si c'est la racine de la procédure, la relier au projet cible
            if node.temp_id in ("proc_root", "root") or node_type == "PROCEDURE":
                await session.run(
                    """
                    MATCH (p:Item {id: $proj_id})
                    MATCH (proc:Item {id: $proc_id})
                    MERGE (p)-[r:LIÉ_À {type: 'RATTACHÉ_À'}]->(proc)
                    ON CREATE SET r.id = $link_id, r.created_at = $now
                    """,
                    {
                        "proj_id": real_proj_id,
                        "proc_id": real_id,
                        "link_id": str(uuid.uuid4()),
                        "now": now,
                    },
                )
                created_links_count += 1

        # Création des relations (CONTIENT_ÉTAPE, SUIVIE_DE, etc.)
        for rel in body.relationships:
            src_real_id = temp_id_map.get(rel.source_temp_id)
            tgt_real_id = temp_id_map.get(rel.target_temp_id)

            if src_real_id and tgt_real_id:
                link_id = str(uuid.uuid4())
                rel_label = rel.rel_type.strip() if rel.rel_type else "CONTRIBUE_A"

                await session.run(
                    """
                    MATCH (src:Item {id: $src_id})
                    MATCH (tgt:Item {id: $tgt_id})
                    MERGE (src)-[r:LIÉ_À {type: $rel_label}]->(tgt)
                    ON CREATE SET r.id = $link_id, r.created_at = $now
                    """,
                    {
                        "src_id": src_real_id,
                        "tgt_id": tgt_real_id,
                        "rel_label": rel_label,
                        "link_id": link_id,
                        "now": now,
                    },
                )
                created_links_count += 1

    # 2. Mode actions individuelles (compatibilité)
    if body.actions:
        for action in body.actions:
            proj_name = action.target_project.strip()
            proj_id = str(uuid.uuid4())
            act_statut = _normalize_statut(action.status)

            proj_record = await run_single(
                session,
                """
                MERGE (p:Item {titre: $titre})
                ON CREATE SET 
                    p.id = $proj_id,
                    p.type = 'PROJET',
                    p.statut = 'EN_COURS',
                    p.priorite = 'NORMALE',
                    p.description = $proj_desc,
                    p.pos_x = 0.0,
                    p.pos_y = 0.0,
                    p.created_at = $now,
                    p.updated_at = $now
                ON MATCH SET
                    p.id = coalesce(p.id, $proj_id),
                    p.updated_at = $now
                RETURN p.id AS id
                """,
                {
                    "titre": proj_name,
                    "proj_id": proj_id,
                    "proj_desc": f"Projet {proj_name}",
                    "now": now,
                },
            )
            target_proj_id = proj_record["id"] if (proj_record and proj_record.get("id")) else proj_id

            if action.action_type in (ActionTypeEnum.CREATE_TASK, ActionTypeEnum.PROCUREMENT_ITEM):
                item_id = str(uuid.uuid4())
                item_type = "COMPOSANT" if action.action_type == ActionTypeEnum.PROCUREMENT_ITEM else "TACHE"
                
                desc_parts = []
                if action.part_details:
                    desc_parts.append(f"Détails : {action.part_details}")
                if action.supplier:
                    desc_parts.append(f"Fournisseur : {action.supplier}")
                if action.notes:
                    desc_parts.append(f"Notes : {action.notes}")
                desc_parts.append(f"Discipline : {action.discipline.value}")
                
                offset_x = random.randint(-250, 250)
                offset_y = random.randint(100, 350)

                await session.run(
                    """
                    MATCH (p:Item) WHERE p.id = $proj_id OR p.titre = $proj_name
                    CREATE (i:Item {
                        id: $item_id,
                        titre: $titre,
                        type: $type,
                        statut: $statut,
                        priorite: 'NORMALE',
                        description: $description,
                        pos_x: coalesce(p.pos_x, 0.0) + $offset_x,
                        pos_y: coalesce(p.pos_y, 0.0) + $offset_y,
                        created_at: $now,
                        updated_at: $now
                    })
                    CREATE (p)-[:LIÉ_À {type: 'CONTRIBUE_A', created_at: $now}]->(i)
                    """,
                    {
                        "proj_id": target_proj_id,
                        "proj_name": proj_name,
                        "item_id": item_id,
                        "titre": action.title,
                        "type": item_type,
                        "statut": act_statut,
                        "description": "\n".join(desc_parts),
                        "offset_x": offset_x,
                        "offset_y": offset_y,
                        "now": now,
                    },
                )
                created_nodes_count += 1

            elif action.action_type == ActionTypeEnum.ADD_BLOCKER:
                item_id = str(uuid.uuid4())
                blocker_desc = f"[BLOCAGE] {action.notes or ''}\nDiscipline: {action.discipline.value}"

                await session.run(
                    """
                    MATCH (p:Item) WHERE p.id = $proj_id OR p.titre = $proj_name
                    CREATE (i:Item {
                        id: $item_id,
                        titre: $titre,
                        type: 'TACHE',
                        statut: 'BLOQUE',
                        priorite: 'HAUTE',
                        description: $description,
                        pos_x: coalesce(p.pos_x, 0.0) + 200.0,
                        pos_y: coalesce(p.pos_y, 0.0) + 200.0,
                        created_at: $now,
                        updated_at: $now
                    })
                    CREATE (p)-[:LIÉ_À {type: 'BLOQUE_PAR', created_at: $now}]->(i)
                    """,
                    {
                        "proj_id": target_proj_id,
                        "proj_name": proj_name,
                        "item_id": item_id,
                        "titre": f"⚠️ {action.title}",
                        "description": blocker_desc,
                        "now": now,
                    },
                )
                created_nodes_count += 1

    logger.info(
        "Scratchpad items applied successfully",
        created_nodes=created_nodes_count,
        updated_nodes=updated_nodes_count,
        created_links=created_links_count,
    )

    return {
        "status": "success",
        "message": f"Procédure/actions appliquées ({created_nodes_count} nœuds créés, {created_links_count} liaisons établies).",
        "created_nodes": created_nodes_count,
        "updated_nodes": updated_nodes_count,
        "created_links": created_links_count,
    }


# ------------------------------------------------------------------------------
# POST /api/v1/agent/run-task — Déclencher l'agent autonome de maintenance GitHub
# ------------------------------------------------------------------------------
@router.post(
    "/run-task",
    response_model=AgentRunTaskResponse,
    summary="Exécuter une tâche autonome de maintenance/doc via Gemini & GitHub",
)
@router.post(
    "/v1/run-task",
    response_model=AgentRunTaskResponse,
    include_in_schema=False,
)
async def run_agent_maintenance_task(
    body: AgentRunTaskRequest,
    _user: CurrentUser,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Reçoit une instruction textuelle, consulte le dépôt GitHub via Gemini 2.5 Flash,
    rédige les modifications nécessaires et soumet des Pull Requests.
    """
    logger.info("Triggering agent maintenance task", prompt=body.task_instruction, user=_user.email)

    try:
        res = await run_agent_task(
            prompt=body.task_instruction,
            session=session,
            project_id=body.project_id,
        )
        return AgentRunTaskResponse(
            status=res.get("status", "COMPLETED"),
            message=res.get("message", ""),
            pr_urls=res.get("pr_urls", []),
            action_id=res.get("action_id"),
        )
    except ValueError as val_err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(val_err),
        )
    except Exception as err:
        logger.error("Error running agent task", error=str(err))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur d'exécution de l'agent : {str(err)}",
        )


# ------------------------------------------------------------------------------
# GET /api/v1/agent/history — Obtenir l'historique des propositions & PRs
# ------------------------------------------------------------------------------
@router.get(
    "/history",
    response_model=AgentHistoryResponse,
    summary="Consulter l'historique des actions de l'agent et statut des PRs",
)
@router.get(
    "/v1/history",
    response_model=AgentHistoryResponse,
    include_in_schema=False,
)
async def get_agent_history(
    _user: CurrentUser,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Récupère la liste des propositions d'actions antérieures et les PRs associées depuis Neo4j."""
    try:
        records = await run_query(
            session,
            """
            MATCH (a:AgentAction)
            OPTIONAL MATCH (a)-[:CREATED_PR]->(pr:PullRequest)
            WITH a, collect(pr.url) AS pr_urls
            RETURN a.id AS action_id,
                   a.prompt AS prompt,
                   a.status AS status,
                   a.response_text AS response_text,
                   a.created_at AS created_at,
                   pr_urls
            ORDER BY a.created_at DESC
            LIMIT 50
            """,
        )

        history_items = []
        for r in records:
            urls = [u for u in r.get("pr_urls", []) if u]
            history_items.append(
                AgentHistoryItem(
                    action_id=r.get("action_id") or "",
                    prompt=r.get("prompt") or "",
                    status=r.get("status") or "UNKNOWN",
                    response_text=r.get("response_text") or "",
                    created_at=r.get("created_at") or "",
                    pr_urls=urls,
                )
            )

        return AgentHistoryResponse(history=history_items)

    except Exception as e:
        logger.error("Error retrieving agent history", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors de la récupération de l'historique : {str(e)}",
        )

