// ============================================================================
// RETRY — Chat spec §48-51
// Failures are classified before retrying. Client errors are never retried;
// transient network/provider failures are retried with exponential backoff
// and full jitter. All retries are bounded.
// ============================================================================

import { AppError, ERROR_CODES } from './errors.js'

// Transient failures — safe to retry (spec §49).
const RETRYABLE_PATTERNS = [
  'ETIMEDOUT',
  'ECONNRESET',
  'ECONNREFUSED',
  'EAI_AGAIN',
  'ENOTFOUND',
  'ECONNABORTED',
  'socket hang up',
  '502',
  '503',
  '504',
  '429',
  'RESOURCE_EXHAUSTED',
  'UNAVAILABLE',
  'overloaded',
  'timeout',
  'fetch failed',
]

// Client errors — do not blindly retry (spec §49).
const NON_RETRYABLE_PATTERNS = [
  '400',
  '401',
  '403',
  '404',
  '422',
  'INVALID_ARGUMENT',
  'PERMISSION_DENIED',
  'NOT_FOUND',
  'FAILED_PRECONDITION',
  'SAFETY',
  'RECITATION',
]

/**
 * Classify a network/provider failure as retryable or not.
 */
export function isRetryableError(err) {
  if (!err) return false
  if (err.code === 'AI_RATE_LIMIT' || err.code === 'AI_TIMEOUT') return true
  if (err.code === 'AI_INVALID_REQUEST') return false

  const status = err.status ?? err.httpStatus
  if (status) {
    if ([429, 500, 502, 503, 504].includes(Number(status))) return true
    if ([400, 401, 403, 404, 422].includes(Number(status))) return false
  }

  const msg = String(err.message || '')
  // Non-retryable patterns take precedence — a message like "HTTP 404 after
  // 502 retry" must not slip through on the retryable match.
  if (NON_RETRYABLE_PATTERNS.some((p) => msg.includes(p))) return false
  return RETRYABLE_PATTERNS.some((p) => msg.toLowerCase().includes(p.toLowerCase()))
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Exponential backoff with jitter (spec §50):
 *   delay = min(maxDelay, base * 2^attempt) + random jitter
 */
export function backoffDelay(attempt, { base = 250, max = 4000 } = {}) {
  const exp = Math.min(max, base * 2 ** attempt)
  return Math.round(exp / 2 + Math.random() * (exp / 2))
}

/**
 * Run an async operation with bounded, classified retries.
 * @param {Function} fn — async operation
 * @param {object} opts
 * @param {number} [opts.retries=2]
 * @param {Function} [opts.onRetry] — (err, attempt, delayMs) => void
 * @param {Function} [opts.isRetryable] — override classifier
 */
export async function withRetry(fn, { retries = 2, base = 250, max = 4000, onRetry, isRetryable = isRetryableError } = {}) {
  let lastErr
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn(attempt)
    } catch (err) {
      lastErr = err
      if (attempt === retries || !isRetryable(err)) throw err
      const delay = backoffDelay(attempt, { base, max })
      onRetry?.(err, attempt + 1, delay)
      await sleep(delay)
    }
  }
  throw lastErr
}

/**
 * Race a promise against a hard timeout. On timeout, rejects with an
 * AI_TIMEOUT AppError (retryable) — spec §53 timeout budget.
 */
export function withTimeout(promise, ms, code = ERROR_CODES.AI_TIMEOUT, message = 'The operation timed out.') {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new AppError(code, message, { details: { timeoutMs: ms } })), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}
