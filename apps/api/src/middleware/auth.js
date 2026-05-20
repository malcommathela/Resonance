import jwt from 'jsonwebtoken'
import { prisma } from '../lib/db.js'

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production'

export const generateToken = (userId) => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '24h' })
}

export const verifyToken = (token) => {
  return jwt.verify(token, JWT_SECRET)
}

export const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' })
    }

    const token = authHeader.slice(7)
    const decoded = verifyToken(token)
    
    // Check Redis cache first
    const cacheKey = `user:${decoded.userId}`
    let user = await cache.get(cacheKey)
    
    if (!user) {
      user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, email: true, name: true, avatar: true, tier: true }
      })
      if (user) await cache.set(cacheKey, user, 300) // 5 min cache
    }

    if (!user) {
      return res.status(401).json({ error: 'User not found' })
    }

    req.user = user
    next()
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' })
  }
}

export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7)
      const decoded = verifyToken(token)
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, email: true, name: true, avatar: true, tier: true }
      })
      req.user = user
    }
    next()
  } catch {
    next()
  }
}