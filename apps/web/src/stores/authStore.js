import { create } from 'zustand'

export const useAuthStore = create((set, get) => ({
  user: JSON.parse(localStorage.getItem('resonance-user') || 'null'),
  isAuthenticated: !!localStorage.getItem('resonance-user'),
  isLoading: false,

  login: async (provider) => {
    set({ isLoading: true })
    // Mock GitHub OAuth
    await new Promise(r => setTimeout(r, 1500))
    const mockUser = {
      id: 'usr_' + Math.random().toString(36).substr(2, 9),
      name: 'Alex Chen',
      email: 'alex@example.com',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alex',
      githubId: 'alexchen',
      tier: 'free',
      team: {
        id: 'team_' + Math.random().toString(36).substr(2, 9),
        name: 'Personal',
        maxDesigns: 3,
        maxSimulationsPerDay: 3,
      }
    }
    localStorage.setItem('resonance-user', JSON.stringify(mockUser))
    set({ user: mockUser, isAuthenticated: true, isLoading: false })
  },

  logout: () => {
    localStorage.removeItem('resonance-user')
    set({ user: null, isAuthenticated: false })
  },

  updateUser: (updates) => {
    const user = { ...get().user, ...updates }
    localStorage.setItem('resonance-user', JSON.stringify(user))
    set({ user })
  },
}))
