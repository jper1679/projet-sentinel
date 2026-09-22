// =============================================================================
// Projet Sentinel — MindmapBoard (Vue canevas principal React Flow)
// =============================================================================

import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  Background,
  BackgroundVariant,
  MiniMap,
  Controls,
  Panel,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type OnNodeDrag,
  type OnNodesChange,
  type OnEdgesChange,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { useAppStore, type SentinelNode, type SentinelEdge, type SentinelNodeData } from '@/store/useAppStore'
import { nodeService, apiNodeToFlowData } from '@/services/nodeService'
import { linkService, type LinkType, type LinkAPIResponse } from '@/services/linkService'
import { applyAutoLayout, type LayoutDirection } from '@/utils/layoutUtils'
import CustomMindmapNode from '@/components/CustomMindmapNode'
import NodeDetailDrawer from '@/components/NodeDetailDrawer'
import CreateLinkModal from '@/components/CreateLinkModal'
import ScratchpadModal from '@/components/ScratchpadModal'
import ImportXMindModal from '@/components/ImportXMindModal'
import Toolbar from '@/components/Toolbar'

import { SelectionMode } from '@xyflow/react'
import SelectionActionBar from '@/components/SelectionActionBar'
import { applySelectiveAutoLayout } from '@/utils/layoutUtils'

// Types de nœuds enregistrés
const NODE_TYPES = { sentinel: CustomMindmapNode }

// Debounce helper
function debounce<T extends (...args: Parameters<T>) => void>(fn: T, delay: number): T {
  let timer: ReturnType<typeof setTimeout>
  return ((...args: Parameters<T>) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }) as T
}

function MindmapBoardContent() {
  // Selectors granulaires pour éviter les re-renders inutiles
  const isLoading = useAppStore((s) => s.isLoading)
  const setLoading = useAppStore((s) => s.setLoading)
  const setNodesStore = useAppStore((s) => s.setNodes)
  const setEdgesStore = useAppStore((s) => s.setEdges)
  const addNodeStore = useAppStore((s) => s.addNode)
  const addEdgeStore = useAppStore((s) => s.addEdge)
  const removeNodeStore = useAppStore((s) => s.removeNode)
  const updateNodePositionStore = useAppStore((s) => s.updateNodePosition)
  const removeEdgeStore = useAppStore((s) => s.removeEdge)
  const selectNodeStore = useAppStore((s) => s.selectNode)

  const { screenToFlowPosition, fitView } = useReactFlow()

  const [rfNodes, setRfNodes, onNodesChange] = useNodesState<SentinelNode>([] as SentinelNode[])
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState<SentinelEdge>([] as SentinelEdge[])

  // Modales
  const [isCreateLinkOpen, setIsCreateLinkOpen] = useState(false)
  const [isScratchpadOpen, setIsScratchpadOpen] = useState(false)
  const [isImportXMindOpen, setIsImportXMindOpen] = useState(false)

  // -------------------------------------------------------------------------
  // Chargement initial du graphe
  // -------------------------------------------------------------------------
  const loadGraph = useCallback(async () => {
    setLoading(true)
    try {
      const apiNodes = await nodeService.getAll()

      let apiLinks: LinkAPIResponse[] = []
      try {
        apiLinks = await linkService.getAll()
      } catch (linkErr) {
        console.warn('Erreur de chargement des liens (mode dégradé):', linkErr)
      }

      const flowNodes: SentinelNode[] = apiNodes.map((n) => ({
        id: n.id,
        type: 'sentinel',
        position: { x: n.pos_x, y: n.pos_y },
        data: apiNodeToFlowData(n),
      }))

      const flowEdges: SentinelEdge[] = apiLinks.map((l) => ({
        id: l.id,
        source: l.source_id,
        target: l.target_id,
        type: 'default',
        animated: l.type === 'BLOQUEE_PAR',
        style: {
          stroke: l.type === 'BLOQUEE_PAR' ? '#ef4444' : '#2d4a70',
          strokeWidth: 2,
        },
        label: l.type === 'BLOQUEE_PAR' ? '🔒 Bloquée par' : undefined,
        labelStyle: { fill: '#ef4444', fontSize: 10 },
        data: { type: l.type, created_at: l.created_at },
      }))

      setRfNodes(flowNodes)
      setRfEdges(flowEdges)
      setNodesStore(flowNodes)
      setEdgesStore(flowEdges)
    } catch (err) {
      console.error('Erreur chargement graphe:', err)
    } finally {
      setLoading(false)
    }
  }, [setRfNodes, setRfEdges, setLoading, setNodesStore, setEdgesStore])

  useEffect(() => {
    loadGraph()
    // eslint-disable-next-deps
  }, [])

  // -------------------------------------------------------------------------
  // Auto-Arrangement (Layout LR, TB, GRID)
  // -------------------------------------------------------------------------
  const handleAutoLayout = useCallback(
    async (direction: LayoutDirection) => {
      if (rfNodes.length === 0) return

      const layoutedNodes = applyAutoLayout(rfNodes, rfEdges, direction)
      setRfNodes(layoutedNodes)
      setNodesStore(layoutedNodes)

      // Recentrer la vue
      setTimeout(() => fitView({ duration: 500, padding: 0.2 }), 50)

      // Persister les nouvelles positions vers l'API
      try {
        await Promise.all(
          layoutedNodes.map((node) =>
            nodeService.updatePosition(node.id, node.position.x, node.position.y),
          ),
        )
      } catch (err) {
        console.error('Erreur sauvegarde auto-layout:', err)
      }
    },
    [rfNodes, rfEdges, setRfNodes, setNodesStore, fitView],
  )

  // -------------------------------------------------------------------------
  // Mise à jour synchrone depuis le Tiroir Latéral (Drawer Save / Delete)
  // -------------------------------------------------------------------------
  const handleNodeUpdatedInDrawer = useCallback(
    (id: string, updatedData: Partial<SentinelNodeData>) => {
      setRfNodes((prevNodes) =>
        prevNodes.map((node) =>
          node.id === id
            ? {
                ...node,
                data: {
                  ...node.data,
                  ...updatedData,
                },
              }
            : node,
        ),
      )
    },
    [setRfNodes],
  )

  const handleNodeDeletedInDrawer = useCallback(
    (id: string) => {
      setRfNodes((prevNodes) => prevNodes.filter((node) => node.id !== id))
      setRfEdges((prevEdges) =>
        prevEdges.filter((edge) => edge.source !== id && edge.target !== id),
      )
    },
    [setRfNodes, setRfEdges],
  )

  // -------------------------------------------------------------------------
  // Création d'un nœud (Bouton Toolbar ou double-clic canvas)
  // -------------------------------------------------------------------------
  const createNodeAtPosition = useCallback(
    async (x: number, y: number, titre = 'Nouvelle idée') => {
      try {
        const apiNode = await nodeService.create({ titre, pos_x: x, pos_y: y })
        const flowNode: SentinelNode = {
          id: apiNode.id,
          type: 'sentinel',
          position: { x, y },
          data: apiNodeToFlowData(apiNode),
        }
        setRfNodes((prev) => [...prev, flowNode])
        addNodeStore(flowNode)
        selectNodeStore(apiNode.id)
      } catch (err) {
        console.error('Erreur création nœud:', err)
      }
    },
    [addNodeStore, selectNodeStore, setRfNodes],
  )

  const handleAddNodeToolbar = useCallback(() => {
    const position = screenToFlowPosition({
      x: window.innerWidth / 2 - 80,
      y: window.innerHeight / 2 - 30,
    })
    createNodeAtPosition(position.x, position.y, 'Nouvelle idée')
  }, [createNodeAtPosition, screenToFlowPosition])

  const handlePaneDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      const target = event.target as HTMLElement
      if (
        target.closest('.react-flow__node') ||
        target.closest('.react-flow__controls') ||
        target.closest('.react-flow__panel')
      ) {
        return
      }

      const position = screenToFlowPosition({
        x: event.clientX - 80,
        y: event.clientY - 30,
      })

      createNodeAtPosition(position.x, position.y, 'Nouvelle idée')
    },
    [createNodeAtPosition, screenToFlowPosition],
  )

  // -------------------------------------------------------------------------
  // Connexion entre deux nœuds (drag handles ou modale + Lien)
  // -------------------------------------------------------------------------
  const addEdgeToState = useCallback(
    (id: string, sourceId: string, targetId: string, type: LinkType) => {
      const newEdge: SentinelEdge = {
        id,
        source: sourceId,
        target: targetId,
        type: 'default',
        animated: type === 'BLOQUEE_PAR',
        style: {
          stroke: type === 'BLOQUEE_PAR' ? '#ef4444' : '#2d4a70',
          strokeWidth: 2,
        },
        label: type === 'BLOQUEE_PAR' ? '🔒 Bloquée par' : undefined,
        labelStyle: { fill: '#ef4444', fontSize: 10 },
        data: { type, created_at: new Date().toISOString() },
      }
      setRfEdges((eds) => addEdge(newEdge, eds) as SentinelEdge[])
      addEdgeStore(newEdge)
    },
    [addEdgeStore, setRfEdges],
  )

  const handleConnect = useCallback(
    async (connection: Connection) => {
      if (!connection.source || !connection.target) return
      try {
        const apiLink = await linkService.create(connection.source, connection.target, 'LIE_A')
        addEdgeToState(apiLink.id, connection.source, connection.target, 'LIE_A')
      } catch (err) {
        console.error('Erreur création lien:', err)
      }
    },
    [addEdgeToState],
  )

  // -------------------------------------------------------------------------
  // Multi-sélection & Groupement en bloc solidaire
  // -------------------------------------------------------------------------
  const selectedNodes = useMemo(() => rfNodes.filter((n) => n.selected), [rfNodes])
  const selectedCount = selectedNodes.length

  const isAllGrouped = useMemo(() => {
    if (selectedCount < 2) return false
    const firstGroupId = selectedNodes[0].data?.group_id
    if (!firstGroupId) return false
    return selectedNodes.every((n) => n.data?.group_id === firstGroupId)
  }, [selectedNodes, selectedCount])

  // Ref pour suivre les positions initiales lors d'un drag (multi-nœuds ou bloc)
  const dragStartPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map())

  const handleNodeDragStart: OnNodeDrag<SentinelNode> = useCallback(
    (_event, draggedNode) => {
      const positionsMap = new Map<string, { x: number; y: number }>()
      const groupId = draggedNode.data?.group_id

      let nodesToTrack: SentinelNode[] = []
      if (groupId) {
        nodesToTrack = rfNodes.filter((n) => n.data?.group_id === groupId)
      } else if (draggedNode.selected) {
        nodesToTrack = rfNodes.filter((n) => n.selected)
      } else {
        nodesToTrack = [draggedNode]
      }

      nodesToTrack.forEach((n) => {
        positionsMap.set(n.id, { x: n.position.x, y: n.position.y })
      })

      dragStartPositionsRef.current = positionsMap
    },
    [rfNodes],
  )

  const handleNodeDrag: OnNodeDrag<SentinelNode> = useCallback(
    (_event, draggedNode) => {
      const initialMap = dragStartPositionsRef.current
      const draggedInitial = initialMap.get(draggedNode.id)
      if (!draggedInitial) return

      const dx = draggedNode.position.x - draggedInitial.x
      const dy = draggedNode.position.y - draggedInitial.y

      if (dx === 0 && dy === 0) return

      setRfNodes((prevNodes) =>
        prevNodes.map((n) => {
          if (n.id === draggedNode.id) return draggedNode
          if (initialMap.has(n.id)) {
            const start = initialMap.get(n.id)!
            return {
              ...n,
              position: {
                x: start.x + dx,
                y: start.y + dy,
              },
            }
          }
          return n
        }),
      )
    },
    [setRfNodes],
  )

  // -------------------------------------------------------------------------
  // Persistance déplacement (debounced 500ms)
  // -------------------------------------------------------------------------
  const persistPosition = useMemo(
    () =>
      debounce(async (id: string, x: number, y: number) => {
        try {
          await nodeService.updatePosition(id, x, y)
          updateNodePositionStore(id, x, y)
        } catch (err) {
          console.error('Erreur persistance position:', err)
        }
      }, 500),
    [updateNodePositionStore],
  )

  const handleNodeDragStop: OnNodeDrag<SentinelNode> = useCallback(
    async (_event, draggedNode) => {
      const initialMap = dragStartPositionsRef.current
      if (initialMap.size === 0) {
        persistPosition(draggedNode.id, draggedNode.position.x, draggedNode.position.y)
        return
      }

      const affectedIds = Array.from(initialMap.keys())
      const updatedNodes = rfNodes.filter((n) => affectedIds.includes(n.id))

      try {
        await Promise.all(
          updatedNodes.map((n) => nodeService.updatePosition(n.id, n.position.x, n.position.y)),
        )
        updatedNodes.forEach((n) => updateNodePositionStore(n.id, n.position.x, n.position.y))
      } catch (err) {
        console.error('Erreur persistance déplacement groupe:', err)
      } finally {
        dragStartPositionsRef.current.clear()
      }
    },
    [rfNodes, persistPosition, updateNodePositionStore],
  )

  // -------------------------------------------------------------------------
  // Suppression de nœuds (Canvas keyboard Delete/Backspace key)
  // -------------------------------------------------------------------------
  const handleNodesDelete = useCallback(
    async (nodesToDelete: SentinelNode[]) => {
      for (const node of nodesToDelete) {
        try {
          await nodeService.delete(node.id)
          removeNodeStore(node.id)
        } catch (err) {
          console.error('Erreur suppression nœud via canvas:', err)
        }
      }
    },
    [removeNodeStore],
  )

  // -------------------------------------------------------------------------
  // Actions de la SelectionActionBar
  // -------------------------------------------------------------------------
  const handleGroupSelection = useCallback(async () => {
    const selectedIds = selectedNodes.map((n) => n.id)
    if (selectedIds.length < 2) return

    const newGroupId = `group-${Date.now()}`
    try {
      await nodeService.bulkGroupNodes(selectedIds, newGroupId)
      setRfNodes((prev) =>
        prev.map((n) =>
          selectedIds.includes(n.id)
            ? { ...n, data: { ...n.data, group_id: newGroupId } }
            : n,
        ),
      )
    } catch (err) {
      console.error('Erreur lors du groupement:', err)
      alert('Erreur lors du groupement des nœuds.')
    }
  }, [selectedNodes, setRfNodes])

  const handleUngroupSelection = useCallback(async () => {
    const selectedIds = selectedNodes.map((n) => n.id)
    if (selectedIds.length === 0) return

    try {
      await nodeService.bulkGroupNodes(selectedIds, null)
      setRfNodes((prev) =>
        prev.map((n) =>
          selectedIds.includes(n.id)
            ? { ...n, data: { ...n.data, group_id: undefined } }
            : n,
        ),
      )
    } catch (err) {
      console.error('Erreur lors du dégroupement:', err)
      alert('Erreur lors de la dissolution du groupe.')
    }
  }, [selectedNodes, setRfNodes])

  const handleSelectiveLayout = useCallback(
    async (direction: LayoutDirection) => {
      const selectedIds = selectedNodes.map((n) => n.id)
      if (selectedIds.length === 0) return

      const layoutedNodes = applySelectiveAutoLayout(rfNodes, selectedIds, rfEdges, direction)
      setRfNodes(layoutedNodes)
      setNodesStore(layoutedNodes)

      const updatedSelected = layoutedNodes.filter((n) => selectedIds.includes(n.id))
      try {
        await Promise.all(
          updatedSelected.map((node) =>
            nodeService.updatePosition(node.id, node.position.x, node.position.y),
          ),
        )
      } catch (err) {
        console.error('Erreur sauvegarde arrangement sélectif:', err)
      }
    },
    [selectedNodes, rfNodes, rfEdges, setRfNodes, setNodesStore],
  )

  const handleDeleteSelected = useCallback(async () => {
    if (selectedCount === 0) return
    if (!window.confirm(`Voulez-vous vraiment supprimer définitivement les ${selectedCount} nœuds sélectionnés ?`)) return

    const selectedIds = new Set(selectedNodes.map((n) => n.id))
    for (const node of selectedNodes) {
      try {
        await nodeService.delete(node.id)
        removeNodeStore(node.id)
      } catch (err) {
        console.error('Erreur suppression nœud:', err)
      }
    }

    setRfNodes((prev) => prev.filter((n) => !selectedIds.has(n.id)))
    setRfEdges((prev) =>
      prev.filter((e) => !selectedIds.has(e.source) && !selectedIds.has(e.target)),
    )
  }, [selectedCount, selectedNodes, removeNodeStore, setRfNodes, setRfEdges])

  // -------------------------------------------------------------------------
  // Suppression d'arête
  // -------------------------------------------------------------------------
  const handleEdgesDelete = useCallback(
    async (edges: SentinelEdge[]) => {
      for (const edge of edges) {
        try {
          await linkService.delete(edge.id)
          removeEdgeStore(edge.id)
        } catch (err) {
          console.error('Erreur suppression lien:', err)
        }
      }
    },
    [removeEdgeStore],
  )

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        onNodesChange={onNodesChange as OnNodesChange}
        onEdgesChange={onEdgesChange as OnEdgesChange}
        onConnect={handleConnect}
        onNodeDragStart={handleNodeDragStart}
        onNodeDrag={handleNodeDrag}
        onNodeDragStop={handleNodeDragStop}
        onNodesDelete={handleNodesDelete as (nodes: SentinelNode[]) => void}
        onEdgesDelete={handleEdgesDelete as (edges: SentinelEdge[]) => void}
        onPaneClick={() => selectNodeStore(null)}
        onDoubleClick={handlePaneDoubleClick}
        zoomOnDoubleClick={false}
        nodeTypes={NODE_TYPES}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={4}
        selectionMode={SelectionMode.Partial}
        selectionOnDrag={true}
        panOnDrag={[1, 2]}
        deleteKeyCode={['Backspace', 'Delete']}
        proOptions={{ hideAttribution: true }}
        style={{ background: '#0a0e1a' }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#1e2d45" />

        <MiniMap
          nodeColor={(node: SentinelNode) => {
            const colorMap: Record<string, string> = {
              IDEE: '#8b5cf6', TACHE: '#3b82f6', PROJET: '#f59e0b', COMPOSANT: '#10b981',
            }
            return colorMap[node.data?.type as string] ?? '#64748b'
          }}
          maskColor="rgba(10,14,26,0.7)"
          position="bottom-right"
          style={{ borderRadius: 10 }}
        />

        <Controls showFitView={false} showZoom={false} showInteractive={false} />

        <Panel position="top-left" style={{ margin: 0 }}>
          <Toolbar
            onRefresh={loadGraph}
            onAddNode={handleAddNodeToolbar}
            onAddLink={() => setIsCreateLinkOpen(true)}
            onAutoLayout={handleAutoLayout}
            onOpenScratchpad={() => setIsScratchpadOpen(true)}
            onOpenImportXMind={() => setIsImportXMindOpen(true)}
            isLoading={isLoading}
            nodeCount={rfNodes.length}
            edgeCount={rfEdges.length}
          />
        </Panel>

        {rfNodes.length === 0 && !isLoading && (
          <Panel position="bottom-center">
            <div
              className="px-5 py-3 rounded-xl text-sm text-center animate-fade-in"
              style={{
                background: 'rgba(17,24,39,0.9)',
                backdropFilter: 'blur(12px)',
                border: '1px solid #1e2d45',
                color: '#64748b',
                marginBottom: '80px',
              }}
            >
              <span className="text-lg">✨</span>{' '}
              <strong className="text-sentinel-text-dim">Cliquez sur « + Nœud »</strong> ou double-cliquez sur le fond
            </div>
          </Panel>
        )}
      </ReactFlow>

      {/* Barre d'actions de sélection multiple */}
      <SelectionActionBar
        selectedCount={selectedCount}
        isAllGrouped={isAllGrouped}
        onGroup={handleGroupSelection}
        onUngroup={handleUngroupSelection}
        onSelectiveLayout={handleSelectiveLayout}
        onDeleteSelected={handleDeleteSelected}
      />

      {/* Modale de création de lien explicite */}
      <CreateLinkModal
        isOpen={isCreateLinkOpen}
        onClose={() => setIsCreateLinkOpen(false)}
        onLinkCreated={(src, tgt, type) => {
          addEdgeToState(`link-${Date.now()}`, src, tgt, type)
        }}
      />

      {/* Modale Ingestion AI Scratchpad */}
      <ScratchpadModal
        isOpen={isScratchpadOpen}
        onClose={() => setIsScratchpadOpen(false)}
        onApplied={async () => {
          await loadGraph()
          setTimeout(() => fitView({ duration: 500, padding: 0.2 }), 100)
        }}
      />

      {/* Modale Importation XMind */}
      <ImportXMindModal
        isOpen={isImportXMindOpen}
        onClose={() => setIsImportXMindOpen(false)}
        onSuccess={async () => {
          await loadGraph()
          setTimeout(() => fitView({ duration: 500, padding: 0.2 }), 150)
        }}
        onTriggerAutoLayout={async () => {
          await loadGraph()
          setTimeout(() => {
            handleAutoLayout('LR')
            setTimeout(() => fitView({ duration: 500, padding: 0.2 }), 150)
          }, 100)
        }}
      />

      {/* Tiroir latéral d'enrichissement */}
      <NodeDetailDrawer
        onNodeUpdated={handleNodeUpdatedInDrawer}
        onNodeDeleted={handleNodeDeletedInDrawer}
      />
    </div>
  )
}

export default function MindmapBoard() {
  return (
    <ReactFlowProvider>
      <MindmapBoardContent />
    </ReactFlowProvider>
  )
}
