const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'

class GitHubService {
  constructor() {
    // No token in localStorage — cookies handle auth
  }

  getHeaders() {
    return {
      'Content-Type': 'application/json',
      // No Authorization header — cookies are sent automatically via credentials: 'include'
    }
  }

  async request(endpoint, options = {}) {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      credentials: 'include', // CRITICAL: sends HTTP-only cookies
      headers: {
        ...this.getHeaders(),
        ...options.headers,
      },
    })

    // Handle token expiration — try refresh once
    if (response.status === 401) {
      const errorData = await response.json().catch(() => ({}))
      
      if (errorData.code === 'TOKEN_EXPIRED') {
        const refreshed = await this.refreshToken()
        if (refreshed) {
          return this.request(endpoint, options) // Retry
        }
      }
      
      // True auth failure — prevent redirect loop on auth pages
      const currentPath = window.location.pathname
      if (!currentPath.includes('/login') && !currentPath.includes('/auth/callback')) {
        localStorage.removeItem('resonance-user')
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
        credentials: 'include', // Sends refreshToken cookie
      })
      return response.ok
    } catch {
      return false
    }
  }

  // List user's repos
  async getRepos(page = 1, perPage = 30) {
    return this.request(`/github/repos?page=${page}&per_page=${perPage}`)
  }

  // List branches
  async getBranches(owner, repo) {
    return this.request(`/github/repos/${owner}/${repo}/branches`)
  }

  // Get file tree
  async getTree(owner, repo, branch = 'main') {
    return this.request(`/github/repos/${owner}/${repo}/tree?branch=${branch}`)
  }

  // Get file content
  async getFileContent(owner, repo, path, branch = 'main') {
    return this.request(`/github/repos/${owner}/${repo}/contents?path=${encodeURIComponent(path)}&branch=${branch}`)
  }

  // Clone repo
  async cloneRepo(repoUrl, branch = 'main') {
    return this.request('/github/clone', {
      method: 'POST',
      body: JSON.stringify({ repoUrl, branch }),
    })
  }

  // Get cloned files
  async getClonedFiles() {
    return this.request('/github/clone/files')
  }

  // Get cloned file content
  async getClonedFile(path) {
    return this.request(`/github/clone/file?path=${encodeURIComponent(path)}`)
  }

  // Clean up clone
  async deleteClone() {
    return this.request('/github/clone', { method: 'DELETE' })
  }
}

export const githubService = new GitHubService()