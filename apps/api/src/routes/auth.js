import { Router } from 'express'
import { getAuth } from '@clerk/express'
import { cache } from '../lib/redis.js'
import { requireAuth, optionalAuth } from '../middleware/auth.js'

const router = Router()

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

// Get current user
router.get('/me', optionalAuth, async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' })
  }
  res.json(req.user)
})

// Clear server cache on logout
router.post('/logout', requireAuth, async (req, res) => {
  await cache.del(`user:clerk:${req.user.clerkId}`)
  res.json({ success: true })
})

export default router