// ============================================================================
// CACHE SERVICE — Chat spec §37-47
// Redis is an acceleration layer, never the source of truth. Every operation
// is fail-open: a Redis outage degrades performance but never availability.
//
// Key namespace (spec §38):
//   resonance:v1:chat:context:{designId}:{version}
//   resonance:v1:chat:response:{hash}
//   resonance:v1:chat:idempotency:{userId}:{key}
//   resonance:v1:chat:lock:{sessionId}
//   resonance:v1:generation:{generationId}
//   resonance:v1:sse:{requestId}
// ============================================================================

import { randomUUID } from 'node:crypto'
import { redisConnection } from '../../lib/redis.js'
import { logger } from '../../lib/logger.js'

// TTL budget (spec §39).
export const TTL = Object.freeze({
  DESIGN_CONTEXT: 300,        // 5 minutes
  AI_RESPONSE: 86_400,        // 24 hours
  IDEMPOTENCY: 86_400,        // 24 hours (DB row is the durable record)
  SESSION_LOCK: 30,           // seconds + renewal
  RATE_WINDOW: 60,
  SSE_REPLAY: 3600,           // 1 hour of recoverable events
})

// Connection/request timeout (spec §53) — Redis ops must never hang a request.
const REDIS_OP_TIMEOUT_MS = parseInt(process.env.CHAT_REDIS_TIMEOUT_MS || '500', 10)

function keys() {
  return {
    context: (designId, version) => `resonance:v1:chat:context:${designId}:${version}`,
    response: (hash) => `resonance:v1:chat:response:${hash}`,
    idempotency: (userId, key) => `resonance:v1:chat:idempotency:${userId}:${key}`,
    sessionLock: (sessionId) => `resonance:v1:chat:lock:${sessionId}`,
    contextLock: (designId, version) => `resonance:v1:chat:lock:context:${designId}:${version}`,
    sseEvents: (requestId) => `resonance:v1:sse:${requestId}`,
    sseSeq: (requestId) => `resonance:v1:sse:${requestId}:seq`,
  }
}

export const chatKeys = keys()

const warned = new Set()
function redisDown(op, err) {
  if (!warned.has(op)) {
    warned.add(op)
    logger.error({ op, err: err.message }, 'Chat cache: Redis unavailable — degraded mode')
  }
}

/** Run a Redis op under a hard timeout; fail-open to a default. */
async function redisOp(op, fallback, fn) {
  let timer
  try {
    const timeout = new Promise((resolve) => {
      timer = setTimeout(() => resolve(fallback), REDIS_OP_TIMEOUT_MS)
    })
    const result = await Promise.race([Promise.resolve().then(fn), timeout])
    return result === undefined ? fallback : result
  } catch (err) {
    redisDown(op, err)
    return fallback
  } finally {
    clearTimeout(timer)
  }
}

// ── Generic JSON get/set ─────────────────────────────────────────────────────

export async function cacheGetJson(key) {
  return redisOp(`get ${key}`, null, async () => {
    const raw = await redisConnection.get(key)
    return raw ? JSON.parse(raw) : null
  })
}

export async function cacheSetJson(key, value, ttlSeconds) {
  return redisOp(`set ${key}`, false, () =>
    redisConnection.set(key, JSON.stringify(value), 'EX', ttlSeconds)
  )
}

// ── Design context cache (spec §40-41) ──────────────────────────────────────
// Correctness comes from the version in the key, not from invalidation.

export async function getDesignContextCache(designId, version) {
  return cacheGetJson(chatKeys.context(designId, version))
}

export async function setDesignContextCache(designId, version, context) {
  return cacheSetJson(chatKeys.context(designId, version), context, TTL.DESIGN_CONTEXT)
}

// ── AI response cache (spec §42) ────────────────────────────────────────────

export async function getResponseCache(hash) {
  return cacheGetJson(chatKeys.response(hash))
}

export async function setResponseCache(hash, payload) {
  return cacheSetJson(chatKeys.response(hash), payload, TTL.AI_RESPONSE)
}

// ── Idempotency acceleration (spec §30-31) ──────────────────────────────────
// DB is the source of truth; this mapping only saves a query.

export async function getIdempotencyPointer(userId, key) {
  return redisOp('idem get', null, () => redisConnection.get(chatKeys.idempotency(userId, key)))
}

export async function setIdempotencyPointer(userId, key, requestId) {
  return redisOp('idem set', false, () =>
    redisConnection.set(chatKeys.idempotency(userId, key), requestId, 'EX', TTL.IDEMPOTENCY)
  )
}

// ── Distributed locks (spec §45-46) ─────────────────────────────────────────
// SET NX EX with an ownership token; release and renew verify ownership
// atomically via Lua so an expired lock can never delete a new owner's lock.

const RELEASE_LOCK_LUA = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end`

const RENEW_LOCK_LUA = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("expire", KEYS[1], ARGV[2])
else
  return 0
end`

/**
 * Acquire a lock. Returns null when the lock is held by someone else, or when
 * Redis is unavailable (callers must then fall back to DB-based coordination).
 */
export async function acquireLock(key, ttlSeconds = TTL.SESSION_LOCK) {
  return redisOp(`lock ${key}`, null, () => {
    const token = randomUUID()
    return redisConnection
      .set(key, token, 'NX', 'EX', ttlSeconds)
      .then((result) => (result === 'OK' ? { key, token, ttlSeconds } : null))
  })
}

export async function releaseLock(lock) {
  if (!lock) return
  return redisOp(`unlock ${lock.key}`, 0, () =>
    redisConnection.eval(RELEASE_LOCK_LUA, 1, lock.key, lock.token)
  )
}

export async function renewLock(lock) {
  if (!lock) return false
  return redisOp(`renew ${lock.key}`, false, () =>
    redisConnection
      .eval(RENEW_LOCK_LUA, 1, lock.key, lock.token, lock.ttlSeconds)
      .then((r) => Number(r) === 1)
  )
}

/**
 * Start periodic lock renewal (spec §46). Returns a stop() function.
 * If a renewal fails, onLost is invoked — the caller must not continue
 * unsafe operations after losing ownership.
 */
export function startLockRenewal(lock, { intervalMs = 15_000, onLost } = {}) {
  const timer = setInterval(async () => {
    const ok = await renewLock(lock)
    if (!ok) {
      stop()
      onLost?.()
    }
  }, intervalMs)
  timer.unref?.()
  function stop() {
    clearInterval(timer)
  }
  return stop
}
