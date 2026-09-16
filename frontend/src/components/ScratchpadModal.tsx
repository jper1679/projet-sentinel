// =============================================================================
// Projet Sentinel — ScratchpadModal (Ingestion de notes brutes par IA Gemini)
// =============================================================================

import React, { useState, useEffect } from 'react'
import {
  Sparkles,
  X,
  Check,
  AlertTriangle,
  Package,
  CheckSquare,
  Clock,
  Flame,
  ArrowLeft,
  Loader2,
  ListTodo,
  HelpCircle,
  Layers,
  ArrowRight,
  Workflow,
  FolderGit2,
} from 'lucide-react'
import {
  parseScratchpad,
  applyScratchpadActions,
  IngestionAnalysisResult,
  NodeItemUpdate,
  NodeToCreate,
  RelationshipToCreate,
  ActionTypeEnum,
  DisciplineEnum,
} from '@/services/agentService'
import { useAppStore } from '@/store/useAppStore'

import { formatErrorMessage } from '@/utils/errorUtils'

interface ScratchpadModalProps {
  isOpen: boolean
  onClose: () => void
  onApplied: () => void
}

const ACTION_TYPE_LABELS: Record<ActionTypeEnum, { label: string; bg: string; text: string; icon: React.ReactNode }> = {
  CREATE_TASK: { label: 'Tâche', bg: 'bg-blue-500/10 border-blue-500/30', text: 'text-blue-400', icon: <CheckSquare size={13} /> },
  PROCUREMENT_ITEM: { label: 'Achat / Stock', bg: 'bg-emerald-500/10 border-emerald-500/30', text: 'text-emerald-400', icon: <Package size={13} /> },
  UPDATE_STATUS: { label: 'Statut', bg: 'bg-purple-500/10 border-purple-500/30', text: 'text-purple-400', icon: <Clock size={13} /> },
  ADD_BLOCKER: { label: 'Blocage', bg: 'bg-rose-500/10 border-rose-500/30', text: 'text-rose-400', icon: <AlertTriangle size={13} /> },
  LOG_PROGRESS: { label: 'Avancement', bg: 'bg-amber-500/10 border-amber-500/30', text: 'text-amber-400', icon: <Flame size={13} /> },
}

const DISCIPLINE_LABELS: Record<DisciplineEnum | string, string> = {
  ELECTRONIQUE_IOT: 'Électronique / IoT',
  USINAGE_FAB: 'Usinage / Fab',
  SYSTEME_AMENAGEMENT: 'Aménagement / 12V',
  LOGISTIQUE_EVENT: 'Logistique / Perso',
  AUTRE: 'Autre',
}

const SAMPLE_PROCEDURE_NOTES = `Procédure de fabrication PCB ESP32 Solaire :
1. Couper la plaque de cuivre FR4 aux dimensions 100x80mm.
2. Insoler au UV pendant 2min30s avec le typon transparent.
3. Révéler dans la solution de soude caustique.
4. Graver dans le perchlorure de fer à 45°C.
5. Percer les trous de composants à 0.8mm avec la dremel.`

export default function ScratchpadModal({ isOpen, onClose, onApplied }: ScratchpadModalProps) {
  const [step, setStep] = useState<'INPUT' | 'CLARIFICATION' | 'REVIEW'>('INPUT')
  const [rawText, setRawText] = useState('')
  const [clarificationInput, setClarificationInput] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isApplying, setIsApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [result, setResult] = useState<IngestionAnalysisResult | null>(null)
  const [actions, setActions] = useState<NodeItemUpdate[]>([])
  const [nodesToCreate, setNodesToCreate] = useState<NodeToCreate[]>([])
  const [relationshipsToCreate, setRelationshipsToCreate] = useState<RelationshipToCreate[]>([])
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set())

  // Récupération des projets existants dans le store pour la clarification
  const nodes = useAppStore((state) => state.nodes)
  const existingProjects = React.useMemo(
    () =>
      nodes
        .filter((n) => n.data?.type === 'PROJET')
        .map((n) => String(n.data?.titre || ''))
        .filter(Boolean),
    [nodes]
  )

  useEffect(() => {
    if (!isOpen) {
      setStep('INPUT')
      setError(null)
      setIsAnalyzing(false)
      setIsApplying(false)
      setClarificationInput('')
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleAnalyze = async (overrideClarification?: string) => {
    if (!rawText.trim()) {
      setError('Veuillez saisir des notes avant de lancer l\'analyse.')
      return
    }
    setError(null)
    setIsAnalyzing(true)

    try {
      const data = await parseScratchpad(rawText, overrideClarification || clarificationInput)
      setResult(data)
      setActions(data.actions || [])
      setNodesToCreate(data.nodes || [])
      setRelationshipsToCreate(data.relationships || [])
      setSelectedIndices(new Set((data.actions || []).map((_, i) => i)))

      if (data.needs_clarification) {
        setStep('CLARIFICATION')
      } else {
        setStep('REVIEW')
      }
    } catch (err: any) {
      setError(formatErrorMessage(err, 'Erreur lors de l\'analyse Gemini.'))
    } finally {
      setIsAnalyzing(false)
    }
  }

  const toggleSelectAction = (index: number) => {
    const next = new Set(selectedIndices)
    if (next.has(index)) {
      next.delete(index)
    } else {
      next.add(index)
    }
    setSelectedIndices(next)
  }

  const toggleSelectAll = () => {
    if (selectedIndices.size === actions.length) {
      setSelectedIndices(new Set())
    } else {
      setSelectedIndices(new Set(actions.map((_, i) => i)))
    }
  }

  const handleActionChange = (index: number, field: keyof NodeItemUpdate, value: any) => {
    const updated = [...actions]
    updated[index] = { ...updated[index], [field]: value }
    setActions(updated)
  }

  const handleApply = async () => {
    const selectedActions = actions.filter((_, i) => selectedIndices.has(i))
    if (selectedActions.length === 0 && nodesToCreate.length === 0) {
      setError('Aucune action ou procédure à appliquer.')
      return
    }

    setError(null)
    setIsApplying(true)

    try {
      await applyScratchpadActions(selectedActions, nodesToCreate, relationshipsToCreate)
      onApplied()
      onClose()
    } catch (err: any) {
      setError(formatErrorMessage(err, 'Erreur lors de l\'application.'))
    } finally {
      setIsApplying(false)
    }
  }

  // Extraction du nœud racine procédure et des étapes pour affichage dans REVIEW
  const rootProcedureNode = nodesToCreate.find((n) => n.type === 'PROCEDURE')
  const stepNodes = nodesToCreate.filter((n) => n.type === 'ETAPE')
  const projectRel = relationshipsToCreate.find((r) => r.rel_type === 'RATTACHÉ_À')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
      <div
        className="w-full max-w-3xl rounded-2xl flex flex-col max-h-[90vh] overflow-hidden"
        style={{
          background: 'rgba(15, 23, 42, 0.95)',
          border: '1px solid #1e2d45',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-sentinel-border/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Sparkles size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white leading-tight flex items-center gap-2">
                Daily Scratchpad
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-sentinel-accent/20 text-sentinel-accent font-semibold border border-sentinel-accent/30">
                  Gemini AI Ops
                </span>
              </h2>
              <p className="text-xs text-sentinel-muted">
                {step === 'INPUT' && 'Saisissez vos notes ou procédures brutes pour extraction automatique'}
                {step === 'CLARIFICATION' && 'Le modèle nécessite une précision sur le projet cible'}
                {step === 'REVIEW' && 'Vérifiez les actions et le graphe de procédure avant insertion Neo4j'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-sentinel-muted hover:text-white hover:bg-sentinel-border/40 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Message d'erreur */}
        {error && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5">
            <AlertTriangle size={16} className="shrink-0 text-rose-400" />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError(null)} className="text-rose-400 hover:text-white">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Corps modale */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* STEP 1: INPUT */}
          {step === 'INPUT' && (
            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs">
                <label className="font-semibold text-sentinel-text">Notes ou Procédure brutes :</label>
                <button
                  type="button"
                  onClick={() => setRawText(SAMPLE_PROCEDURE_NOTES)}
                  className="text-sentinel-accent hover:underline flex items-center gap-1 text-[11px]"
                >
                  Exemple de procédure
                </button>
              </div>

              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Ex: Procédure d'assemblage batterie 12V LiFePO4: 1. Contrôler les tensions cellules. 2. Assembler les busbars..."
                rows={9}
                className="w-full p-4 rounded-xl bg-slate-900/90 border border-sentinel-border/60 text-white text-xs placeholder:text-sentinel-muted/60 focus:outline-none focus:border-sentinel-accent transition-all resize-none font-mono"
              />

              <div className="flex items-center justify-between text-[11px] text-sentinel-muted">
                <span>Raccourci clavier : <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">Ctrl+K</kbd></span>
                <span>{rawText.length} caractères</span>
              </div>
            </div>
          )}

          {/* STEP 2: CLARIFICATION INTERACTIVE */}
          {step === 'CLARIFICATION' && (
            <div className="space-y-4">
              <div
                className="p-4 rounded-xl space-y-3 border shadow-lg"
                style={{
                  background: 'linear-gradient(135deg, rgba(217,119,6,0.15), rgba(15,23,42,0.9))',
                  borderColor: 'rgba(245,158,11,0.5)',
                }}
              >
                <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                  <HelpCircle size={18} className="animate-pulse" />
                  Précision requise : Projet cible non identifié
                </div>
                <p className="text-xs text-slate-200 leading-relaxed font-medium">
                  {result?.clarification_question ||
                    'À quel projet cette note ou procédure doit-elle être rattachée ?'}
                </p>

                {/* Boutons de sélection rapide des projets existants */}
                {existingProjects.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[11px] text-slate-400 font-semibold flex items-center gap-1">
                      <FolderGit2 size={12} /> Projets existants détectés dans Neo4j :
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {existingProjects.map((prj) => (
                        <button
                          key={prj}
                          type="button"
                          onClick={() => setClarificationInput(prj)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                            clarificationInput === prj
                              ? 'bg-amber-500 text-slate-950 border-amber-400 shadow'
                              : 'bg-slate-800/80 border-slate-700 text-amber-300 hover:border-amber-400/60'
                          }`}
                        >
                          {prj}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Champ de texte de réponse */}
                <div className="space-y-1.5 pt-2">
                  <label className="text-[11px] text-slate-300 font-medium">
                    Saisissez ou modifiez le nom du projet :
                  </label>
                  <input
                    type="text"
                    value={clarificationInput}
                    onChange={(e) => setClarificationInput(e.target.value)}
                    placeholder="Ex: Projet Airstream, Station Solaire..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-amber-500/40 text-amber-200 text-xs focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: REVIEW */}
          {step === 'REVIEW' && (
            <div className="space-y-5">
              {/* Executive Summary / Sitrep */}
              {result?.sitrep_summary && (
                <div
                  className="p-4 rounded-xl space-y-1.5"
                  style={{
                    background: 'linear-gradient(135deg, rgba(30,58,138,0.2), rgba(17,24,39,0.8))',
                    border: '1px solid #2563eb40',
                  }}
                >
                  <div className="text-xs font-semibold text-blue-400 flex items-center gap-1.5">
                    <Sparkles size={14} /> Résumé Exécutif (Sitrep)
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed italic">
                    "{result.sitrep_summary}"
                  </p>
                </div>
              )}

              {/* SECTION PROCÉDURE GENEREE */}
              {rootProcedureNode && (
                <div className="p-4 rounded-xl bg-slate-900/90 border border-pink-500/40 space-y-3">
                  <div className="flex items-center justify-between border-b border-pink-500/20 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-lg bg-pink-500/20 text-pink-400 border border-pink-500/30">
                        <Workflow size={16} />
                      </span>
                      <div>
                        <div className="text-xs font-bold text-white flex items-center gap-2">
                          Procédure : {rootProcedureNode.title}
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 font-semibold border border-pink-500/30">
                            PROCÉDURE
                          </span>
                        </div>
                        {projectRel?.target_project && (
                          <div className="text-[11px] text-slate-400 flex items-center gap-1">
                            Rattaché au projet :{' '}
                            <span className="text-amber-300 font-semibold">{projectRel.target_project}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-cyan-400 font-semibold bg-cyan-950/60 px-2.5 py-1 rounded-lg border border-cyan-500/30">
                      {stepNodes.length} Étapes séquentielles
                    </span>
                  </div>

                  {/* Séquence des Étapes */}
                  <div className="space-y-2 pt-1">
                    <div className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                      <Layers size={13} className="text-cyan-400" /> Pipeline des étapes (:CONTIENT_ÉTAPE & :SUIVIE_DE) :
                    </div>

                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {stepNodes.map((st, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <div className="flex-1 p-2.5 rounded-lg bg-slate-950/80 border border-cyan-500/30 text-xs flex items-center justify-between">
                            <span className="font-medium text-cyan-200">
                              <span className="text-cyan-400 font-bold mr-2">Étape {i + 1} :</span>
                              {st.title}
                            </span>
                            {st.notes && (
                              <span className="text-[10px] text-slate-400 italic max-w-[200px] truncate">
                                {st.notes}
                              </span>
                            )}
                          </div>
                          {i < stepNodes.length - 1 && (
                            <ArrowRight size={14} className="text-cyan-400 shrink-0" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* LISTE DES ACTIONS SEPAREES */}
              {actions.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white flex items-center gap-2">
                      <ListTodo size={14} className="text-sentinel-accent" />
                      Actions extraites ({selectedIndices.size} / {actions.length} sélectionnées)
                    </span>
                    <button
                      type="button"
                      onClick={toggleSelectAll}
                      className="text-xs text-sentinel-accent hover:underline text-[11px]"
                    >
                      {selectedIndices.size === actions.length ? 'Tout désélectionner' : 'Tout sélectionner'}
                    </button>
                  </div>

                  <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-1">
                    {actions.map((act, idx) => {
                      const isChecked = selectedIndices.has(idx)
                      const meta = ACTION_TYPE_LABELS[act.action_type] || ACTION_TYPE_LABELS.CREATE_TASK

                      return (
                        <div
                          key={idx}
                          className={`p-3.5 rounded-xl border transition-all space-y-2.5 ${
                            isChecked
                              ? 'bg-slate-900/90 border-sentinel-border'
                              : 'bg-slate-950/50 border-slate-800/60 opacity-60'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 flex-1">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleSelectAction(idx)}
                                className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-sentinel-accent focus:ring-0 cursor-pointer"
                              />
                              <span
                                className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-semibold ${meta.bg} ${meta.text}`}
                              >
                                {meta.icon} {meta.label}
                              </span>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-medium">
                                {DISCIPLINE_LABELS[act.discipline] || act.discipline}
                              </span>
                            </div>

                            <div className="flex items-center gap-1 text-xs">
                              <span className="text-sentinel-muted text-[11px]">Projet:</span>
                              <input
                                type="text"
                                value={act.target_project}
                                onChange={(e) => handleActionChange(idx, 'target_project', e.target.value)}
                                className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-amber-300 font-semibold text-xs focus:outline-none focus:border-amber-400"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                            <input
                              type="text"
                              value={act.title}
                              onChange={(e) => handleActionChange(idx, 'title', e.target.value)}
                              placeholder="Titre de l'action..."
                              className="md:col-span-3 px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700/80 text-white text-xs focus:outline-none focus:border-sentinel-accent"
                            />
                            <select
                              value={act.status || 'A_FAIRE'}
                              onChange={(e) => handleActionChange(idx, 'status', e.target.value)}
                              className="px-2 py-1 rounded-lg bg-slate-800/80 border border-slate-700/80 text-sentinel-text text-xs focus:outline-none focus:border-sentinel-accent"
                            >
                              <option value="A_FAIRE">À FAIRE</option>
                              <option value="EN_COURS">EN COURS</option>
                              <option value="TERMINE">TERMINÉ</option>
                              <option value="BLOQUE">BLOQUÉ</option>
                            </select>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-sentinel-border/50 bg-slate-900/60">
          {step === 'CLARIFICATION' ? (
            <>
              <button
                type="button"
                onClick={() => setStep('INPUT')}
                disabled={isAnalyzing}
                className="btn-ghost px-4 py-2 text-xs flex items-center gap-1.5 text-sentinel-muted hover:text-white"
              >
                <ArrowLeft size={14} /> Modifier les notes
              </button>
              <button
                type="button"
                onClick={() => handleAnalyze()}
                disabled={isAnalyzing || !clarificationInput.trim()}
                className="btn-primary px-5 py-2 text-xs font-semibold flex items-center gap-2 shadow-lg shadow-amber-500/20 bg-gradient-to-r from-amber-500 to-orange-600 border-none hover:from-amber-400 hover:to-orange-550 text-white"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Analyse Gemini en cours...
                  </>
                ) : (
                  <>
                    <Sparkles size={14} /> Préciser & Relancer l'analyse ⚡
                  </>
                )}
              </button>
            </>
          ) : step === 'REVIEW' ? (
            <>
              <button
                type="button"
                onClick={() => setStep('INPUT')}
                disabled={isApplying}
                className="btn-ghost px-4 py-2 text-xs flex items-center gap-1.5 text-sentinel-muted hover:text-white"
              >
                <ArrowLeft size={14} /> Modifier les notes
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="btn-ghost px-4 py-2 text-xs text-sentinel-muted"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleApply}
                  disabled={isApplying}
                  className="btn-primary px-5 py-2 text-xs font-semibold flex items-center gap-2 shadow-lg shadow-blue-500/20"
                >
                  {isApplying ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Application dans Neo4j...
                    </>
                  ) : (
                    <>
                      <Check size={14} /> Appliquer dans Neo4j
                    </>
                  )}
                </button>
              </div>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                disabled={isAnalyzing}
                className="btn-ghost px-4 py-2 text-xs text-sentinel-muted"
              >
                Annuler
              </button>

              <button
                type="button"
                onClick={() => handleAnalyze()}
                disabled={isAnalyzing || !rawText.trim()}
                className="btn-primary px-5 py-2 text-xs font-semibold flex items-center gap-2 shadow-lg shadow-amber-500/20 bg-gradient-to-r from-amber-500 to-orange-600 border-none hover:from-amber-400 hover:to-orange-550 text-white"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Analyse Gemini en cours...
                  </>
                ) : (
                  <>
                    <Sparkles size={14} /> Analyser avec Gemini ⚡
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
