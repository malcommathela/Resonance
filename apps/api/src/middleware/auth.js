import { getAuth } from '@clerk/express'
import { prisma } from '../lib/db.js'
import { cache } from '../lib/redis.js'

// Get or create user from Clerk auth
export const getUser = async (req) => {
  const auth = getAuth(req)
  if (!auth?.userId) return null

  const cacheKey = `user:clerk:${auth.userId}`
  let user = await cache.get(cacheKey)

  if (!user) {
    user = await prisma.user.findUnique({
      where: { clerkId: auth.userId },
      select: { id: true, email: true, name: true, avatar: true, tier: true, githubId: true, clerkId: true }
    })
    if (user) await cache.set(cacheKey, user, 300)
  }

  return user
}

// Optional auth — attaches req.user if logged in, never fails
export const optionalAuth = async (req, res, next) => {
  try {
    const user = await getUser(req)
    if (user) req.user = user
    next()
  } catch (err) {
    console.error('Optional auth error:', err)
    next()
  }
}

// Strict auth — requires valid Clerk session + DB user
export const requireAuth = async (req, res, next) => {
  try {
    const auth = getAuth(req)
    if (!auth?.userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const user = await getUser(req)
    if (!user) {
      return res.status(401).json({ error: 'User not found' })
    }

    req.user = user
    next()
  } catch (err) {
    console.error('Auth error:', err)
    res.status(401).json({ error: 'Invalid authentication' })
  }
}