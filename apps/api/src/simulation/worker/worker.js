// ============================================================================
// SIMULATION WORKER — L06 Cloud & Compute + L12 Error Tracking
// ============================================================================

import * as Sentry from '@sentry/node'
import { createSimulationWorker } from './queue.js'
import { logger } from '../../lib/logger.js'
import { prisma } from '../../lib/db.js'
import { redisConnection, redisSubscriber } from '../../lib/redis.js'
import { sendAlert } from '../../lib/alerting.js'
import http from 'http'

// ============================================================================
// SENTRY — L12: Worker error tracking (no profiling, no HTTP integration)
// ============================================================================
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
  release: process.env.npm_package_version || 'unknown',
  integrations: [],
  tracesSampleRate: 0.0,
})

const WORKER_CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '2', 10)
const MAX_MEMORY_MB = parseInt(process.env.WORKER_MAX_MEMORY_MB || '2048', 10)
const HEALTH_PORT = parseInt(process.env.WORKER_HEALTH_PORT || '3002', 10)
const MEMORY_CHECK_INTERVAL_MS = 30000

logger.info({ concurrency: WORKER_CONCURRENCY, maxMemoryMb: MAX_MEMORY_MB }, 'Starting simulation worker')

const worker = createSimulationWorker(WORKER_CONCURRENCY)

// ============================================================================
// HEALTH HTTP SERVER — L06: Required for Docker/K8s health probes
// ============================================================================
const healthServer = http.createServer(async (req, res) => {
  if (req.url === '/health' && req.method === 'GET') {
    try {
      // Check DB
      await prisma.$queryRaw`SELECT 1`
      // Check Redis
      await redisConnection.ping()
      // Check worker state
      const isRunning = worker.isRunning()

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        status: 'ok',
        service: 'simulation-worker',
        pid: process.pid,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        workerRunning: isRunning,
      }))
    } catch (err) {
      res.writeHead(503, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ status: 'degraded', error: err.message }))
    }
  } else {
    res.writeHead(404)
    res.end()
  }
})

healthServer.listen(HEALTH_PORT, () => {
  logger.info({ port: HEALTH_PORT }, 'Worker health server listening')
})

// ============================================================================
// MEMORY MONITOR
// ============================================================================
const memoryMonitor = setInterval(() => {
  const mem = process.memoryUsage()
  const heapUsedMB = Math.round(mem.heapUsed / 1024 / 1024)
  const rssMB = Math.round(mem.rss / 1024 / 1024)

  if (heapUsedMB > MAX_MEMORY_MB) {
    const context = { heapUsedMB, rssMB, maxMemoryMb: MAX_MEMORY_MB }
    logger.fatal(context, 'Memory limit exceeded — initiating shutdown')
    Sentry.captureMessage('Worker memory limit exceeded', { level: 'fatal', extra: context })
    sendAlert({ level: 'critical', message: 'Worker memory limit exceeded', context })
    shutdown('MEMORY_LIMIT')
    return
  }

  if (heapUsedMB > MAX_MEMORY_MB * 0.8) {
    logger.warn({ heapUsedMB, rssMB }, 'Memory usage high')
  }
}, MEMORY_CHECK_INTERVAL_MS)

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================
let isShuttingDown = false

async function shutdown(signal) {
  if (isShuttingDown) return
  isShuttingDown = true

  logger.info({ signal }, 'Worker shutting down...')
  clearInterval(memoryMonitor)

  healthServer.close(() => {
    logger.info('Health server closed')
  })

  try {
    await worker.close()
    logger.info('BullMQ worker closed')
  } catch (err) {
    logger.error({ err: err.message }, 'Worker close error')
    Sentry.captureException(err)
  }

  try {
    await prisma.$disconnect()
    logger.info('Prisma disconnected')
  } catch (err) {
    logger.error({ err: err.message }, 'Prisma disconnect error')
    Sentry.captureException(err)
  }

  try {
    await redisConnection.quit()
    await redisSubscriber.quit()
    logger.info('Redis connections closed')
  } catch (err) {
    logger.error({ err: err.message }, 'Redis close error')
    Sentry.captureException(err)
  }

  logger.info('Worker shutdown complete')
  process.exit(0)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

process.on('uncaughtException', (err) => {
  logger.fatal({ err: err.message, stack: err.stack }, 'Uncaught exception in worker')
  Sentry.captureException(err)
  sendAlert({ level: 'critical', message: 'Worker uncaught exception', context: { error: err.message } })
  shutdown('uncaughtException')
})

process.on('unhandledRejection', (reason) => {
  logger.fatal({ reason: reason?.message || reason }, 'Unhandled rejection in worker')
  Sentry.captureException(reason)
  sendAlert({ level: 'critical', message: 'Worker unhandled rejection', context: { reason: String(reason) } })
  shutdown('unhandledRejection')
})

setInterval(() => {}, 1000)