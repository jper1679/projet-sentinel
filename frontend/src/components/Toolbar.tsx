// =============================================================================
// Projet Sentinel — Toolbar (Barre d'outils du canevas)
// =============================================================================

import { useCallback, useState, useEffect } from 'react'
import {
  Network, LogOut, RefreshCw, ZoomIn, ZoomOut,
  Maximize, Info, Plus, Link2, LayoutGrid, ChevronDown, Sparkles
} from 'lucide-react'
import { useReactFlow } from '@xyflow/react'
import { useAppStore } from '@/store/useAppStore'
import type { LayoutDirection } from '@/utils/layoutUtils'

interface ToolbarProps {
  onRefresh: () => void
  onAddNode: () => void
  onAddLink: () => void
  onAutoLayout: (direction: LayoutDirection) => void
  onOpenScratchpad: () => void
  isLoading: boolean
  nodeCount: number
  edgeCount: number
}

export default function Toolbar({
  onRefresh,
  onAddNode,
  onAddLink,
  onAutoLayout,
  onOpenScratchpad,
  isLoading,
  nodeCount,
  edgeCount,
}: ToolbarProps) {
  const logout = useAppStore((s) => s.logout)
  const user = useAppStore((s) => s.user)
  const { zoomIn, zoomOut, fitView } = useReactFlow()

  const [isLayoutMenuOpen, setIsLayoutMenuOpen] = useState(false)

  // Ecouteur du raccourci clavier Ctrl+K pour ouvrir le Scratchpad
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        onOpenScratchpad()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onOpenScratchpad])

  const handleLogout = useCallback(() => {
    if (window.confirm('Se déconnecter de Sentinel ?')) {
      logout()
    }
  }, [logout])

  const handleSelectLayout = (dir: LayoutDirection) => {
    onAutoLayout(dir)
    setIsLayoutMenuOpen(false)
  }

  return (
    <div
      className="absolute top-4 left-4 z-20 flex flex-col gap-2.5"
      style={{ pointerEvents: 'all' }}
    >
      {/* Logo / Titre */}
      <div
        className="flex items-center gap-3 px-4 py-2.5 rounded-xl"
        style={{
          background: 'rgba(17,24,39,0.92)',
          backdropFilter: 'blur(12px)',
          border: '1px solid #1e2d45',
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        }}
      >
        <div
          className="flex items-center justify-center rounded-lg"
          style={{
            width: 28,
            height: 28,
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
          }}
        >
          <Network size={14} color="white" />
        </div>
        <div>
          <div className="text-sm font-bold text-white leading-tight">Sentinel</div>
          <div className="text-xs text-sentinel-muted leading-tight">PLM/ALM par graphe</div>
        </div>
      </div>

      {/* Actions rapides : + Nœud, + Lien, Scratchpad & Auto-Arrangement */}
      <div
        className="flex flex-col gap-1.5 p-1.5 rounded-xl relative z-10"
        style={{
          background: 'rgba(17,24,39,0.92)',
          backdropFilter: 'blur(12px)',
          border: '1px solid #1e2d45',
          boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
        }}
      >
        {/* Bouton IA Scratchpad */}
        <button
          id="btn-scratchpad"
          onClick={onOpenScratchpad}
          className="w-full py-1.5 px-3 text-xs justify-center font-bold rounded-lg flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white shadow-md transition-all cursor-pointer"
          title="Ouvrir l'analyseur IA de notes quotidiennes (Raccourci: Ctrl+K)"
        >
          <Sparkles size={13} /> Scratchpad ⚡ <span className="text-[10px] opacity-80 font-mono font-normal ml-auto">(Ctrl+K)</span>
        </button>

        <div className="flex items-center gap-1.5">
          <button
            id="btn-add-node"
            onClick={onAddNode}
            className="flex-1 btn-primary py-1.5 px-3 text-xs justify-center font-semibold"
            title="Ajouter un nouveau nœud d'idée/tâche"
          >
            <Plus size={14} /> Nœud
          </button>
          <button
            id="btn-add-link"
            onClick={onAddLink}
            className="flex-1 btn-ghost py-1.5 px-3 text-xs justify-center font-semibold border border-sentinel-border hover:border-sentinel-accent/50 text-sentinel-text hover:text-white"
            title="Relier deux nœuds existants"
          >
            <Link2 size={14} className="text-sentinel-accent" /> Lien
          </button>
        </div>

        {/* Bouton Auto-Arranger avec menu déroulant */}
        <div className="relative z-20">
          <button
            id="btn-auto-layout"
            onClick={() => setIsLayoutMenuOpen((v) => !v)}
            className="w-full btn-ghost py-1.5 px-3 text-xs justify-between font-semibold border border-sentinel-border/60 hover:bg-sentinel-border/50 text-sentinel-text-dim hover:text-white"
            title="Réorganiser automatiquement la disposition du canevas"
          >
            <span className="flex items-center gap-1.5">
              <LayoutGrid size={13} className="text-amber-400" /> Auto-Arranger
            </span>
            <ChevronDown size={12} className={`transition-transform ${isLayoutMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Sous-menu Auto-Layout */}
          {isLayoutMenuOpen && (
            <div
              className="absolute left-0 top-full mt-1.5 w-full min-w-[190px] rounded-xl p-1.5 z-50 animate-fade-in space-y-1"
              style={{
                background: 'rgba(17, 24, 39, 0.98)',
                backdropFilter: 'blur(12px)',
                border: '1px solid #2a3e5c',
                boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
              }}
            >
              {[
                { id: 'layout-lr', dir: 'LR' as const, label: 'Mindmap ➡️', desc: 'Horizontale' },
                { id: 'layout-tb', dir: 'TB' as const, label: 'Arbre ⬇️', desc: 'Verticale' },
                { id: 'layout-grid', dir: 'GRID' as const, label: 'Grille 🔲', desc: 'Matrice' },
              ].map(({ id, dir, label, desc }) => (
                <button
                  key={id}
                  id={id}
                  onClick={() => handleSelectLayout(dir)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs hover:bg-sentinel-border/60 text-left transition-colors cursor-pointer"
                >
                  <span className="font-medium text-sentinel-text">{label}</span>
                  <span className="text-[10px] text-sentinel-muted">{desc}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div
        className="flex items-center gap-3 px-4 py-2 rounded-xl text-xs text-sentinel-text-dim"
        style={{
          background: 'rgba(17,24,39,0.85)',
          backdropFilter: 'blur(8px)',
          border: '1px solid #1e2d45',
        }}
      >
        <span>
          <span className="font-semibold text-sentinel-accent">{nodeCount}</span> nœuds
        </span>
        <span className="text-sentinel-border">·</span>
        <span>
          <span className="font-semibold text-sentinel-accent">{edgeCount}</span> liens
        </span>
      </div>

      {/* Contrôles zoom */}
      <div
        className="flex flex-col rounded-xl overflow-hidden"
        style={{
          background: 'rgba(17,24,39,0.92)',
          backdropFilter: 'blur(12px)',
          border: '1px solid #1e2d45',
        }}
      >
        {[
          { icon: <ZoomIn size={14} />,  action: () => zoomIn(),          title: 'Zoom avant',        id: 'btn-zoom-in' },
          { icon: <ZoomOut size={14} />, action: () => zoomOut(),         title: 'Zoom arrière',       id: 'btn-zoom-out' },
          { icon: <Maximize size={14} />,action: () => fitView(),         title: 'Vue d\'ensemble',    id: 'btn-fit-view' },
          { icon: <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />,
            action: onRefresh, title: 'Recharger le graphe', id: 'btn-refresh' },
        ].map(({ icon, action, title, id }, i, arr) => (
          <button
            key={id}
            id={id}
            onClick={action}
            title={title}
            className="flex items-center justify-center text-sentinel-muted hover:text-sentinel-text hover:bg-sentinel-border transition-colors"
            style={{
              width: 36,
              height: 36,
              borderBottom: i < arr.length - 1 ? '1px solid #1e2d45' : 'none',
            }}
          >
            {icon}
          </button>
        ))}
      </div>

      {/* Légende */}
      <div
        className="px-3 py-3 rounded-xl text-xs space-y-1.5"
        style={{
          background: 'rgba(17,24,39,0.85)',
          backdropFilter: 'blur(8px)',
          border: '1px solid #1e2d45',
        }}
      >
        <div className="flex items-center gap-1.5 text-sentinel-muted font-semibold uppercase tracking-wider mb-2">
          <Info size={10} /> Légende
        </div>
        {[
          { color: '#8b5cf6', label: 'Idée' },
          { color: '#3b82f6', label: 'Tâche' },
          { color: '#f59e0b', label: 'Projet' },
          { color: '#10b981', label: 'Composant' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-2">
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
            <span className="text-sentinel-text-dim">{label}</span>
          </div>
        ))}
      </div>

      {/* Utilisateur + Déconnexion */}
      <button
        id="btn-logout"
        onClick={handleLogout}
        className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs transition-all"
        style={{
          background: 'rgba(17,24,39,0.85)',
          backdropFilter: 'blur(8px)',
          border: '1px solid #1e2d45',
          color: '#64748b',
        }}
        title="Se déconnecter"
      >
        <div
          className="flex items-center justify-center rounded-full text-xs font-bold text-white"
          style={{ width: 22, height: 22, background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}
        >
          {user?.nom?.[0]?.toUpperCase() ?? '?'}
        </div>
        <span className="flex-1 text-left truncate">{user?.nom ?? 'Utilisateur'}</span>
        <LogOut size={12} />
      </button>
    </div>
  )
}
