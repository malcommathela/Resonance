import { Router } from 'express'
import { getAuth, requireAuth, clerkClient } from '@clerk/express'
import { prisma } from '../lib/db.js'
import { cache } from '../lib/redis.js'

const router = Router()

// Helper: Get or create DB user from Clerk auth
async function getDbUser(req) {
  const auth = getAuth(req)
  if (!auth?.userId) return null

  let user = await prisma.user.findUnique({
    where: { clerkId: auth.userId },
    select: { id: true, email: true, name: true, avatar: true, tier: true, githubId: true, clerkId: true }
  })

  if (!user) {
    try {
      const clerkUser = await clerkClient.users.getUser(auth.userId)
      const primaryEmail = clerkUser.emailAddresses?.[0]?.emailAddress

      const githubAccount = clerkUser.externalAccounts?.find(
        acc => acc.provider === 'github' || acc.provider === 'oauth_github'
      )

      user = await prisma.user.create({
        data: {
          clerkId: auth.userId,
          email: primaryEmail || `user-${auth.userId}@clerk.dev`,
          name: `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || clerkUser.username || 'User',
          avatar: clerkUser.imageUrl,
          tier: 'free',
          githubId: githubAccount?.externalId || null,
        },
        select: { id: true, email: true, name: true, avatar: true, tier: true, githubId: true, clerkId: true }
      })
      console.log(`[AUTO-CREATE] User created: ${user.id} (${user.email})`)
    } catch (err) {
      console.error('[AUTO-CREATE] Failed:', err.message)
      return null
    }
  }

  return user
}

// DEBUG: Check what Clerk sees
router.get('/debug', (req, res) => {
  const auth = getAuth(req)
  res.json({
    hasAuth: !!auth,
    userId: auth?.userId || null,
    sessionId: auth?.sessionId || null,
    headers: {
      authorization: req.headers.authorization?.substring(0, 50) + '...' || null,
    },
    env: {
      hasPublishableKey: !!process.env.CLERK_PUBLISHABLE_KEY,
      hasSecretKey: !!process.env.CLERK_SECRET_KEY,
      publishableKeyPrefix: process.env.CLERK_PUBLISHABLE_KEY?.substring(0, 10) || null,
      secretKeyPrefix: process.env.CLERK_SECRET_KEY?.substring(0, 10) || null,
    }
  })
})

router.get('/verify-token', async (req, res) => {
  try {
    const auth = getAuth(req)
    const token = req.headers.authorization?.replace('Bearer ', '')

    res.json({
      hasAuth: !!auth,
      userId: auth?.userId,
      sessionId: auth?.sessionId,
      tokenLength: token?.length,
      tokenPrefix: token?.substring(0, 50),
      env: {
        hasSecretKey: !!process.env.CLERK_SECRET_KEY,
        secretKeyPrefix: process.env.CLERK_SECRET_KEY?.substring(0, 10),
      }
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Get current user
router.get('/me', async (req, res) => {
  try {
    const user = await getDbUser(req)
    if (!user) return res.status(401).json({ error: 'Not authenticated' })
    res.json(user)
  } catch (err) {
    console.error('Auth /me error:', err)
    res.status(500).json({ error: err.message })
  }
})

// Clear server cache on logout
router.post('/logout', requireAuth(), async (req, res) => {
  try {
    const auth = getAuth(req)
    if (auth?.userId) {
      await cache.del(`user:clerk:${auth.userId}`)
      await cache.del(`clone:${auth.userId}`)
    }
    res.json({ success: true })
  } catch (err) {
    console.error('Logout error:', err)
    res.status(500).json({ error: err.message })
  }
})

export default router