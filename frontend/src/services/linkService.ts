// =============================================================================
// Projet Sentinel — Service Links (Relations API)
// =============================================================================

import api from './api'

export type LinkType = 'BLOQUEE_PAR' | 'RATTACHE_A' | 'ASSIGNE_A' | 'LIE_A'

export interface LinkAPIResponse {
  id: string
  source_id: string
  target_id: string
  type: LinkType
  created_at: string
}

export const linkService = {
  /** Charge toutes les relations */
  async getAll(): Promise<LinkAPIResponse[]> {
    const res = await api.get<LinkAPIResponse[]>('/links/')
    return res.data
  },

  /** Crée une relation entre deux nœuds */
  async create(sourceId: string, targetId: string, type: LinkType = 'LIE_A'): Promise<LinkAPIResponse> {
    const res = await api.post<LinkAPIResponse>('/links/', {
      source_id: sourceId,
      target_id: targetId,
      type,
    })
    return res.data
  },

  /** Supprime une relation par son ID */
  async delete(id: string): Promise<void> {
    await api.delete(`/links/${id}`)
  },
}
