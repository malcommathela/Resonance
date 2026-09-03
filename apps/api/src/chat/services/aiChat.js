// ============================================================================
// AI CHAT ORCHESTRATOR — Chat spec §29, §53, §63-66, §72-73, §111, §153
// Runs the durable AI operation pipeline:
//
//   persist user message -> create request state -> acquire session lock
//     -> build (versioned, cached) context -> response cache -> Gemini stream
//     -> SSE events -> persist final response -> mark completed -> release
//
// The operation is fully decoupled from any SSE connection: if the browser
// disappears mid-stream the operation continues and the final response is
// persisted (spec §35, §73).
// ============================================================================

import { prisma } from '../../lib/db.js'
import { logger } from '../../lib/logger.js'
import { AppError, ERROR_CODES, toAppError } from '../../utils/errors.js'
import { acquireLock, releaseLock, startLockRenewal, getResponseCache, setResponseCache, chatKeys } from './cacheService.js'
import { markCompleted, markFailed, createRequest } from './idempotency.js'
import { buildChatContext, loadRecentHistory, responseCacheHash } from './chatContext.js'
import { streamChat, MODEL_INFO, AI_PROVIDER_CONFIG } from './aiProvider.js'
import { publish } from './sseHub.js'
import { deriveSessionTitle, detectIntent, PROMPT_VERSIONS } from '../prompts.js'
import { enqueueGeneration } from '../workers/generationWorker.js'

export const MAX_MESSAGE_CHARS = 8000

// ────────────────────────────────────────────────────────────────────────────
// MESSAGE SEQUENCE — deterministic ordering (spec §64)
// (sessionId, sequence) has a DB unique constraint; we allocate max+1 and
// retry the create on the rare race.
// ────────────────────────────────────────────────────────────────────────────

async function createMessageWithSequence(tx, data, tries = 3) {
  for (let attempt = 1; ; attempt++) {
    const agg = await tx.chatMessage.aggregate({
      where: { sessionId: data.sessionId },
      _max: { sequence: true },
    })
    try {
      return await tx.chatMessage.create({
        data: { ...data, sequence: (agg._max.sequence ?? 0) + 1 },
      })
    } catch (err) {
      if (err?.code === 'P2002' && attempt < tries) continue
      throw err
    }
  }
}

// ────────────────────────────────────────────────────────────────────────────
// SUBMIT MESSAGE (spec §29 pipeline)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Persist the user message and start the AI operation.
 * Returns { request, userMessage } — the caller attaches SSE to request.id.
 * This function never waits on the AI.
 */
export async function submitMessage({ session, user, content, idempotencyKey, useDesignSystem = false, designId = null }) {
  const trimmed = String(content ?? '').trim()
  if (!trimmed) {
    throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Message cannot be empty.')
  }
  if (trimmed.length > MAX_MESSAGE_CHARS) {
    throw new AppError(ERROR_CODES.VALIDATION_ERROR, `Message exceeds the ${MAX_MESSAGE_CHARS} character limit.`)
  }

  // Design context switch mid-session (Flow C): verify access before attach.
  let effectiveDesignId = session.designId
  if (designId && designId !== session.designId) {
    const design = await prisma.design.findUnique({
      where: { id: designId },
      select: { id: true, ownerId: true, teamId: true },
    })
    if (!design) throw new AppError(ERROR_CODES.DESIGN_NOT_FOUND, 'Design not found.')
    const isOwner = design.ownerId === user.id
    const isTeam = design.teamId
      ? !!(await prisma.teamMember.findFirst({ where: { teamId: design.teamId, userId: user.id } }))
      : false
    if (!isOwner && !isTeam) throw new AppError(ERROR_CODES.AUTH_ERROR, 'Access denied.')
    effectiveDesignId = designId
  }

  // Session concurrency — one active AI request per session (spec §66).
  const lock = await acquireLock(chatKeys.sessionLock(session.id))
  const active = await prisma.chatRequest.findFirst({
    where: { sessionId: session.id, status: 'processing', updatedAt: { gte: new Date(Date.now() - 15 * 60 * 1000) } },
    select: { id: true },
  })
  if (active) {
    await releaseLock(lock)
    throw new AppError(ERROR_CODES.CHAT_REQUEST_IN_PROGRESS, 'This conversation already has a request in progress.')
  }

  try {
    const intent = detectIntent(trimmed)

    // 1. Persist user message + title (spec §111 — title never blocks AI).
    const userMessage = await prisma.$transaction(async (tx) => {
      const msg = await createMessageWithSequence(tx, {
        sessionId: session.id,
        role: 'user',
        content: trimmed,
        type: 'text',
        status: 'completed',
        idempotencyKey,
      })
      if (session.title === 'New Chat') {
        await tx.chatSession.update({
          where: { id: session.id },
          data: { title: deriveSessionTitle(trimmed) },
        })
      }
      return msg
    })

    // 2. Durable request state.
    const request = await createRequest({
      userId: user.id,
      sessionId: session.id,
      idempotencyKey,
      messageId: userMessage.id,
      metadata: { intent, useDesignSystem },
    })

    if (intent === 'generation') {
      await startGeneration({ session, user, request, userMessage })
      // The generation worker owns progress from here; the 30s session lock
      // TTL is irrelevant. Release immediately so status polling isn't delayed.
      await releaseLock(lock)
    } else {
      await prisma.chatRequest.update({
        where: { id: request.id },
        data: { metadata: { intent: 'chat', useDesignSystem, designId: effectiveDesignId } },
      })
      // Fire-and-forget: the operation continues even if the caller crashes.
      runTextChat({
        request,
        session: { ...session, designId: effectiveDesignId },
        userMessage,
        useDesignSystem,
        lock,
      }).catch((err) => logger.error({ err: err.message, requestId: request.id }, 'runTextChat crashed'))
    }

    return { request, userMessage }
  } catch (err) {
    await releaseLock(lock)
    throw err
  }
}

// ────────────────────────────────────────────────────────────────────────────
// TEXT CHAT OPERATION
// ────────────────────────────────────────────────────────────────────────────

async function runTextChat({ request, session, userMessage, useDesignSystem, lock }) {
  const startedAt = Date.now()
  let renewStop = null
  if (lock) {
    renewStop = startLockRenewal(lock, {
      onLost: () => logger.warn({ requestId: request.id }, 'Session lock lost mid-request'),
    })
  }

  let usage = { promptTokens: 0, completionTokens: 0 }
  let designVersion = null

  try {
    await publish(request.id, 'status', { stage: 'thinking', label: 'Thinking…' })

    // Context (versioned + cached; degrades gracefully, spec §68/§70).
    const history = await loadRecentHistory(session.id)
    const context = await buildChatContext({ session, history, userMessage: userMessage.content, designSystemEnabled: useDesignSystem })
    designVersion = context.versions.designVersion

    // Response cache (spec §42-43) — hash is version-aware.
    const cacheHash = responseCacheHash({
      model: MODEL_INFO.model,
      userMessage: userMessage.content,
      session,
      versions: context.versions,
      designSystemEnabled: useDesignSystem,
    })
    const cached = await getResponseCache(cacheHash)
    let assistantContent

    if (cached?.content) {
      assistantContent = cached.content
      for (let i = 0; i < assistantContent.length; i += 256) {
        await publish(request.id, 'chunk', { content: assistantContent.slice(i, i + 256) })
      }
    } else {
      // Live stream — buffer in memory, single durable write at the end (§36).
      const buffer = []
      let ttfbLogged = false
      try {
        for await (const chunk of streamChat({
          systemInstruction: context.systemInstruction,
          history,
          userMessage: userMessage.content,
          onUsage: (u) => {
            usage.promptTokens = u.promptTokens
            usage.completionTokens += u.completionTokens
          },
        })) {
          if (!ttfbLogged) {
            ttfbLogged = true
            logger.info({ requestId: request.id, ttfbMs: Date.now() - startedAt }, 'Chat TTFT')
          }
          buffer.push(chunk)
          await publish(request.id, 'chunk', { content: chunk })
        }
      } catch (err) {
        const appErr = toAppError(err)
        await markFailed(request.id, appErr.code, appErr.message)
        await publish(request.id, 'error', {
          code: appErr.code,
          message: userSafeMessage(appErr),
          retryable: appErr.retryable,
        })
        return // finally releases the lock
      }
      assistantContent = buffer.join('')

      if (!assistantContent.trim()) {
        const appErr = new AppError(ERROR_CODES.AI_INVALID_OUTPUT, 'The AI returned an empty response.')
        await markFailed(request.id, appErr.code, appErr.message)
        await publish(request.id, 'error', { code: appErr.code, message: userSafeMessage(appErr), retryable: appErr.retryable })
        return
      }

      await setResponseCache(cacheHash, {
        content: assistantContent,
        model: MODEL_INFO.model,
        promptVersion: PROMPT_VERSIONS.systemPersona,
      })
    }

    // Durable write (spec §36) — assistant message + request completed.
    const assistantMessage = await prisma.$transaction(async (tx) => {
      const msg = await createMessageWithSequence(tx, {
        sessionId: session.id,
        role: 'assistant',
        content: assistantContent,
        type: 'text',
        status: 'completed',
        requestId: request.id,
        metadata: {
          model: MODEL_INFO.model,
          modelVersion: MODEL_INFO.modelVersion,
          promptVersion: PROMPT_VERSIONS.systemPersona,
          tokensUsed: usage.promptTokens + usage.completionTokens,
          latencyMs: Date.now() - startedAt,
          designVersion,
          contextCacheHit: context.contextCacheHit,
          responseCacheHit: !!cached?.content,
          requestId: request.id,
        },
      })
      await tx.chatSession.update({
        where: { id: session.id },
        data: { version: { increment: 1 } },
      })
      return msg
    })

    await markCompleted(request.id, assistantMessage.id)
    await publish(request.id, 'done', {
      metadata: {
        messageId: assistantMessage.id,
        latencyMs: Date.now() - startedAt,
        cacheHit: !!cached?.content,
        designVersion,
      },
    })

    logger.info(
      {
        request: request.id,
        session: session.id,
        user: request.userId,
        design: session.designId,
        designVersion,
        aiTotalMs: Date.now() - startedAt,
        retries: 0,
        cacheHit: !!cached?.content,
        status: 'completed',
      },
      'Chat request completed'
    )
  } catch (err) {
    const appErr = toAppError(err)
    logger.error({ err: appErr.message, requestId: request.id }, 'Chat request failed')
    await markFailed(request.id, appErr.code, appErr.message)
    await publish(request.id, 'error', {
      code: appErr.code,
      message: userSafeMessage(appErr),
      retryable: appErr.retryable,
    })
  } finally {
    renewStop?.()
    await releaseLock(lock)
  }
}

function userSafeMessage(appErr) {
  return appErr.retryable
    ? `${appErr.message} Your message is safe — you can retry.`
    : appErr.message
}

// ────────────────────────────────────────────────────────────────────────────
// GENERATION INTENT (Flow B) — durable job + 202-style async processing
// ────────────────────────────────────────────────────────────────────────────

async function startGeneration({ session, user, request, userMessage }) {
  const generation = await prisma.generation.create({
    data: {
      userId: user.id,
      sessionId: session.id,
      prompt: userMessage.content,
      status: 'queued',
      requestKey: request.id,
    },
  })
  await prisma.chatRequest.update({
    where: { id: request.id },
    data: { metadata: { intent: 'generation', generationId: generation.id } },
  })
  await publish(request.id, 'status', {
    stage: 'queued',
    label: 'Analyzing requirements…',
    generationId: generation.id,
  })

  // BullMQ commands offline-queue forever while Redis is disconnected —
  // bound the enqueue and fail the job cleanly instead of hanging.
  try {
    const enqueued = await Promise.race([
      enqueueGeneration({ generationId: generation.id }),
      new Promise((resolve, reject) => setTimeout(() => reject(new Error('Queue unavailable')), 3000)),
    ])
    logger.info(
      { request: request.id, generation: generation.id, jobId: enqueued?.id },
      'Generation job enqueued'
    )
  } catch (err) {
    logger.error({ err: err.message, generationId: generation.id }, 'Generation enqueue failed')
    await prisma.generation
      .update({
        where: { id: generation.id },
        data: {
          status: 'failed',
          errorCode: ERROR_CODES.GENERATION_FAILED,
          errorMessage: 'Could not queue the generation job. Please retry.',
        },
      })
      .catch(() => {})
    await markFailed(request.id, ERROR_CODES.GENERATION_FAILED, 'Could not queue the generation job. Please retry.')
    throw new AppError(ERROR_CODES.GENERATION_FAILED, 'Could not queue the generation job. Please retry.')
  }
}

// ────────────────────────────────────────────────────────────────────────────
// RETRY (spec §80) — new attempt, same user message, no duplicates
// ────────────────────────────────────────────────────────────────────────────

export async function retryMessage({ session, user, messageId }) {
  const message = await prisma.chatMessage.findUnique({ where: { id: messageId } })
  if (!message || message.sessionId !== session.id) {
    throw new AppError(ERROR_CODES.MESSAGE_NOT_FOUND, 'Message not found.')
  }
  if (message.role !== 'user') {
    throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Only user messages can be retried.')
  }

  // Most recent request tied to this message.
  const lastRequest = message.requestId
    ? await prisma.chatRequest.findUnique({ where: { id: message.requestId } })
    : await prisma.chatRequest.findFirst({
        where: { messageId: message.id },
        orderBy: { createdAt: 'desc' },
      })

  if (lastRequest && lastRequest.status === 'processing') {
    // Still running — nothing to retry; client should attach instead.
    return { request: lastRequest, attached: true }
  }

  const attempt = (lastRequest?.attempt ?? 0) + 1
  const lock = await acquireLock(chatKeys.sessionLock(session.id))
  const active = await prisma.chatRequest.findFirst({
    where: { sessionId: session.id, status: 'processing', updatedAt: { gte: new Date(Date.now() - 15 * 60 * 1000) } },
    select: { id: true },
  })
  if (active) {
    await releaseLock(lock)
    throw new AppError(ERROR_CODES.CHAT_REQUEST_IN_PROGRESS, 'This conversation already has a request in progress.')
  }

  try {
    const request = await prisma.chatRequest.create({
      data: {
        idempotencyKey: `${lastRequest?.idempotencyKey ?? message.idempotencyKey ?? message.id}:retry${attempt}`,
        userId: user.id,
        sessionId: session.id,
        status: 'processing',
        messageId: message.id,
        attempt,
        metadata: { ...(lastRequest?.metadata || {}), retriedFrom: lastRequest?.id ?? null },
      },
    })

    const meta = request.metadata || {}
    if (meta.intent === 'generation') {
      await startGeneration({ session, user, request, userMessage: message })
      await releaseLock(lock)
    } else {
      runTextChat({
        request,
        session,
        userMessage: message,
        useDesignSystem: !!meta.useDesignSystem,
        lock,
      }).catch((err) => logger.error({ err: err.message, requestId: request.id }, 'retry runTextChat crashed'))
    }

    return { request, attached: false }
  } catch (err) {
    await releaseLock(lock)
    throw err
  }
}

// ────────────────────────────────────────────────────────────────────────────
// REQUEST STATE STREAMING (spec §72-73) — refresh / reconnect recovery
// ────────────────────────────────────────────────────────────────────────────

/**
 * Decide the terminal synthesis for a request whose replay buffer is missing
 * (Redis TTL expired or Redis unavailable). The DB is the source of truth.
 * Returns { type, data } | null.
 */
export async function synthesizeTerminalEvent(request) {
  if (request.status === 'completed' && request.responseId) {
    const response = await prisma.chatMessage.findUnique({ where: { id: request.responseId } })
    if (response) {
      return { type: 'chunk', data: { content: response.content } }
    }
    return { type: 'done', data: { metadata: { recovered: true } } }
  }
  if (request.status === 'failed') {
    return {
      type: 'error',
      data: {
        code: request.errorCode || ERROR_CODES.INTERNAL_ERROR,
        message: request.errorMessage || 'The request failed. You can retry.',
        retryable: true,
      },
    }
  }
  if (request.status === 'cancelled') {
    return { type: 'error', data: { code: 'CANCELLED', message: 'The request was cancelled.', retryable: false } }
  }
  return null
}
