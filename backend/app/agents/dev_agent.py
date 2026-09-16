# ==============================================================================
# Projet Sentinel — DevAgent (Squelette LangGraph — Jalon 2+)
# ==============================================================================
#
# Responsabilités prévues du DevAgent :
#   - Génération automatique de tickets techniques depuis les idées
#   - Décomposition d'un PROJET en tâches/sous-tâches
#   - Estimation automatique des temps et coûts via LLM
#   - Détection de doublons dans le graphe d'idées


class DevAgentState:
    """État interne du DevAgent."""
    user_id: str
    project_id: str | None
    prompt: str
    generated_items: list[dict]
    error: str | None


class DevAgentStub:
    """
    Stub du DevAgent — remplacé par l'implémentation LangGraph au Jalon 2.
    Interface publique stable.
    """

    async def decompose_project(self, project_id: str) -> list[dict]:
        """Décompose un nœud PROJET en sous-tâches générées par IA."""
        return []

    async def generate_from_prompt(self, prompt: str, user_id: str) -> list[dict]:
        """Génère un ensemble de nœuds depuis un prompt en langage naturel."""
        return []

    async def estimate_item(self, node_id: str) -> dict:
        """Estime automatiquement le temps et le coût d'un Item."""
        return {"status": "stub", "message": "DevAgent non encore activé (Jalon 2)"}

    async def find_duplicates(self, titre: str) -> list[dict]:
        """Détecte les nœuds potentiellement en doublon."""
        return []


# Singleton injectable
dev_agent = DevAgentStub()

# ==============================================================================
# TODO Jalon 2 : Implémenter avec LangGraph + Tool Calling Neo4j
# ==============================================================================
#
# Les outils LangGraph à créer :
#   - create_node_tool : appel à l'API POST /nodes
#   - link_nodes_tool  : appel à l'API POST /links
#   - search_graph_tool: requête Cypher sémantique (avec embeddings)
#   - estimate_tool    : LLM avec contexte domaine pour estimation
