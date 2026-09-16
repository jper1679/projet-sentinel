# ==============================================================================
# Projet Sentinel — Service Gemini Agent (Maintenance & Ingestion GitHub)
# ==============================================================================

import os
import re
import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any

import structlog
from neo4j import AsyncSession

from app.config import get_settings
from app.services.github_agent import (
    read_repo_file,
    search_repo,
    propose_doc_update,
    GitHubService,
)

logger = structlog.get_logger()
settings = get_settings()

SYSTEM_INSTRUCTION = (
    "You are an automated repository maintainer and documentation agent for Projet Sentinel. "
    "When updates are requested, consult repository files, draft clean markdown/code changes "
    "conforming to project architecture, and submit them as Pull Requests. "
    "Provide clear rationale in the PR body."
)


async def run_agent_task(
    prompt: str,
    session: Optional[AsyncSession] = None,
    project_id: Optional[str] = None,
    custom_github_service: Optional[GitHubService] = None,
) -> Dict[str, Any]:
    """Exécute une tâche d'agent autonome avec Gemini 2.5 Flash et les outils GitHub.
    
    Args:
        prompt: Instruction ou demande de l'utilisateur.
        session: Session Neo4j optionnelle pour journaliser l'action et la PR.
        project_id: ID du projet Neo4j auquel associer la tâche.
        custom_github_service: Instance personnalisée du service GitHub (optionnel).
    
    Returns:
        Dict contenant status, message/réponse, list de PR URLs, et action_id.
    """
    api_key = settings.gemini_api_key or os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        raise ValueError("Clé API Gemini non configurée (GEMINI_API_KEY).")

    # Utiliser le service GitHub fourni ou par défaut
    gh_service = custom_github_service or GitHubService()

    # Définition des wrappers d'outils localisés
    def tool_read_repo_file(path: str) -> str:
        return gh_service.read_repo_file(path)

    def tool_search_repo(query: str) -> List[str]:
        return gh_service.search_repo(query)

    def tool_propose_doc_update(
        file_path: str,
        new_content: str,
        commit_message: str,
        branch_name: str,
        pr_title: str,
        pr_description: str,
    ) -> str:
        return gh_service.propose_doc_update(
            file_path=file_path,
            new_content=new_content,
            commit_message=commit_message,
            branch_name=branch_name,
            pr_title=pr_title,
            pr_description=pr_description,
        )

    tools_list = [tool_read_repo_file, tool_search_repo, tool_propose_doc_update]
    tool_map = {
        "tool_read_repo_file": tool_read_repo_file,
        "read_repo_file": tool_read_repo_file,
        "tool_search_repo": tool_search_repo,
        "search_repo": tool_search_repo,
        "tool_propose_doc_update": tool_propose_doc_update,
        "propose_doc_update": tool_propose_doc_update,
    }

    pr_urls: List[str] = []
    action_id = str(uuid.uuid4())
    now_iso = datetime.now(timezone.utc).isoformat()

    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=api_key)

        model_candidates = ["gemini-3.6-flash", "gemini-3.5-flash", "gemini-2.0-flash", "gemini-1.5-flash", "gemini-flash-latest"]

        contents = [prompt]
        max_turns = 8
        turn = 0
        final_text = ""

        logger.info("Starting Gemini agent task", prompt=prompt[:100])

        while turn < max_turns:
            turn += 1
            response = None
            last_err = None

            for m in model_candidates:
                try:
                    response = client.models.generate_content(
                        model=m,
                        contents=contents,
                        config=types.GenerateContentConfig(
                            system_instruction=SYSTEM_INSTRUCTION,
                            tools=tools_list,
                            temperature=0.2,
                        ),
                    )
                    if response:
                        break
                except Exception as m_err:
                    logger.warning("Gemini model candidate failed, trying next", model=m, error=str(m_err))
                    last_err = m_err
                    continue

            if not response:
                raise RuntimeError(f"Aucun modèle Gemini n'a pu exécuter la demande : {str(last_err)}")


            # Vérifier si Gemini demande des appels de fonction
            function_calls = getattr(response, "function_calls", None)
            if not function_calls and hasattr(response, "candidates") and response.candidates:
                candidate = response.candidates[0]
                if candidate.content and candidate.content.parts:
                    for part in candidate.content.parts:
                        if hasattr(part, "function_call") and part.function_call:
                            function_calls = [part.function_call]
                            break

            if function_calls:
                # Conserver le message de réponse de l'assistant dans la conversation
                if hasattr(response, "candidates") and response.candidates:
                    contents.append(response.candidates[0].content)

                for fc in function_calls:
                    fn_name = fc.name
                    fn_args = dict(fc.args) if fc.args else {}
                    logger.info("Gemini requested tool execution", tool=fn_name, args=fn_args)

                    if fn_name in tool_map:
                        tool_fn = tool_map[fn_name]
                        result = tool_fn(**fn_args)
                    else:
                        result = f"Erreur : Outil '{fn_name}' non reconnu."

                    result_str = str(result)
                    logger.info("Tool execution result", tool=fn_name, result_preview=result_str[:200])

                    # Extraire d'éventuelles URLs de PR créées
                    urls = re.findall(r"https://github\.com/[^\s/]+/[^\s/]+/pull/\d+", result_str)
                    for url in urls:
                        if url not in pr_urls:
                            pr_urls.append(url)

                    # Transmettre la réponse de l'outil à Gemini
                    contents.append(
                        types.Part.from_function_response(
                            name=fn_name,
                            response={"result": result_str},
                        )
                    )
            else:
                # Pas d'appel de fonction, fin de l'itération
                if hasattr(response, "text") and response.text:
                    final_text = response.text
                break

        if not final_text and pr_urls:
            final_text = f"Tâche exécutée avec succès. Pull Request(s) générée(s) : {', '.join(pr_urls)}"

        agent_status = "SUCCESS" if pr_urls or final_text else "COMPLETED"

    except Exception as e:
        logger.error("Error executing Gemini agent task", error=str(e))
        agent_status = "FAILED"
        final_text = f"Erreur lors de l'exécution de l'agent : {str(e)}"

    # Journalisation dans Neo4j si une session est fournie
    if session:
        try:
            target_project_id = project_id or "default_project"
            await session.run(
                """
                MERGE (p:Item {id: $proj_id})
                ON CREATE SET p.titre = 'Projet Général', p.type = 'PROJET', p.statut = 'EN_COURS'
                CREATE (a:AgentAction {
                    id: $action_id,
                    prompt: $prompt,
                    status: $status,
                    response_text: $response_text,
                    created_at: $created_at
                })
                CREATE (p)-[:HAS_AUTOMATION]->(a)
                """,
                {
                    "proj_id": target_project_id,
                    "action_id": action_id,
                    "prompt": prompt,
                    "status": agent_status,
                    "response_text": final_text,
                    "created_at": now_iso,
                },
            )

            for url in pr_urls:
                pr_id = str(uuid.uuid4())
                await session.run(
                    """
                    MATCH (a:AgentAction {id: $action_id})
                    CREATE (pr:PullRequest {
                        id: $pr_id,
                        url: $url,
                        status: 'OPEN',
                        created_at: $created_at
                    })
                    CREATE (a)-[:CREATED_PR]->(pr)
                    """,
                    {
                        "action_id": action_id,
                        "pr_id": pr_id,
                        "url": url,
                        "created_at": now_iso,
                    },
                )
            logger.info("Logged AgentAction and PullRequests in Neo4j", action_id=action_id, pr_count=len(pr_urls))
        except Exception as neo_err:
            logger.error("Failed to log agent action to Neo4j", error=str(neo_err))

    return {
        "action_id": action_id,
        "status": agent_status,
        "message": final_text,
        "pr_urls": pr_urls,
    }
