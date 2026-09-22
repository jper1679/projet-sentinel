// =============================================================================
// Projet Sentinel — Service Nodes (API CRUD)
// =============================================================================

import api from './api'
import type { SentinelNodeData } from '@/store/useAppStore'

export interface NodeCreatePayload {
  titre: string
  description?: string
  type?: string
  statut?: string
  priorite?: string
  temps_estime_h?: number
  cout_estime?: number
  pos_x?: number
  pos_y?: number
  group_id?: string | null
}

export interface NodeUpdatePayload extends Partial<NodeCreatePayload> {}

export interface NodeAPIResponse {
  id: string
  titre: string
  description?: string
  type: string
  statut: string
  priorite: string
  temps_estime_h?: number
  cout_estime?: number
  pos_x: number
  pos_y: number
  group_id?: string | null
  created_at: string
  updated_at: string
}

export const nodeService = {
  /** Charge tous les nœuds depuis l'API */
  async getAll(params?: { statut?: string; type?: string }): Promise<NodeAPIResponse[]> {
    const res = await api.get<NodeAPIResponse[]>('/nodes/', { params })
    return res.data
  },

  /** Charge un nœud unique par son ID */
  async getById(id: string): Promise<NodeAPIResponse> {
    const res = await api.get<NodeAPIResponse>(`/nodes/${id}`)
    return res.data
  },

  /** Crée un nouveau nœud */
  async create(payload: NodeCreatePayload): Promise<NodeAPIResponse> {
    const res = await api.post<NodeAPIResponse>('/nodes/', payload)
    return res.data
  },

  /** Met à jour un nœud (champs + position) */
  async update(id: string, payload: NodeUpdatePayload): Promise<NodeAPIResponse> {
    const res = await api.put<NodeAPIResponse>(`/nodes/${id}`, payload)
    return res.data
  },

  /** Met à jour uniquement la position (drag React Flow) */
  async updatePosition(id: string, x: number, y: number): Promise<void> {
    await api.put(`/nodes/${id}`, { pos_x: x, pos_y: y })
  },

  /** Grouper ou dégrouper des nœuds en lot */
  async bulkGroupNodes(nodeIds: string[], groupId: string | null): Promise<{ updated_count: number; group_id: string | null }> {
    const res = await api.put<{ updated_count: number; group_id: string | null }>('/nodes/group_bulk', {
      node_ids: nodeIds,
      group_id: groupId,
    })
    return res.data
  },

  /** Supprime un nœud et ses relations */
  async delete(id: string): Promise<void> {
    await api.delete(`/nodes/${id}`)
  },

  /** Importe un fichier .xmind ou .json */
  async importXMind(file: File): Promise<{ created_nodes: number; created_links: number; message: string }> {
    const formData = new FormData()
    formData.append('file', file)
    const res = await api.post<{ created_nodes: number; created_links: number; message: string }>(
      '/nodes/import/xmind',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    )
    return res.data
  },
}

/** Convertit la réponse API en format React Flow Node data */
export function apiNodeToFlowData(apiNode: NodeAPIResponse): SentinelNodeData {
  return {
    titre: apiNode.titre,
    description: apiNode.description,
    type: apiNode.type as SentinelNodeData['type'],
    statut: apiNode.statut as SentinelNodeData['statut'],
    priorite: apiNode.priorite as SentinelNodeData['priorite'],
    temps_estime_h: apiNode.temps_estime_h,
    cout_estime: apiNode.cout_estime,
    group_id: apiNode.group_id ?? undefined,
    created_at: apiNode.created_at,
    updated_at: apiNode.updated_at,
  }
}
