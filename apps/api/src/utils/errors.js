// ============================================================================
// ERROR TAXONOMY — Chat spec §78-79
// Structured, retryable-aware errors. The API error handler converts these
// into the canonical envelope:
//   { error: { code, message, retryable, requestId } }
// Never expose stack traces, credentials, or infrastructure details.
// ============================================================================

export const ERROR_CODES = Object.freeze({
  AUTH_ERROR: 'AUTH_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  DESIGN_NOT_FOUND: 'DESIGN_NOT_FOUND',
  DESIGN_VERSION_CONFLICT: 'DESIGN_VERSION_CONFLICT',
  CHAT_REQUEST_IN_PROGRESS: 'CHAT_REQUEST_IN_PROGRESS',
  MESSAGE_NOT_FOUND: 'MESSAGE_NOT_FOUND',
  REQUEST_NOT_FOUND: 'REQUEST_NOT_FOUND',
  GENERATION_NOT_FOUND: 'GENERATION_NOT_FOUND',
  AI_TIMEOUT: 'AI_TIMEOUT',
  AI_RATE_LIMIT: 'AI_RATE_LIMIT',
  AI_UNAVAILABLE: 'AI_UNAVAILABLE',
  AI_INVALID_OUTPUT: 'AI_INVALID_OUTPUT',
  AI_INVALID_REQUEST: 'AI_INVALID_REQUEST',
  DATABASE_UNAVAILABLE: 'DATABASE_UNAVAILABLE',
  REDIS_UNAVAILABLE: 'REDIS_UNAVAILABLE',
  NETWORK_ERROR: 'NETWORK_ERROR',
  SSE_DISCONNECTED: 'SSE_DISCONNECTED',
  GENERATION_FAILED: 'GENERATION_FAILED',
  SIMULATION_FAILED: 'SIMULATION_FAILED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
})

// Errors the client may automatically retry. Client errors (400/401/403/404)
// are never retryable — spec §49.
const RETRYABLE_CODES = new Set([
  ERROR_CODES.AI_TIMEOUT,
  ERROR_CODES.AI_RATE_LIMIT,
  ERROR_CODES.AI_UNAVAILABLE,
  ERROR_CODES.AI_INVALID_OUTPUT,
  ERROR_CODES.NETWORK_ERROR,
  ERROR_CODES.REDIS_UNAVAILABLE,
  ERROR_CODES.GENERATION_FAILED,
  ERROR_CODES.RATE_LIMITED,
])

export class AppError extends Error {
  /**
   * @param {string} code — one of ERROR_CODES
   * @param {string} message — user-safe message
   * @param {object} [opts]
   * @param {number} [opts.status] — HTTP status (defaults derived from code)
   * @param {boolean} [opts.retryable] — overrides the code default
   * @param {object} [opts.details] — extra structured context (logged, not leaked)
   * @param {Error} [opts.cause] — original error, kept server-side only
   */
  constructor(code, message, opts = {}) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.status = opts.status ?? DEFAULT_STATUS[code] ?? 500
    this.retryable = opts.retryable ?? RETRYABLE_CODES.has(code)
    this.details = opts.details
    this.cause = opts.cause
  }

  toJSON(requestId) {
    return {
      error: {
        code: this.code,
        message: this.message,
        retryable: this.retryable,
        ...(requestId ? { requestId } : {}),
      },
    }
  }
}

const DEFAULT_STATUS = {
  [ERROR_CODES.AUTH_ERROR]: 401,
  [ERROR_CODES.VALIDATION_ERROR]: 422,
  [ERROR_CODES.RATE_LIMITED]: 429,
  [ERROR_CODES.SESSION_NOT_FOUND]: 404,
  [ERROR_CODES.DESIGN_NOT_FOUND]: 404,
  [ERROR_CODES.DESIGN_VERSION_CONFLICT]: 409,
  [ERROR_CODES.CHAT_REQUEST_IN_PROGRESS]: 409,
  [ERROR_CODES.MESSAGE_NOT_FOUND]: 404,
  [ERROR_CODES.REQUEST_NOT_FOUND]: 404,
  [ERROR_CODES.GENERATION_NOT_FOUND]: 404,
  [ERROR_CODES.AI_TIMEOUT]: 504,
  [ERROR_CODES.AI_RATE_LIMIT]: 429,
  [ERROR_CODES.AI_UNAVAILABLE]: 503,
  [ERROR_CODES.AI_INVALID_OUTPUT]: 502,
  [ERROR_CODES.AI_INVALID_REQUEST]: 400,
  [ERROR_CODES.DATABASE_UNAVAILABLE]: 503,
  [ERROR_CODES.REDIS_UNAVAILABLE]: 503,
  [ERROR_CODES.NETWORK_ERROR]: 502,
  [ERROR_CODES.SSE_DISCONNECTED]: 502,
  [ERROR_CODES.GENERATION_FAILED]: 502,
  [ERROR_CODES.SIMULATION_FAILED]: 502,
  [ERROR_CODES.INTERNAL_ERROR]: 500,
}

export function isAppError(err) {
  return err instanceof AppError
}

/**
 * Coerce any thrown error into an AppError. Unknown errors become
 * INTERNAL_ERROR — the original message is never surfaced to clients.
 */
export function toAppError(err) {
  if (isAppError(err)) return err
  return new AppError(ERROR_CODES.INTERNAL_ERROR, 'Something went wrong. Please try again.', {
    cause: err,
  })
}
