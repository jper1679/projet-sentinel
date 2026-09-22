// =============================================================================
// Projet Sentinel — GanttView (Vue Chronologique & Dépendances d'Exécution)
// Accessible via la route /gantt
// =============================================================================

import { useCallback, useEffect, useState, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft, RefreshCw, Layers, ExternalLink, Filter, Search,
  Calendar, Clock, ShieldAlert, CheckCircle2, PlayCircle, AlertOctagon, HelpCircle, DollarSign
} from 'lucide-react'

import { nodeService, type NodeAPIResponse } from '@/services/nodeService'
import { linkService, type LinkAPIResponse } from '@/services/linkService'

interface GanttTaskItem {
  id: string
  titre: string
  type: string
  statut: string
  priorite: string
  temps_estime_h: number
  cout_estime?: number
  created_at: string
  updated_at: string
  dependencies: string[] // Liste des IDs de nœuds dont cette tâche dépend (prédecesseurs)
  successors: string[]   // Liste des IDs de nœuds exécutés après
  level: number          // Niveau de profondeur dans l'ordre d'exécution
}

const STATUT_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  BACKLOG:  { label: 'Backlog',   color: '#94a3b8', bg: '#334155' },
  A_FAIRE:  { label: 'À faire',   color: '#60a5fa', bg: '#1d4ed8' },
  EN_COURS: { label: 'En cours',  color: '#fbbf24', bg: '#d97706' },
  TERMINE:  { label: 'Terminé',   color: '#34d399', bg: '#059669' },
  BLOQUE:   { label: 'Bloqué 🔒', color: '#f87171', bg: '#dc2626' },
}

export default function GanttView() {
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nodes, setNodes] = useState<NodeAPIResponse[]>([])
  const [links, setLinks] = useState<LinkAPIResponse[]>([])

  // Filtres
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedType, setSelectedType] = useState<string>('ALL')
  const [selectedStatut, setSelectedStatut] = useState<string>('ALL')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [allNodes, allLinks] = await Promise.all([
        nodeService.getAll(),
        linkService.getAll(),
      ])
      setNodes(allNodes)
      setLinks(allLinks)
    } catch (err) {
      console.error('Erreur chargement données Gantt:', err)
      setError('Impossible de charger les nœuds et dépendances pour le diagramme de Gantt.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Calcul du graphe de dépendances et de l'ordonnancement (Levels)
  const ganttTasks = useMemo(() => {
    if (!nodes.length) return []

    // Map de départ des tâches
    const taskMap = new Map<string, GanttTaskItem>()

    nodes.forEach((n) => {
      taskMap.set(n.id, {
        id: n.id,
        titre: n.titre,
        type: n.type,
        statut: n.statut,
        priorite: n.priorite,
        temps_estime_h: n.temps_estime_h || 4, // Défaut 4h si non renseigné
        cout_estime: n.cout_estime,
        created_at: n.created_at,
        updated_at: n.updated_at,
        dependencies: [],
        successors: [],
        level: 0,
      })
    })

    // Analyser les relations pour remplir dependencies & successors
    links.forEach((l) => {
      if (l.type === 'EXECUTE_AVANT' || l.type === 'SUIVIE_DE') {
        // Source doit être exécuté AVANT Target => Target dépend de Source
        const src = taskMap.get(l.source_id)
        const tgt = taskMap.get(l.target_id)
        if (src && tgt) {
          tgt.dependencies.push(src.id)
          src.successors.push(tgt.id)
        }
      } else if (l.type === 'BLOQUEE_PAR') {
        // Source est BLOQUÉE PAR Target => Source dépend de Target
        const src = taskMap.get(l.source_id)
        const tgt = taskMap.get(l.target_id)
        if (src && tgt) {
          src.dependencies.push(tgt.id)
          tgt.successors.push(src.id)
        }
      }
    })

    // Calcul récursif des niveaux d'exécution (Topological ordering)
    const computeLevel = (taskId: string, visited = new Set<string>()): number => {
      if (visited.has(taskId)) return 0 // Gestion anti-cycle
      visited.add(taskId)
      const task = taskMap.get(taskId)
      if (!task || task.dependencies.length === 0) return 0

      let maxDepLevel = 0
      task.dependencies.forEach((depId) => {
        const lvl = computeLevel(depId, new Set(visited))
        if (lvl + 1 > maxDepLevel) {
          maxDepLevel = lvl + 1
        }
      })
      return maxDepLevel
    }

    taskMap.forEach((task) => {
      task.level = computeLevel(task.id)
    })

    // Tri par niveau d'exécution puis par statut
    const taskList = Array.from(taskMap.values())
    taskList.sort((a, b) => a.level - b.level || a.titre.localeCompare(b.titre))

    return taskList
  }, [nodes, links])

  // Filtrage des tâches
  const filteredTasks = useMemo(() => {
    return ganttTasks.filter((t) => {
      const matchSearch = t.titre.toLowerCase().includes(searchQuery.toLowerCase())
      const matchType = selectedType === 'ALL' || t.type === selectedType
      const matchStatut = selectedStatut === 'ALL' || t.statut === selectedStatut
      return matchSearch && matchType && matchStatut
    })
  }, [ganttTasks, searchQuery, selectedType, selectedStatut])

  // Niveaux d'exécution uniques pour la grille
  const maxLevel = useMemo(() => {
    return filteredTasks.reduce((max, t) => Math.max(max, t.level), 0)
  }, [filteredTasks])

  // Calcul des métriques globales style MS Project
  const projectMetrics = useMemo(() => {
    const totalTime = nodes.reduce((sum, n) => sum + (n.temps_estime_h || 0), 0)
    const totalCost = nodes.reduce((sum, n) => sum + (n.cout_estime || 0), 0)
    const completedCount = nodes.filter((n) => n.statut === 'TERMINE').length
    const blockedCount = nodes.filter((n) => n.statut === 'BLOQUE').length
    const progressPct = nodes.length > 0 ? Math.round((completedCount / nodes.length) * 100) : 0

    return { totalTime, totalCost, completedCount, blockedCount, progressPct }
  }, [nodes])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0e1a] text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="animate-spin text-purple-500" size={32} />
          <span className="text-sm font-medium">Calcul de l'ordonnancement et du diagramme de Gantt…</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0e1a] text-slate-300 p-6">
        <div className="max-w-md w-full bg-[#111827] border border-red-500/30 rounded-2xl p-6 text-center space-y-4 shadow-2xl">
          <ShieldAlert className="text-red-400 mx-auto" size={48} />
          <h2 className="text-lg font-bold text-white">Erreur d'affichage Gantt</h2>
          <p className="text-sm text-slate-400">{error}</p>
          <button onClick={() => navigate('/')} className="btn-primary w-full justify-center">
            <ArrowLeft size={16} /> Retour au canevas
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-slate-200 flex flex-col font-sans">
      {/* Header Bar */}
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
            <CheckCircle2 size={14} className="text-blue-400" /> Kanban Jira
          </button>
          <div className="h-4 w-[1px] bg-slate-700" />
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-purple-500/20 text-purple-400 border border-purple-500/30">
              <Calendar size={16} />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white leading-none">Diagramme de Gantt & Dépendances MS Project</h1>
              <p className="text-[11px] text-slate-400 leading-tight">Ordonnancement des tâches et métriques de projet</p>
            </div>
          </div>
        </div>

        {/* Action Controls & Refresh */}
        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            className="btn-ghost text-xs px-3 py-1.5 flex items-center gap-1.5 text-slate-300 border border-slate-700/50 rounded-lg"
            title="Rafraîchir les données"
          >
            <RefreshCw size={13} /> Rafraîchir
          </button>
        </div>
      </header>

      {/* Bandeau de Métriques MS Project */}
      <div className="bg-[#0f172a] border-b border-[#1e2d45] px-6 py-3 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
        <div className="flex items-center gap-3 p-2.5 rounded-xl bg-[#111827] border border-[#1e2d45]">
          <div className="p-2 rounded-lg bg-blue-500/15 text-blue-400">
            <Clock size={16} />
          </div>
          <div>
            <div className="text-[10px] text-slate-400 uppercase font-bold">Durée totale</div>
            <div className="text-sm font-bold text-white font-mono">{projectMetrics.totalTime} h</div>
          </div>
        </div>

        <div className="flex items-center gap-3 p-2.5 rounded-xl bg-[#111827] border border-[#1e2d45]">
          <div className="p-2 rounded-lg bg-emerald-500/15 text-emerald-400">
            <DollarSign size={16} />
          </div>
          <div>
            <div className="text-[10px] text-slate-400 uppercase font-bold">Budget estimé</div>
            <div className="text-sm font-bold text-emerald-400 font-mono">${projectMetrics.totalCost.toLocaleString('fr-CA')}</div>
          </div>
        </div>

        <div className="flex items-center gap-3 p-2.5 rounded-xl bg-[#111827] border border-[#1e2d45]">
          <div className="p-2 rounded-lg bg-purple-500/15 text-purple-400">
            <CheckCircle2 size={16} />
          </div>
          <div className="flex-1">
            <div className="text-[10px] text-slate-400 uppercase font-bold flex justify-between">
              <span>Avancement</span>
              <span className="text-purple-400">{projectMetrics.progressPct}%</span>
            </div>
            <div className="w-full h-2 bg-slate-800 rounded-full mt-1 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all duration-500"
                style={{ width: `${projectMetrics.progressPct}%` }}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 p-2.5 rounded-xl bg-[#111827] border border-[#1e2d45]">
          <div className="p-2 rounded-lg bg-red-500/15 text-red-400">
            <ShieldAlert size={16} />
          </div>
          <div>
            <div className="text-[10px] text-slate-400 uppercase font-bold">Tâches bloquées</div>
            <div className="text-sm font-bold text-red-400 font-mono">{projectMetrics.blockedCount} 🔒</div>
          </div>
        </div>
      </div>

      {/* Toolbar / Filtres */}
      <div className="bg-[#111827] border-b border-[#1e2d45] px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Recherche */}
          <div className="relative min-w-[200px] flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Filtrer par titre..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#0a0e1a] border border-[#1e2d45] rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 outline-none focus:border-purple-500"
            />
          </div>

          {/* Filtre Type */}
          <div className="flex items-center gap-1.5 bg-[#0a0e1a] border border-[#1e2d45] rounded-xl px-2.5 py-1 text-xs">
            <Filter size={12} className="text-purple-400" />
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
              <option value="PROCEDURE">📋 Procédure</option>
              <option value="ETAPE">🔹 Étape</option>
            </select>
          </div>

          {/* Filtre Statut */}
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

        {/* Compteur */}
        <div className="text-xs text-slate-400">
          Affichage : <span className="font-bold text-white">{filteredTasks.length}</span> / {ganttTasks.length} éléments
        </div>
      </div>

      {/* Zone Principale Gantt */}
      <main className="flex-1 p-6 overflow-x-auto">
        <div className="min-w-[900px] bg-[#111827] border border-[#1e2d45] rounded-2xl overflow-hidden shadow-2xl">
          
          {/* En-tête de la grille Gantt (Colonnes de Jalons / Phases d'exécution) */}
          <div className="grid grid-cols-[320px,1fr] border-b border-[#1e2d45] bg-[#0a0e1a]">
            <div className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider border-r border-[#1e2d45] flex items-center gap-2">
              <Layers size={14} className="text-purple-400" /> Nœud & Tâche
            </div>

            {/* Colonnes d'étapes d'exécution (Phases 0, 1, 2, ...) */}
            <div className="grid" style={{ gridTemplateColumns: `repeat(${maxLevel + 2}, minmax(140px, 1fr))` }}>
              {Array.from({ length: maxLevel + 2 }).map((_, i) => (
                <div
                  key={i}
                  className="p-3 text-center border-r border-[#1e2d45]/60 text-xs font-semibold text-slate-400"
                >
                  Phase {i + 1}
                  <span className="block text-[10px] font-normal text-slate-500">
                    {i === 0 ? 'Démarrage' : `Ordre +${i}`}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Corps de la liste des tâches et des barres Gantt */}
          <div className="divide-y divide-[#1e2d45]/50">
            {filteredTasks.length === 0 ? (
              <div className="p-12 text-center text-slate-500 text-sm space-y-2">
                <AlertOctagon className="mx-auto text-slate-600" size={36} />
                <p>Aucune tâche ne correspond aux critères de recherche sélectionnés.</p>
              </div>
            ) : (
              filteredTasks.map((task) => {
                const st = STATUT_STYLES[task.statut] ?? STATUT_STYLES.A_FAIRE

                return (
                  <div
                    key={task.id}
                    className="grid grid-cols-[320px,1fr] hover:bg-[#1a2333]/50 transition-colors group"
                  >
                    {/* Colonne gauche : Infos du nœud Jira */}
                    <div className="p-3.5 border-r border-[#1e2d45] flex flex-col justify-center space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <Link
                          to={`/node/${task.id}`}
                          className="font-semibold text-xs text-slate-100 hover:text-purple-400 transition-colors truncate flex items-center gap-1.5"
                          title="Ouvrir la fiche Jira"
                        >
                          <span className="text-sm">
                            {task.type === 'IDEE' ? '💡' : task.type === 'PROJET' ? '📁' : task.type === 'COMPOSANT' ? '⚙️' : '✅'}
                          </span>
                          <span className="truncate">{task.titre}</span>
                        </Link>
                        <button
                          onClick={() => navigate(`/node/${task.id}`)}
                          className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-white transition-opacity p-1"
                          title="Ouvrir la fiche Jira"
                        >
                          <ExternalLink size={12} />
                        </button>
                      </div>

                      <div className="flex items-center gap-2 text-[10px] text-slate-400">
                        <span className="font-mono text-purple-400 font-bold bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.2 rounded">
                          SENT-{task.id.slice(0, 6)}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock size={10} /> {task.temps_estime_h}h
                        </span>
                        {task.dependencies.length > 0 && (
                          <span className="text-amber-400 font-medium">
                            • {task.dependencies.length} dép.
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Colonne droite : Barre Gantt positionnée sur son niveau d'exécution */}
                    <div
                      className="p-3 relative flex items-center"
                      style={{ gridTemplateColumns: `repeat(${maxLevel + 2}, minmax(140px, 1fr))` }}
                    >
                      <div className="w-full grid" style={{ gridTemplateColumns: `repeat(${maxLevel + 2}, minmax(140px, 1fr))` }}>
                        {/* Emplacement de la barre chronologique */}
                        <div
                          className="col-span-2 relative z-10"
                          style={{
                            gridColumnStart: task.level + 1,
                            gridColumnEnd: `span 2`,
                          }}
                        >
                          <div
                            onClick={() => navigate(`/node/${task.id}`)}
                            className="h-8 rounded-xl px-3 flex items-center justify-between shadow-lg cursor-pointer transition-transform hover:scale-[1.02] border"
                            style={{
                              background: st.bg,
                              borderColor: `${st.color}80`,
                              color: 'white',
                            }}
                          >
                            <div className="flex items-center gap-2 overflow-hidden text-xs font-semibold">
                              <span
                                style={{ width: 6, height: 6, borderRadius: '50%', background: st.color }}
                              />
                              <span className="truncate">{task.titre}</span>
                            </div>

                            <span className="text-[10px] font-bold uppercase tracking-wider bg-black/30 px-2 py-0.5 rounded-full ml-2 shrink-0">
                              {st.label}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                  </div>
                )
              })
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
