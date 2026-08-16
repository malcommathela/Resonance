import { useAuth } from '@clerk/clerk-react'
import { useEffect } from 'react'

const rawBase = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const API_BASE = rawBase.replace(/\/+$/, '')

const pending = new Map()

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
    if (this.getToken) {
      try { return await this.getToken() } catch (err) {
        console.error('Failed to get Clerk token via getter:', err)
      }
    }
    try {
      const token = await window.__clerk?.session?.getToken?.()
      if (token) return token
    } catch (e) { /* ignore */ }
    try {
      const token = await window.Clerk?.session?.getToken?.()
      if (token) return token
    } catch (e) { /* ignore */ }
    return null
  }

  async getHeaders() {
    const headers = { 'Content-Type': 'application/json' }
    const token = await this.getAuthToken()
    if (token) headers['Authorization'] = `Bearer ${token}`
    return headers
  }

  async request(endpoint, options = {}) {
    const safeEndpoint = endpoint?.startsWith('/') ? endpoint : `/${endpoint || ''}`
    const url = `${API_BASE}${safeEndpoint}`
    const isGet = !options.method || options.method === 'GET'
    const dedupeKey = isGet ? `GET:${url}:${JSON.stringify(options)}` : null

    if (dedupeKey && pending.has(dedupeKey)) {
      return pending.get(dedupeKey)
    }

    const promise = fetch(url, {
      ...options,
      credentials: 'include',
      headers: { ...(await this.getHeaders()), ...options.headers },
    }).then(async (response) => {
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        const error = new Error(data.error || `API Error: ${response.status}`)
        error.status = response.status
        error.statusText = response.statusText
        error.data = data
        throw error
      }
      return response.json()
    })

    if (dedupeKey) {
      pending.set(dedupeKey, promise)
      promise.catch(() => {}).finally(() => pending.delete(dedupeKey))
    }

    return promise
  }

  // Designs
  async getDesigns() { return this.request('/designs') }
  async getDesign(id) { return this.request(`/designs/${id}`) }
  async createDesign(data) { return this.request('/designs', { method: 'POST', body: JSON.stringify(data) }) }
  async updateDesign(id, data) { return this.request(`/designs/${id}`, { method: 'PATCH', body: JSON.stringify(data) }) }
  async deleteDesign(id) { return this.request(`/designs/${id}`, { method: 'DELETE' }) }
  async saveCanvas(id, { nodes, edges }) {
    return this.request(`/designs/${id}/canvas`, { method: 'POST', body: JSON.stringify({ nodes, edges }) })
  }
  async autoSaveCanvas(id, { nodes, edges }) {
    return this.request(`/designs/${id}/autosave`, { method: 'POST', body: JSON.stringify({ nodes, edges }) })
  }

  // Simulations
  async runSimulation(designId, config) {
    return this.request(`/simulations/${designId}/run`, { method: 'POST', body: JSON.stringify(config) })
  }
  async getSimulationStatus(id) { return this.request(`/simulations/${id}/status`) }
  async stopSimulation(id) { return this.request(`/simulations/${id}/stop`, { method: 'POST' }) }
  streamSimulation(id) { return `${API_BASE}/simulations/${id}/stream` }

  async validateDesign(designId) {
    return this.request(`/validation/${designId}/validate`, { method: 'POST' })
  }

  // Auth
  async getCurrentUser() { return this.request('/auth/me') }

  // Design Overview
  async getDesignOverview(id) { return this.request(`/designs/${id}/overview`) }
  async getDesignReports(id) { return this.request(`/designs/${id}/reports`) }
  async getDesignAuditLogs(id) { return this.request(`/designs/${id}/audit-logs`) }
  async getReportBySimulationId(simulationId) {
    return this.request(`/simulations/${simulationId}/report`)
  }

  // Team — CRUD
  async createTeam(data) { return this.request('/team', { method: 'POST', body: JSON.stringify(data) }) }
  async getTeams() { return this.request('/teams') }
  async getTeam(id) { return this.request(`/team/${id}`) }
  async updateTeam(id, data) { return this.request(`/team/${id}`, { method: 'PATCH', body: JSON.stringify(data) }) }
  async deleteTeam(id) { return this.request(`/team/${id}`, { method: 'DELETE' }) }

  // Team — Members
  async getTeamMembers(id) { return this.request(`/team/${id}/members`) }
  async removeTeamMember(teamId, userId) { return this.request(`/team/${teamId}/members/${userId}`, { method: 'DELETE' }) }
  async updateTeamMemberRole(teamId, userId, role) { return this.request(`/team/${teamId}/members/${userId}/role`, { method: 'PATCH', body: JSON.stringify({ role }) }) }

  // Team — Invites
  async inviteTeamMember(teamId, data) { return this.request(`/team/${teamId}/invite`, { method: 'POST', body: JSON.stringify(data) }) }
  async getTeamInvites(teamId) { return this.request(`/team/${teamId}/invites`) }
  async revokeTeamInvite(teamId, inviteId) { return this.request(`/team/${teamId}/invites/${inviteId}`, { method: 'DELETE' }) }
  async acceptTeamInvite(token) { return this.request('/team/invite/accept', { method: 'POST', body: JSON.stringify({ token }) }) }
  async declineTeamInvite(token) { return this.request('/team/invite/decline', { method: 'POST', body: JSON.stringify({ token }) }) }
  async getMyInvites() { return this.request('/team/invites/me') }

  // Team — Designs
  async getTeamDesigns(teamId) { return this.request(`/team/${teamId}/designs`) }
  async createTeamDesign(teamId, data) { return this.request(`/team/${teamId}/designs`, { method: 'POST', body: JSON.stringify(data) }) }
  async importDesignToTeam(teamId, designId) { return this.request(`/team/${teamId}/designs/import`, { method: 'POST', body: JSON.stringify({ designId }) }) }
  async removeDesignFromTeam(teamId, designId) { return this.request(`/team/${teamId}/designs/${designId}`, { method: 'DELETE' }) }

  // Legacy — kept for backward compatibility
  async inviteMember(data) { return this.request('/team/invite', { method: 'POST', body: JSON.stringify(data) }) }
  async removeMember(id) { return this.request(`/team/members/${id}`, { method: 'DELETE' }) }
  async updateMemberRole(id, role) { return this.request(`/team/members/${id}/role`, { method: 'PATCH', body: JSON.stringify({ role }) }) }

  async logout() { return this.request('/auth/logout', { method: 'POST' }) }
}

export const api = new ApiService()

export function useApiWithAuth() {
  const { getToken, isSignedIn, isLoaded } = useAuth()
  useEffect(() => {
    if (!isLoaded) return
    api.setTokenGetter(async () => {
      if (!isSignedIn || !getToken) return null
      try { return await getToken() } catch (err) {
        console.error('Clerk getToken failed:', err)
        return null
      }
    })
  }, [isLoaded, isSignedIn, getToken])
  return { api, isLoaded, isSignedIn }
}