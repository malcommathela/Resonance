// ============================================================================
// CIRCUIT BREAKER — Chat spec §52
// Prevents cascading failures against external AI providers.
//
//   CLOSED -> repeated failures -> OPEN -> cooldown -> HALF-OPEN
//   HALF-OPEN -> successful probe -> CLOSED
//   HALF-OPEN -> failed probe -> OPEN
//
// When OPEN, calls fail fast with a controlled retryable error instead of
// hammering a degraded provider. Per-process state is intentional: breakers
// protect the calls made by this instance.
// ============================================================================

import { AppError, ERROR_CODES } from './errors.js'
import { logger } from '../lib/logger.js'

export const STATE = Object.freeze({
  CLOSED: 'CLOSED',
  OPEN: 'OPEN',
  HALF_OPEN: 'HALF_OPEN',
})

const breakers = new Map()

/**
 * Get (or lazily create) a named breaker.
 * @param {string} name — e.g. 'gemini'
 * @param {object} opts
 * @param {number} [opts.failureThreshold=5] — consecutive failures before OPEN
 * @param {number} [opts.cooldownMs=30000] — OPEN -> HALF-OPEN cooldown
 */
export function getBreaker(name, { failureThreshold = 5, cooldownMs = 30_000 } = {}) {
  if (!breakers.has(name)) {
    breakers.set(name, {
      name,
      state: STATE.CLOSED,
      failures: 0,
      openedAt: 0,
      failureThreshold,
      cooldownMs,
    })
  }
  return breakers.get(name)
}

function transition(breaker, state) {
  if (breaker.state === state) return
  breaker.state = state
  if (state === STATE.OPEN) {
    breaker.openedAt = Date.now()
    logger.warn({ breaker: breaker.name, failures: breaker.failures }, 'Circuit breaker OPEN')
  } else if (state === STATE.HALF_OPEN) {
    logger.info({ breaker: breaker.name }, 'Circuit breaker HALF-OPEN — probing')
  } else if (state === STATE.CLOSED) {
    breaker.failures = 0
    logger.info({ breaker: breaker.name }, 'Circuit breaker CLOSED')
  }
}

/**
 * Wrap an async provider call with breaker semantics.
 * While OPEN, throws AI_UNAVAILABLE (retryable) without calling the provider.
 */
export async function withCircuitBreaker(name, fn, opts = {}) {
  const breaker = getBreaker(name, opts)

  if (breaker.state === STATE.OPEN) {
    const elapsed = Date.now() - breaker.openedAt
    if (elapsed >= breaker.cooldownMs) {
      transition(breaker, STATE.HALF_OPEN)
    } else {
      throw new AppError(ERROR_CODES.AI_UNAVAILABLE, 'Resonance AI is temporarily unavailable. Please retry shortly.', {
        details: { breaker: name, retryInMs: breaker.cooldownMs - elapsed },
      })
    }
  }

  try {
    const result = await fn()
    if (breaker.state === STATE.HALF_OPEN) {
      transition(breaker, STATE.CLOSED)
    } else {
      breaker.failures = 0
    }
    return result
  } catch (err) {
    if (breaker.state === STATE.HALF_OPEN) {
      transition(breaker, STATE.OPEN)
    } else {
      breaker.failures += 1
      if (breaker.failures >= breaker.failureThreshold) {
        transition(breaker, STATE.OPEN)
      }
    }
    throw err
  }
}

/** Exposed for health checks / metrics (spec §95). */
export function breakerStatus() {
  return Object.fromEntries(
    [...breakers.entries()].map(([name, b]) => [
      name,
      { state: b.state, failures: b.failures },
    ])
  )
}
