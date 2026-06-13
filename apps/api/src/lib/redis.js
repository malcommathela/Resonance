import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || 'https://your-db.upstash.io',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || 'your-token',
})

export const cache = {
  async get(key) {
    const data = await redis.get(key)
    return data || null
  },

  async set(key, value, ttl = 3600) {
    await redis.set(key, JSON.stringify(value), { ex: ttl })
  },

  async del(key) {
    await redis.del(key)
  },

  async keys(pattern) {
    const keys = await redis.keys(pattern)
    return keys || []
  },

  async invalidatePattern(pattern) {
    const keys = await redis.keys(pattern)
    if (keys && keys.length > 0) {
      await redis.del(...keys)
    }
  },
}

export { redis }
