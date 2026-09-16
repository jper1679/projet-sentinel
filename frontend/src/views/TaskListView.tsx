// =============================================================================
// Projet Sentinel — TaskListView (Vue liste filtrée — Stub Jalon 2)
// =============================================================================

import { CheckSquare } from 'lucide-react'

/**
 * Vue secondaire : liste filtrée des tâches.
 * Sera implémentée au Jalon 2 avec filtres avancés et tableau Kanban.
 */
export default function TaskListView() {
  return (
    <div className="flex flex-col items-center justify-center w-full h-full" style={{ background: '#0a0e1a' }}>
      <div className="text-center animate-fade-in">
        <CheckSquare size={48} className="text-sentinel-accent mx-auto mb-4 opacity-50" />
        <h2 className="text-xl font-semibold text-sentinel-text mb-2">Vue Liste — Jalon 2</h2>
        <p className="text-sentinel-muted text-sm max-w-xs">
          La vue liste avec filtres avancés, Kanban et timeline sera disponible au Jalon 2.
        </p>
      </div>
    </div>
  )
}
