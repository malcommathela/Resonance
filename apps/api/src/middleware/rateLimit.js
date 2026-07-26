import rateLimit from 'express-rate-limit'
import { redisConnection } from '../lib/redis.js'

// ============================================================================
// CUSTOM REDIS STORE FOR EXPRESS-RATE-LIMIT (Atomic INCR + EXPIRE via Lua)
// ============================================================================
// Problem: Default memory store is per-instance. If you run 4 API containers,
// a user gets 4x the allowed rate. Redis store makes limits global.
//
// This custom store uses ioredis (already installed) — no new dependencies.
// ============================================================================

const INCR_AND_EXPIRE_LUA = `
  local key = KEYS[1]
  local window = ARGV[1]
  local current = redis.call('INCR', key)
  if current == 1 then
    redis.call('PEXPIRE', key, window)
  end
  return current
`

class RedisRateLimitStore {
  constructor(redisClient, prefix = 'rl:') {
    this.client = redisClient
    this.prefix = prefix
    this.windowMs = 60000
  }

  async init(options) {
    this.windowMs = options.windowMs
  }

  async increment(key) {
    const fullKey = `${this.prefix}${key}`
    const now = Date.now()
    const resetTime = new Date(now + this.windowMs)

    try {
      const totalHits = await this.client.eval(
        INCR_AND_EXPIRE_LUA,
        1,
        fullKey,
        this.windowMs
      )
      return { totalHits: Number(totalHits), resetTime }
    } catch (err) {
      // Fail open: if Redis is down, don't block legitimate traffic
      console.error('[RATE LIMIT] Redis increment failed:', err.message)
      return { totalHits: 1, resetTime }
    }
  }

  async decrement(key) {
    try {
      await this.client.decr(`${this.prefix}${key}`)
    } catch (err) {
      console.error('[RATE LIMIT] Redis decrement failed:', err.message)
    }
  }

  async resetKey(key) {
    try {
      await this.client.del(`${this.prefix}${key}`)
    } catch (err) {
      console.error('[RATE LIMIT] Redis reset failed:', err.message)
    }
  }
}

// ============================================================================
// KEY GENERATOR
// ============================================================================

function getClientKey(req) {
  // Prefer authenticated user ID, fall back to IP.
  // req.ip is ONLY accurate because app.set('trust proxy') is configured
  // in index.js. Without trust proxy, req.ip = load balancer IP = useless.
  return req.userId || req.ip || 'unknown'
}

// ============================================================================
// RATE LIMITERS
// ============================================================================

/**
 * Global API rate limiter — applies to ALL routes (except health check).
 * 150 req/min per IP/user. Prevents brute force / scraping.
 */
export const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 150,
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisRateLimitStore(redisConnection, 'rl:global:'),
  keyGenerator: getClientKey,
  skip: (req) => req.path === '/health',
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many requests. Please slow down.',
      retryAfter: 60,
    })
  },
})

/**
 * Simulation creation limiter — expensive: enqueues BullMQ job + DB writes.
 * 5 per minute per user. Prevents queue flooding and runaway costs.
 */
export const simulationCreateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisRateLimitStore(redisConnection, 'rl:sim:create:'),
  keyGenerator: getClientKey,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many simulation requests. Please wait a moment.',
      retryAfter: 60,
    })
  },
})

/**
 * SSE stream creation limiter — prevents connection exhaustion.
 * Each SSE connection is long-lived. 10 new streams per minute per user.
 */
export const sseLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisRateLimitStore(redisConnection, 'rl:sim:sse:'),
  keyGenerator: getClientKey,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many stream requests. Please wait.',
      retryAfter: 60,
    })
  },
})

/**
 * Report fetch limiter — DB-heavy query with joins.
 * 30 per minute per user.
 */
export const reportLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisRateLimitStore(redisConnection, 'rl:sim:report:'),
  keyGenerator: getClientKey,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many report requests. Please wait.',
      retryAfter: 60,
    })
  },
})

/**
 * Validation limiter — moderate CPU cost, traverses graph.
 * 20 per minute per user.
 */
export const validationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisRateLimitStore(redisConnection, 'rl:val:'),
  keyGenerator: getClientKey,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many validation requests. Please wait.',
      retryAfter: 60,
    })
  },
})