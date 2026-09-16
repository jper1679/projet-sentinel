# ==============================================================================
# Projet Sentinel — Modèles Pydantic : Link (Relation du graphe)
# ==============================================================================

from enum import StrEnum

from pydantic import BaseModel, Field


class LinkType(StrEnum):
    BLOQUEE_PAR = "BLOQUEE_PAR"
    RATTACHE_A = "RATTACHE_A"
    ASSIGNE_A = "ASSIGNE_A"
    LIE_A = "LIE_A"


class LinkCreate(BaseModel):
    source_id: str = Field(..., description="ID du nœud source")
    target_id: str = Field(..., description="ID du nœud cible")
    type: LinkType = LinkType.LIE_A


class LinkOut(BaseModel):
    id: str
    source_id: str
    target_id: str
    type: LinkType
    created_at: str

    model_config = {"from_attributes": True}


class LinkDelete(BaseModel):
    source_id: str
    target_id: str
    type: LinkType
