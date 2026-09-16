// =============================================================================
// Projet Sentinel — Store Zustand global
// =============================================================================

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { Node, Edge } from '@xyflow/react'

// ---------------------------------------------------------------------------
// Types métier
// ---------------------------------------------------------------------------

export type ItemType = 'IDEE' | 'TACHE' | 'PROJET' | 'COMPOSANT'
export type ItemStatut = 'BACKLOG' | 'A_FAIRE' | 'EN_COURS' | 'TERMINE' | 'BLOQUE'
export type ItemPriorite = 'BASSE' | 'NORMALE' | 'HAUTE' | 'CRITIQUE'
export type UserRole = 'ADMIN' | 'USER' | 'CLIENT'

export interface SentinelUser {
  id: string
  email: string
  nom: string
  role: UserRole
  created_at: string
}

export interface SentinelNodeData extends Record<string, unknown> {
  titre: string
  description?: string
  type: ItemType
  statut: ItemStatut
  priorite: ItemPriorite
  temps_estime_h?: number
  cout_estime?: number
  created_at: string
  updated_at: string
}

export type SentinelNode = Node<SentinelNodeData>
export type SentinelEdge = Edge<{ type: string; created_at: string }>

// ---------------------------------------------------------------------------
// State & Actions
// ---------------------------------------------------------------------------

interface AppState {
  // Auth
  token: string | null
  user: SentinelUser | null

  // Graph
  nodes: SentinelNode[]
  edges: SentinelEdge[]

  // UI
  selectedNodeId: string | null
  isDrawerOpen: boolean
  isLoading: boolean

  // Actions Auth
  setToken: (token: string, user: SentinelUser) => void
  logout: () => void

  // Actions Graph
  setNodes: (nodes: SentinelNode[]) => void
  setEdges: (edges: SentinelEdge[]) => void
  addNode: (node: SentinelNode) => void
  updateNode: (id: string, data: Partial<SentinelNodeData>) => void
  updateNodePosition: (id: string, x: number, y: number) => void
  removeNode: (id: string) => void
  addEdge: (edge: SentinelEdge) => void
  removeEdge: (id: string) => void

  // Actions UI
  selectNode: (id: string | null) => void
  setDrawerOpen: (open: boolean) => void
  setLoading: (loading: boolean) => void
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Initial state
      token: null,
      user: null,
      nodes: [],
      edges: [],
      selectedNodeId: null,
      isDrawerOpen: false,
      isLoading: false,

      // Auth
      setToken: (token, user) => set({ token, user }),
      logout: () =>
        set({ token: null, user: null, nodes: [], edges: [], selectedNodeId: null, isDrawerOpen: false }),

      // Graph
      setNodes: (nodes) => set({ nodes }),
      setEdges: (edges) => set({ edges }),

      addNode: (node) =>
        set((state) => ({ nodes: [...state.nodes, node] })),

      updateNode: (id, data) =>
        set((state) => ({
          nodes: state.nodes.map((n) =>
            n.id === id ? { ...n, data: { ...n.data, ...data } } : n,
          ),
        })),

      updateNodePosition: (id, x, y) =>
        set((state) => ({
          nodes: state.nodes.map((n) =>
            n.id === id ? { ...n, position: { x, y } } : n,
          ),
        })),

      removeNode: (id) =>
        set((state) => ({
          nodes: state.nodes.filter((n) => n.id !== id),
          edges: state.edges.filter((e) => e.source !== id && e.target !== id),
          selectedNodeId: state.selectedNodeId === id ? null : state.selectedNodeId,
          isDrawerOpen: state.selectedNodeId === id ? false : state.isDrawerOpen,
        })),

      addEdge: (edge) =>
        set((state) => ({ edges: [...state.edges, edge] })),

      removeEdge: (id) =>
        set((state) => ({ edges: state.edges.filter((e) => e.id !== id) })),

      // UI
      selectNode: (id) =>
        set({ selectedNodeId: id, isDrawerOpen: id !== null }),

      setDrawerOpen: (open) =>
        set((state) => ({
          isDrawerOpen: open,
          selectedNodeId: open ? state.selectedNodeId : null,
        })),

      setLoading: (loading) => set({ isLoading: loading }),
    }),
    {
      name: 'sentinel-auth',
      storage: createJSONStorage(() => localStorage),
      // Ne persiste que le token et l'user — pas le graphe (chargé depuis l'API)
      partialize: (state) => ({ token: state.token, user: state.user }),
    },
  ),
)
