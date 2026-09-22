// =============================================================================
// Projet Sentinel — ImportXMindModal (Modal d'importation .xmind)
// =============================================================================

import { useState, useRef } from 'react'
import { Upload, X, CheckCircle2, AlertCircle, FileSpreadsheet, Loader2, LayoutGrid } from 'lucide-react'
import { nodeService } from '@/services/nodeService'

interface ImportXMindModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  onTriggerAutoLayout?: () => void
}

export default function ImportXMindModal({
  isOpen,
  onClose,
  onSuccess,
  onTriggerAutoLayout,
}: ImportXMindModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ created_nodes: number; created_links: number; message: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!isOpen) return null

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
      setError(null)
      setResult(null)
    }
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0])
      setError(null)
      setResult(null)
    }
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
  }

  const handleUpload = async () => {
    if (!file) return
    setIsUploading(true)
    setError(null)
    setResult(null)

    try {
      const res = await nodeService.importXMind(file)
      setResult(res)
      onSuccess()
    } catch (err: any) {
      console.error('Erreur d\'importation XMind:', err)
      const detail = err.response?.data?.detail || err.message || 'Impossible d\'importer ce fichier XMind.'
      setError(detail)
    } finally {
      setIsUploading(false)
    }
  }

  const handleReset = () => {
    setFile(null)
    setError(null)
    setResult(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-lg bg-[#0b1329] border border-[#1e2d45] rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e2d45] bg-[#0f172a]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/15 text-cyan-400">
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Importer une Mindmap XMind</h3>
              <p className="text-xs text-slate-400">Fichiers .xmind (XMind 8, ZEN, 2020+)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#1e2d45] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {!result ? (
            <>
              {/* Dropzone */}
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onClick={() => fileInputRef.current?.click()}
                className={`relative flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
                  file
                    ? 'border-cyan-500/50 bg-cyan-950/20'
                    : 'border-[#1e2d45] hover:border-cyan-500/40 bg-[#111827]/60 hover:bg-[#111827]'
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".xmind,.json"
                  className="hidden"
                />

                <div className="p-3 mb-3 rounded-full bg-cyan-500/10 text-cyan-400">
                  <Upload size={24} />
                </div>

                {file ? (
                  <div className="text-center">
                    <p className="text-sm font-semibold text-white truncate max-w-xs">{file.name}</p>
                    <p className="text-xs text-cyan-400 mt-1">{(file.size / 1024).toFixed(1)} KB — Cliquez pour changer</p>
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="text-sm font-medium text-slate-200">
                      Glissez votre fichier <span className="text-cyan-400 font-mono font-bold">.xmind</span> ici
                    </p>
                    <p className="text-xs text-slate-400 mt-1">ou cliquez pour parcourir vos dossiers</p>
                  </div>
                )}
              </div>

              {/* Erreur */}
              {error && (
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Info mapping */}
              <div className="p-3.5 rounded-xl bg-[#111827] border border-[#1e2d45] text-xs text-slate-400 space-y-1.5">
                <p className="font-semibold text-slate-300">✨ Traitement intelligent :</p>
                <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-400">
                  <li>Création automatique des nœuds avec hiérarchie de liens <span className="text-purple-400 font-mono">CONTIENT_ETAPE</span>.</li>
                  <li>Mapping des notes XMind dans la description des nœuds.</li>
                  <li>Mapping des marqueurs (priorités, états d'avancement).</li>
                </ul>
              </div>

              {/* Footer boutons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-[#1e2d45] transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={!file || isUploading}
                  onClick={handleUpload}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 transition-all shadow-lg shadow-cyan-600/20"
                >
                  {isUploading ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Importation en cours...
                    </>
                  ) : (
                    <>
                      <Upload size={14} />
                      Lancer l'importation
                    </>
                  )}
                </button>
              </div>
            </>
          ) : (
            /* Écran de Succès */
            <div className="py-4 text-center space-y-4">
              <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <CheckCircle2 size={28} />
              </div>
              <div>
                <h4 className="text-lg font-bold text-white">Importation réussie !</h4>
                <p className="text-xs text-slate-400 mt-1">{result.message}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 max-w-xs mx-auto">
                <div className="p-3 rounded-xl bg-[#111827] border border-[#1e2d45]">
                  <div className="text-xl font-bold text-cyan-400 font-mono">{result.created_nodes}</div>
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Nœuds créés</div>
                </div>
                <div className="p-3 rounded-xl bg-[#111827] border border-[#1e2d45]">
                  <div className="text-xl font-bold text-purple-400 font-mono">{result.created_links}</div>
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Relations créées</div>
                </div>
              </div>

              <div className="pt-4 flex flex-col gap-2">
                {onTriggerAutoLayout && (
                  <button
                    type="button"
                    onClick={() => {
                      onTriggerAutoLayout()
                      onClose()
                    }}
                    className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 transition-all shadow-lg shadow-purple-600/20"
                  >
                    <LayoutGrid size={15} />
                    Réorganiser le canevas (Auto-Layout) 🪄
                  </button>
                )}

                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-[#1e2d45] transition-colors"
                >
                  Fermer et afficher le canevas
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
