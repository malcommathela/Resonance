import { useAuth } from '@clerk/clerk-react'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'

class ApiService {
  constructor() {
    this.getToken = null // Will be set by the hook
  }

  setTokenGetter(getTokenFn) {
    this.getToken = getTokenFn
  }

  async getHeaders() {
    const headers = {
      'Content-Type': 'application/json',
    }

    // Get Clerk JWT token
    if (this.getToken) {
      const token = await this.getToken()
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
    }

    return headers
  }

  async request(endpoint, options = {}) {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      credentials: 'include', // Keep for any remaining cookie needs
      headers: {
        ...(await this.getHeaders()),
        ...options.headers,
      },
    })

    if (response.status === 401) {
      // Let Clerk handle re-auth
      const currentPath = window.location.pathname
      if (!currentPath.includes('/login') && !currentPath.includes('/sign-up')) {
        window.location.href = '/login'
      }
      throw new Error('Session expired')
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(error.error || `API Error: ${response.status}`)
    }

    return response.json()
  }

  async getCurrentUser() {
    return this.request('/auth/me')
  }

  async logout() {
    await this.request('/auth/logout', { method: 'POST' }).catch(() => {})
  }

  async getDesigns() {
    return this.request('/designs')
  }

  async getDesign(id) {
    return this.request(`/designs/${id}`)
  }

  async createDesign(data) {
    return this.request('/designs', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateDesign(id, data) {
    return this.request(`/designs/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  }

  async deleteDesign(id) {
    return this.request(`/designs/${id}`, { method: 'DELETE' })
  }

  async saveCanvas(id, { nodes, edges }) {
    return this.request(`/designs/${id}/canvas`, {
      method: 'POST',
      body: JSON.stringify({ nodes, edges }),
    })
  }

  async autoSaveCanvas(id, { nodes, edges }) {
    return this.request(`/designs/${id}/autosave`, {
      method: 'POST',
      body: JSON.stringify({ nodes, edges }),
    })
  }

  async runSimulation(data) {
    return this.request('/simulations', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async getSimulation(id) {
    return this.request(`/simulations/${id}`)
  }
}

export const api = new ApiService()

// Hook to connect Clerk's getToken to the API service
export function useApiWithAuth() {
  const { getToken } = useAuth()

  // Set the token getter when the hook runs
  api.setTokenGetter(() => getToken())

  return api
}