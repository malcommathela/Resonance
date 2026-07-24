import { Redis } from 'ioredis'
import { Redis as UpstashRedis } from '@upstash/redis'

const redisOptions = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy: (times) => Math.min(times * 50, 2000),
  connectTimeout: 10000,
  keepAlive: 30000,
}

export const redisConnection = new Redis(redisOptions)
export const redisSubscriber = new Redis({ ...redisOptions })

const upstashRedis = new UpstashRedis({
  url: process.env.UPSTASH_REDIS_REST_URL || 'https://your-db.upstash.io',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || 'your-token',
})

export const cache = {
  async get(key) {
    const data = await upstashRedis.get(key)
    if (data == null) return null
    // FIX: parse JSON strings back into objects
    if (typeof data === 'string') {
      try { return JSON.parse(data) } catch { return data }
    }
    return data
  },

  async set(key, value, ttl = 3600) {
    await upstashRedis.set(key, JSON.stringify(value), { ex: ttl })
  },

  async del(key) {
    await upstashRedis.del(key)
  },

  async keys(pattern) {
    const keys = await upstashRedis.keys(pattern)
    return keys || []
  },

  async invalidatePattern(pattern) {
    const keys = await upstashRedis.keys(pattern)
    if (keys && keys.length > 0) {
      await upstashRedis.del(...keys)
    }
  },
}

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
  console.log('[REDIS] Connected')
})

redisConnection.on('reconnecting', () => {
  console.log('[REDIS] Reconnecting...')
})

redisSubscriber.on('error', (err) => {
  console.error('[REDIS] Subscriber error:', err.message)
})

export async function checkRedisHealth() {
  try {
    const ping = await redisConnection.ping()
    return { ioredis: ping === 'PONG' ? 'ok' : 'degraded', upstash: 'unknown' }
  } catch (err) {
    return { ioredis: 'error', error: err.message }
  }
}