import { Router } from 'express'
import { prisma } from '../lib/db.js'
import { cache } from '../lib/redis.js'
import { 
  generateAccessToken, 
  generateRefreshToken, 
  setAuthCookies,
  clearAuthCookies,
  authMiddleware 
} from '../middleware/auth.js'

const router = Router()

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET
const GITHUB_CALLBACK_URL = process.env.GITHUB_CALLBACK_URL
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
    redirect_uri: GITHUB_CALLBACK_URL,
    scope: 'user:email read:user repo',
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
        redirect_uri: GITHUB_CALLBACK_URL,
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

    // Fetch emails
    const emailsRes = await fetch('https://api.github.com/user/emails', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Resonance-App',
      },
    })

    const emails = await emailsRes.json()
    const primaryEmail = emails.find(e => e.primary)?.email || githubUser.email || `${githubUser.login}@github.com`

    // Find or create user
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
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          name: githubUser.name || githubUser.login,
          avatar: githubUser.avatar_url,
        }
      })
    }

    // Generate tokens
    const accessToken = generateAccessToken(user.id)
    const refreshToken = await generateRefreshToken(user.id)

    // Store GitHub token by userId (survives JWT refreshes!)
    await cache.set(`github-token:${user.id}`, tokenData.access_token, 604800) // 7 days

    // Set HTTP-only cookies
    setAuthCookies(res, accessToken, refreshToken)

    // Redirect to frontend with success flag (no token in URL!)
    res.redirect(`${FRONTEND_URL}/auth/callback?success=true`)

  } catch (err) {
    console.error('GitHub OAuth error:', err)
    res.redirect(`${FRONTEND_URL}/login?error=auth_failed`)
  }
})

// Refresh endpoint
router.post('/refresh', async (req, res) => {
  const { refreshTokens } = await import('../middleware/auth.js')
  await refreshTokens(req, res)
})

// Get current user
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, email: true, name: true, avatar: true, tier: true, createdAt: true }
    })

    if (!user) return res.status(401).json({ error: 'User not found' })
    res.json(user)
  } catch {
    res.status(401).json({ error: 'Invalid token' })
  }
})

// Logout - clear cookies and revoke refresh token
router.post('/logout', authMiddleware, async (req, res) => {
  try {
    // Revoke refresh token from Redis
    const refreshToken = req.cookies?.refreshToken
    if (refreshToken && req.user?.id) {
      await cache.del(`refresh:${req.user.id}:${refreshToken}`)
    }

    clearAuthCookies(res)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router