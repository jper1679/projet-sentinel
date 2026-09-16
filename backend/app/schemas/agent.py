from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field


class DisciplineEnum(str, Enum):
    ELECTRONIQUE_IOT = "ELECTRONIQUE_IOT"       # Firmware, PCB, ESP32, capteurs, signaux
    USINAGE_FAB = "USINAGE_FAB"                 # CNC, laser, impression 3D, gabarits, bois
    SYSTEME_AMENAGEMENT = "SYSTEME_AMENAGEMENT" # 12V/120V, plomberie, mécanique, modifications VR
    LOGISTIQUE_EVENT = "LOGISTIQUE_EVENT"       # Organisation, commandes globales, vie perso
    AUTRE = "AUTRE"


class ActionTypeEnum(str, Enum):
    LOG_PROGRESS = "LOG_PROGRESS"               # Note d'avancement / journal horodaté
    UPDATE_STATUS = "UPDATE_STATUS"             # Changement d'état (ex. passé à TERMINE ou EN_COURS)
    CREATE_TASK = "CREATE_TASK"                 # Nouvelle tâche ou prochaine étape actionnable
    ADD_BLOCKER = "ADD_BLOCKER"                 # Point de blocage matériel ou technique
    PROCUREMENT_ITEM = "PROCUREMENT_ITEM"       # Pièce à commander / vérifier en stock


class NodeItemUpdate(BaseModel):
    action_type: ActionTypeEnum
    discipline: DisciplineEnum
    target_project: str = Field(description="Nom ou identifiant normalisé du projet (ex: Airstream, Sentinel, CNC, Atelier, etc.)")
    title: str = Field(description="Libellé concis et technique de l'action ou du jalon")
    status: Optional[str] = Field(default=None, description="A_FAIRE, EN_COURS, TERMINE, BLOQUE")
    part_details: Optional[str] = Field(default=None, description="Détails du composant si achat/stock : référence, jauge, dimensions ou quantité")
    supplier: Optional[str] = Field(default=None, description="Fournisseur potentiel si mentionné (ex: Digikey, JLCPCB, McMaster, Rona, local)")
    notes: Optional[str] = Field(default=None, description="Détails contextuels, observations techniques ou retours d'expérience")


class ExecutionModeEnum(str, Enum):
    STRICT_SEQUENTIEL = "STRICT_SEQUENTIEL"
    PARALLELE_LIBRE = "PARALLELE_LIBRE"


class NodeToCreate(BaseModel):
    temp_id: str = Field(description="Identifiant temporaire pour construire les liens (ex: 'proc_root', 'step_1')")
    type: str = Field(description="'PROCEDURE', 'ETAPE', 'TACHE', 'LOG', 'COMPOSANT'")
    titre: str
    description: Optional[str] = None
    ordre: Optional[int] = None
    statut: Optional[str] = "A_FAIRE"


class RelationshipToCreate(BaseModel):
    source_temp_id: str
    target_temp_id: str
    rel_type: str = Field(description="'CONTIENT_ÉTAPE', 'BLOQUÉE_PAR', 'SUIVIE_DE', 'RATTACHÉ_À', 'DOCUMENTE'")


class IngestionAnalysisResult(BaseModel):
    needs_clarification: bool = Field(default=False, description="True si une information critique (ex: projet parent manquant) empêche la création sans deviner")
    clarification_question: Optional[str] = Field(default=None, description="La question explicite à poser à l'utilisateur si bloqué")
    sitrep_summary: Optional[str] = Field(default=None, description="Résumé exécutif si l'analyse est complète")
    target_project_name: Optional[str] = Field(default=None, description="Nom du projet résolu")
    nodes: List[NodeToCreate] = Field(default_factory=list)
    relationships: List[RelationshipToCreate] = Field(default_factory=list)
    actions: List[NodeItemUpdate] = Field(default_factory=list)


class ScratchpadParseRequest(BaseModel):
    raw_text: str = Field(..., min_length=3, description="Notes brutes quotidiennes à analyser")
    clarification_response: Optional[str] = Field(default=None, description="Réponse explicite de l'utilisateur à la question de clarification")


class ScratchpadApplyRequest(BaseModel):
    nodes: List[NodeToCreate] = Field(default_factory=list, description="Liste des nœuds à créer")
    relationships: List[RelationshipToCreate] = Field(default_factory=list, description="Liste des liaisons entre nœuds")
    target_project_name: Optional[str] = Field(default=None, description="Nom du projet auquel rattacher la procédure")
    actions: List[NodeItemUpdate] = Field(default_factory=list, description="Actions individuelles (compatibilité rétroactive)")


# ------------------------------------------------------------------------------
# Schemas Agent GitHub Maintainer / Automation
# ------------------------------------------------------------------------------
class AgentRunTaskRequest(BaseModel):
    task_instruction: str = Field(..., min_length=3, description="Instruction de maintenance ou de mise à jour documentaire")
    project_id: Optional[str] = Field(default=None, description="ID optionnel du projet Neo4j associé")


class AgentRunTaskResponse(BaseModel):
    status: str = Field(..., description="Statut de l'exécution ('SUCCESS', 'COMPLETED', 'FAILED')")
    message: str = Field(..., description="Message de résultat ou résumé de l'agent")
    pr_urls: List[str] = Field(default_factory=list, description="URLs des Pull Requests générées")
    action_id: Optional[str] = Field(default=None, description="Identifiant unique de l'action enregistrée dans Neo4j")


class AgentHistoryItem(BaseModel):
    action_id: str
    prompt: str
    status: str
    response_text: str
    created_at: str
    pr_urls: List[str] = Field(default_factory=list)


class AgentHistoryResponse(BaseModel):
    history: List[AgentHistoryItem]