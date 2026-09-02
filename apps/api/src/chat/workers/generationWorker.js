// ============================================================================
// GENERATION WORKER — Chat spec §54, §58-60, §74-75, §154
// Durable design-generation jobs. Flow:
//
//   queued -> running -> validating -> saving -> completed
//
// The worker survives browser disconnects entirely: the design is created in
// a DB transaction together with the generation card message, and SSE events
// are published through the hub so reconnecting clients still see the result.
//
// Recovery (spec §74-75): workers heartbeat via updatedAt; a recovery sweep
// fails or re-queues jobs that stopped making progress (server restart,
// worker crash) so nothing stays stuck forever.
// ============================================================================

import { Queue, Worker } from 'bullmq'
import { redisConnection } from '../../lib/redis.js'
import { prisma } from '../../lib/db.js'
import { logger } from '../../lib/logger.js'
import { publish } from '../services/sseHub.js'
import { generateJson } from '../services/aiProvider.js'
import { validateGeneratedDesign } from '../services/designValidator.js'
import { DESIGN_GENERATION_INSTRUCTION, SYSTEM_PERSONA } from '../prompts.js'
import { ERROR_CODES } from '../../utils/errors.js'
import { markFailed } from '../services/idempotency.js'

export const generationQueue = new Queue('generation', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 1, // retries are explicit (user retry), not automatic — AI work isn't free
    removeOnComplete: { count: 500, age: 24 * 3600 },
    removeOnFail: { count: 500, age: 7 * 24 * 3600 },
  },
})

export async function enqueueGeneration({ generationId }) {
  return generationQueue.add(
    'generate-design',
    { generationId },
    { jobId: `gen-${generationId}`, priority: 5 }
  )
}

// Heartbeat cadence (spec §75) — a job older than STALE_THRESHOLD_MS without
// progress is considered abandoned.
const HEARTBEAT_MS = 15_000
export const STALE_THRESHOLD_MS = 10 * 60 * 1000

// ────────────────────────────────────────────────────────────────────────────
// PROCESSOR
// ────────────────────────────────────────────────────────────────────────────

export async function runGenerationProcessor(job) {
  const { generationId } = job.data
  const generation = await prisma.generation.findUnique({ where: { id: generationId } })
  if (!generation) {
    logger.warn({ generationId }, 'Generation job: row missing — skipping')
    return { skipped: true }
  }
  if (['completed', 'cancelled'].includes(generation.status)) {
    return { skipped: true, status: generation.status } // idempotent re-delivery
  }

  // Heartbeat loop — cleared when the processor finishes either way.
  const heartbeat = setInterval(() => {
    prisma.generation
      .update({ where: { id: generationId }, data: { updatedAt: new Date() } })
      .catch(() => {})
  }, HEARTBEAT_MS)
  heartbeat.unref?.()

  const startedAt = Date.now()
  const requestId = generation.requestKey
  const emit = (type, data) => (requestId ? publish(requestId, type, data) : Promise.resolve())

  try {
    // ── RUNNING ──
    await prisma.generation.update({ where: { id: generationId }, data: { status: 'running' } })
    await emit('status', { stage: 'running', label: 'Designing topology…', generationId })

    const session = generation.sessionId
      ? await prisma.chatSession.findUnique({ where: { id: generation.sessionId }, select: { designId: true } })
      : null
    const linkedDesign = session?.designId
      ? await prisma.design.findUnique({ where: { id: session.designId }, select: { id: true, version: true, name: true } })
      : null

    const prompt = [
      linkedDesign
        ? `The user already has a design called "${linkedDesign.name}" (version ${linkedDesign.version}) in this conversation. Generate a NEW design per their request; do not merely modify the existing one unless asked.`
        : null,
      `User request:\n${generation.prompt}`,
    ]
      .filter(Boolean)
      .join('\n\n')

    const { data: parsed, usage } = await generateJson({
      systemInstruction: `${SYSTEM_PERSONA}\n\n${DESIGN_GENERATION_INSTRUCTION}`,
      prompt,
    })

    // ── VALIDATING (spec §58 — AI output is untrusted) ──
    await prisma.generation.update({ where: { id: generationId }, data: { status: 'validating' } })
    await emit('status', { stage: 'validating', label: 'Validating structure…' })
    const validated = validateGeneratedDesign(parsed)

    // ── SAVING (spec §85 — one transaction, no partial resources) ──
    await prisma.generation.update({ where: { id: generationId }, data: { status: 'saving' } })
    await emit('status', { stage: 'saving', label: 'Saving design…' })

    const result = await prisma.$transaction(async (tx) => {
      const design = await tx.design.create({
        data: {
          name: validated.name,
          description: validated.description,
          status: 'draft',
          ownerId: generation.userId,
          version: 1,
          blocks: {
            create: validated.blocks.map((b) => ({
              type: b.type,
              label: b.label,
              x: b.x,
              y: b.y,
              color: b.color,
              config: b.config ?? {},
            })),
          },
        },
        include: { blocks: true },
      })

      // Map AI node ids -> created Block ids for edge FKs.
      const blockIdByNodeId = new Map()
      const cardNodes = []
      validated.blocks.forEach((b, i) => {
        const node = validated.cardPayload.nodes[i]
        blockIdByNodeId.set(node.id, design.blocks[i].id)
        cardNodes.push(node)
      })

      await tx.edge.createMany({
        data: validated.edges.map((e) => ({
          designId: design.id,
          sourceId: blockIdByNodeId.get(e.sourceId),
          targetId: blockIdByNodeId.get(e.targetId),
          connectionType: e.connectionType,
          animated: e.animated,
        })),
      })

      const cardPayload = {
        ...validated.cardPayload,
        designId: design.id,
        nodes: cardNodes,
      }

      const intro =
        `Here's a **${validated.name}** architecture — ${validated.stats.nodeCount} components, ` +
        `${validated.stats.edgeCount} connections, estimated at **$${validated.cardPayload.estimatedMonthlyCost.toLocaleString()}/month**.\n\n` +
        `The design below is ready — open it in the Canvas Editor to fine-tune it, or run a simulation to get scores and find bottlenecks.`

      // Generation card message — durable even if SSE was lost (spec §90).
      const agg = await tx.chatMessage.aggregate({
        where: { sessionId: generation.sessionId },
        _max: { sequence: true },
      })
      const cardMessage = generation.sessionId
        ? await tx.chatMessage.create({
            data: {
              sessionId: generation.sessionId,
              sequence: (agg._max.sequence ?? 0) + 1,
              role: 'assistant',
              content: intro,
              type: 'generation',
              status: 'completed',
              requestId,
              metadata: {
                generationId,
                designId: design.id,
                design: cardPayload,
              },
            },
          })
        : null

      if (generation.sessionId) {
        await tx.chatSession.update({
          where: { id: generation.sessionId },
          data: { version: { increment: 1 } },
        })
      }

      const updatedGeneration = await tx.generation.update({
        where: { id: generationId },
        data: {
          status: 'completed',
          designId: design.id,
          designVersion: 1,
          metadata: cardPayload,
        },
      })

      return { design, cardPayload, cardMessage, generation: updatedGeneration }
    })

    // ── COMPLETED — notify chat listeners ──
    await emit('chunk', { content: result.cardMessage?.content ?? `Design "${result.design.name}" is ready.` })
    await emit('generation', { design: result.cardPayload })
    await emit('done', {
      metadata: {
        generationId,
        designId: result.design.id,
        messageId: result.cardMessage?.id ?? null,
        latencyMs: Date.now() - startedAt,
      },
    })

    if (requestId) {
      await prisma.chatRequest
        .update({ where: { id: requestId }, data: { status: 'completed', responseId: result.cardMessage?.id ?? null } })
        .catch(() => {})
    }

    logger.info(
      { generationId, designId: result.design.id, durationMs: Date.now() - startedAt, tokens: usage.promptTokens + usage.completionTokens },
      'Generation completed'
    )
    return { designId: result.design.id }
  } catch (err) {
    const isValidation = err?.code === ERROR_CODES.AI_INVALID_OUTPUT
    const code = isValidation ? ERROR_CODES.AI_INVALID_OUTPUT : ERROR_CODES.GENERATION_FAILED
    await prisma.generation
      .update({
        where: { id: generationId },
        data: { status: 'failed', errorCode: code, errorMessage: err.message },
      })
      .catch((e) => logger.error({ err: e.message, generationId }, 'Failed to mark generation failed'))

    if (requestId) {
      await markFailed(requestId, code, 'Design generation failed. You can retry.')
    }
    await emit('error', { code, message: 'Design generation failed. You can retry.', retryable: true })
    await emit('done', { metadata: { generationId, failed: true } })

    logger.error({ err: err.message, generationId }, 'Generation failed')
    throw err
  } finally {
    clearInterval(heartbeat)
  }
}

// ────────────────────────────────────────────────────────────────────────────
// WORKER FACTORY (in-process, mirroring the simulation worker)
// ────────────────────────────────────────────────────────────────────────────

export function createGenerationWorker(concurrency = 1) {
  const worker = new Worker(
    'generation',
    async (job) => runGenerationProcessor(job),
    {
      connection: redisConnection,
      concurrency,
      limiter: { max: 5, duration: 1000 },
      stalledInterval: 30_000,
      maxStalledCount: 1,
    }
  )

  worker.on('completed', (job) => logger.info({ jobId: job.id }, 'Generation job completed'))
  worker.on('failed', (job, err) => logger.error({ jobId: job?.id, err: err.message }, 'Generation job failed'))
  worker.on('error', (err) => logger.error({ err: err.message }, 'Generation worker error'))

  return worker
}

// ────────────────────────────────────────────────────────────────────────────
// RECOVERY SWEEP (spec §74-75) — call on boot and periodically
// ────────────────────────────────────────────────────────────────────────────

export async function runGenerationRecoverySweep() {
  const staleBefore = new Date(Date.now() - STALE_THRESHOLD_MS)

  // 1. Stale in-flight generations: the server died mid-flight; AI work
  //    cannot be resumed, so fail them cleanly and let the client retry.
  const staleRunning = await prisma.generation.findMany({
    where: { status: { in: ['running', 'validating', 'saving'] }, updatedAt: { lt: staleBefore } },
    select: { id: true, requestKey: true },
    take: 50,
  })
  for (const gen of staleRunning) {
    logger.warn({ generationId: gen.id }, 'Recovery: failing stale generation')
    await prisma.generation
      .update({
        where: { id: gen.id },
        data: { status: 'failed', errorCode: ERROR_CODES.GENERATION_FAILED, errorMessage: 'Generation was interrupted and can be retried.' },
      })
      .catch(() => {})
    if (gen.requestKey) {
      await markFailed(gen.requestKey, ERROR_CODES.GENERATION_FAILED, 'Design generation was interrupted. You can retry.')
      await publish(gen.requestKey, 'error', {
        code: ERROR_CODES.GENERATION_FAILED,
        message: 'Design generation was interrupted. You can retry.',
        retryable: true,
      }).catch(() => {})
      await publish(gen.requestKey, 'done', { metadata: { failed: true } }).catch(() => {})
    }
  }

  // 2. Stale queued generations: the BullMQ job was lost (e.g. Redis restart)
  //    — re-enqueue; the processor is idempotent.
  const staleQueued = await prisma.generation.findMany({
    where: { status: 'queued', updatedAt: { lt: staleBefore } },
    select: { id: true },
    take: 50,
  })
  for (const gen of staleQueued) {
    logger.warn({ generationId: gen.id }, 'Recovery: re-enqueueing stale queued generation')
    await prisma.generation
      .update({ where: { id: gen.id }, data: { updatedAt: new Date() } })
      .catch(() => {})
    // Bounded: BullMQ offline-queues forever while Redis is disconnected.
    await Promise.race([
      enqueueGeneration({ generationId: gen.id }),
      new Promise((resolve) => setTimeout(() => resolve(null), 3000)),
    ]).catch((err) =>
      logger.error({ err: err.message, generationId: gen.id }, 'Recovery re-enqueue failed')
    )
  }

  // 3. Stale chat requests stuck processing (server restart mid-chat, spec §125).
  const staleRequests = await prisma.chatRequest.findMany({
    where: { status: 'processing', updatedAt: { lt: new Date(Date.now() - 15 * 60 * 1000) } },
    select: { id: true },
    take: 100,
  })
  for (const req of staleRequests) {
    await markFailed(req.id, ERROR_CODES.AI_TIMEOUT, 'The request was interrupted. You can retry.')
  }

  return { failedStale: staleRunning.length, requeued: staleQueued.length, failedRequests: staleRequests.length }
}
