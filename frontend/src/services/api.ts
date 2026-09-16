// =============================================================================
// Projet Sentinel — Client Axios avec interceptor JWT
// =============================================================================

import axios from 'axios'
import { useAppStore } from '@/store/useAppStore'

const api = axios.create({
  baseURL: '/api',
  timeout: 15_000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Intercepteur requête : injecte le Bearer token
api.interceptors.request.use((config) => {
  const token = useAppStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Intercepteur réponse : 401 → logout automatique
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAppStore.getState().logout()
      window.location.href = '/login'
    }
    return Promise.reject(error)
  },
)

export default api
