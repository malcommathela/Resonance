import { Router } from 'express'
import { cache } from '../lib/redis.js'
import { requireAuth, optionalAuth } from '../middleware/auth.js'

const router = Router()

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