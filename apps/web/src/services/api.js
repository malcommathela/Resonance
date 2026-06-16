import { useAuth } from '@clerk/clerk-react'
import { useCallback, useEffect } from 'react'

// FIX: Strip trailing slash from API_BASE to prevent double slashes
const rawBase = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const API_BASE = rawBase.replace(/\/+$/, '') // removes trailing slash(es)

class ApiService {
  constructor() {
    this.getToken = null
  }

  setTokenGetter(getTokenFn) {
    this.getToken = getTokenFn
  }

  async getAuthToken() {
    if (this.getToken) {
      return await this.getToken()
    }
    return null
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
    // FIX: Ensure endpoint always starts with / and isn't empty
    const safeEndpoint = endpoint && endpoint.startsWith('/') ? endpoint : `/${endpoint || ''}`
    const url = `${API_BASE}${safeEndpoint}`

    const response = await fetch(url, {
      ...options,
      headers: {
        ...(await this.getHeaders()),
        ...options.headers,
      },
    })

    // FIX: Better error handling — preserve status for callers to check
    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      const error = new Error(data.error || `API Error: ${response.status}`)
      error.status = response.status      // attach status for modal logic
      error.statusText = response.statusText
      error.data = data
      throw error
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

export function useApiWithAuth() {
  const { getToken, isSignedIn, isLoaded } = useAuth()
  
  const getTokenRef = useCallback(() => {
    if (isSignedIn && getToken) {
      return getToken()
    }
    return null
  }, [isSignedIn, getToken])

  useEffect(() => {
    api.setTokenGetter(getTokenRef)
  }, [getTokenRef])

  return { api, isLoaded, isSignedIn }
}