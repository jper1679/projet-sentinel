// =============================================================================
// Projet Sentinel — LoginView (Écran de connexion JWT)
// =============================================================================

import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Network, Lock, Mail, Eye, EyeOff, AlertCircle } from 'lucide-react'
import api from '@/services/api'
import { useAppStore } from '@/store/useAppStore'

interface LoginResponse {
  access_token: string
  token_type: string
  user: {
    id: string
    email: string
    nom: string
    role: 'ADMIN' | 'USER' | 'CLIENT'
    created_at: string
  }
}

import { formatErrorMessage } from '@/utils/errorUtils'

export default function LoginView() {
  const navigate = useNavigate()
  const setToken = useAppStore((s) => s.setToken)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      const res = await api.post<LoginResponse>('/auth/login', { email, password })
      setToken(res.data.access_token, res.data.user)
      navigate('/', { replace: true })
    } catch (err: unknown) {
      setError(formatErrorMessage(err, 'Connexion impossible. Vérifiez vos identifiants.'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div
      className="flex items-center justify-center w-screen h-screen"
      style={{
        background: 'radial-gradient(ellipse at 30% 20%, rgba(59,130,246,0.08) 0%, transparent 60%), #0a0e1a',
      }}
    >
      {/* Grid background subtile */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `linear-gradient(rgba(30,45,69,0.4) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(30,45,69,0.4) 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
          pointerEvents: 'none',
        }}
      />

      {/* Card de connexion */}
      <div
        className="relative z-10 w-full max-w-sm animate-fade-in"
        style={{
          background: 'rgba(17,24,39,0.85)',
          backdropFilter: 'blur(20px)',
          border: '1px solid #1e2d45',
          borderRadius: '20px',
          padding: '40px 36px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        }}
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div
            className="flex items-center justify-center rounded-2xl mb-4"
            style={{
              width: 56,
              height: 56,
              background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
              boxShadow: '0 8px 24px rgba(59,130,246,0.4)',
            }}
          >
            <Network size={26} color="white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Sentinel</h1>
          <p className="text-sm text-sentinel-muted mt-1">PLM/ALM par Graphe</p>
        </div>

        {/* Formulaire */}
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Email */}
          <div>
            <label htmlFor="login-email" className="form-label">Adresse e-mail</label>
            <div className="relative">
              <Mail
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-sentinel-muted pointer-events-none"
              />
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="form-input pl-9"
                placeholder="jp.flying@gmail.com"
              />
            </div>
          </div>

          {/* Mot de passe */}
          <div>
            <label htmlFor="login-password" className="form-label">Mot de passe</label>
            <div className="relative">
              <Lock
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-sentinel-muted pointer-events-none"
              />
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="form-input pl-9 pr-10"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-sentinel-muted hover:text-sentinel-text transition-colors"
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {/* Erreur */}
          {error && (
            <div
              className="flex items-center gap-2 p-3 rounded-lg text-sm"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171' }}
            >
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            id="btn-login"
            type="submit"
            disabled={isLoading}
            className="w-full btn-primary justify-center py-2.5 mt-2"
            style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}
          >
            {isLoading ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Connexion…
              </>
            ) : (
              'Se connecter'
            )}
          </button>
        </form>

        {/* Footer */}
        <p className="text-center text-xs text-sentinel-muted mt-6">
          Projet Sentinel v1.0 — Jalon 1
        </p>
      </div>
    </div>
  )
}
