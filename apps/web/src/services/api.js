const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'

class ApiService {
  constructor() {
    this.token = localStorage.getItem('resonance-token')
  }

  setToken(token) {
    this.token = token
    localStorage.setItem('resonance-token', token)
  }

  clearToken() {
    this.token = null
    localStorage.removeItem('resonance-token')
  }

  getHeaders() {
    const headers = {
      'Content-Type': 'application/json',
    }
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`
    }
    return headers
  }

  async request(endpoint, options = {}) {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...options.headers,
      },
    })

    if (response.status === 401) {
      this.clearToken()
      window.location.href = '/login'
      throw new Error('Session expired')
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(error.error || `API Error: ${response.status}`)
    }

    return response.json()
  }

  // Auth
  async githubCallback(token) {
    // Set token directly instead of using this.setToken
    this.token = token
    localStorage.setItem('resonance-token', token)
    
    const user = await this.request('/auth/me')
    return { token, user }
  }

  async getCurrentUser() {
    return this.request('/auth/me')
  }

  async logout() {
    await this.request('/auth/logout', { method: 'POST' }).catch(() => {})
    this.clearToken()
  }

  // Designs
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
      body: JSON.stringify({ blocks: nodes, edges }),
    })
  }

  // Simulations
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