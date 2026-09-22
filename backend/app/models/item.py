# ==============================================================================
# Projet Sentinel — Modèles Pydantic : Item (Node du graphe)
# ==============================================================================

from enum import StrEnum
from typing import Optional

from pydantic import BaseModel, Field


class ItemType(StrEnum):
    IDEE = "IDEE"
    TACHE = "TACHE"
    PROJET = "PROJET"
    COMPOSANT = "COMPOSANT"
    PROCEDURE = "PROCEDURE"
    ETAPE = "ETAPE"


class ItemStatut(StrEnum):
    BACKLOG = "BACKLOG"
    A_FAIRE = "A_FAIRE"
    EN_COURS = "EN_COURS"
    TERMINE = "TERMINE"
    BLOQUE = "BLOQUE"


class ItemPriorite(StrEnum):
    BASSE = "BASSE"
    NORMALE = "NORMALE"
    HAUTE = "HAUTE"
    CRITIQUE = "CRITIQUE"


class NodeCreate(BaseModel):
    titre: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    type: ItemType = ItemType.IDEE
    statut: ItemStatut = ItemStatut.A_FAIRE
    priorite: ItemPriorite = ItemPriorite.NORMALE
    temps_estime_h: Optional[float] = Field(None, ge=0)
    cout_estime: Optional[float] = Field(None, ge=0)
    # Position sur le canevas Mindmap
    pos_x: float = 0.0
    pos_y: float = 0.0
    group_id: Optional[str] = None


class NodeUpdate(BaseModel):
    titre: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    type: Optional[ItemType] = None
    statut: Optional[ItemStatut] = None
    priorite: Optional[ItemPriorite] = None
    temps_estime_h: Optional[float] = Field(None, ge=0)
    cout_estime: Optional[float] = Field(None, ge=0)
    pos_x: Optional[float] = None
    pos_y: Optional[float] = None
    group_id: Optional[str] = None


class NodeOut(BaseModel):
    id: str
    titre: str
    description: Optional[str] = None
    type: ItemType
    statut: ItemStatut
    priorite: ItemPriorite
    temps_estime_h: Optional[float] = None
    cout_estime: Optional[float] = None
    pos_x: float = 0.0
    pos_y: float = 0.0
    group_id: Optional[str] = None
    created_at: str
    updated_at: str

    model_config = {"from_attributes": True}
