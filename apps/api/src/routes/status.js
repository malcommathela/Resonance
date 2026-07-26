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
// L13: READINESS — Traffic should not route here until all deps are healthy
// Returns 200 when DB, Redis, and Queue are reachable. 503 otherwise.
// ============================================================================
router.get('/ready', asyncHandler(async (req, res) => {
  const checks = {
    database: 'unknown',
    redis: 'unknown',
    queue: 'unknown',
  }

  // Database
  try {
    await prisma.$queryRaw`SELECT 1`
    checks.database = 'ok'
  } catch (err) {
    checks.database = 'error'
    logger.error({ err: err.message, requestId: req.requestId }, 'Readiness: DB failed')
  }

  // Redis
  try {
    const redisHealth = await checkRedisHealth()
    checks.redis = redisHealth.ioredis
  } catch (err) {
    checks.redis = 'error'
    logger.error({ err: err.message, requestId: req.requestId }, 'Readiness: Redis failed')
  }

  // BullMQ Queue (verifies Redis + BullMQ layer)
  try {
    await simulationQueue.getJobCounts()
    checks.queue = 'ok'
  } catch (err) {
    checks.queue = 'error'
    logger.error({ err: err.message, requestId: req.requestId }, 'Readiness: Queue failed')
  }

  const allOk = Object.values(checks).every(v => v === 'ok')
  const statusCode = allOk ? 200 : 503

  res.status(statusCode).json({
    status: allOk ? 'ready' : 'not_ready',
    checks,
    timestamp: new Date().toISOString(),
  })
}))

export default router