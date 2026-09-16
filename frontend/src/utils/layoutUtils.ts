// =============================================================================
// Projet Sentinel — Algorithmes d'Auto-Arrangement (Layout Engine)
// Permet de réordonner les nœuds en mode Arbre (TB), Mindmap (LR) ou Grille (GRID)
// =============================================================================

import type { SentinelNode, SentinelEdge } from '@/store/useAppStore'

export type LayoutDirection = 'TB' | 'LR' | 'GRID'

export function applyAutoLayout(
  nodes: SentinelNode[],
  edges: SentinelEdge[],
  direction: LayoutDirection = 'LR',
): SentinelNode[] {
  if (nodes.length === 0) return nodes

  // Mode GRILLE : organisation matricielle simple et propre
  if (direction === 'GRID') {
    const cols = Math.ceil(Math.sqrt(nodes.length))
    const spacingX = 240
    const spacingY = 140

    return nodes.map((node, index) => {
      const col = index % cols
      const row = Math.floor(index / cols)
      return {
        ...node,
        position: {
          x: col * spacingX,
          y: row * spacingY,
        },
      }
    })
  }

  // Mode Arbre (TB = Top-to-Bottom, LR = Left-to-Right)
  // 1. Calcul des degrés entrants (in-degree) et de la profondeur de chaque nœud
  const inDegree: Record<string, number> = {}
  const adjList: Record<string, string[]> = {}

  nodes.forEach((n) => {
    inDegree[n.id] = 0
    adjList[n.id] = []
  })

  edges.forEach((e) => {
    if (inDegree[e.target] !== undefined) {
      inDegree[e.target] += 1
    }
    if (adjList[e.source]) {
      adjList[e.source].push(e.target)
    }
  })

  // 2. Calcul du niveau (depth) de chaque nœud par parcours en largeur (BFS)
  const depthMap: Record<string, number> = {}
  const queue: string[] = []

  // Les nœuds sans prédécesseur sont au niveau 0
  nodes.forEach((n) => {
    if (inDegree[n.id] === 0) {
      depthMap[n.id] = 0
      queue.push(n.id)
    }
  })

  // Si aucun nœud racine (ex: cycle), on met le premier au niveau 0
  if (queue.length === 0 && nodes.length > 0) {
    depthMap[nodes[0].id] = 0
    queue.push(nodes[0].id)
  }

  while (queue.length > 0) {
    const current = queue.shift()!
    const currentDepth = depthMap[current] || 0

    const neighbors = adjList[current] || []
    neighbors.forEach((nbr) => {
      if (depthMap[nbr] === undefined || depthMap[nbr] < currentDepth + 1) {
        depthMap[nbr] = currentDepth + 1
        queue.push(nbr)
      }
    })
  }

  // Pour les nœuds non visités (ex: composants isolés), assigner la profondeur 0
  nodes.forEach((n) => {
    if (depthMap[n.id] === undefined) {
      depthMap[n.id] = 0
    }
  })

  // 3. Regrouper les nœuds par niveau
  const levels: Record<number, SentinelNode[]> = {}
  nodes.forEach((n) => {
    const d = depthMap[n.id]
    if (!levels[d]) levels[d] = []
    levels[d].push(n)
  })

  // 4. Positionner selon la direction
  const nodeWidth = 240
  const nodeHeight = 120
  const gapX = 80
  const gapY = 60

  const result: SentinelNode[] = []

  const levelKeys = Object.keys(levels)
    .map(Number)
    .sort((a, b) => a - b)

  levelKeys.forEach((levelIndex) => {
    const levelNodes = levels[levelIndex]
    const count = levelNodes.length

    levelNodes.forEach((node, index) => {
      let x = 0
      let y = 0

      if (direction === 'LR') {
        // Mindmap de gauche à droite
        x = levelIndex * (nodeWidth + gapX)
        y = (index - (count - 1) / 2) * (nodeHeight + gapY)
      } else {
        // Arbre du haut vers le bas (TB)
        x = (index - (count - 1) / 2) * (nodeWidth + gapX)
        y = levelIndex * (nodeHeight + gapY)
      }

      result.push({
        ...node,
        position: { x, y },
      })
    })
  })

  return result
}
