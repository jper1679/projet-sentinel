// =============================================================================
// Projet Sentinel — NodeDetailView (Page dédiée style Jira pour un nœud)
// Accessible via la route /node/:id
// =============================================================================

import { useCallback, useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft, Save, Trash2, Tag, CheckCircle, AlertTriangle, Clock,
  DollarSign, FileText, Share2, Layers, RefreshCw,
  ShieldAlert, Sparkles, Check, Plus, BarChart2, Link2, CheckSquare, MessageSquare
} from 'lucide-react'

import {
  useAppStore,
  type SentinelNodeData,
  type ItemType,
  type ItemStatut,
  type ItemPriorite,
} from '@/store/useAppStore'
import { nodeService, type NodeAPIResponse } from '@/services/nodeService'
import { linkService, type LinkAPIResponse, type LinkType } from '@/services/linkService'

const TYPE_OPTIONS: { value: ItemType; label: string; icon: string; color: string }[] = [
  { value: 'IDEE',      label: 'Idée',         icon: '💡', color: '#8b5cf6' },
  { value: 'TACHE',     label: 'Tâche',        icon: '✅', color: '#3b82f6' },
  { value: 'PROJET',    label: 'Projet',       icon: '📁', color: '#f59e0b' },
  { value: 'COMPOSANT', label: 'Composant',    icon: '⚙️', color: '#10b981' },
]

const STATUT_OPTIONS: { value: ItemStatut; label: string; color: string; bg: string }[] = [
  { value: 'BACKLOG',  label: 'Backlog',   color: '#94a3b8', bg: 'rgba(148,163,184,0.15)' },
  { value: 'A_FAIRE',  label: 'À faire',   color: '#60a5fa', bg: 'rgba(96,165,250,0.15)' },
  { value: 'EN_COURS', label: 'En cours',  color: '#fbbf24', bg: 'rgba(251,191,36,0.15)' },
  { value: 'TERMINE',  label: 'Terminé',   color: '#34d399', bg: 'rgba(52,211,153,0.15)' },
  { value: 'BLOQUE',   label: 'Bloqué 🔒', color: '#f87171', bg: 'rgba(248,113,113,0.15)' },
]

const PRIORITE_OPTIONS: { value: ItemPriorite; label: string; color: string }[] = [
  { value: 'BASSE',    label: 'Basse',    color: '#64748b' },
  { value: 'NORMALE',  label: 'Normale',  color: '#3b82f6' },
  { value: 'HAUTE',    label: 'Haute',    color: '#f59e0b' },
  { value: 'CRITIQUE', label: 'Critique', color: '#ef4444' },
]

const LINK_TYPE_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  EXECUTE_AVANT: { label: 'Doit être exécuté avant', icon: '➡️', color: '#8b5cf6' },
  BLOQUEE_PAR:   { label: 'Bloquée par',            icon: '🔒', color: '#ef4444' },
  RATTACHE_A:    { label: 'Rattaché à',             icon: '📁', color: '#f59e0b' },
  ASSIGNE_A:     { label: 'Assigné à',              icon: '👤', color: '#10b981' },
  SUIVIE_DE:     { label: 'Suivie de',              icon: '🔹', color: '#06b6d4' },
  CONTIENT_ETAPE:{ label: 'Contient l\'étape',     icon: '📋', color: '#ec4899' },
  LIE_A:          { label: 'Lié à',                  icon: '🔗', color: '#3b82f6' },
}

const strId = () => Math.random().toString(36).slice(2)

export default function NodeDetailView() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const updateNodeStore = useAppStore((s) => s.updateNode)
  const removeNodeStore = useAppStore((s) => s.removeNode)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nodeData, setNodeData] = useState<NodeAPIResponse | null>(null)

  // Formulaire local
  const [form, setForm] = useState<Partial<SentinelNodeData>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Relations
  const [links, setLinks] = useState<LinkAPIResponse[]>([])
  const [allNodes, setAllNodes] = useState<NodeAPIResponse[]>([])

  // Modal d'ajout de relation rapide
  const [showAddRelation, setShowAddRelation] = useState(false)
  const [newRelTargetId, setNewRelTargetId] = useState('')
  const [newRelType, setNewRelType] = useState<LinkType>('EXECUTE_AVANT')
  const [isAddingRel, setIsAddingRel] = useState(false)
  // Sub-tasks checklist local state
  const [checklist, setChecklist] = useState<{ id: string; text: string; done: boolean }[]>([])
  const [newCheckitem, setNewCheckitem] = useState('')

  // Comments / Notes history
  const [comments, setComments] = useState<{ id: string; author: string; text: string; created_at: string }[]>([])
  const [newComment, setNewComment] = useState('')

  const handleAddCheckitem = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCheckitem.trim()) return
    setChecklist((prev) => [...prev, { id: strId(), text: newCheckitem.trim(), done: false }])
    setNewCheckitem('')
  }

  const toggleCheckitem = (itemId: string) => {
    setChecklist((prev) => prev.map((item) => (item.id === itemId ? { ...item, done: !item.done } : item)))
  }

  const deleteCheckitem = (itemId: string) => {
    setChecklist((prev) => prev.filter((item) => item.id !== itemId))
  }

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim()) return
    const commentObj = {
      id: strId(),
      author: 'Utilisateur',
      text: newComment.trim(),
      created_at: new Date().toISOString(),
    }
    setComments((prev) => [commentObj, ...prev])
    setNewComment('')
  }

  const checklistProgress = useMemo(() => {
    if (checklist.length === 0) return 0
    const doneCount = checklist.filter((item) => item.done).length
    return Math.round((doneCount / checklist.length) * 100)
  }, [checklist])

  // Charger le nœud et les relations
  const loadData = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const nodeRes = await nodeService.getById(id)
      setNodeData(nodeRes)
      setForm({
        titre: nodeRes.titre,
        description: nodeRes.description ?? '',
        type: nodeRes.type as ItemType,
        statut: nodeRes.statut as ItemStatut,
        priorite: nodeRes.priorite as ItemPriorite,
        temps_estime_h: nodeRes.temps_estime_h,
        cout_estime: nodeRes.cout_estime,
      })

      try {
        const [allLinksRes, allNodesRes] = await Promise.all([
          linkService.getAll(),
          nodeService.getAll(),
        ])
        setLinks(allLinksRes.filter((l) => l.source_id === id || l.target_id === id))
        setAllNodes(allNodesRes)
      } catch (relErr) {
        console.warn('Avertissement chargement relations secondaires:', relErr)
      }
    } catch (err: unknown) {
      console.error('Erreur chargement détail nœud:', err)
      setError('Impossible de charger le nœud demandé ou nœud introuvable.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Handlers
  const handleSave = async () => {
    if (!id || !form.titre?.trim()) return
    setIsSaving(true)
    setSaveSuccess(false)
    try {
      const updated = await nodeService.update(id, {
        titre: form.titre,
        description: form.description,
        type: form.type,
        statut: form.statut,
        priorite: form.priorite,
        temps_estime_h: form.temps_estime_h,
        cout_estime: form.cout_estime,
      })
      setNodeData(updated)
      updateNodeStore(id, form)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err) {
      console.error('Erreur sauvegarde nœud:', err)
      alert('Erreur lors de la sauvegarde du nœud.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!id) return
    if (!window.confirm('Voulez-vous vraiment supprimer définitivement ce nœud ?')) return
    setIsDeleting(true)
    try {
      await nodeService.delete(id)
      removeNodeStore(id)
      navigate('/')
    } catch (err) {
      console.error('Erreur suppression:', err)
      alert('Erreur lors de la suppression du nœud.')
      setIsDeleting(false)
    }
  }

  const handleAddRelation = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id || !newRelTargetId) return
    setIsAddingRel(true)
    try {
      const newLink = await linkService.create(id, newRelTargetId, newRelType)
      setLinks((prev) => [newLink, ...prev])
      setShowAddRelation(false)
      setNewRelTargetId('')
    } catch (err) {
      console.error('Erreur ajout relation:', err)
      alert('Erreur lors de la création de la relation.')
    } finally {
      setIsAddingRel(false)
    }
  }

  const handleDeleteLink = async (linkId: string) => {
    if (!window.confirm('Supprimer cette relation ?')) return
    try {
      await linkService.delete(linkId)
      setLinks((prev) => prev.filter((l) => l.id !== linkId))
    } catch (err) {
      console.error('Erreur suppression relation:', err)
      alert('Impossible de supprimer la relation.')
    }
  }

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href)
    alert('Lien de la fiche Jira copié dans le presse-papier !')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0e1a] text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="animate-spin text-blue-500" size={32} />
          <span className="text-sm font-medium">Chargement du ticket Jira…</span>
        </div>
      </div>
    )
  }

  if (error || !nodeData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0e1a] text-slate-300 p-6">
        <div className="max-w-md w-full bg-[#111827] border border-red-500/30 rounded-2xl p-6 text-center space-y-4 shadow-2xl">
          <ShieldAlert className="text-red-400 mx-auto" size={48} />
          <h2 className="text-lg font-bold text-white">Nœud introuvable</h2>
          <p className="text-sm text-slate-400">{error ?? 'Ce nœud n\'existe pas ou a été supprimé.'}</p>
          <button onClick={() => navigate('/')} className="btn-primary w-full justify-center">
            <ArrowLeft size={16} /> Retour au canevas
          </button>
        </div>
      </div>
    )
  }

  const currentTypeOpt = TYPE_OPTIONS.find((t) => t.value === form.type) ?? TYPE_OPTIONS[0]

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-slate-200 flex flex-col font-sans">
      {/* Header / Top Navbar style Jira */}
      <header className="sticky top-0 z-30 bg-[#111827]/90 backdrop-blur-md border-b border-[#1e2d45] px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white bg-[#1e2d45]/50 hover:bg-[#1e2d45] px-3 py-1.5 rounded-lg border border-slate-700/50 transition-colors"
          >
            <ArrowLeft size={14} /> Retour à la carte
          </button>
          <button
            onClick={() => navigate('/gantt')}
            className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white bg-[#1e2d45]/50 hover:bg-[#1e2d45] px-3 py-1.5 rounded-lg border border-slate-700/50 transition-colors"
          >
            <BarChart2 size={14} className="text-purple-400" /> Vue Gantt
          </button>
          <div className="h-4 w-[1px] bg-slate-700" />
          <div className="flex items-center gap-2">
            <span className="text-base">{currentTypeOpt.icon}</span>
            <span className="font-mono text-xs font-bold text-blue-400 uppercase tracking-wider bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded">
              SENT-{nodeData.id.slice(0, 8)}
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleCopyLink}
            className="btn-ghost text-xs px-3 py-1.5 flex items-center gap-1.5 text-slate-400 hover:text-white border border-slate-700/50 rounded-lg"
            title="Copier l'URL directe"
          >
            <Share2 size={13} /> Partager
          </button>

          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 transition-all flex items-center gap-1.5"
          >
            <Trash2 size={13} /> {isDeleting ? 'Suppression…' : 'Supprimer'}
          </button>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className={`btn-primary px-4 py-1.5 text-xs flex items-center gap-1.5 transition-all shadow-lg ${
              saveSuccess ? 'bg-green-600 hover:bg-green-500' : ''
            }`}
          >
            {saveSuccess ? <Check size={14} /> : <Save size={14} />}
            {isSaving ? 'Enregistrement…' : saveSuccess ? 'Sauvegardé !' : 'Enregistrer'}
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Colonne Principale (Gauche - 2/3) */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Section Titre */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <FileText size={12} className="text-blue-400" /> Titre de la demande / du nœud
            </label>
            <input
              type="text"
              value={form.titre ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, titre: e.target.value }))}
              placeholder="Titre du nœud..."
              className="w-full text-2xl md:text-3xl font-bold text-white bg-transparent border-b-2 border-[#1e2d45] focus:border-blue-500 outline-none pb-2 transition-colors placeholder:text-slate-600"
            />
          </div>

          {/* Section Description */}
          <div className="bg-[#111827] border border-[#1e2d45] rounded-2xl p-5 space-y-3 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#1e2d45] pb-3">
              <span className="text-sm font-semibold text-white flex items-center gap-2">
                <FileText size={15} className="text-amber-400" /> Description & Contexte Jira
              </span>
              <span className="text-xs text-slate-500 font-mono">Markdown supporté</span>
            </div>
            <textarea
              rows={8}
              value={form.description ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Saisissez la description détaillée, les critères d'acceptation, les spécifications techniques ou notes d'avancement..."
              className="w-full bg-[#0a0e1a] border border-[#1e2d45] rounded-xl p-4 text-sm text-slate-200 focus:border-blue-500 outline-none resize-y placeholder:text-slate-600 leading-relaxed"
            />
          </div>

          {/* Section Checklist & Sous-tâches Jira */}
          <div className="bg-[#111827] border border-[#1e2d45] rounded-2xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#1e2d45] pb-3">
              <span className="text-sm font-semibold text-white flex items-center gap-2">
                <CheckSquare size={15} className="text-emerald-400" /> Checklist & Sous-tâches ({checklist.length})
              </span>
              <span className="text-xs font-bold text-emerald-400 font-mono">{checklistProgress}%</span>
            </div>

            {/* Barre de progression */}
            {checklist.length > 0 && (
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-300"
                  style={{ width: `${checklistProgress}%` }}
                />
              </div>
            )}

            {/* Formulaire d'ajout d'élément à la checklist */}
            <form onSubmit={handleAddCheckitem} className="flex gap-2">
              <input
                type="text"
                placeholder="Ajouter une sous-tâche ou critère d'acceptation..."
                value={newCheckitem}
                onChange={(e) => setNewCheckitem(e.target.value)}
                className="flex-1 bg-[#0a0e1a] border border-[#1e2d45] rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-emerald-500"
              />
              <button type="submit" className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1">
                <Plus size={13} /> Ajouter
              </button>
            </form>

            {/* Liste des sous-tâches */}
            {checklist.length === 0 ? (
              <div className="text-xs text-slate-500 text-center py-3 italic">
                Aucune sous-tâche définie. Ajoutez des critères pour suivre l'avancement.
              </div>
            ) : (
              <div className="space-y-1.5">
                {checklist.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-[#0a0e1a] border border-[#1e2d45] hover:border-emerald-500/40 transition-colors group"
                  >
                    <label className="flex items-center gap-2.5 cursor-pointer flex-1">
                      <input
                        type="checkbox"
                        checked={item.done}
                        onChange={() => toggleCheckitem(item.id)}
                        className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-0 cursor-pointer"
                      />
                      <span className={`text-xs ${item.done ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                        {item.text}
                      </span>
                    </label>
                    <button
                      onClick={() => deleteCheckitem(item.id)}
                      className="text-slate-500 hover:text-red-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section Relations / Nœuds connectés & Dépendances */}
          <div className="bg-[#111827] border border-[#1e2d45] rounded-2xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#1e2d45] pb-3">
              <span className="text-sm font-semibold text-white flex items-center gap-2">
                <Layers size={15} className="text-cyan-400" /> Dépendances & Relations Graphe ({links.length})
              </span>
              <button
                onClick={() => setShowAddRelation((v) => !v)}
                className="btn-ghost text-xs px-2.5 py-1 text-blue-400 hover:text-white border border-blue-500/30 rounded-lg flex items-center gap-1"
              >
                <Plus size={13} /> Ajouter une relation
              </button>
            </div>

            {/* Formulaire rapide d'ajout de relation */}
            {showAddRelation && (
              <form onSubmit={handleAddRelation} className="p-3 bg-[#0a0e1a] border border-blue-500/30 rounded-xl space-y-3 animate-fade-in">
                <div className="text-xs font-semibold text-blue-300 flex items-center gap-1.5">
                  <Link2 size={13} /> Créer un lien depuis ce nœud
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Type de relation</label>
                    <select
                      className="w-full bg-[#111827] border border-[#1e2d45] rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-blue-500"
                      value={newRelType}
                      onChange={(e) => setNewRelType(e.target.value as LinkType)}
                    >
                      <option value="EXECUTE_AVANT">Doit être exécuté avant ➡️</option>
                      <option value="BLOQUEE_PAR">Bloquée par 🔒</option>
                      <option value="RATTACHE_A">Rattaché à 📁</option>
                      <option value="ASSIGNE_A">Assigné à 👤</option>
                      <option value="LIE_A">Lié à 🔗</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Nœud cible</label>
                    <select
                      className="w-full bg-[#111827] border border-[#1e2d45] rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-blue-500"
                      value={newRelTargetId}
                      onChange={(e) => setNewRelTargetId(e.target.value)}
                      required
                    >
                      <option value="">Sélectionner le nœud cible...</option>
                      {allNodes
                        .filter((n) => n.id !== id)
                        .map((n) => (
                          <option key={n.id} value={n.id}>
                            {n.titre} ({n.type})
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAddRelation(false)}
                    className="btn-ghost text-xs px-3 py-1"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={isAddingRel}
                    className="btn-primary text-xs px-3 py-1"
                  >
                    {isAddingRel ? 'Création...' : 'Valider le lien'}
                  </button>
                </div>
              </form>
            )}

            {links.length === 0 ? (
              <div className="text-center py-6 text-slate-500 text-xs">
                Aucune relation enregistrée pour ce nœud.
              </div>
            ) : (
              <div className="space-y-2">
                {links.map((link) => {
                  const isSource = link.source_id === id
                  const targetId = isSource ? link.target_id : link.source_id
                  const targetNode = allNodes.find((n) => n.id === targetId)
                  const relMeta = LINK_TYPE_LABELS[link.type] ?? LINK_TYPE_LABELS.LIE_A

                  return (
                    <div
                      key={link.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-[#0a0e1a] border border-[#1e2d45] hover:border-blue-500/40 transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className="text-xs px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1.5"
                          style={{
                            background: `${relMeta.color}15`,
                            color: relMeta.color,
                            border: `1px solid ${relMeta.color}30`,
                          }}
                        >
                          <span>{relMeta.icon}</span>
                          <span>{isSource ? relMeta.label : `(Inversé) ${relMeta.label}`}</span>
                        </span>
                        <Link
                          to={`/node/${targetId}`}
                          className="text-sm font-medium text-slate-200 group-hover:text-blue-400 transition-colors flex items-center gap-1.5"
                        >
                          {targetNode ? targetNode.titre : `Nœud ${targetId.slice(0, 8)}`}
                        </Link>
                      </div>

                      <div className="flex items-center gap-3">
                        {targetNode && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] uppercase font-bold bg-slate-800 text-slate-400">
                            {targetNode.type}
                          </span>
                        )}
                        <button
                          onClick={() => handleDeleteLink(link.id)}
                          className="text-slate-500 hover:text-red-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Supprimer cette relation"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Colonne Latérale (Droite - 1/3) : Panneau de détails Jira */}
        <div className="space-y-6">
          <div className="bg-[#111827] border border-[#1e2d45] rounded-2xl p-5 space-y-6 shadow-xl sticky top-24">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-[#1e2d45] pb-3 flex items-center gap-2">
              <Sparkles size={14} className="text-amber-400" /> Métadonnées & Champs
            </h3>

            {/* Type */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                <Tag size={13} /> Type de nœud
              </label>
              <div className="grid grid-cols-2 gap-2">
                {TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, type: opt.value }))}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all text-left"
                    style={{
                      background: form.type === opt.value ? `${opt.color}22` : '#0a0e1a',
                      border: `1px solid ${form.type === opt.value ? opt.color : '#1e2d45'}`,
                      color: form.type === opt.value ? opt.color : '#94a3b8',
                    }}
                  >
                    <span>{opt.icon}</span>
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Statut */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                <CheckCircle size={13} /> Statut Jira
              </label>
              <div className="grid grid-cols-2 gap-2">
                {STATUT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, statut: opt.value }))}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all text-left"
                    style={{
                      background: form.statut === opt.value ? opt.bg : '#0a0e1a',
                      border: `1px solid ${form.statut === opt.value ? opt.color : '#1e2d45'}`,
                      color: form.statut === opt.value ? opt.color : '#94a3b8',
                    }}
                  >
                    <span
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        background: opt.color,
                        flexShrink: 0,
                      }}
                    />
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Priorité */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                <AlertTriangle size={13} /> Priorité
              </label>
              <div className="grid grid-cols-2 gap-2">
                {PRIORITE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, priorite: opt.value }))}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all text-left"
                    style={{
                      background: form.priorite === opt.value ? `${opt.color}22` : '#0a0e1a',
                      border: `1px solid ${form.priorite === opt.value ? opt.color : '#1e2d45'}`,
                      color: form.priorite === opt.value ? opt.color : '#94a3b8',
                    }}
                  >
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Estimations Temps & Coût */}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[#1e2d45]">
              <div>
                <label className="text-xs font-medium text-slate-400 flex items-center gap-1 mb-1">
                  <Clock size={12} /> Temps (h)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={form.temps_estime_h ?? ''}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, temps_estime_h: e.target.value ? +e.target.value : undefined }))
                  }
                  placeholder="0.0"
                  className="w-full bg-[#0a0e1a] border border-[#1e2d45] rounded-xl px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-400 flex items-center gap-1 mb-1">
                  <DollarSign size={12} /> Coût ($)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.cout_estime ?? ''}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, cout_estime: e.target.value ? +e.target.value : undefined }))
                  }
                  placeholder="0"
                  className="w-full bg-[#0a0e1a] border border-[#1e2d45] rounded-xl px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Infos système */}
            <div className="pt-4 border-t border-[#1e2d45] space-y-1.5 text-[11px] text-slate-500">
              <div className="flex justify-between">
                <span>Identifiant (UUID) :</span>
                <span className="font-mono text-slate-400">{nodeData.id.slice(0, 12)}…</span>
              </div>
              <div className="flex justify-between">
                <span>Coordonnées canevas :</span>
                <span className="font-mono text-slate-400">X: {Math.round(nodeData.pos_x)}, Y: {Math.round(nodeData.pos_y)}</span>
              </div>
              <div className="flex justify-between">
                <span>Créé le :</span>
                <span className="text-slate-400">{new Date(nodeData.created_at).toLocaleString('fr-CA')}</span>
              </div>
              <div className="flex justify-between">
                <span>Modifié le :</span>
                <span className="text-slate-400">{new Date(nodeData.updated_at).toLocaleString('fr-CA')}</span>
              </div>
            </div>

          </div>
        </div>

      </main>
    </div>
  )
}
