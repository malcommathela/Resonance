import { useAuth } from '@clerk/clerk-react'
import { useCallback, useEffect, useRef } from 'react'

const rawBase = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const API_BASE = rawBase.replace(/\/+$/, '')

class ApiService {
  constructor() {
    this.getToken = null
    this.tokenCache = null
    this.tokenExpiry = 0
  }

  setTokenGetter(getTokenFn) {
    this.getToken = getTokenFn
  }

  async getAuthToken() {
    if (!this.getToken) return null
    
    // Cache token for 50 seconds to avoid repeated Clerk API calls
    const now = Date.now()
    if (this.tokenCache && this.tokenExpiry > now) {
      return this.tokenCache
    }

    try {
      const token = await this.getToken()
      this.tokenCache = token
      this.tokenExpiry = now + 50000 // 50s cache
      return token
    } catch (err) {
      console.error('Failed to get Clerk token:', err)
      this.tokenCache = null
      return null
    }
  }

  async getHeaders() {
    const headers = {
      'Content-Type': 'application/json',
    }

    const token = await this.getAuthToken()
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    return headers
  }

  async request(endpoint, options = {}) {
    const safeEndpoint = endpoint && endpoint.startsWith('/') ? endpoint : `/${endpoint || ''}`
    const url = `${API_BASE}${safeEndpoint}`

    const response = await fetch(url, {
      ...options,
      credentials: 'include', // FIXED: Send cookies for Clerk session
      headers: {
        ...(await this.getHeaders()),
        ...options.headers,
      },
    })

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      const error = new Error(data.error || `API Error: ${response.status}`)
      error.status = response.status
      error.statusText = response.statusText
      error.data = data
      throw error
    }

    return response.json()
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
      body: JSON.stringify({ nodes, edges }),
    })
  }

  async autoSaveCanvas(id, { nodes, edges }) {
    return this.request(`/designs/${id}/autosave`, {
      method: 'POST',
      body: JSON.stringify({ nodes, edges }),
    })
  }

  // Simulations
  async runSimulation(designId, config) {
    return this.request(`/simulations/${designId}/run`, {
      method: 'POST',
      body: JSON.stringify(config),
    })
  }

  async getSimulationStatus(id) {
    return this.request(`/simulations/${id}/status`)
  }

  async stopSimulation(id) {
    return this.request(`/simulations/${id}/stop`, { method: 'POST' })
  }

  async streamSimulation(id) {
    return `${API_BASE}/simulations/${id}/stream`
  }

  async getCurrentUser() {
    return this.request('/auth/me')
  }

  async logout() {
    return this.request('/auth/logout', { method: 'POST' })
  }
}

export const api = new ApiService()

// FIXED: Properly initialize token getter with Clerk
export function useApiWithAuth() {
  const { getToken, isSignedIn, isLoaded } = useAuth()

  // Set getter synchronously — no race condition
  if (isLoaded) {
    api.setTokenGetter(async () => {
      if (!isSignedIn || !getToken) return null
      try {
        return await getToken()
      } catch (err) {
        console.error('Clerk getToken failed:', err)
        return null
      }
    })
  }

  return { api, isLoaded, isSignedIn }
}