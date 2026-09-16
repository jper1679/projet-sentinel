// =============================================================================
// Projet Sentinel — CustomMindmapNode (React Flow custom node)
// =============================================================================

import { memo, useCallback } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { useAppStore, type SentinelNode, type SentinelNodeData } from '@/store/useAppStore'

// Couleurs par type de nœud
const TYPE_COLORS: Record<string, { border: string; bg: string; text: string; dot: string }> = {
  IDEE:      { border: '#8b5cf6', bg: '#1e1535', text: '#c4b5fd', dot: '#8b5cf6' },
  TACHE:     { border: '#3b82f6', bg: '#0f1e35', text: '#93c5fd', dot: '#3b82f6' },
  PROJET:    { border: '#f59e0b', bg: '#1e1a0f', text: '#fcd34d', dot: '#f59e0b' },
  COMPOSANT: { border: '#10b981', bg: '#0f1e18', text: '#6ee7b7', dot: '#10b981' },
  PROCEDURE: { border: '#ec4899', bg: '#29101d', text: '#f472b6', dot: '#ec4899' },
  ETAPE:     { border: '#06b6d4', bg: '#0a2228', text: '#67e8f9', dot: '#06b6d4' },
}

// Icônes texte par type
const TYPE_ICONS: Record<string, string> = {
  IDEE:      '💡',
  TACHE:     '✅',
  PROJET:    '📁',
  COMPOSANT: '⚙️',
  PROCEDURE: '📋',
  ETAPE:     '🔹',
}

// Couleurs par statut (badge)
const STATUT_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  BACKLOG:  { bg: 'rgba(100,116,139,0.2)', text: '#94a3b8', label: 'Backlog' },
  A_FAIRE:  { bg: 'rgba(59,130,246,0.2)',  text: '#60a5fa', label: 'À faire' },
  EN_COURS: { bg: 'rgba(245,158,11,0.2)',  text: '#fbbf24', label: 'En cours' },
  TERMINE:  { bg: 'rgba(16,185,129,0.2)',  text: '#34d399', label: 'Terminé' },
  BLOQUE:   { bg: 'rgba(239,68,68,0.2)',   text: '#f87171', label: 'Bloqué 🔒' },
}

function CustomMindmapNode({ id, data, selected }: NodeProps<SentinelNode>) {
  const selectNode = useAppStore((s) => s.selectNode)
  const colors = TYPE_COLORS[data.type] ?? TYPE_COLORS.IDEE
  const statut = STATUT_STYLES[data.statut] ?? STATUT_STYLES.A_FAIRE

  const handleClick = useCallback(() => {
    selectNode(id)
  }, [id, selectNode])

  return (
    <div
      onClick={handleClick}
      style={{
        background: colors.bg,
        border: `1.5px solid ${selected ? '#60a5fa' : colors.border}`,
        boxShadow: selected
          ? `0 0 0 2px rgba(96,165,250,0.4), 0 8px 32px rgba(0,0,0,0.5)`
          : `0 4px 16px rgba(0,0,0,0.4)`,
        borderRadius: '12px',
        minWidth: '160px',
        maxWidth: '240px',
        padding: '12px 14px',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        userSelect: 'none',
      }}
    >
      {/* Handle Entrée (haut) */}
      <Handle
        type="target"
        position={Position.Top}
        style={{
          background: '#1e2d45',
          border: `2px solid ${colors.border}`,
          width: 10,
          height: 10,
          top: -6,
        }}
      />

      {/* En-tête : type + icône */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
        <span style={{ fontSize: '14px' }}>{TYPE_ICONS[data.type]}</span>
        <span
          style={{
            fontSize: '10px',
            fontWeight: 600,
            color: colors.text,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          {data.type}
        </span>
      </div>

      {/* Titre */}
      <div
        style={{
          fontSize: '13px',
          fontWeight: 600,
          color: '#e2e8f0',
          lineHeight: 1.3,
          marginBottom: '8px',
          wordBreak: 'break-word',
        }}
      >
        {data.titre}
      </div>

      {/* Pied : statut + estimations */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
        {/* Badge statut */}
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '2px 7px',
            borderRadius: '99px',
            background: statut.bg,
            color: statut.text,
            fontSize: '10px',
            fontWeight: 600,
          }}
        >
          {statut.label}
        </span>

        {/* Estimations */}
        {(data.temps_estime_h != null || data.cout_estime != null) && (
          <div style={{ display: 'flex', gap: '6px', fontSize: '10px', color: '#64748b' }}>
            {data.temps_estime_h != null && <span>⏱ {data.temps_estime_h}h</span>}
            {data.cout_estime != null && <span>💲{data.cout_estime}</span>}
          </div>
        )}
      </div>

      {/* Handle Sortie (bas) */}
      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          background: '#1e2d45',
          border: `2px solid ${colors.border}`,
          width: 10,
          height: 10,
          bottom: -6,
        }}
      />

      {/* Handles latéraux */}
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        style={{
          background: '#1e2d45',
          border: `2px solid ${colors.border}`,
          width: 8,
          height: 8,
          right: -5,
        }}
      />
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        style={{
          background: '#1e2d45',
          border: `2px solid ${colors.border}`,
          width: 8,
          height: 8,
          left: -5,
        }}
      />
    </div>
  )
}

export default memo(CustomMindmapNode)
