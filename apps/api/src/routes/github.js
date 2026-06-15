import { Router } from 'express'
import { prisma } from '../lib/db.js'
import { cache } from '../lib/redis.js'
import { requireAuth } from '../middleware/auth.js'
import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

const router = Router()
const execAsync = promisify(exec)

// Helper: Get GitHub token by clerkId
// Since we no longer have the custom OAuth flow, users need to connect their GitHub
// via Clerk's social connection. The token is stored when they use the GitHub OAuth through Clerk.
// For now, this route checks if the user has a githubId (meaning they signed in with GitHub via Clerk)
// and uses a stored token, or falls back to a user-provided token.
async function getGitHubToken(req) {
  const clerkId = req.user?.clerkId
  if (!clerkId) {
    console.log('getGitHubToken: no clerkId in req.user')
    return null
  }

  const token = await cache.get(`github-token:${clerkId}`)
  if (!token) {
    console.log(`getGitHubToken: no github-token for clerkId ${clerkId}`)
  }
  return token
}

// POST /github/token — Store a GitHub personal access token
// Users can provide their own PAT if they didn't sign in with GitHub via Clerk
router.post('/token', requireAuth, async (req, res) => {
  try {
    const { token } = req.body
    if (!token) return res.status(400).json({ error: 'Token required' })

    await cache.set(`github-token:${req.user.clerkId}`, token, 604800) // 7 days
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Helper: GitHub API request
async function githubApi(token, endpoint, options = {}) {
  const response = await fetch(`https://api.github.com${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Resonance-App',
      ...options.headers,
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'GitHub API error' }))
    throw new Error(error.message || `GitHub API ${response.status}`)
  }

  return response.json()
}

// GET /github/repos — List user's repositories
router.get('/repos', requireAuth, async (req, res) => {
  try {
    const token = await getGitHubToken(req)
    if (!token) {
      return res.status(401).json({ error: 'GitHub token not found. Connect your GitHub account or provide a PAT at POST /github/token' })
    }

    const { page = 1, per_page = 30, sort = 'updated' } = req.query

    const repos = await githubApi(token, `/user/repos?page=${page}&per_page=${per_page}&sort=${sort}&affiliation=owner,collaborator`)

    res.json(repos.map(repo => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      description: repo.description,
      url: repo.html_url,
      cloneUrl: repo.clone_url,
      defaultBranch: repo.default_branch,
      language: repo.language,
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      private: repo.private,
      updatedAt: repo.updated_at,
    })))
  } catch (err) {
    console.error('GitHub repos error:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /github/repos/:owner/:repo/branches — List branches
router.get('/repos/:owner/:repo/branches', requireAuth, async (req, res) => {
  try {
    const token = await getGitHubToken(req)
    if (!token) return res.status(401).json({ error: 'GitHub token not found' })

    const { owner, repo } = req.params
    const branches = await githubApi(token, `/repos/${owner}/${repo}/branches`)

    res.json(branches.map(b => ({
      name: b.name,
      sha: b.commit.sha,
      protected: b.protected,
    })))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /github/repos/:owner/:repo/tree — Get file tree for a branch
router.get('/repos/:owner/:repo/tree', requireAuth, async (req, res) => {
  try {
    const token = await getGitHubToken(req)
    if (!token) return res.status(401).json({ error: 'GitHub token not found' })

    const { owner, repo } = req.params
    const { branch = 'main', path: filePath = '' } = req.query

    const treeData = await githubApi(token, `/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`)

    const relevantExtensions = ['.json', '.yml', '.yaml', '.tf', '.proto', '.js', '.ts', '.go', '.py', '.java', '.dockerfile', '.dockerignore']
    const relevantNames = ['package.json', 'docker-compose', 'Dockerfile', 'kubernetes', 'terraform', 'serverless', 'requirements', 'go.mod', 'Cargo.toml', 'pom.xml', 'build.gradle']

    const filtered = treeData.tree
      .filter(item => {
        if (item.type !== 'blob') return false
        const name = item.path.toLowerCase()
        return relevantExtensions.some(ext => name.endsWith(ext)) ||
               relevantNames.some(r => name.includes(r.toLowerCase()))
      })
      .map(item => ({
        path: item.path,
        sha: item.sha,
        size: item.size,
      }))
      .sort((a, b) => a.path.localeCompare(b.path))

    res.json({
      branch,
      truncated: treeData.truncated,
      files: filtered,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /github/repos/:owner/:repo/contents — Get file content
router.get('/repos/:owner/:repo/contents', requireAuth, async (req, res) => {
  try {
    const token = await getGitHubToken(req)
    if (!token) return res.status(401).json({ error: 'GitHub token not found' })

    const { owner, repo } = req.params
    const { path: filePath, branch = 'main' } = req.query

    const content = await githubApi(token, `/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`)

    if (content.content) {
      const decoded = Buffer.from(content.content, 'base64').toString('utf-8')
      res.json({
        path: content.path,
        sha: content.sha,
        size: content.size,
        content: decoded,
        encoding: 'utf-8',
      })
    } else {
      res.json(content)
    }
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /github/clone — Clone repo to temp storage for analysis
router.post('/clone', requireAuth, async (req, res) => {
  try {
    const { repoUrl, branch = 'main' } = req.body
    if (!repoUrl) return res.status(400).json({ error: 'repoUrl required' })

    const token = await getGitHubToken(req)
    if (!token) return res.status(401).json({ error: 'GitHub token not found' })

    const tempDir = path.join(os.tmpdir(), `resonance-${req.user.clerkId}-${Date.now()}`)
    await fs.mkdir(tempDir, { recursive: true })

    const authUrl = repoUrl.replace('https://github.com', `https://${token}@github.com`)

    await execAsync(`git clone --depth 1 --branch ${branch} ${authUrl} ${tempDir}`, {
      timeout: 60000,
      maxBuffer: 1024 * 1024 * 10,
    })

    await fs.rm(path.join(tempDir, '.git'), { recursive: true, force: true })
    await cache.set(`clone:${req.user.clerkId}`, { path: tempDir, repoUrl, branch, createdAt: Date.now() }, 3600)

    res.json({ 
      success: true, 
      tempDir,
      message: 'Repository cloned successfully' 
    })
  } catch (err) {
    console.error('Clone error:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /github/clone/files — List cloned files
router.get('/clone/files', requireAuth, async (req, res) => {
  try {
    const cloneData = await cache.get(`clone:${req.user.clerkId}`)
    if (!cloneData) return res.status(404).json({ error: 'No cloned repository found' })

    const { path: tempDir } = cloneData

    async function scanDir(dir, basePath = '') {
      const entries = await fs.readdir(dir, { withFileTypes: true })
      const files = []

      for (const entry of entries) {
        const relativePath = path.join(basePath, entry.name)
        const fullPath = path.join(dir, entry.name)

        if (entry.isDirectory()) {
          if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist' || entry.name === 'build') continue
          const subFiles = await scanDir(fullPath, relativePath)
          files.push(...subFiles)
        } else {
          files.push({
            path: relativePath,
            size: (await fs.stat(fullPath)).size,
          })
        }
      }

      return files
    }

    const files = await scanDir(tempDir)

    const relevant = files.filter(f => {
      const name = f.path.toLowerCase()
      return name.includes('package.json') ||
             name.includes('docker-compose') ||
             name.includes('dockerfile') ||
             name.includes('kubernetes') ||
             name.includes('terraform') ||
             name.includes('serverless') ||
             name.includes('requirements') ||
             name.includes('go.mod') ||
             name.includes('cargo.toml') ||
             name.includes('pom.xml') ||
             name.includes('build.gradle') ||
             name.includes('.proto') ||
             name.includes('.tf') ||
             name.includes('.yaml') ||
             name.includes('.yml')
    })

    res.json({
      repoUrl: cloneData.repoUrl,
      branch: cloneData.branch,
      totalFiles: files.length,
      relevantFiles: relevant.length,
      files: relevant.sort((a, b) => a.path.localeCompare(b.path)),
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /github/clone/file — Read a specific file from cloned repo
router.get('/clone/file', requireAuth, async (req, res) => {
  try {
    const cloneData = await cache.get(`clone:${req.user.clerkId}`)
    if (!cloneData) return res.status(404).json({ error: 'No cloned repository found' })

    const { path: tempDir } = cloneData
    const { path: filePath } = req.query

    if (!filePath) return res.status(400).json({ error: 'path required' })

    const fullPath = path.resolve(tempDir, filePath)
    if (!fullPath.startsWith(tempDir)) {
      return res.status(403).json({ error: 'Invalid path' })
    }

    const content = await fs.readFile(fullPath, 'utf-8')
    res.json({ path: filePath, content })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /github/clone — Clean up cloned repo
router.delete('/clone', requireAuth, async (req, res) => {
  try {
    const cloneData = await cache.get(`clone:${req.user.clerkId}`)
    if (cloneData) {
      await fs.rm(cloneData.path, { recursive: true, force: true })
      await cache.del(`clone:${req.user.clerkId}`)
    }
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router