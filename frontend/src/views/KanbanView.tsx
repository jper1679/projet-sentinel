// =============================================================================
// Projet Sentinel — KanbanView (Tableau Kanban Interactif style Jira)
// Accessible via la route /kanban
// =============================================================================

import { useCallback, useEffect, useState, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft, RefreshCw, Plus, Search, Filter, Layers, ExternalLink,
  Clock, DollarSign, AlertTriangle, CheckCircle2, ChevronRight, BarChart2,
  Calendar, CheckSquare
} from 'lucide-react'

import { nodeService, type NodeAPIResponse } from '@/services/nodeService'
import { useAppStore, type ItemStatut, type ItemType, type ItemPriorite } from '@/store/useAppStore'

interface KanbanColumn {
  id: ItemStatut
  label: string
  color: string
  bg: string
  border: string
  icon: string
}

const KANBAN_COLUMNS: KanbanColumn[] = [
  { id: 'BACKLOG',  label: 'Backlog',   color: '#94a3b8', bg: 'rgba(148,163,184,0.08)', border: '#334155', icon: '📥' },
  { id: 'A_FAIRE',  label: 'À faire',   color: '#60a5fa', bg: 'rgba(96,165,250,0.08)',  border: '#1e3a8a', icon: '🎯' },
  { id: 'EN_COURS', label: 'En cours',  color: '#fbbf24', bg: 'rgba(251,191,36,0.08)',  border: '#78350f', icon: '⚡' },
  { id: 'TERMINE',  label: 'Terminé',   color: '#34d399', bg: 'rgba(52,211,153,0.08)',  border: '#064e3b', icon: '✅' },
  { id: 'BLOQUE',   label: 'Bloqué 🔒', color: '#f87171', bg: 'rgba(248,113,113,0.08)', border: '#7f1d1d', icon: '⛔' },
]

const TYPE_ICONS: Record<string, string> = {
  IDEE: '💡', TACHE: '✅', PROJET: '📁', COMPOSANT: '⚙️', PROCEDURE: '📋', ETAPE: '🔹'
}

const PRIORITE_BADGES: Record<string, { label: string; color: string }> = {
  BASSE:    { label: 'Basse',    color: '#64748b' },
  NORMALE:  { label: 'Normale',  color: '#3b82f6' },
  HAUTE:    { label: 'Haute',    color: '#f59e0b' },
  CRITIQUE: { label: 'Critique', color: '#ef4444' },
}

export default function KanbanView() {
  const navigate = useNavigate()
  const addNodeStore = useAppStore((s) => s.addNode)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nodes, setNodes] = useState<NodeAPIResponse[]>([])

  // Filtres
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedType, setSelectedType] = useState<string>('ALL')
  const [selectedPriorite, setSelectedPriorite] = useState<string>('ALL')

  // Modale rapide de création dans une colonne
  const [quickCreateStatut, setQuickCreateStatut] = useState<ItemStatut | null>(null)
  const [quickTitle, setQuickTitle] = useState('')
  const [quickType, setQuickType] = useState<ItemType>('TACHE')
  const [isCreating, setIsCreating] = useState(false)

  // Charger la liste des nœuds
  const loadNodes = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await nodeService.getAll()
      setNodes(data)
    } catch (err) {
      console.error('Erreur chargement Kanban:', err)
      setError('Impossible de charger les cartes du tableau Kanban.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadNodes()
  }, [loadNodes])

  // Filtrage des nœuds
  const filteredNodes = useMemo(() => {
    return nodes.filter((n) => {
      const matchSearch = n.titre.toLowerCase().includes(searchQuery.toLowerCase())
      const matchType = selectedType === 'ALL' || n.type === selectedType
      const matchPriorite = selectedPriorite === 'ALL' || n.priorite === selectedPriorite
      return matchSearch && matchType && matchPriorite
    })
  }, [nodes, searchQuery, selectedType, selectedPriorite])

  // Grouper par statut
  const columnsData = useMemo(() => {
    const map: Record<ItemStatut, NodeAPIResponse[]> = {
      BACKLOG: [],
      A_FAIRE: [],
      EN_COURS: [],
      TERMINE: [],
      BLOQUE: [],
    }
    filteredNodes.forEach((n) => {
      const st = (n.statut as ItemStatut) || 'A_FAIRE'
      if (map[st]) {
        map[st].push(n)
      } else {
        map['A_FAIRE'].push(n)
      }
    })
    return map
  }, [filteredNodes])

  // Déplacement direct de statut pour un nœud
  const handleUpdateStatut = async (nodeId: string, newStatut: ItemStatut) => {
    try {
      const updated = await nodeService.update(nodeId, { statut: newStatut })
      setNodes((prev) => prev.map((n) => (n.id === nodeId ? updated : n)))
    } catch (err) {
      console.error('Erreur changement statut:', err)
      alert('Impossible de modifier le statut.')
    }
  }

  // Création rapide dans une colonne spécifique
  const handleQuickCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!quickCreateStatut || !quickTitle.trim()) return
    setIsCreating(true)
    try {
      const newNode = await nodeService.create({
        titre: quickTitle.trim(),
        statut: quickCreateStatut,
        type: quickType,
        pos_x: Math.random() * 500,
        pos_y: Math.random() * 400,
      })
      setNodes((prev) => [newNode, ...prev])
      setQuickTitle('')
      setQuickCreateStatut(null)
    } catch (err) {
      console.error('Erreur création rapide:', err)
      alert('Erreur lors de la création de la tâche.')
    } finally {
      setIsCreating(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0e1a] text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="animate-spin text-blue-500" size={32} />
          <span className="text-sm font-medium">Chargement du tableau Kanban Jira…</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-slate-200 flex flex-col font-sans">
      {/* Header Top Bar */}
      <header className="sticky top-0 z-30 bg-[#111827]/90 backdrop-blur-md border-b border-[#1e2d45] px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white bg-[#1e2d45]/50 hover:bg-[#1e2d45] px-3 py-1.5 rounded-lg border border-slate-700/50 transition-colors"
          >
            <ArrowLeft size={14} /> Retour à la carte
          </button>
          <div className="h-4 w-[1px] bg-slate-700" />
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30">
              <CheckSquare size={16} />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white leading-none">Tableau Kanban Jira</h1>
              <p className="text-[11px] text-slate-400 leading-tight">Suivi et gestion du flux de travail</p>
            </div>
          </div>
        </div>

        {/* Action Controls & Navigation Switcher */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/gantt')}
            className="btn-ghost text-xs px-3 py-1.5 flex items-center gap-1.5 text-purple-400 hover:text-white border border-purple-500/30 rounded-lg"
          >
            <BarChart2 size={13} /> Vue Gantt
          </button>
          <button
            onClick={loadNodes}
            className="btn-ghost text-xs px-3 py-1.5 flex items-center gap-1.5 text-slate-300 border border-slate-700/50 rounded-lg"
            title="Rafraîchir"
          >
            <RefreshCw size={13} /> Rafraîchir
          </button>
        </div>
      </header>

      {/* Toolbar / Filtres */}
      <div className="bg-[#111827] border-b border-[#1e2d45] px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Recherche */}
          <div className="relative min-w-[200px] flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Filtrer les cartes Jira..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#0a0e1a] border border-[#1e2d45] rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 outline-none focus:border-blue-500"
            />
          </div>

          {/* Filtre Type */}
          <div className="flex items-center gap-1.5 bg-[#0a0e1a] border border-[#1e2d45] rounded-xl px-2.5 py-1 text-xs">
            <Filter size={12} className="text-blue-400" />
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

          {/* Filtre Priorité */}
          <div className="flex items-center gap-1.5 bg-[#0a0e1a] border border-[#1e2d45] rounded-xl px-2.5 py-1 text-xs">
            <span className="text-slate-400 text-[11px]">Priorité:</span>
            <select
              value={selectedPriorite}
              onChange={(e) => setSelectedPriorite(e.target.value)}
              className="bg-transparent text-slate-200 font-medium outline-none cursor-pointer"
            >
              <option value="ALL">Toutes priorités</option>
              <option value="BASSE">Basse</option>
              <option value="NORMALE">Normale</option>
              <option value="HAUTE">Haute</option>
              <option value="CRITIQUE">Critique ⚠️</option>
            </select>
          </div>
        </div>

        <div className="text-xs text-slate-400">
          Total : <span className="font-bold text-white">{filteredNodes.length}</span> cartes
        </div>
      </div>

      {/* Grille des Colonnes Kanban */}
      <main className="flex-1 p-6 overflow-x-auto">
        <div className="min-w-[1200px] grid grid-cols-5 gap-4 items-start">
          {KANBAN_COLUMNS.map((col) => {
            const colItems = columnsData[col.id] || []

            return (
              <div
                key={col.id}
                className="bg-[#111827] border rounded-2xl p-3.5 space-y-3 flex flex-col max-h-[82vh]"
                style={{ borderColor: col.border, background: col.bg }}
              >
                {/* En-tête de la colonne */}
                <div className="flex items-center justify-between pb-2 border-b border-[#1e2d45]">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{col.icon}</span>
                    <span className="text-xs font-bold text-white uppercase tracking-wider">{col.label}</span>
                    <span
                      className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono"
                      style={{ background: `${col.color}22`, color: col.color, border: `1px solid ${col.color}40` }}
                    >
                      {colItems.length}
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      setQuickCreateStatut(col.id)
                      setQuickTitle('')
                    }}
                    className="p-1 hover:bg-slate-700/50 rounded-lg text-slate-400 hover:text-white transition-colors"
                    title={`Ajouter une carte dans ${col.label}`}
                  >
                    <Plus size={14} />
                  </button>
                </div>

                {/* Formulaire d'ajout rapide dans la colonne */}
                {quickCreateStatut === col.id && (
                  <form onSubmit={handleQuickCreate} className="p-2.5 bg-[#0a0e1a] border border-blue-500/40 rounded-xl space-y-2 animate-fade-in">
                    <input
                      type="text"
                      placeholder="Titre de la tâche..."
                      value={quickTitle}
                      onChange={(e) => setQuickTitle(e.target.value)}
                      autoFocus
                      required
                      className="w-full bg-[#111827] border border-[#1e2d45] rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-blue-500"
                    />
                    <div className="flex items-center justify-between">
                      <select
                        value={quickType}
                        onChange={(e) => setQuickType(e.target.value as ItemType)}
                        className="bg-[#111827] border border-[#1e2d45] rounded px-2 py-0.5 text-[10px] text-slate-300"
                      >
                        <option value="TACHE">✅ Tâche</option>
                        <option value="IDEE">💡 Idée</option>
                        <option value="PROJET">📁 Projet</option>
                        <option value="COMPOSANT">⚙️ Composant</option>
                      </select>

                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => setQuickCreateStatut(null)}
                          className="px-2 py-0.5 text-[10px] text-slate-400 hover:text-white"
                        >
                          Annuler
                        </button>
                        <button
                          type="submit"
                          disabled={isCreating}
                          className="btn-primary px-2.5 py-0.5 text-[10px]"
                        >
                          Ajouter
                        </button>
                      </div>
                    </div>
                  </form>
                )}

                {/* Cartes de la colonne */}
                <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                  {colItems.length === 0 ? (
                    <div className="text-center py-8 text-slate-600 text-xs italic">
                      Aucun élément
                    </div>
                  ) : (
                    colItems.map((item) => {
                      const prio = PRIORITE_BADGES[item.priorite] ?? PRIORITE_BADGES.NORMALE

                      return (
                        <div
                          key={item.id}
                          className="p-3 bg-[#0a0e1a] border border-[#1e2d45] hover:border-blue-500/50 rounded-xl space-y-2.5 shadow-md hover:shadow-xl transition-all group relative"
                        >
                          {/* Top: Type + UUID + Quick Link */}
                          <div className="flex items-center justify-between text-[10px]">
                            <div className="flex items-center gap-1.5">
                              <span>{TYPE_ICONS[item.type] ?? '💡'}</span>
                              <span className="font-mono font-bold text-blue-400">
                                SENT-{item.id.slice(0, 6)}
                              </span>
                            </div>

                            <div className="flex items-center gap-1">
                              <span
                                className="px-1.5 py-0.2 rounded font-semibold text-[9px] uppercase"
                                style={{ background: `${prio.color}15`, color: prio.color }}
                              >
                                {prio.label}
                              </span>
                              <button
                                onClick={() => navigate(`/node/${item.id}`)}
                                className="text-slate-500 hover:text-white p-0.5 transition-colors"
                                title="Ouvrir la fiche Jira"
                              >
                                <ExternalLink size={12} />
                              </button>
                            </div>
                          </div>

                          {/* Titre */}
                          <Link
                            to={`/node/${item.id}`}
                            className="block font-semibold text-xs text-slate-100 hover:text-blue-400 transition-colors leading-snug"
                          >
                            {item.titre}
                          </Link>

                          {/* Extrait description si présent */}
                          {item.description && (
                            <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                              {item.description}
                            </p>
                          )}

                          {/* Footer: Temps / Coût & Sélecteur de statut */}
                          <div className="flex items-center justify-between pt-1.5 border-t border-[#1e2d45]/60 text-[10px] text-slate-500">
                            <div className="flex items-center gap-2">
                              {item.temps_estime_h != null && (
                                <span className="flex items-center gap-0.5">
                                  <Clock size={10} /> {item.temps_estime_h}h
                                </span>
                              )}
                              {item.cout_estime != null && (
                                <span className="flex items-center gap-0.5 text-green-400">
                                  <DollarSign size={10} /> {item.cout_estime}
                                </span>
                              )}
                            </div>

                            {/* Déplacement rapide de colonne */}
                            <select
                              value={item.statut}
                              onChange={(e) => handleUpdateStatut(item.id, e.target.value as ItemStatut)}
                              className="bg-[#111827] border border-[#1e2d45] rounded px-1.5 py-0.5 text-[10px] text-slate-300 outline-none hover:border-blue-500 cursor-pointer"
                            >
                              {KANBAN_COLUMNS.map((c) => (
                                <option key={c.id} value={c.id}>
                                  ➡️ {c.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </main>
    </div>
  )
}
