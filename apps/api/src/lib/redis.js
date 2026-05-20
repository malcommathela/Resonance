import Redis from 'ioredis'

export const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  retryStrategy: (times) => Math.min(times * 50, 2000),
  maxRetriesPerRequest: 3,
})

redis.on('error', (err) => {
  console.error('Redis error:', err)
})

redis.on('connect', () => {
  console.log('🔴 Redis connected')
})

// Cache helpers
export const cache = {
  async get(key) {
    const data = await redis.get(key)
    return data ? JSON.parse(data) : null
  },

  async set(key, value, ttl = 3600) {
    await redis.setex(key, ttl, JSON.stringify(value))
  },

  async del(key) {
    await redis.del(key)
  },

  async invalidatePattern(pattern) {
    const keys = await redis.keys(pattern)
    if (keys.length > 0) {
      await redis.del(...keys)
    }
  },
}