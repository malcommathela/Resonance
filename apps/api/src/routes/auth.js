import { Router } from 'express'
import { prisma } from '../lib/db.js'
import { generateToken } from '../middleware/auth.js'
import { cache } from '../lib/redis.js'

const router = Router()

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'

// Step 1: Redirect user to GitHub for authorization
router.get('/github', (req, res) => {
  if (!GITHUB_CLIENT_ID) {
    return res.status(500).json({ error: 'GitHub OAuth not configured' })
  }

  const state = Buffer.from(Math.random().toString()).toString('base64')
  
  // Store state in Redis for 10 minutes
  cache.set(`github:state:${state}`, { createdAt: Date.now() }, 600)

  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    redirect_uri: `${req.protocol}://${req.get('host')}/auth/github/callback`,
    scope: 'user:email read:user',
    state,
  })

  res.redirect(`https://github.com/login/oauth/authorize?${params}`)
})

// Step 2: GitHub redirects back with code
router.get('/github/callback', async (req, res) => {
  const { code, state, error } = req.query

  if (error) {
    return res.redirect(`${FRONTEND_URL}/login?error=${error}`)
  }

  if (!code || !state) {
    return res.redirect(`${FRONTEND_URL}/login?error=missing_params`)
  }

  // Verify state to prevent CSRF
  const savedState = await cache.get(`github:state:${state}`)
  if (!savedState) {
    return res.redirect(`${FRONTEND_URL}/login?error=invalid_state`)
  }
  await cache.del(`github:state:${state}`)

  try {
    // Exchange code for access token
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: `${req.protocol}://${req.get('host')}/auth/github/callback`,
      }),
    })

    const tokenData = await tokenRes.json()

    if (tokenData.error) {
      throw new Error(tokenData.error_description || tokenData.error)
    }

    // Fetch user data from GitHub
    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Resonance-App',
      },
    })

    const githubUser = await userRes.json()

    // Fetch emails (primary might be private)
    const emailsRes = await fetch('https://api.github.com/user/emails', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Resonance-App',
      },
    })

    const emails = await emailsRes.json()
    const primaryEmail = emails.find(e => e.primary)?.email || githubUser.email || `${githubUser.login}@github.com`

    // Find or create user in database
    let user = await prisma.user.findUnique({
      where: { githubId: githubUser.id.toString() }
    })

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: primaryEmail,
          name: githubUser.name || githubUser.login,
          avatar: githubUser.avatar_url,
          githubId: githubUser.id.toString(),
          tier: 'free',
        }
      })
    } else {
      // Update avatar if changed
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          name: githubUser.name || githubUser.login,
          avatar: githubUser.avatar_url,
        }
      })
    }

    // Generate JWT
    const token = generateToken(user.id)

    // Store session in Redis
    await cache.set(`session:${token}`, {
      userId: user.id,
      githubToken: tokenData.access_token,
      createdAt: new Date().toISOString()
    }, 86400)

    // Redirect to frontend with token
    res.redirect(`${FRONTEND_URL}/auth/callback?token=${token}`)

  } catch (err) {
    console.error('GitHub OAuth error:', err)
    res.redirect(`${FRONTEND_URL}/login?error=auth_failed`)
  }
})

// Get current user from JWT
router.get('/me', async (req, res) => {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token' })
  }

  try {
    const { verifyToken } = await import('../middleware/auth.js')
    const decoded = verifyToken(authHeader.slice(7))

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, name: true, avatar: true, tier: true, createdAt: true }
    })

    if (!user) return res.status(401).json({ error: 'User not found' })
    res.json(user)
  } catch {
    res.status(401).json({ error: 'Invalid token' })
  }
})

router.post('/logout', async (req, res) => {
  const authHeader = req.headers.authorization
  if (authHeader?.startsWith('Bearer ')) {
    await cache.del(`session:${authHeader.slice(7)}`)
  }
  res.json({ success: true })
})

export default router