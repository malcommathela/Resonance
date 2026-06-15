import { useAuth } from '@clerk/clerk-react'
import { useEffect } from 'react'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'

class ApiService {
  constructor() {
    this.getToken = null
  }

  setTokenGetter(getTokenFn) {
    this.getToken = getTokenFn
  }

  async getHeaders() {
    const headers = {
      'Content-Type': 'application/json',
    }
    
    if (this.getToken) {
      try {
        const token = await this.getToken()
        if (token) {
          headers['Authorization'] = `Bearer ${token}`
        }
      } catch (err) {
        console.error('Failed to get Clerk token:', err)
      }
    }

    return headers
  }

  async request(endpoint, options = {}) {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        ...(await this.getHeaders()),
        ...options.headers,
      },
    })

    if (response.status === 401) {
      const error = await response.json().catch(() => ({ error: 'Unauthorized' }))
      throw new Error(error.error || 'Unauthorized')
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(error.error || `API Error: ${response.status}`)
    }

    return response.json()
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

  async getCurrentUser() {
    return this.request('/auth/me')
  }

  async logout() {
    return this.request('/auth/logout', { method: 'POST' })
  }
}

export const api = new ApiService()

// Hook to connect Clerk's getToken to the API service
export function useApiWithAuth() {
  const { getToken, isSignedIn } = useAuth()
  
  useEffect(() => {
    if (isSignedIn && getToken) {
      api.setTokenGetter(() => getToken())
    } else {
      api.setTokenGetter(null)
    }
  }, [isSignedIn, getToken])

  return api
}