// ============================================================================
// CHAT ROUTES — Chat spec §28 API contract
//
//   POST   /chat/sessions                                    create session
//   GET    /chat/sessions                                    list sessions
//   GET    /chat/sessions/:id                                session detail
//   PATCH  /chat/sessions/:id                                rename / archive
//   DELETE /chat/sessions/:id                                delete (cascade)
//   POST   /chat/sessions/:id/messages                       submit + SSE
//   GET    /chat/sessions/:id/messages                       cursor pagination
//   POST   /chat/sessions/:id/messages/:messageId/retry      retry + SSE
//   GET    /chat/requests/:requestId                         request state
//   GET    /chat/requests/:requestId/stream                  SSE (recoverable)
//   POST   /chat/generate-design                             202 + generationId
//   GET    /chat/generations/:generationId                   generation state
//   POST   /chat/generations/:generationId/cancel            cancel generation
//
// Authorization: every query is scoped to the authenticated owner
// (req.dbUser.id from tenantContext). Client-provided IDs never bypass it.
// ============================================================================

import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/db.js'
import { logger } from '../lib/logger.js'
import { AppError, ERROR_CODES, toAppError } from '../utils/errors.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { chatMessageLimiter, chatGenerateLimiter, chatSseLimiter } from '../middleware/rateLimit.js'
import { submitMessage, retryMessage, synthesizeTerminalEvent, MAX_MESSAGE_CHARS } from '../chat/services/aiChat.js'
import { requireIdempotencyKey, findIdempotentRequest, resolveDuplicate } from '../chat/services/idempotency.js'
import { attachStream, writeSyntheticEvent } from '../chat/services/sseHub.js'
import { enqueueGeneration, generationQueue } from '../chat/workers/generationWorker.js'

const router = Router()

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Convert AppErrors into the canonical envelope BEFORE the SSE headers go
 * out; anything else flows to the central error handler.
 */
function responder(fn) {
  return asyncHandler(async (req, res, next) => {
    try {
      return await fn(req, res, next)
    } catch (err) {
      if (err instanceof AppError) {
        return res.status(err.status).json({ ...err.toJSON(req.requestId), requestId: req.requestId })
      }
      next(err)
    }
  })
}

function assertOwnership(row, what = 'Resource') {
  if (!row) throw new AppError(ERROR_CODES.SESSION_NOT_FOUND, `${what} not found.`)
  return row
}

const cuidish = z.string().trim().min(1).max(64)

const createSessionSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  designId: cuidish.optional(),
})

const messageSchema = z.object({
  message: z.string().min(1, 'Message cannot be empty.').max(MAX_MESSAGE_CHARS),
  useDesignSystem: z.boolean().optional().default(false),
  designId: cuidish.optional(),
})

const generateSchema = z.object({
  prompt: z.string().trim().min(1).max(MAX_MESSAGE_CHARS),
  sessionId: cuidish.optional(),
  title: z.string().trim().max(200).optional(),
})

async function getOwnedSession(req) {
  const session = await prisma.chatSession.findFirst({
    where: { id: req.params.id, userId: req.dbUser.id },
    include: { design: { select: { id: true, name: true, version: true } } },
  })
  if (!session) throw new AppError(ERROR_CODES.SESSION_NOT_FOUND, 'Conversation not found.')
  return session
}

/**
 * Attach SSE for a request: replay buffered events, then go live. If the
 * replay buffer is gone but the DB holds a terminal state (refresh after a
 * long time), synthesize the final events from persisted state (spec §72).
 */
async function streamRequest(res, request, { lastEventId } = {}) {
  const attach = await attachStream({ res, requestId: request.id, lastEventId })
  if (attach.replayedTerminal || attach.closed) return

  const synthetic = await synthesizeTerminalEvent(request)
  if (!synthetic) return // processing — live events will arrive

  if (synthetic.type === 'chunk') {
    writeSyntheticEvent(res, request.id, 'chunk', synthetic.data, (attach.lastSeq || 0) + 1)
    writeSyntheticEvent(res, request.id, 'done', {
      metadata: { messageId: request.responseId, recovered: true },
    }, (attach.lastSeq || 0) + 2)
  } else {
    writeSyntheticEvent(res, request.id, synthetic.type, synthetic.data, (attach.lastSeq || 0) + 1)
    if (synthetic.type === 'error') {
      writeSyntheticEvent(res, request.id, 'done', { metadata: { failed: true } }, (attach.lastSeq || 0) + 2)
    }
  }
  res.end()
}

// ============================================================================
// SESSIONS
// ============================================================================

router.post('/sessions', responder(async (req, res) => {
  const body = createSessionSchema.parse(req.body ?? {})

  let design = null
  if (body.designId) {
    design = await prisma.design.findUnique({
      where: { id: body.designId },
      select: { id: true, ownerId: true, teamId: true, name: true, version: true },
    })
    if (!design) throw new AppError(ERROR_CODES.DESIGN_NOT_FOUND, 'Design not found.')
    const isTeam = design.teamId
      ? !!(await prisma.teamMember.findFirst({ where: { teamId: design.teamId, userId: req.dbUser.id } }))
      : false
    if (design.ownerId !== req.dbUser.id && !isTeam) {
      throw new AppError(ERROR_CODES.AUTH_ERROR, 'Access denied.')
    }
  }

  const session = await prisma.chatSession.create({
    data: {
      userId: req.dbUser.id,
      title: body.title || 'New Chat',
      designId: design?.id ?? null,
      mode: design ? 'design' : 'general',
    },
  })

  res.status(201).json({
    id: session.id,
    title: session.title,
    status: session.status,
    mode: session.mode,
    designId: session.designId,
    design: design ? { id: design.id, name: design.name, version: design.version } : null,
    version: session.version,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  })
}))

// Cursor pagination on updatedAt — cheap and index-backed.
router.get('/sessions', responder(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '30', 10) || 30, 100)
  const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : null
  const status = ['active', 'archived'].includes(req.query.status) ? req.query.status : 'active'

  const sessions = await prisma.chatSession.findMany({
    where: { userId: req.dbUser.id, status },
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true, title: true, status: true, mode: true, designId: true,
      createdAt: true, updatedAt: true,
      design: { select: { id: true, name: true, version: true } },
      _count: { select: { messages: true } },
    },
  })

  const hasMore = sessions.length > limit
  const page = hasMore ? sessions.slice(0, limit) : sessions
  res.json({
    sessions: page,
    nextCursor: hasMore ? page[page.length - 1].id : null,
  })
}))

router.get('/sessions/:id', responder(async (req, res) => {
  const session = await getOwnedSession(req)
  res.json(session)
}))

const patchSessionSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  status: z.enum(['active', 'archived']).optional(),
})

router.patch('/sessions/:id', responder(async (req, res) => {
  const body = patchSessionSchema.parse(req.body ?? {})
  await getOwnedSession(req)
  const session = await prisma.chatSession.update({
    where: { id: req.params.id },
    data: { ...(body.title ? { title: body.title } : {}), ...(body.status ? { status: body.status } : {}) },
  })
  res.json(session)
}))

// Deletion is transactional (messages cascade via FK) and owner-scoped (§109).
router.delete('/sessions/:id', responder(async (req, res) => {
  await getOwnedSession(req)
  await prisma.$transaction([
    prisma.chatRequest.deleteMany({ where: { sessionId: req.params.id } }),
    prisma.generation.updateMany({ where: { sessionId: req.params.id }, data: { sessionId: null } }),
    prisma.chatSession.delete({ where: { id: req.params.id } }),
  ])
  res.status(204).end()
}))

// ============================================================================
// MESSAGES — submit (SSE), history (cursor pagination), retry (SSE)
// ============================================================================

router.post('/sessions/:id/messages', chatMessageLimiter, responder(async (req, res) => {
  const session = await getOwnedSession(req)
  const body = messageSchema.parse(req.body ?? {})
  const idempotencyKey = requireIdempotencyKey(req)

  // Idempotency: duplicates never create duplicate AI work (spec §30-31).
  const existing = await findIdempotentRequest(req.dbUser.id, idempotencyKey)
  if (existing) {
    const { action, request } = await resolveDuplicate(existing)
    logger.info({ action, requestId: request.id, session: session.id }, 'Idempotent message replay')
    return streamRequest(res, request, {
      lastEventId: req.get('Last-Event-ID') || req.query.lastEventId,
    })
  }

  const { request } = await submitMessage({
    session,
    user: req.dbUser,
    content: body.message,
    idempotencyKey,
    useDesignSystem: body.useDesignSystem,
    designId: body.designId,
  })

  await streamRequest(res, request)
}))

// Cursor pagination — `before` is a message id; avoid large offsets (§67).
router.get('/sessions/:id/messages', responder(async (req, res) => {
  const session = await getOwnedSession(req)
  const limit = Math.min(parseInt(req.query.limit || '50', 10) || 50, 100)
  const before = typeof req.query.before === 'string' ? req.query.before : null

  let beforeSequence = null
  if (before) {
    const anchor = await prisma.chatMessage.findUnique({
      where: { id: before },
      select: { sessionId: true, sequence: true },
    })
    if (!anchor || anchor.sessionId !== session.id) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Invalid cursor.')
    }
    beforeSequence = anchor.sequence
  }

  const messages = await prisma.chatMessage.findMany({
    where: { sessionId: session.id, ...(beforeSequence ? { sequence: { lt: beforeSequence } } : {}) },
    orderBy: { sequence: 'asc' },
    take: limit,
  })

  const hasMore = messages.length === limit
  res.json({
    messages,
    hasMore,
    nextBefore: hasMore ? messages[0].id : null,
  })
}))

router.post('/sessions/:id/messages/:messageId/retry', chatMessageLimiter, responder(async (req, res) => {
  const session = await getOwnedSession(req)
  const { request, attached } = await retryMessage({
    session,
    user: req.dbUser,
    messageId: req.params.messageId,
  })
  if (attached) {
    // Still running — attaching to it IS the correct response (spec §31).
    logger.info({ requestId: request.id }, 'Retry: request still processing — attaching')
  }
  await streamRequest(res, request, {
    lastEventId: req.get('Last-Event-ID') || req.query.lastEventId,
  })
}))

// ============================================================================
// REQUESTS — durable state + recoverable stream (spec §72-73)
// ============================================================================

async function getOwnedRequest(req) {
  const request = await prisma.chatRequest.findFirst({
    where: { id: req.params.requestId, userId: req.dbUser.id },
  })
  if (!request) throw new AppError(ERROR_CODES.REQUEST_NOT_FOUND, 'Request not found.')
  return request
}

router.get('/requests/:requestId', responder(async (req, res) => {
  const request = await getOwnedRequest(req)
  res.json({
    id: request.id,
    sessionId: request.sessionId,
    status: request.status,
    attempt: request.attempt,
    messageId: request.messageId,
    responseId: request.responseId,
    errorCode: request.errorCode,
    errorMessage: request.errorMessage,
    metadata: request.metadata,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
  })
}))

router.get('/requests/:requestId/stream', chatSseLimiter, responder(async (req, res) => {
  const request = await getOwnedRequest(req)
  await streamRequest(res, request, {
    lastEventId: req.get('Last-Event-ID') || req.query.lastEventId,
  })
}))

// ============================================================================
// GENERATIONS — explicit endpoint (spec §28, Flow B)
// ============================================================================

router.post('/generate-design', chatGenerateLimiter, responder(async (req, res) => {
  const body = generateSchema.parse(req.body ?? {})
  const idempotencyKey = requireIdempotencyKey(req)

  const existing = await findIdempotentRequest(req.dbUser.id, idempotencyKey)
  if (existing) {
    const { request } = await resolveDuplicate(existing)
    const generationId = request.metadata?.generationId
    return res.status(202).json({ requestId: request.id, generationId, sessionId: request.sessionId, duplicate: true })
  }

  // Session: use the provided one (if owned) or create a conversation.
  let session = body.sessionId
    ? await prisma.chatSession.findFirst({ where: { id: body.sessionId, userId: req.dbUser.id } })
    : null
  if (body.sessionId && !session) {
    throw new AppError(ERROR_CODES.SESSION_NOT_FOUND, 'Conversation not found.')
  }
  if (!session) {
    session = await prisma.chatSession.create({
      data: { userId: req.dbUser.id, title: body.title || body.prompt.slice(0, 60) },
    })
  }

  const { request } = await submitMessage({
    session,
    user: req.dbUser,
    content: body.prompt,
    idempotencyKey,
    useDesignSystem: true,
  })
  const generationId = (await prisma.chatRequest.findUnique({ where: { id: request.id } }))?.metadata?.generationId

  res.status(202).json({ requestId: request.id, generationId, sessionId: session.id })
}))

async function getOwnedGeneration(req) {
  const generation = await prisma.generation.findFirst({
    where: { id: req.params.generationId, userId: req.dbUser.id },
  })
  if (!generation) throw new AppError(ERROR_CODES.GENERATION_NOT_FOUND, 'Generation not found.')
  return generation
}

router.get('/generations/:generationId', responder(async (req, res) => {
  const generation = await getOwnedGeneration(req)
  res.json({
    id: generation.id,
    sessionId: generation.sessionId,
    designId: generation.designId,
    status: generation.status,
    prompt: generation.prompt,
    errorCode: generation.errorCode,
    errorMessage: generation.errorMessage,
    design: generation.metadata, // durable card payload (spec §90)
    createdAt: generation.createdAt,
    updatedAt: generation.updatedAt,
  })
}))

router.post('/generations/:generationId/cancel', responder(async (req, res) => {
  const generation = await getOwnedGeneration(req)
  if (['completed', 'failed', 'cancelled'].includes(generation.status)) {
    return res.json({ id: generation.id, status: generation.status, cancelled: false })
  }

  await prisma.generation.update({
    where: { id: generation.id },
    data: { status: 'cancelled' },
  })
  const job = await generationQueue.getJob(`gen-${generation.id}`)
  await job?.remove().catch(() => {})

  if (generation.requestKey) {
    await prisma.chatRequest
      .update({ where: { id: generation.requestKey }, data: { status: 'cancelled' } })
      .catch(() => {})
  }

  logger.info({ generationId: generation.id }, 'Generation cancelled')
  res.json({ id: generation.id, status: 'cancelled', cancelled: true })
}))

export default router
