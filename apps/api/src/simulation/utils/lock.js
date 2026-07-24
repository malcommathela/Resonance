/**
 * Distributed Locking — P5.6 Concurrent Simulation Handling
 * 
 * Prevents concurrent simulations on the same design (per-design lock).
 * Uses Redis SET NX EX pattern for atomicity.
 */

import { redisConnection } from '../../lib/redis.js'
import crypto from 'crypto'

const DEFAULT_LOCK_TTL_SECONDS = 300 // 5 minutes

/**
 * Acquire a distributed lock.
 * @param {string} key — lock key (e.g. 'design:{designId}:simulation')
 * @param {number} ttlSeconds — lock TTL
 * @returns {Promise<{token: string, release: () => Promise<void>}> | null}
 */
export async function acquireLock(key, ttlSeconds = DEFAULT_LOCK_TTL_SECONDS) {
  const token = crypto.randomUUID()
  const result = await redisConnection.set(key, token, 'NX', 'EX', ttlSeconds)

  if (result === 'OK') {
    return {
      token,
      release: async () => {
        // Lua script to ensure we only delete if token matches (prevents race)
        const script = `
          if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("del", KEYS[1])
          else
            return 0
          end
        `
        await redisConnection.eval(script, 1, key, token)
      },
    }
  }

  return null
}

/**
 * Check if a lock exists.
 */
export async function isLocked(key) {
  const exists = await redisConnection.exists(key)
  return exists === 1
}

/**
 * Extend an existing lock.
 */
export async function extendLock(key, token, additionalSeconds) {
  const script = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("expire", KEYS[1], ARGV[2])
    else
      return 0
    end
  `
  const result = await redisConnection.eval(script, 1, key, token, additionalSeconds)
  return result === 1
}

/**
 * Per-design simulation lock key.
 */
export function designLockKey(designId) {
  return `lock:design:${designId}:simulation`
}

/**
 * Per-user rate limit key.
 */
export function userRateLimitKey(userId) {
  return `ratelimit:user:${userId}:simulations`
}