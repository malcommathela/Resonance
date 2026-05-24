import jwt from 'jsonwebtoken'
import { prisma } from '../lib/db.js'
import { cache } from '../lib/redis.js'

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production'
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'refresh-secret-change-in-production'

// Access token: short-lived (15 min)
export const generateAccessToken = (userId) => {
  return jwt.sign({ userId, type: 'access' }, JWT_SECRET, { expiresIn: '15m' })
}

// Refresh token: long-lived (7 days), stored in Redis
export const generateRefreshToken = async (userId) => {
  const refreshToken = jwt.sign(
    { userId, type: 'refresh', jti: crypto.randomUUID() },
    JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  )
  // Store in Redis with TTL matching token expiry
  await cache.set(`refresh:${userId}:${refreshToken}`, { createdAt: Date.now() }, 604800)
  return refreshToken
}

export const verifyAccessToken = (token) => {
  return jwt.verify(token, JWT_SECRET)
}

export const verifyRefreshToken = (token) => {
  return jwt.verify(token, JWT_REFRESH_SECRET)
}

// Main auth middleware - reads from HTTP-only cookie
export const authMiddleware = async (req, res, next) => {
  try {
    // Read access token from HTTP-only cookie
    const token = req.cookies?.accessToken

    if (!token) {
      return res.status(401).json({ error: 'No token provided' })
    }

    const decoded = verifyAccessToken(token)

    if (decoded.type !== 'access') {
      return res.status(401).json({ error: 'Invalid token type' })
    }

    // Check Redis cache first, then DB
    const cacheKey = `user:${decoded.userId}`
    let user = await cache.get(cacheKey)

    if (!user) {
      user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, email: true, name: true, avatar: true, tier: true, githubId: true }
      })
      if (user) await cache.set(cacheKey, user, 300)
    }

    if (!user) {
      return res.status(401).json({ error: 'User not found' })
    }

    req.user = user
    next()
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' })
    }
    console.error('Auth middleware error:', err.message)
    return res.status(401).json({ error: 'Invalid token' })
  }
}

// Optional auth - doesn't fail if no token
export const optionalAuth = async (req, res, next) => {
  try {
    const token = req.cookies?.accessToken
    if (token) {
      const decoded = verifyAccessToken(token)
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

// Refresh token endpoint handler
export const refreshTokens = async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken

    if (!refreshToken) {
      return res.status(401).json({ error: 'No refresh token' })
    }

    const decoded = verifyRefreshToken(refreshToken)

    if (decoded.type !== 'refresh') {
      return res.status(401).json({ error: 'Invalid token type' })
    }

    // Verify token exists in Redis (prevents using revoked tokens)
    const stored = await cache.get(`refresh:${decoded.userId}:${refreshToken}`)
    if (!stored) {
      return res.status(401).json({ error: 'Refresh token revoked' })
    }

    // Generate new tokens
    const newAccessToken = generateAccessToken(decoded.userId)
    const newRefreshToken = await generateRefreshToken(decoded.userId)

    // Revoke old refresh token
    await cache.del(`refresh:${decoded.userId}:${refreshToken}`)

    // Set new cookies
    res.cookie('accessToken', newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000, // 15 minutes
    })

    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/auth/refresh',
    })

    res.json({ success: true })
  } catch (err) {
    console.error('Refresh error:', err)
    res.status(401).json({ error: 'Invalid refresh token' })
  }
}

// Set auth cookies helper
export const setAuthCookies = (res, accessToken, refreshToken) => {
  res.cookie('accessToken', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 15 * 60 * 1000,
  })

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/auth/refresh',
  })
}

// Clear auth cookies helper
export const clearAuthCookies = (res) => {
  res.clearCookie('accessToken')
  res.clearCookie('refreshToken', { path: '/auth/refresh' })
}