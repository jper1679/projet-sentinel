// =============================================================================
// Projet Sentinel — Service API Agent Scratchpad (Gemini AI)
// =============================================================================

import api from './api'

export type DisciplineEnum =
  | 'ELECTRONIQUE_IOT'
  | 'USINAGE_FAB'
  | 'SYSTEME_AMENAGEMENT'
  | 'LOGISTIQUE_EVENT'
  | 'AUTRE'

export type ActionTypeEnum =
  | 'LOG_PROGRESS'
  | 'UPDATE_STATUS'
  | 'CREATE_TASK'
  | 'ADD_BLOCKER'
  | 'PROCUREMENT_ITEM'

export interface NodeItemUpdate {
  action_type: ActionTypeEnum
  discipline: DisciplineEnum
  target_project: string
  title: string
  status?: string
  part_details?: string
  supplier?: string
  notes?: string
}

export interface NodeToCreate {
  title: string
  type: string
  sous_type?: string
  status?: string
  discipline?: DisciplineEnum | string
  notes?: string
  temp_id?: string
}

export interface RelationshipToCreate {
  source_temp_id?: string
  target_temp_id?: string
  rel_type: string
  target_project?: string
}

export interface IngestionAnalysisResult {
  sitrep_summary?: string
  needs_clarification?: boolean
  clarification_question?: string
  target_project_name?: string
  actions?: NodeItemUpdate[]
  nodes?: NodeToCreate[]
  relationships?: RelationshipToCreate[]
}

export interface ApplyResponse {
  status: string
  message: string
  created_nodes: number
  updated_nodes: number
}

/**
 * Analyse des notes quotidiennes brutes via Gemini AI (supporte réponse de clarification).
 */
export async function parseScratchpad(
  rawText: string,
  clarificationResponse?: string
): Promise<IngestionAnalysisResult> {
  const response = await api.post<IngestionAnalysisResult>('/agent/parse', {
    raw_text: rawText,
    clarification_response: clarificationResponse || null,
  })
  return response.data
}

/**
 * Applique la sélection d'actions, nœuds et relations validés dans Neo4j.
 */
export async function applyScratchpadActions(
  actions: NodeItemUpdate[],
  nodes: NodeToCreate[] = [],
  relationships: RelationshipToCreate[] = []
): Promise<ApplyResponse> {
  const response = await api.post<ApplyResponse>('/agent/apply', {
    actions,
    nodes,
    relationships,
  })
  return response.data
}

