import * as Sentry from '@sentry/node'
import { nodeProfilingIntegration } from '@sentry/profiling-node'
import express from 'express'
import cors from 'cors'
import compression from 'compression'
import 'dotenv/config'
import { clerkMiddleware } from '@clerk/express'

import { logger, requestLogger } from './lib/logger.js'
import { securityHeaders, sanitizeInput } from './middleware/security.js'
import { globalLimiter } from './middleware/rateLimit.js'
import { tenantContext } from './middleware/tenantContext.js'
import { asyncHandler } from './middleware/asyncHandler.js'
import { requestId } from './middleware/requestId.js'
import { checkRedisHealth } from './lib/redis.js'
import { prisma } from './lib/db.js'
import { simulationQueue } from './simulation/worker/queue.js'
import { sendAlert, trackErrorForAlert } from './lib/alerting.js'

import simulationRoutes from './routes/simulations.js'
import designRoutes from './routes/designs.js'
import authRoutes from './routes/auth.js'
import validationRoutes from './routes/validation.js'
import statusRoutes from './routes/status.js'
import githubRoutes from './routes/github.js'
import teamRoutes from './routes/team.js'


// ============================================================================
// SENTRY — L12: Error Tracking & Performance Monitoring
// Must initialize before any other imports so it can instrument everything.
// ============================================================================
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
  release: process.env.npm_package_version || 'unknown',
  integrations: [
    nodeProfilingIntegration(),
    Sentry.httpIntegration(),
    Sentry.expressIntegration(),
  ],
  tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.2'),
  profilesSampleRate: parseFloat(process.env.SENTRY_PROFILES_SAMPLE_RATE || '0.1'),
})

const app = express()
const PORT = process.env.PORT || 3001

// ============================================================================
// TRUST PROXY — critical for accurate req.ip behind load balancers
// ============================================================================
app.set('trust proxy', process.env.TRUST_PROXY_COUNT || 1)

// ============================================================================
// SECURITY MIDDLEWARE
// ============================================================================
app.use(securityHeaders)
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}))
app.use(compression())
app.use(express.json({ limit: '10mb' }))
app.use(sanitizeInput)

// ============================================================================
// REQUEST TRACING — L12: correlation IDs + structured request logging
// ============================================================================
app.use(requestId)
app.use(requestLogger)

// ============================================================================
// CLERK AUTHENTICATION
// ============================================================================
app.use(clerkMiddleware())

// ============================================================================
// GLOBAL RATE LIMITING (skips /health, /live, /ready)
// ============================================================================
app.use(globalLimiter)

// ============================================================================
// L13: STATUS PROBES — liveness + readiness for orchestrators
// ============================================================================
app.use(statusRoutes)

// ============================================================================
// HEALTH CHECK — with dependency validation (legacy endpoint)
// ============================================================================
app.get('/health', asyncHandler(async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.env.npm_package_version || 'unknown',
    database: 'unknown',
    redis: 'unknown',
    queue: 'unknown',
  }

  // DB check
  try {
    await prisma.$queryRaw`SELECT 1`
    health.database = 'ok'
  } catch (err) {
    health.database = 'error'
    health.status = 'degraded'
    logger.error({ err: err.message, requestId: req.requestId }, 'Health check: DB failed')
  }

  // Redis check
  try {
    const redisHealth = await checkRedisHealth()
    health.redis = redisHealth.ioredis
    if (redisHealth.ioredis !== 'ok') {
      health.status = 'degraded'
    }
  } catch (err) {
    health.redis = 'error'
    health.status = 'degraded'
    logger.error({ err: err.message, requestId: req.requestId }, 'Health check: Redis failed')
  }

  // Queue check
  try {
    const queueJobs = await simulationQueue.getJobCounts()
    health.queue = { status: 'ok', jobs: queueJobs }
  } catch (err) {
    health.queue = { status: 'error', error: err.message }
    health.status = 'degraded'
    logger.error({ err: err.message, requestId: req.requestId }, 'Health check: Queue failed')
  }

  const statusCode = health.status === 'ok' ? 200 : 503
  res.status(statusCode).json(health)
}))

// ============================================================================
// API ROUTES — with tenant context (auth + ownership + RLS)
// ============================================================================
app.use('/simulations', asyncHandler(tenantContext), simulationRoutes)
app.use('/designs', asyncHandler(tenantContext), designRoutes)
app.use('/auth', asyncHandler(tenantContext), authRoutes)
app.use('/validation', asyncHandler(tenantContext), validationRoutes)
app.use('/github', asyncHandler(tenantContext), githubRoutes)
app.use('/team', asyncHandler(tenantContext), teamRoutes)


// ============================================================================
// ERROR HANDLING — L12: Sentry → alerting → structured logs
// ============================================================================
// Sentry v8: expressErrorHandler() captures exceptions before our custom handler
app.use(Sentry.expressErrorHandler())

app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500

  // L12: Alert on 5xx spikes (debounced)
  if (status >= 500) {
    trackErrorForAlert(err)
    sendAlert({
      level: 'critical',
      message: `${req.method} ${req.originalUrl} -> ${status}: ${err.message}`,
      context: {
        status,
        requestId: req.requestId,
        userId: req.userId,
        url: req.originalUrl,
        method: req.method,
      },
    })
  }

  logger.error({
    err: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    url: req.originalUrl || req.url,
    method: req.method,
    userId: req.userId,
    requestId: req.requestId,
    status,
  }, 'Unhandled error')

  res.status(status).json({
    error: err.message || 'Internal server error',
    requestId: req.requestId,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  })
})

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found', requestId: req.requestId })
})

// ============================================================================
// SERVER STARTUP
// ============================================================================
const server = app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`)
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`)
})

// ============================================================================
// GRACEFUL SHUTDOWN — L06 Cloud & Compute + L13 Availability
// ============================================================================
async function gracefulShutdown(signal) {
  logger.info({ signal }, 'Starting graceful shutdown...')

  // Stop accepting new connections
  server.close(() => {
    logger.info('HTTP server closed')
  })

  // Force exit after timeout to prevent hanging
  const forceExit = setTimeout(() => {
    logger.fatal('Forced exit after shutdown timeout')
    process.exit(1)
  }, 15000)

  try {
    await simulationQueue.close()
    logger.info('BullMQ queue closed')
  } catch (err) {
    logger.error({ err: err.message }, 'Queue close error')
  }

  try {
    await prisma.$disconnect()
    logger.info('Prisma disconnected')
  } catch (err) {
    logger.error({ err: err.message }, 'Prisma disconnect error')
  }

  clearTimeout(forceExit)
  logger.info('Graceful shutdown complete')
  process.exit(0)
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))

// L12: Capture unhandled exceptions at process level
process.on('uncaughtException', (err) => {
  Sentry.captureException(err)
  logger.fatal({ err: err.message, stack: err.stack }, 'Uncaught exception')
  sendAlert({ level: 'critical', message: 'Uncaught exception', context: { error: err.message } })
  gracefulShutdown('uncaughtException')
})

process.on('unhandledRejection', (reason) => {
  Sentry.captureException(reason)
  logger.fatal({ reason: reason?.message || reason }, 'Unhandled rejection')
  sendAlert({ level: 'critical', message: 'Unhandled rejection', context: { reason: String(reason) } })
})

export default app