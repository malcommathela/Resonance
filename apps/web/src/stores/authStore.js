import { create } from 'zustand'
import { api } from '@/services/api'

export const useAuthStore = create((set, get) => ({
  user: JSON.parse(localStorage.getItem('resonance-user') || 'null'),
  isAuthenticated: !!localStorage.getItem('resonance-token'),
  isLoading: false,
  error: null,

  init: async () => {
    const token = localStorage.getItem('resonance-token')
    if (!token) {
      set({ isAuthenticated: false, user: null })
      return
    }

    try {
      const user = await api.getCurrentUser()
      localStorage.setItem('resonance-user', JSON.stringify(user))
      set({ user, isAuthenticated: true, isLoading: false })
    } catch {
      localStorage.removeItem('resonance-token')
      localStorage.removeItem('resonance-user')
      set({ user: null, isAuthenticated: false, isLoading: false })
    }
  },

  login: async (provider) => {
    if (provider === 'github') {
      // Redirect to backend OAuth endpoint
      window.location.href = `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/auth/github`
    }
  },

  handleCallback: async (token) => {
  console.log('handleCallback called with token')
  set({ isLoading: true, error: null })
  try {
    const { user } = await api.githubCallback(token)
    console.log('handleCallback success:', user)
    localStorage.setItem('resonance-token', token)
    localStorage.setItem('resonance-user', JSON.stringify(user))
    set({ user, isAuthenticated: true, isLoading: false })
    return user
  } catch (err) {
    console.error('handleCallback error:', err)
    set({ error: err.message, isLoading: false, isAuthenticated: false })
    throw err
  }
},

  logout: () => {
    api.logout()
    localStorage.removeItem('resonance-token')
    localStorage.removeItem('resonance-user')
    set({ user: null, isAuthenticated: false, error: null })
  },

  updateUser: (updates) => {
    const user = { ...get().user, ...updates }
    localStorage.setItem('resonance-user', JSON.stringify(user))
    set({ user })
  },
}))