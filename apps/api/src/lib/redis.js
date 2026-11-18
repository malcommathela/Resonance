import { Redis } from 'ioredis'
import { Redis as UpstashRedis } from '@upstash/redis'

// ── Helpers ─────────────────────────────────────────────────────────
function cleanHost(raw) {
  if (!raw) return 'localhost'
  // Strip https://, http://, and trailing slashes
  return raw.replace(/^https?:\/\//, '').replace(/\/$/, '')
}

function isUpstash(host) {
  return host?.includes('.upstash.io')
}

const REDIS_HOST = cleanHost(process.env.REDIS_HOST)
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10)
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined

// ── ioredis (TCP) ───────────────────────────────────────────────────
// Upstash supports the Redis protocol too, but needs TLS
const redisOptions = {
  host: REDIS_HOST,
  port: REDIS_PORT,
  password: REDIS_PASSWORD,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy: (times) => Math.min(times * 50, 2000),
  connectTimeout: 10000,
  keepAlive: 30000,
  // REQUIRED for Upstash — they enforce TLS on port 6379
  tls: isUpstash(REDIS_HOST) ? {} : undefined,
}

export const redisConnection = new Redis(redisOptions)
export const redisSubscriber = new Redis({ ...redisOptions })

// ── Upstash REST (fallback / cache layer) ───────────────────────────
const upstashRedis = new UpstashRedis({
  url: process.env.UPSTASH_REDIS_REST_URL || 'https://your-db.upstash.io',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || 'your-token',
  // SDK default is 5 retries with exponential backoff. A cache outage should
  // not stall every request for seconds before we fall back to the DB.
  retry: { retries: 1 },
})

// The cache is an optimisation, not a dependency. A failed read must fall
// through to the DB, and a failed write/invalidation must not turn an already
// committed request into a 500. Log each operation's first failure only.
const warnedCacheFailures = new Set()
function cacheFailure(operation, err) {
  if (!warnedCacheFailures.has(operation)) {
    warnedCacheFailures.add(operation)
    console.error(`[CACHE] ${operation} failed: ${err.message} (further failures suppressed)`)
  }
}

export const cache = {
  async get(key) {
    try {
      const data = await upstashRedis.get(key)
      if (data == null) return null
      if (typeof data === 'string') {
        try { return JSON.parse(data) } catch { return data }
      }
      return data
    } catch (err) {
      cacheFailure('get', err)
      return null
    }
  },

  async set(key, value, ttl = 3600) {
    try {
      await upstashRedis.set(key, JSON.stringify(value), { ex: ttl })
    } catch (err) {
      cacheFailure('set', err)
    }
  },

  async del(key) {
    try {
      await upstashRedis.del(key)
    } catch (err) {
      cacheFailure('del', err)
    }
  },

  async keys(pattern) {
    try {
      const keys = await upstashRedis.keys(pattern)
      return keys || []
    } catch (err) {
      cacheFailure('keys', err)
      return []
    }
  },

  async invalidatePattern(pattern) {
    try {
      const keys = await upstashRedis.keys(pattern)
      if (keys && keys.length > 0) {
        await upstashRedis.del(...keys)
      }
    } catch (err) {
      cacheFailure('invalidatePattern', err)
    }
  },
}

// ── Logging ─────────────────────────────────────────────────────────
let connectionErrors = 0
const MAX_LOGGED_ERRORS = 3

redisConnection.on('error', (err) => {
  connectionErrors++
  if (connectionErrors <= MAX_LOGGED_ERRORS) {
    console.error('[REDIS] Connection error:', err.message)
  }
  if (connectionErrors === MAX_LOGGED_ERRORS + 1) {
    console.error('[REDIS] Further errors suppressed to reduce log noise')
  }
})

redisConnection.on('connect', () => {
  connectionErrors = 0
  console.log('[REDIS] Connected to', REDIS_HOST)
})

redisConnection.on('reconnecting', () => {
  console.log('[REDIS] Reconnecting...')
})

redisSubscriber.on('error', (err) => {
  console.error('[REDIS] Subscriber error:', err.message)
})

// ── Health check ────────────────────────────────────────────────────
export async function checkRedisHealth() {
  try {
    const ping = await redisConnection.ping()
    return {
      ioredis: ping === 'PONG' ? 'ok' : 'degraded',
      host: REDIS_HOST,
      upstash: 'unknown',
    }
  } catch (err) {
    return { ioredis: 'error', error: err.message }
  }
}