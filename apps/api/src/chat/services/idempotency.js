// ============================================================================
// IDEMPOTENCY — Chat spec §30-31, §51
// PostgreSQL is the source of truth (unique (userId, idempotencyKey) on
// chat_requests); Redis only accelerates the lookup.
//
// Duplicate-key semantics:
//   completed  -> return the stored result
//   processing -> return the existing request so the client attaches to it
//   failed     -> reset the SAME request row to processing (attempt + 1) and
//                 redo the work — retries must be able to make progress, but
//                 never create duplicate user-visible messages.
// ============================================================================

import { prisma } from '../../lib/db.js'
import { logger } from '../../lib/logger.js'
import { AppError, ERROR_CODES } from '../../utils/errors.js'
import { getIdempotencyPointer, setIdempotencyPointer } from './cacheService.js'

/**
 * Look up an existing request by idempotency key.
 * @returns {Promise<object|null>} ChatRequest or null
 */
export async function findIdempotentRequest(userId, idempotencyKey) {
  // Fast path: Redis pointer (best-effort).
  const pointer = await getIdempotencyPointer(userId, idempotencyKey)
  if (pointer) {
    const byPointer = await prisma.chatRequest
      .findUnique({ where: { id: pointer } })
      .catch(() => null)
    if (byPointer && byPointer.idempotencyKey === idempotencyKey && byPointer.userId === userId) {
      return byPointer
    }
  }

  // Source of truth.
  return prisma.chatRequest.findUnique({
    where: { userId_idempotencyKey: { userId, idempotencyKey } },
  })
}

/**
 * Resolve a duplicate idempotency key according to its current state.
 * @returns {Promise<{ action: 'replay'|'attach'|'reattach', request: object }>}
 */
export async function resolveDuplicate(request) {
  if (request.status === 'completed') {
    return { action: 'replay', request }
  }

  if (request.status === 'processing') {
    // If the row is ancient, the server that owned it died (spec §74/§125) —
    // reclaim it instead of attaching forever.
    const staleMs = Date.now() - new Date(request.updatedAt).getTime()
    if (staleMs < STALE_REQUEST_MS) {
      return { action: 'attach', request }
    }
    const reclaimed = await prisma.chatRequest.update({
      where: { id: request.id },
      data: {
        status: 'failed',
        errorCode: ERROR_CODES.AI_TIMEOUT,
        errorMessage: 'The request was interrupted and can be retried.',
      },
    })
    return { action: 'replay-failed', request: reclaimed }
  }

  // failed / cancelled -> new attempt on the same row.
  const reopened = await prisma.chatRequest.update({
    where: { id: request.id },
    data: {
      status: 'processing',
      attempt: { increment: 1 },
      errorCode: null,
      errorMessage: null,
      metadata: { ...(request.metadata || {}) },
    },
  })
  logger.info(
    { requestId: reopened.id, attempt: reopened.attempt },
    'Idempotent retry: reopening failed request'
  )
  return { action: 'reattach', request: reopened }
}

/** Stale threshold for processing rows with no heartbeat (15 min). */
export const STALE_REQUEST_MS = 15 * 60 * 1000

/**
 * Create the durable request row and register the Redis pointer.
 */
export async function createRequest({ userId, sessionId, idempotencyKey, messageId, metadata }) {
  const request = await prisma.chatRequest.create({
    data: {
      idempotencyKey,
      userId,
      sessionId,
      status: 'processing',
      messageId,
      metadata: metadata || undefined,
    },
  })
  await setIdempotencyPointer(userId, idempotencyKey, request.id)
  return request
}

/**
 * Terminal state transitions. Every failed operation must end in a known
 * state — never "processing forever" (spec §125).
 */
export async function markCompleted(requestId, responseId) {
  return prisma.chatRequest.update({
    where: { id: requestId },
    data: { status: 'completed', responseId },
  })
}

export async function markFailed(requestId, errorCode, errorMessage) {
  return prisma.chatRequest
    .update({
      where: { id: requestId },
      data: { status: 'failed', errorCode, errorMessage },
    })
    .catch((err) => {
      logger.error({ err: err.message, requestId }, 'Failed to mark request failed')
      return null
    })
}

export async function markCancelled(requestId) {
  return prisma.chatRequest
    .update({ where: { id: requestId }, data: { status: 'cancelled' } })
    .catch(() => null)
}

/**
 * Assert a valid, present idempotency key (spec §29).
 */
export function requireIdempotencyKey(req) {
  const key = req.get('X-Idempotency-Key')
  if (!key || typeof key !== 'string' || key.length < 8 || key.length > 128) {
    throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'A valid X-Idempotency-Key header (8-128 characters) is required.')
  }
  return key
}
