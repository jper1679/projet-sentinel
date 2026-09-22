// =============================================================================
// Projet Sentinel — TaskListView (Vue Tableau / Liste structurée des nœuds)
// Accessible via la route /list
// =============================================================================

import { useCallback, useEffect, useState, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft, RefreshCw, Search, Filter, Layers, ExternalLink,
  Clock, DollarSign, AlertTriangle, CheckCircle2, Trash2, Tag, CheckSquare, BarChart2
} from 'lucide-react'

import { nodeService, type NodeAPIResponse } from '@/services/nodeService'
import { type ItemStatut, type ItemType } from '@/store/useAppStore'

const TYPE_ICONS: Record<string, string> = {
  IDEE: '💡', TACHE: '✅', PROJET: '📁', COMPOSANT: '⚙️', PROCEDURE: '📋', ETAPE: '🔹'
}

const STATUT_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  BACKLOG:  { label: 'Backlog',   color: '#94a3b8', bg: 'rgba(148,163,184,0.15)' },
  A_FAIRE:  { label: 'À faire',   color: '#60a5fa', bg: 'rgba(96,165,250,0.15)' },
  EN_COURS: { label: 'En cours',  color: '#fbbf24', bg: 'rgba(251,191,36,0.15)' },
  TERMINE:  { label: 'Terminé',   color: '#34d399', bg: 'rgba(52,211,153,0.15)' },
  BLOQUE:   { label: 'Bloqué 🔒', color: '#f87171', bg: 'rgba(248,113,113,0.15)' },
}

const PRIORITE_STYLES: Record<string, { label: string; color: string }> = {
  BASSE:    { label: 'Basse',    color: '#64748b' },
  NORMALE:  { label: 'Normale',  color: '#3b82f6' },
  HAUTE:    { label: 'Haute',    color: '#f59e0b' },
  CRITIQUE: { label: 'Critique ⚠️', color: '#ef4444' },
}

export default function TaskListView() {
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nodes, setNodes] = useState<NodeAPIResponse[]>([])

  // Filtres
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedType, setSelectedType] = useState<string>('ALL')
  const [selectedStatut, setSelectedStatut] = useState<string>('ALL')
  const [selectedPriorite, setSelectedPriorite] = useState<string>('ALL')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await nodeService.getAll()
      setNodes(data)
    } catch (err) {
      console.error('Erreur chargement Liste:', err)
      setError('Impossible de charger la liste des tâches.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const filteredNodes = useMemo(() => {
    return nodes.filter((n) => {
      const matchSearch = n.titre.toLowerCase().includes(searchQuery.toLowerCase()) || (n.description || '').toLowerCase().includes(searchQuery.toLowerCase())
      const matchType = selectedType === 'ALL' || n.type === selectedType
      const matchStatut = selectedStatut === 'ALL' || n.statut === selectedStatut
      const matchPriorite = selectedPriorite === 'ALL' || n.priorite === selectedPriorite
      return matchSearch && matchType && matchStatut && matchPriorite
    })
  }, [nodes, searchQuery, selectedType, selectedStatut, selectedPriorite])

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!window.confirm('Voulez-vous vraiment supprimer ce nœud ?')) return
    try {
      await nodeService.delete(id)
      setNodes((prev) => prev.filter((n) => n.id !== id))
    } catch (err) {
      console.error('Erreur suppression:', err)
      alert('Impossible de supprimer le nœud.')
    }
  }

  const handleUpdateStatut = async (id: string, newStatut: ItemStatut, e: React.ChangeEvent<HTMLSelectElement>) => {
    e.stopPropagation()
    try {
      const updated = await nodeService.update(id, { statut: newStatut })
      setNodes((prev) => prev.map((n) => (n.id === id ? updated : n)))
    } catch (err) {
      console.error('Erreur statut:', err)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0e1a] text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="animate-spin text-blue-500" size={32} />
          <span className="text-sm font-medium">Chargement du tableau de tâches…</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-slate-200 flex flex-col font-sans">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-[#111827]/90 backdrop-blur-md border-b border-[#1e2d45] px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white bg-[#1e2d45]/50 hover:bg-[#1e2d45] px-3 py-1.5 rounded-lg border border-slate-700/50 transition-colors"
          >
            <ArrowLeft size={14} /> Carte
          </button>
          <button
            onClick={() => navigate('/kanban')}
            className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white bg-[#1e2d45]/50 hover:bg-[#1e2d45] px-3 py-1.5 rounded-lg border border-slate-700/50 transition-colors"
          >
            <CheckSquare size={14} className="text-blue-400" /> Kanban Jira
          </button>
          <button
            onClick={() => navigate('/gantt')}
            className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white bg-[#1e2d45]/50 hover:bg-[#1e2d45] px-3 py-1.5 rounded-lg border border-slate-700/50 transition-colors"
          >
            <BarChart2 size={14} className="text-purple-400" /> Vue Gantt
          </button>
          <div className="h-4 w-[1px] bg-slate-700" />
          <div className="flex items-center gap-2">
            <Layers size={18} className="text-emerald-400" />
            <h1 className="text-sm font-bold text-white leading-none">Vue Tableau & Liste des Tâches</h1>
          </div>
        </div>

        <button
          onClick={loadData}
          className="btn-ghost text-xs px-3 py-1.5 flex items-center gap-1.5 text-slate-300 border border-slate-700/50 rounded-lg"
        >
          <RefreshCw size={13} /> Rafraîchir
        </button>
      </header>

      {/* Toolbar / Filtres */}
      <div className="bg-[#111827] border-b border-[#1e2d45] px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative min-w-[200px] flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher par titre ou description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#0a0e1a] border border-[#1e2d45] rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-[#0a0e1a] border border-[#1e2d45] rounded-xl px-2.5 py-1 text-xs">
            <Filter size={12} className="text-emerald-400" />
            <span className="text-slate-400 text-[11px]">Type:</span>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="bg-transparent text-slate-200 font-medium outline-none cursor-pointer"
            >
              <option value="ALL">Tous les types</option>
              <option value="IDEE">💡 Idée</option>
              <option value="TACHE">✅ Tâche</option>
              <option value="PROJET">📁 Projet</option>
              <option value="COMPOSANT">⚙️ Composant</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-[#0a0e1a] border border-[#1e2d45] rounded-xl px-2.5 py-1 text-xs">
            <span className="text-slate-400 text-[11px]">Statut:</span>
            <select
              value={selectedStatut}
              onChange={(e) => setSelectedStatut(e.target.value)}
              className="bg-transparent text-slate-200 font-medium outline-none cursor-pointer"
            >
              <option value="ALL">Tous les statuts</option>
              <option value="BACKLOG">Backlog</option>
              <option value="A_FAIRE">À faire</option>
              <option value="EN_COURS">En cours</option>
              <option value="TERMINE">Terminé</option>
              <option value="BLOQUE">Bloqué 🔒</option>
            </select>
          </div>
        </div>

        <div className="text-xs text-slate-400">
          Affichage : <span className="font-bold text-white">{filteredNodes.length}</span> éléments
        </div>
      </div>

      {/* Tableau des Tâches */}
      <main className="flex-1 p-6 overflow-x-auto">
        <div className="min-w-[900px] bg-[#111827] border border-[#1e2d45] rounded-2xl overflow-hidden shadow-2xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#0a0e1a] border-b border-[#1e2d45] text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="p-3.5 pl-5">Clé Jira</th>
                <th className="p-3.5">Type</th>
                <th className="p-3.5">Titre</th>
                <th className="p-3.5">Statut</th>
                <th className="p-3.5">Priorité</th>
                <th className="p-3.5">Temps (h)</th>
                <th className="p-3.5">Coût ($)</th>
                <th className="p-3.5 pr-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2d45]/60 text-xs">
              {filteredNodes.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500 italic">
                    Aucun élément trouvé dans le système.
                  </td>
                </tr>
              ) : (
                filteredNodes.map((n) => {
                  const st = STATUT_STYLES[n.statut] ?? STATUT_STYLES.A_FAIRE
                  const pr = PRIORITE_STYLES[n.priorite] ?? PRIORITE_STYLES.NORMALE

                  return (
                    <tr
                      key={n.id}
                      onClick={() => navigate(`/node/${n.id}`)}
                      className="hover:bg-[#1a2333]/50 transition-colors cursor-pointer group"
                    >
                      <td className="p-3.5 pl-5 font-mono font-bold text-blue-400">
                        SENT-{n.id.slice(0, 6)}
                      </td>

                      <td className="p-3.5 font-medium text-slate-300">
                        <span className="mr-1.5">{TYPE_ICONS[n.type] ?? '💡'}</span>
                        {n.type}
                      </td>

                      <td className="p-3.5 font-semibold text-slate-100 group-hover:text-blue-400 transition-colors">
                        {n.titre}
                      </td>

                      <td className="p-3.5">
                        <select
                          value={n.statut}
                          onChange={(e) => handleUpdateStatut(n.id, e.target.value as ItemStatut, e)}
                          onClick={(e) => e.stopPropagation()}
                          className="bg-[#0a0e1a] border border-[#1e2d45] rounded-lg px-2 py-1 text-xs outline-none hover:border-blue-500 font-semibold"
                          style={{ color: st.color }}
                        >
                          <option value="BACKLOG">Backlog</option>
                          <option value="A_FAIRE">À faire</option>
                          <option value="EN_COURS">En cours</option>
                          <option value="TERMINE">Terminé</option>
                          <option value="BLOQUE">Bloqué 🔒</option>
                        </select>
                      </td>

                      <td className="p-3.5 font-semibold" style={{ color: pr.color }}>
                        {pr.label}
                      </td>

                      <td className="p-3.5 font-mono text-slate-300">
                        {n.temps_estime_h != null ? `${n.temps_estime_h} h` : '—'}
                      </td>

                      <td className="p-3.5 font-mono text-slate-300">
                        {n.cout_estime != null ? `$${n.cout_estime}` : '—'}
                      </td>

                      <td className="p-3.5 pr-5 text-right space-x-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/node/${n.id}`)
                          }}
                          className="btn-ghost p-1.5 rounded-lg text-slate-400 hover:text-white"
                          title="Ouvrir la fiche Jira"
                        >
                          <ExternalLink size={13} />
                        </button>

                        <button
                          onClick={(e) => handleDelete(n.id, e)}
                          className="btn-ghost p-1.5 rounded-lg text-slate-400 hover:text-red-400"
                          title="Supprimer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  )
}
