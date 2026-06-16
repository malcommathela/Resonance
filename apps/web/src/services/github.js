import { api } from './api.js'

class GitHubService {
  // Delegate all requests to api.request — gets Clerk token + consistent error handling
  async request(endpoint, options = {}) {
    return api.request(endpoint, options)
  }

  async getRepos(page = 1, perPage = 30) {
    return this.request(`/github/repos?page=${page}&per_page=${perPage}`)
  }

  async getBranches(owner, repo) {
    return this.request(`/github/repos/${owner}/${repo}/branches`)
  }

  async getTree(owner, repo, branch = 'main') {
    return this.request(`/github/repos/${owner}/${repo}/tree?branch=${branch}`)
  }

  async getFileContent(owner, repo, path, branch = 'main') {
    return this.request(`/github/repos/${owner}/${repo}/contents?path=${encodeURIComponent(path)}&branch=${branch}`)
  }

  async cloneRepo(repoUrl, branch = 'main') {
    return this.request('/github/clone', {
      method: 'POST',
      body: JSON.stringify({ repoUrl, branch }),
    })
  }

  async getClonedFiles() {
    return this.request('/github/clone/files')
  }

  async getClonedFile(path) {
    return this.request(`/github/clone/file?path=${encodeURIComponent(path)}`)
  }

  async deleteClone() {
    return this.request('/github/clone', { method: 'DELETE' })
  }
}

export const githubService = new GitHubService()