// =============================================================================
// Projet Sentinel — CreateLinkModal (Modale de création explicite de relation)
// =============================================================================

import { useState } from 'react'
import { X, Link2, ArrowRight } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { linkService, type LinkType } from '@/services/linkService'

import { formatErrorMessage } from '@/utils/errorUtils'

interface CreateLinkModalProps {
  isOpen: boolean
  onClose: () => void
  onLinkCreated: (sourceId: string, targetId: string, type: LinkType) => void
}

const LINK_TYPE_OPTIONS: { value: LinkType; label: string; description: string; color: string }[] = [
  { value: 'EXECUTE_AVANT', label: 'Doit être exécuté avant ➡️', description: 'Ordre d\'exécution chronologique (vue Gantt)', color: '#8b5cf6' },
  { value: 'LIE_A',        label: 'Lié à',        description: 'Relation neutre d\'association', color: '#3b82f6' },
  { value: 'BLOQUEE_PAR',  label: 'Bloquée par',  description: 'Relation de dépendance / blocage', color: '#ef4444' },
  { value: 'RATTACHE_A',   label: 'Rattaché à',   description: 'Relation hiérarchique (sous-tâche/projet)', color: '#f59e0b' },
  { value: 'ASSIGNE_A',    label: 'Assigné à',    description: 'Assignation à un responsable', color: '#10b981' },
]

export default function CreateLinkModal({ isOpen, onClose, onLinkCreated }: CreateLinkModalProps) {
  const nodes = useAppStore((s) => s.nodes)
  const selectedNodeId = useAppStore((s) => s.selectedNodeId)

  const [sourceId, setSourceId] = useState<string>(selectedNodeId ?? (nodes[0]?.id || ''))
  const [targetId, setTargetId] = useState<string>('')
  const [linkType, setLinkType] = useState<LinkType>('LIE_A')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!sourceId || !targetId) {
      setError('Veuillez sélectionner un nœud source et un nœud cible.')
      return
    }
    if (sourceId === targetId) {
      setError('Un nœud ne peut pas être relié à lui-même.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      await linkService.create(sourceId, targetId, linkType)
      onLinkCreated(sourceId, targetId, linkType)
      onClose()
    } catch (err: unknown) {
      setError(formatErrorMessage(err, 'Erreur lors de la création de la relation.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs animate-fade-in">
      <div
        className="w-full max-w-md rounded-2xl p-6 space-y-5"
        style={{
          background: '#111827',
          border: '1px solid #1e2d45',
          boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className="flex items-center justify-center rounded-lg p-2"
              style={{ background: 'rgba(59,130,246,0.15)', color: '#3b82f6' }}
            >
              <Link2 size={18} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-sentinel-text">Créer une relation</h3>
              <p className="text-xs text-sentinel-muted">Relier deux nœuds du graphe</p>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5 rounded-lg">
            <X size={16} />
          </button>
        </div>

        {/* Formulaire */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nœud source & cible */}
          <div className="grid grid-cols-[1fr,auto,1fr] gap-2 items-center">
            <div>
              <label className="form-label">Source</label>
              <select
                className="form-input text-xs"
                value={sourceId}
                onChange={(e) => setSourceId(e.target.value)}
              >
                <option value="" disabled>Choisir source...</option>
                {nodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.data.titre} ({n.data.type})
                  </option>
                ))}
              </select>
            </div>

            <div className="pt-5 text-sentinel-muted">
              <ArrowRight size={16} />
            </div>

            <div>
              <label className="form-label">Cible</label>
              <select
                className="form-input text-xs"
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
              >
                <option value="" disabled>Choisir cible...</option>
                {nodes
                  .filter((n) => n.id !== sourceId)
                  .map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.data.titre} ({n.data.type})
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* Type de relation */}
          <div>
            <label className="form-label">Type de relation</label>
            <div className="grid grid-cols-2 gap-2">
              {LINK_TYPE_OPTIONS.map((opt) => (
                <button
                  type="button"
                  key={opt.value}
                  onClick={() => setLinkType(opt.value)}
                  className="flex flex-col text-left p-2.5 rounded-xl border transition-all"
                  style={{
                    background: linkType === opt.value ? `${opt.color}15` : '#1a2235',
                    borderColor: linkType === opt.value ? opt.color : '#1e2d45',
                  }}
                >
                  <span className="text-xs font-semibold" style={{ color: linkType === opt.value ? opt.color : '#e2e8f0' }}>
                    {opt.label}
                  </span>
                  <span className="text-[10px] text-sentinel-muted truncate">{opt.description}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Erreur */}
          {error && (
            <div className="p-2.5 rounded-lg text-xs bg-red-500/10 border border-red-500/20 text-red-400">
              {error}
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost flex-1 justify-center">
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary flex-1 justify-center"
            >
              {isSubmitting ? 'Création...' : 'Créer la relation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
