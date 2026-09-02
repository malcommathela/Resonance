import { Router } from 'express'
import { prisma } from '../lib/db.js'
import { checkRedisHealth } from '../lib/redis.js'
import { simulationQueue } from '../simulation/worker/queue.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { logger } from '../lib/logger.js'

const router = Router()

// ============================================================================
// L13: LIVENESS — Kubernetes/Docker orchestrator probe
// Returns 200 if the Node process is alive. Fast, no dependency checks.
// ============================================================================
router.get('/live', (req, res) => {
  res.status(200).json({
    status: 'alive',
    service: 'resonance-api',
    pid: process.pid,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  })
})

// ============================================================================
// L13: READINESS — Traffic should not route here until critical deps healthy
// Database is critical (503 when down). Redis/queue unavailability only
// degrades the app (caches and locks fail open, Chat spec §7/§47/§116), so
// they report 'degraded' without failing readiness. All checks are hard-
// bounded: ioredis and BullMQ offline-queue commands while disconnected, so
// unguarded calls hang forever during a Redis outage.
// ============================================================================
const DEP_TIMEOUT_MS = 2000

function withDeadline(promise, fallback) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(fallback), DEP_TIMEOUT_MS)),
  ])
}

router.get('/ready', asyncHandler(async (req, res) => {
  const checks = {
    database: 'unknown',
    redis: 'unknown',
    queue: 'unknown',
  }

  // Database — critical
  checks.database = await withDeadline(
    prisma.$queryRaw`SELECT 1`.then(() => 'ok').catch(() => 'error'),
    'error'
  )

  // Redis — degradation-tolerant
  checks.redis = await withDeadline(
    checkRedisHealth().then((h) => (h.ioredis === 'ok' ? 'ok' : 'degraded')).catch(() => 'degraded'),
    'degraded'
  )

  // BullMQ Queue — degradation-tolerant
  checks.queue = await withDeadline(
    simulationQueue.getJobCounts().then(() => 'ok').catch(() => 'degraded'),
    'degraded'
  )

  const dbOk = checks.database === 'ok'
  const statusCode = dbOk ? 200 : 503
  const status = dbOk
    ? (Object.values(checks).every((v) => v === 'ok') ? 'ready' : 'degraded')
    : 'not_ready'

  res.status(statusCode).json({
    status,
    checks,
    timestamp: new Date().toISOString(),
  })
}))

export default router