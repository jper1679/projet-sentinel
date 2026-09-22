import { useCallback, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Network, LogOut, RefreshCw, ZoomIn, ZoomOut,
  Maximize, Info, Plus, Link2, LayoutGrid, ChevronDown, Sparkles, Eye, Check, BarChart2,
  CheckSquare, Layers, Download, FileSpreadsheet
} from 'lucide-react'
import { useReactFlow } from '@xyflow/react'
import { useAppStore, type NodeVisibleFields } from '@/store/useAppStore'
import type { LayoutDirection } from '@/utils/layoutUtils'

interface ToolbarProps {
  onRefresh: () => void
  onAddNode: () => void
  onAddLink: () => void
  onAutoLayout: (direction: LayoutDirection) => void
  onOpenScratchpad: () => void
  onOpenImportXMind?: () => void
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
  onOpenImportXMind,
  isLoading,
  nodeCount,
  edgeCount,
}: ToolbarProps) {
  const navigate = useNavigate()
  const logout = useAppStore((s) => s.logout)
  const user = useAppStore((s) => s.user)
  const nodes = useAppStore((s) => s.nodes)
  const edges = useAppStore((s) => s.edges)

  const DEFAULT_VF = { type: true, statut: true, priorite: true, temps_estime_h: true, cout_estime: true, description: false }
  const rawVF = useAppStore((s) => s.visibleFields)
  const visibleFields = rawVF ? { ...DEFAULT_VF, ...rawVF } : DEFAULT_VF
  const toggleVisibleField = useAppStore((s) => s.toggleVisibleField)
  const { zoomIn, zoomOut, fitView } = useReactFlow()

  const [isLayoutMenuOpen, setIsLayoutMenuOpen] = useState(false)
  const [isFieldsMenuOpen, setIsFieldsMenuOpen] = useState(false)

  // Handler d'exportation JSON du graphe
  const handleExportJSON = useCallback(() => {
    const exportData = {
      version: '1.0',
      exported_at: new Date().toISOString(),
      node_count: nodes.length,
      edge_count: edges.length,
      nodes: nodes.map((n) => ({
        id: n.id,
        position: n.position,
        data: n.data,
      })),
      edges: edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        data: e.data,
      })),
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sentinel-graph-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [nodes, edges])

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

  const fieldLabels: { key: keyof NodeVisibleFields; label: string }[] = [
    { key: 'type', label: 'Type de nœud' },
    { key: 'statut', label: 'Statut' },
    { key: 'priorite', label: 'Priorité' },
    { key: 'temps_estime_h', label: 'Temps estimé (h)' },
    { key: 'cout_estime', label: 'Coût estimé ($)' },
    { key: 'description', label: 'Extrait description' },
  ]

  return (
    <div
      className="absolute top-4 left-4 z-20 flex flex-col gap-2.5"
      style={{ pointerEvents: 'all' }}
    >
      {/* Logo / Titre & Navigation par Onglets Principaux */}
      <div
        className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl"
        style={{
          background: 'rgba(17,24,39,0.92)',
          backdropFilter: 'blur(12px)',
          border: '1px solid #1e2d45',
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        }}
      >
        <div className="flex items-center gap-3">
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

        {/* Barre d'onglets principaux (Carte, Kanban, Gantt, Liste) */}
        <div className="flex items-center gap-1 bg-[#0a0e1a] border border-[#1e2d45] rounded-lg p-1 ml-2">
          <button
            onClick={() => navigate('/')}
            className="px-2 py-1 rounded text-xs font-semibold bg-blue-600/30 text-blue-300 border border-blue-500/40 flex items-center gap-1"
            title="Vue Carte Mindmap"
          >
            📍 Carte
          </button>
          <button
            onClick={() => navigate('/kanban')}
            className="px-2 py-1 rounded text-xs font-semibold text-slate-400 hover:text-white hover:bg-[#1e2d45] transition-colors flex items-center gap-1"
            title="Tableau Kanban Jira"
          >
            <CheckSquare size={12} className="text-blue-400" /> Kanban
          </button>
          <button
            onClick={() => navigate('/gantt')}
            className="px-2 py-1 rounded text-xs font-semibold text-slate-400 hover:text-white hover:bg-[#1e2d45] transition-colors flex items-center gap-1"
            title="Diagramme Gantt MS Project"
          >
            <BarChart2 size={12} className="text-purple-400" /> Gantt
          </button>
          <button
            onClick={() => navigate('/list')}
            className="px-2 py-1 rounded text-xs font-semibold text-slate-400 hover:text-white hover:bg-[#1e2d45] transition-colors flex items-center gap-1"
            title="Vue Tableau Liste"
          >
            <Layers size={12} className="text-emerald-400" /> Liste
          </button>
        </div>
      </div>

      {/* Actions rapides : + Nœud, + Lien, Scratchpad, Auto-Arrangement & Champs affichés */}
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

        {/* Bouton Importation XMind */}
        {onOpenImportXMind && (
          <button
            id="btn-import-xmind"
            onClick={onOpenImportXMind}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-semibold bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-500/40 text-cyan-300 transition-all shadow-sm cursor-pointer"
            title="Importer une carte Mindmap XMind (.xmind)"
          >
            <FileSpreadsheet size={13} className="text-cyan-400" /> Importer XMind 📥
          </button>
        )}

        {/* Bouton Auto-Arranger avec menu déroulant */}
        <div className="relative z-20">
          <button
            id="btn-auto-layout"
            onClick={() => {
              setIsLayoutMenuOpen((v) => !v)
              setIsFieldsMenuOpen(false)
            }}
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

        {/* Bouton Champs Affichés avec menu déroulant de sélection */}
        <div className="relative z-20">
          <button
            id="btn-fields-menu"
            onClick={() => {
              setIsFieldsMenuOpen((v) => !v)
              setIsLayoutMenuOpen(false)
            }}
            className="w-full btn-ghost py-1.5 px-3 text-xs justify-between font-semibold border border-sentinel-border/60 hover:bg-sentinel-border/50 text-sentinel-text-dim hover:text-white"
            title="Choisir les champs affichés sur les nœuds"
          >
            <span className="flex items-center gap-1.5">
              <Eye size={13} className="text-cyan-400" /> Champs affichés
            </span>
            <ChevronDown size={12} className={`transition-transform ${isFieldsMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Sous-menu Sélection des champs */}
          {isFieldsMenuOpen && (
            <div
              className="absolute left-0 top-full mt-1.5 w-full min-w-[210px] rounded-xl p-2 z-50 animate-fade-in space-y-1"
              style={{
                background: 'rgba(17, 24, 39, 0.98)',
                backdropFilter: 'blur(12px)',
                border: '1px solid #2a3e5c',
                boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
              }}
            >
              <div className="text-[10px] uppercase font-bold text-sentinel-muted px-2 py-1 tracking-wider border-b border-sentinel-border/50 mb-1">
                Champs visibles sur les blocs
              </div>
              {fieldLabels.map(({ key, label }) => {
                const active = visibleFields[key]
                return (
                  <button
                    key={key}
                    onClick={() => toggleVisibleField(key)}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs hover:bg-sentinel-border/60 transition-colors text-left"
                  >
                    <span className={active ? 'text-white font-medium' : 'text-sentinel-muted'}>
                      {label}
                    </span>
                    <div
                      className={`w-4 h-4 rounded flex items-center justify-center border transition-all ${
                        active ? 'bg-blue-600 border-blue-500 text-white' : 'border-sentinel-border bg-slate-800'
                      }`}
                    >
                      {active && <Check size={11} />}
                    </div>
                  </button>
                )
              })}
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
