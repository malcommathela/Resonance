// ============================================================================
// SSE HUB — Chat spec §32-35, §114
// SSE is a delivery mechanism, NOT the source of truth. Events flow from the
// AI operation through this hub to browsers, but every important state change
// is persisted in PostgreSQL first, and every event is buffered in Redis so
// an interrupted stream can resume with Last-Event-ID without duplicating
// work.
//
// Delivery path:
//   AI operation -> publish(requestId, type, data)
//     -> Redis list (replay buffer, TTL 1h)
//     -> Redis pub/sub bus (multi-instance fan-out)
//     -> connected SSE clients (all instances)
//
// Wire format per event:
//   event: <type>\nid: <sequence>\ndata: { requestId, sequence, type, ... }
// ============================================================================

import { redisConnection, redisSubscriber } from '../../lib/redis.js'
import { logger } from '../../lib/logger.js'
import { TTL } from './cacheService.js'

const EVENT_NAME = /^[a-z_]+$/
const MAX_REPLAY_EVENTS = 500
const HEARTBEAT_INTERVAL_MS = 15_000

const BUS_CHANNEL = 'resonance:v1:sse:bus'
const INSTANCE_ID = `${process.pid}-${Math.random().toString(36).slice(2, 8)}`

// requestId -> Set<{ res, heartbeat }>
const localClients = new Map()

let subscribed = false
function ensureSubscription() {
  if (subscribed) return
  subscribed = true
  redisSubscriber.on('message', (channel, message) => {
    if (channel !== BUS_CHANNEL) return
    let envelope
    try {
      envelope = JSON.parse(message)
    } catch {
      return
    }
    // Skip our own publishes — they were already delivered locally.
    if (envelope.origin === INSTANCE_ID) return
    deliverLocal(envelope.requestId, envelope.event)
  })
  redisSubscriber.subscribe(BUS_CHANNEL).catch((err) => {
    logger.error({ err: err.message }, 'SSE hub: failed to subscribe to bus')
  })
}

// ────────────────────────────────────────────────────────────────────────────
// EVENT SEQUENCE
// ────────────────────────────────────────────────────────────────────────────

const memorySeq = new Map()
const REDIS_CALL_TIMEOUT_MS = 500

// ioredis offline-queues commands while disconnected (they neither resolve
// nor reject), so every call gets a hard deadline and a local fallback.
function bounded(promise, fallback) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(fallback), REDIS_CALL_TIMEOUT_MS)),
  ])
}

async function nextSequence(requestId) {
  const result = await bounded(
    redisConnection.incr(`resonance:v1:sse:${requestId}:seq`).catch(() => null),
    null
  )
  if (result !== null) return result
  // Redis unavailable — single-instance in-memory fallback.
  const next = (memorySeq.get(requestId) || 0) + 1
  memorySeq.set(requestId, next)
  return next
}

// ────────────────────────────────────────────────────────────────────────────
// PUBLISH
// ────────────────────────────────────────────────────────────────────────────

/**
 * Publish an event for a request. Assigns the monotonic sequence, stores it
 * in the replay buffer, and fans out to every connected client (here and on
 * other instances via the pub/sub bus). Never throws — a Redis failure must
 * not break the AI operation; local clients still receive events directly.
 *
 * @param {string} requestId
 * @param {'status'|'thinking'|'chunk'|'generation'|'error'|'done'} type
 * @param {object} data — event payload (merged into the event body)
 * @returns {Promise<object>} the published event
 */
export async function publish(requestId, type, data = {}) {
  if (!EVENT_NAME.test(type)) throw new TypeError(`Invalid SSE event type: ${type}`)

  const sequence = await nextSequence(requestId)
  const event = { requestId, sequence, type, ...data, ts: Date.now() }
  const serialized = JSON.stringify(event)

  // Replay buffer (fire-and-forget; correctness lives in PostgreSQL).
  const replayKey = `resonance:v1:sse:${requestId}`
  Promise.all([
    redisConnection.rpush(replayKey, serialized),
    redisConnection.ltrim(replayKey, -MAX_REPLAY_EVENTS, -1),
    redisConnection.expire(replayKey, TTL.SSE_REPLAY),
  ]).catch(() => { /* degraded mode — replay unavailable */ })

  // Multi-instance fan-out (fire-and-forget).
  redisConnection
    .publish(BUS_CHANNEL, JSON.stringify({ origin: INSTANCE_ID, requestId, event }))
    .catch(() => {})

  deliverLocal(requestId, event)
  return event
}

/**
 * Deliver an event to clients connected to THIS instance.
 * `error` and `done` close the stream afterwards.
 */
function deliverLocal(requestId, event) {
  const clients = localClients.get(requestId)
  if (!clients || clients.size === 0) return

  const terminal = event.type === 'error' || event.type === 'done'
  for (const client of [...clients]) {
    try {
      writeEvent(client.res, event)
      if (terminal) {
        clients.delete(client)
        client.close()
      }
    } catch {
      clients.delete(client)
      client.close()
    }
  }
  if (clients.size === 0) localClients.delete(requestId)
}

function writeEvent(res, event) {
  res.write(`event: ${event.type}\nid: ${event.sequence}\ndata: ${JSON.stringify(event)}\n\n`)
  if (res.flush) res.flush()
}

// ────────────────────────────────────────────────────────────────────────────
// STREAM ATTACHMENT (with Last-Event-ID replay, spec §33)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Attach an HTTP response as an SSE stream for a request.
 * Replays buffered events newer than lastEventId before going live, so a
 * reconnecting client never misses or duplicates content.
 *
 * @param {object} opts
 * @param {import('express').Response} opts.res
 * @param {string} opts.requestId
 * @param {string|null} [opts.lastEventId] — last SSE id the client received
 * @param {Function} [opts.onClose] — called when the client disconnects
 * @returns {Promise<{ clientCount: number }>}
 */
export async function attachStream({ res, requestId, lastEventId, onClose }) {
  ensureSubscription()

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  })
  res.write('retry: 2000\n\n')
  if (res.flush) res.flush()

  // 1. Replay from the durable event buffer.
  const replayed = await bounded(
    redisConnection.lrange(`resonance:v1:sse:${requestId}`, 0, -1),
    []
  ) // degraded mode — client recovers via GET /requests/:id
  const lastSeq = Number(lastEventId) || 0
  let highestSeq = lastSeq
  let replayedTerminal = false
  for (const raw of replayed) {
    let event
    try {
      event = JSON.parse(raw)
    } catch {
      continue
    }
    if (event.sequence > lastSeq) {
      try {
        writeEvent(res, event)
        highestSeq = Math.max(highestSeq, event.sequence)
      } catch {
        try { res.end() } catch { /* already dead */ }
        return finishClosed(requestId, onClose)
      }
      if (event.type === 'error' || event.type === 'done') {
        try { res.end() } catch { /* already dead */ }
        return finishClosed(requestId, onClose)
      }
    }
  }

  // 2. Go live.
  if (!localClients.has(requestId)) localClients.set(requestId, new Set())

  let closed = false
  const handleClose = () => {
    if (closed) return
    closed = true
    clearInterval(heartbeat)
    const set = localClients.get(requestId)
    set?.delete(client)
    if (set && set.size === 0) localClients.delete(requestId)
    onClose?.()
  }

  const client = {
    res,
    close: () => {
      try {
        res.end()
      } catch {
        /* already dead */
      }
      handleClose()
    },
  }
  localClients.get(requestId).add(client)

  const heartbeat = setInterval(() => {
    try {
      res.write(`event: heartbeat\ndata: ${JSON.stringify({ requestId, ts: Date.now() })}\n\n`)
      if (res.flush) res.flush()
    } catch {
      /* closed — cleanup happens via handleClose */
    }
  }, HEARTBEAT_INTERVAL_MS)
  heartbeat.unref?.()

  res.on('close', handleClose)

  return { clientCount: localClients.get(requestId)?.size ?? 1, lastSeq: highestSeq, replayedTerminal }
}

function finishClosed(requestId, onClose) {
  onClose?.()
  return { clientCount: 0, closed: true, replayedTerminal: true }
}

/**
 * Number of live clients attached to a request (observability, spec §95).
 */
export function clientCount(requestId) {
  return localClients.get(requestId)?.size ?? 0
}

/**
 * Write a synthetic event directly to one response (used by the recovery
 * path when the replay buffer is gone but the DB holds the final state).
 */
export function writeSyntheticEvent(res, requestId, type, data, sequence) {
  writeEvent(res, { requestId, sequence, type, ...data, ts: Date.now() })
}

export function sseHubStatus() {
  return {
    instanceId: INSTANCE_ID,
    requests: localClients.size,
    clients: [...localClients.values()].reduce((sum, s) => sum + s.size, 0),
  }
}
