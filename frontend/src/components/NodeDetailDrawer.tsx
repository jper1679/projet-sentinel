// =============================================================================
// Projet Sentinel — NodeDetailDrawer (Tiroir latéral d'enrichissement)
// S'ouvre au clic sur un nœud, permet d'éditer tous les attributs
// =============================================================================

import { useCallback, useEffect, useState } from 'react'
import {
  X, Tag, Clock, DollarSign, FileText, Save, Trash2,
  AlertTriangle, Layers, CheckCircle
} from 'lucide-react'
import { useAppStore, type SentinelNodeData, type ItemType, type ItemStatut, type ItemPriorite } from '@/store/useAppStore'
import { nodeService } from '@/services/nodeService'

const TYPE_OPTIONS: { value: ItemType; label: string; icon: string }[] = [
  { value: 'IDEE',      label: 'Idée',         icon: '💡' },
  { value: 'TACHE',     label: 'Tâche',         icon: '✅' },
  { value: 'PROJET',    label: 'Projet',        icon: '📁' },
  { value: 'COMPOSANT', label: 'Composant',     icon: '⚙️' },
]

const STATUT_OPTIONS: { value: ItemStatut; label: string; color: string }[] = [
  { value: 'BACKLOG',  label: 'Backlog',   color: '#64748b' },
  { value: 'A_FAIRE',  label: 'À faire',   color: '#3b82f6' },
  { value: 'EN_COURS', label: 'En cours',  color: '#f59e0b' },
  { value: 'TERMINE',  label: 'Terminé',   color: '#10b981' },
  { value: 'BLOQUE',   label: 'Bloqué 🔒', color: '#ef4444' },
]

const PRIORITE_OPTIONS: { value: ItemPriorite; label: string; color: string }[] = [
  { value: 'BASSE',    label: 'Basse',    color: '#64748b' },
  { value: 'NORMALE',  label: 'Normale',  color: '#3b82f6' },
  { value: 'HAUTE',    label: 'Haute',    color: '#f59e0b' },
  { value: 'CRITIQUE', label: 'Critique', color: '#ef4444' },
]

interface NodeDetailDrawerProps {
  onNodeUpdated?: (id: string, updatedData: Partial<SentinelNodeData>) => void
  onNodeDeleted?: (id: string) => void
}

export default function NodeDetailDrawer({ onNodeUpdated, onNodeDeleted }: NodeDetailDrawerProps = {}) {
  const selectedNodeId = useAppStore((s) => s.selectedNodeId)
  const isDrawerOpen = useAppStore((s) => s.isDrawerOpen)
  const setDrawerOpen = useAppStore((s) => s.setDrawerOpen)
  const updateNode = useAppStore((s) => s.updateNode)
  const removeNode = useAppStore((s) => s.removeNode)
  const nodes = useAppStore((s) => s.nodes)
  const selectedNode = nodes.find((n) => n.id === selectedNodeId)
  const data = selectedNode?.data

  // Local form state
  const [form, setForm] = useState<Partial<SentinelNodeData>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Sync form lorsque le nœud sélectionné change
  useEffect(() => {
    if (data) setForm({ ...data })
    setSaveError(null)
  }, [selectedNodeId, data])

  const handleClose = useCallback(() => {
    setDrawerOpen(false)
  }, [setDrawerOpen])

  const handleSave = useCallback(async () => {
    if (!selectedNodeId || !form) return
    setIsSaving(true)
    setSaveError(null)
    try {
      await nodeService.update(selectedNodeId, {
        titre:          form.titre,
        description:    form.description,
        type:           form.type,
        statut:         form.statut,
        priorite:       form.priorite,
        temps_estime_h: form.temps_estime_h,
        cout_estime:    form.cout_estime,
      })
      updateNode(selectedNodeId, form)
      if (onNodeUpdated) {
        onNodeUpdated(selectedNodeId, form)
      }
    } catch (e: unknown) {
      setSaveError('Erreur lors de la sauvegarde')
    } finally {
      setIsSaving(false)
    }
  }, [selectedNodeId, form, updateNode, onNodeUpdated])

  const handleDelete = useCallback(async () => {
    if (!selectedNodeId) return
    if (!window.confirm('Supprimer ce nœud et toutes ses relations ?')) return
    setIsDeleting(true)
    try {
      await nodeService.delete(selectedNodeId)
      removeNode(selectedNodeId)
      if (onNodeDeleted) {
        onNodeDeleted(selectedNodeId)
      }
      setDrawerOpen(false)
    } catch {
      setSaveError('Erreur lors de la suppression')
      setIsDeleting(false)
    }
  }, [selectedNodeId, removeNode, setDrawerOpen, onNodeDeleted])

  if (!isDrawerOpen || !data) return null

  return (
    <>
      {/* Overlay semi-transparent */}
      <div
        className="fixed inset-0 z-30"
        onClick={handleClose}
        style={{ background: 'transparent' }}
      />

      {/* Tiroir */}
      <div
        className="fixed top-0 right-0 h-full z-40 flex flex-col animate-slide-in"
        style={{
          width: '360px',
          background: '#111827',
          borderLeft: '1px solid #1e2d45',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.5)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid #1e2d45' }}
        >
          <div className="flex items-center gap-2">
            <Layers size={16} className="text-sentinel-accent" />
            <span className="text-sm font-semibold text-sentinel-text">Détail du nœud</span>
          </div>
          <button onClick={handleClose} className="btn-ghost p-1.5 rounded-lg">
            <X size={16} />
          </button>
        </div>

        {/* Corps scrollable */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {/* Titre */}
          <div>
            <label className="form-label">Titre</label>
            <input
              id="drawer-titre"
              className="form-input"
              value={form.titre ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, titre: e.target.value }))}
              placeholder="Titre du nœud..."
            />
          </div>

          {/* Description */}
          <div>
            <label className="form-label flex items-center gap-1.5">
              <FileText size={11} /> Description
            </label>
            <textarea
              id="drawer-description"
              className="form-input resize-none"
              rows={4}
              value={form.description ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Description, contexte, notes..."
            />
          </div>

          {/* Type */}
          <div>
            <label className="form-label flex items-center gap-1.5">
              <Tag size={11} /> Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              {TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  id={`type-${opt.value.toLowerCase()}`}
                  onClick={() => setForm((f) => ({ ...f, type: opt.value }))}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150"
                  style={{
                    background: form.type === opt.value ? 'rgba(59,130,246,0.15)' : '#1a2235',
                    border: `1px solid ${form.type === opt.value ? '#3b82f6' : '#1e2d45'}`,
                    color: form.type === opt.value ? '#93c5fd' : '#94a3b8',
                  }}
                >
                  <span>{opt.icon}</span>
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Statut */}
          <div>
            <label className="form-label flex items-center gap-1.5">
              <CheckCircle size={11} /> Statut
            </label>
            <div className="grid grid-cols-2 gap-2">
              {STATUT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  id={`statut-${opt.value.toLowerCase()}`}
                  onClick={() => setForm((f) => ({ ...f, statut: opt.value }))}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150"
                  style={{
                    background: form.statut === opt.value ? `${opt.color}22` : '#1a2235',
                    border: `1px solid ${form.statut === opt.value ? opt.color : '#1e2d45'}`,
                    color: form.statut === opt.value ? opt.color : '#94a3b8',
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: opt.color,
                      flexShrink: 0,
                    }}
                  />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Priorité */}
          <div>
            <label className="form-label flex items-center gap-1.5">
              <AlertTriangle size={11} /> Priorité
            </label>
            <div className="grid grid-cols-2 gap-2">
              {PRIORITE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  id={`priorite-${opt.value.toLowerCase()}`}
                  onClick={() => setForm((f) => ({ ...f, priorite: opt.value }))}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-150"
                  style={{
                    background: form.priorite === opt.value ? `${opt.color}22` : '#1a2235',
                    border: `1px solid ${form.priorite === opt.value ? opt.color : '#1e2d45'}`,
                    color: form.priorite === opt.value ? opt.color : '#94a3b8',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Estimations */}
          <div className="divider" />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label flex items-center gap-1.5">
                <Clock size={11} /> Temps (h)
              </label>
              <input
                id="drawer-temps"
                type="number"
                min="0"
                step="0.5"
                className="form-input"
                value={form.temps_estime_h ?? ''}
                onChange={(e) =>
                  setForm((f) => ({ ...f, temps_estime_h: e.target.value ? +e.target.value : undefined }))
                }
                placeholder="0.0"
              />
            </div>
            <div>
              <label className="form-label flex items-center gap-1.5">
                <DollarSign size={11} /> Coût ($)
              </label>
              <input
                id="drawer-cout"
                type="number"
                min="0"
                step="1"
                className="form-input"
                value={form.cout_estime ?? ''}
                onChange={(e) =>
                  setForm((f) => ({ ...f, cout_estime: e.target.value ? +e.target.value : undefined }))
                }
                placeholder="0"
              />
            </div>
          </div>

          {/* Métadonnées */}
          <div className="divider" />
          <div className="text-xs text-sentinel-muted space-y-1">
            <div>ID : <span className="font-mono text-sentinel-text-dim">{selectedNodeId?.slice(0, 8)}…</span></div>
            <div>Créé : {data.created_at ? new Date(data.created_at).toLocaleString('fr-CA') : '—'}</div>
            <div>Modifié : {data.updated_at ? new Date(data.updated_at).toLocaleString('fr-CA') : '—'}</div>
          </div>
        </div>

        {/* Footer — Actions */}
        <div
          className="px-5 py-4 space-y-3"
          style={{ borderTop: '1px solid #1e2d45' }}
        >
          {saveError && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-red-500/10 text-red-400 text-xs">
              <AlertTriangle size={12} />
              {saveError}
            </div>
          )}

          <div className="flex gap-2">
            <button
              id="btn-save-node"
              onClick={handleSave}
              disabled={isSaving}
              className="btn-primary flex-1"
            >
              <Save size={14} />
              {isSaving ? 'Sauvegarde…' : 'Sauvegarder'}
            </button>

            <button
              id="btn-delete-node"
              onClick={handleDelete}
              disabled={isDeleting}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 active:scale-95"
              style={{
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.3)',
                color: '#f87171',
              }}
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
