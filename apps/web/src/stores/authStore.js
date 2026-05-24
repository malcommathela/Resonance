import { create } from 'zustand'
import { api } from '@/services/api'

const getStoredUser = () => {
  try {
    const stored = localStorage.getItem('resonance-user')
    if (!stored || stored === 'undefined' || stored === 'null') return null
    return JSON.parse(stored)
  } catch {
    localStorage.removeItem('resonance-user')
    return null
  }
}

export const useAuthStore = create((set, get) => ({
  user: getStoredUser(),
  isAuthenticated: false,
  isLoading: true,
  error: null,

  init: async () => {
    set({ isLoading: true, error: null })
    try {
      const user = await api.getCurrentUser()
      localStorage.setItem('resonance-user', JSON.stringify(user))
      set({ user, isAuthenticated: true, isLoading: false, error: null })
    } catch (err) {
      console.error('Auth init error:', err.message)
      localStorage.removeItem('resonance-user')
      set({ user: null, isAuthenticated: false, isLoading: false })
    }
  },

  login: async (provider) => {
    if (provider === 'github') {
      window.location.href = `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/auth/github`
    }
  },

  handleCallback: async () => {
    set({ isLoading: true, error: null })
    try {
      const user = await api.githubCallback()
      localStorage.setItem('resonance-user', JSON.stringify(user))
      set({ user, isAuthenticated: true, isLoading: false, error: null })
      return user
    } catch (err) {
      set({ error: err.message, isLoading: false, isAuthenticated: false })
      throw err
    }
  },

  logout: async () => {
    try {
      await api.logout()
    } catch (err) {
      console.error('Logout error:', err)
    }
    localStorage.removeItem('resonance-user')
    set({ user: null, isAuthenticated: false, error: null, isLoading: false })
  },

  updateUser: (updates) => {
    const user = { ...get().user, ...updates }
    localStorage.setItem('resonance-user', JSON.stringify(user))
    set({ user })
  },
}))