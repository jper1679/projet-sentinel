import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAppStore } from '@/store/useAppStore'
import LoginView from '@/views/LoginView'
import MindmapBoard from '@/views/MindmapBoard'
import NodeDetailView from '@/views/NodeDetailView'
import GanttView from '@/views/GanttView'

/**
 * Route protégée : redirige vers /login si non authentifié.
 */
function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = useAppStore((s) => s.token)
  return token ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginView />} />
        <Route
          path="/"
          element={
            <PrivateRoute>
              <MindmapBoard />
            </PrivateRoute>
          }
        />
        <Route
          path="/node/:id"
          element={
            <PrivateRoute>
              <NodeDetailView />
            </PrivateRoute>
          }
        />
        <Route
          path="/gantt"
          element={
            <PrivateRoute>
              <GanttView />
            </PrivateRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
