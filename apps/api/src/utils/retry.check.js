// Contract test for provider failure classification.
// Run from repo root: node --test apps/api/src/utils/retry.check.js
import assert from 'node:assert/strict'
import { isRetryableError } from './retry.js'

// Explicit statuses still win.
assert.equal(isRetryableError({ status: 429 }), true)
assert.equal(isRetryableError({ status: 500 }), true)
assert.equal(isRetryableError({ status: 404 }), false)
assert.equal(isRetryableError({ code: 'AI_INVALID_REQUEST' }), false)
assert.equal(isRetryableError({ code: 'AI_TIMEOUT' }), true)

// A three-digit status in a message is only a status when it stands alone.
// Regression: "timeout after 4000ms" was read as HTTP 400 and never retried.
assert.equal(isRetryableError({ message: 'timeout after 4000ms' }), true)
assert.equal(isRetryableError({ message: 'fetch failed after 4000ms' }), true)
assert.equal(isRetryableError({ message: 'HTTP 503 service unavailable' }), true)
assert.equal(isRetryableError({ message: 'HTTP 400 bad request' }), false)

// Non-retryable signals still take precedence over retryable ones.
assert.equal(isRetryableError({ message: 'HTTP 404 after 502 retry' }), false)
assert.equal(isRetryableError({ message: 'ERROR: safety block after timeout' }), false)

console.log('retry.check: OK')
