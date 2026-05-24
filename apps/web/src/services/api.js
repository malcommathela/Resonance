const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'

class ApiService {
  constructor() {
    // No token in localStorage anymore - cookies handle auth
  }

  getHeaders() {
    return {
      'Content-Type': 'application/json',
    }
  }

  async request(endpoint, options = {}) {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      credentials: 'include',
      headers: {
        ...this.getHeaders(),
        ...options.headers,
      },
    })

    // Handle token expiration - try refresh once
    if (response.status === 401) {
      const errorData = await response.json().catch(() => ({}))
      
      if (errorData.code === 'TOKEN_EXPIRED') {
        const refreshed = await this.refreshToken()
        if (refreshed) {
          return this.request(endpoint, options)
        }
      }
      
      // True auth failure - redirect to login (prevent loop on auth pages)
      const currentPath = window.location.pathname
      if (!currentPath.includes('/login') && !currentPath.includes('/auth/callback')) {
        window.location.href = '/login'
      }
      
      throw new Error(errorData.error || 'Session expired')
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(error.error || `API Error: ${response.status}`)
    }

    return response.json()
  }

  async refreshToken() {
    try {
      const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      })
      return response.ok
    } catch {
      return false
    }
  }

  async githubCallback() {
    const user = await this.request('/auth/me')
    return user
  }

  async getCurrentUser() {
    return this.request('/auth/me')
  }

  async logout() {
    await this.request('/auth/logout', { method: 'POST' }).catch(() => {})
    localStorage.removeItem('resonance-user')
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