// =============================================================================
// Projet Sentinel — SelectionActionBar (Barre d'actions pour la multi-sélection)
// =============================================================================

import React from 'react'
import { FolderGit2, Unlock, Grid, ArrowRight, ArrowDown, Sparkles, Trash2 } from 'lucide-react'

interface SelectionActionBarProps {
  selectedCount: number
  isAllGrouped: boolean
  onGroup: () => void
  onUngroup: () => void
  onSelectiveLayout: (direction: 'LR' | 'TB' | 'GRID') => void
  onDeleteSelected: () => void
}

export default function SelectionActionBar({
  selectedCount,
  isAllGrouped,
  onGroup,
  onUngroup,
  onSelectiveLayout,
  onDeleteSelected,
}: SelectionActionBarProps) {
  if (selectedCount < 2) return null

  return (
    <div
      className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-2xl shadow-2xl backdrop-blur-xl border animate-fade-in"
      style={{
        background: 'rgba(15, 23, 42, 0.92)',
        borderColor: 'rgba(99, 102, 241, 0.4)',
        boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.7), 0 0 20px rgba(99, 102, 241, 0.2)',
      }}
    >
      {/* Compteur de nœuds sélectionnés */}
      <div className="flex items-center gap-2 pr-3 border-r border-slate-700/60">
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 font-bold text-xs border border-indigo-500/30">
          {selectedCount}
        </span>
        <span className="text-xs font-semibold text-slate-200">
          nœuds sélectionnés
        </span>
      </div>

      {/* Groupe / Dissoudre */}
      {isAllGrouped ? (
        <button
          onClick={onUngroup}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-amber-300 hover:text-white bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-all"
          title="Dissoudre le groupe verrouillé"
        >
          <Unlock size={14} />
          <span>Dissoudre le groupe</span>
        </button>
      ) : (
        <button
          onClick={onGroup}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-indigo-300 hover:text-white bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/40 transition-all"
          title="Grouper les nœuds sélectionnés en bloc solidaire"
        >
          <FolderGit2 size={14} className="text-indigo-400" />
          <span>Grouper en bloc</span>
        </button>
      )}

      {/* Auto-Arrangement Sélectif */}
      <div className="flex items-center gap-1 px-2 border-l border-r border-slate-700/60">
        <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mr-1 flex items-center gap-1">
          <Sparkles size={11} className="text-purple-400" /> Arranger:
        </span>
        <button
          onClick={() => onSelectiveLayout('LR')}
          className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/80 border border-slate-700/40 text-xs transition-colors flex items-center gap-1"
          title="Aligner horizontalement (LR)"
        >
          <ArrowRight size={13} className="text-blue-400" /> LR
        </button>
        <button
          onClick={() => onSelectiveLayout('TB')}
          className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/80 border border-slate-700/40 text-xs transition-colors flex items-center gap-1"
          title="Aligner verticalement (TB)"
        >
          <ArrowDown size={13} className="text-emerald-400" /> TB
        </button>
        <button
          onClick={() => onSelectiveLayout('GRID')}
          className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/80 border border-slate-700/40 text-xs transition-colors flex items-center gap-1"
          title="Disposer en grille (GRID)"
        >
          <Grid size={13} className="text-purple-400" /> Grille
        </button>
      </div>

      {/* Suppression groupée */}
      <button
        onClick={onDeleteSelected}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-red-400 hover:text-white bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 transition-all"
        title="Supprimer définitivement la sélection"
      >
        <Trash2 size={14} />
        <span>Supprimer ({selectedCount})</span>
      </button>
    </div>
  )
}
