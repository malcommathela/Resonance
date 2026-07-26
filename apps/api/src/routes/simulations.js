import { Router } from 'express'
import { getAuth } from '@clerk/express'
import { prisma } from '../lib/db.js'
import { validateArchitecture, validateSimulationInput } from '../simulation/validation.js'
import { DeterministicRNG, createSimulationSeed } from '@resonance/shared/deterministic'
import { enqueueSimulation, getJobState } from '../simulation/worker/queue.js'
import { redisSubscriber } from '../lib/redis.js'
import { acquireLock, designLockKey } from '../simulation/utils/lock.js'
import { logAuditEvent } from '../simulation/utils/audit.js'
import {
  getCachedSimulationStatus,
  invalidateSimulationStatus,
  getCachedReport,
  cacheReport,
  getCachedSimulationList,
} from '../simulation/utils/cache.js'
import {
  simulationCreateLimiter,
  sseLimiter,
  reportLimiter,
} from '../middleware/rateLimit.js'

const router = Router()

// ============================================================================
// AUTH MIDDLEWARE — supports Clerk session cookies AND Bearer tokens
// ============================================================================

router.use(async (req, res, next) => {
  // 1. Try Clerk cookie session first
  const auth = getAuth(req)
  if (auth?.userId) {
    req.userId = auth.userId
    return next()
  }

  // 2. Fallback: manually decode Bearer token (for cross-origin SSE)
  const authHeader = req.headers.authorization
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    try {
      // Clerk JWT payload: { sub: "user_xxx", ... }
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString())
      if (payload?.sub) {
        req.userId = payload.sub
        return next()
      }
    } catch (err) {
      console.error('[AUTH] Bearer token decode failed:', err.message)
    }
  }

  return res.status(401).json({ error: 'Unauthorized' })
})

// ============================================================================
// HELPERS
// ============================================================================

async function getDesign(req, designId) {
  const user = await prisma.user.findUnique({
    where: { clerkId: req.userId },
    select: { id: true }
  })
  if (!user) return null

  const design = await prisma.design.findFirst({
    where: { id: designId, ownerId: user.id },
    include: { blocks: true, edges: true }
  })

  if (design) {
    console.log('[SIMULATION] Loaded design:', design.id)
    console.log('[SIMULATION] Blocks:', design.blocks.map(b => ({ id: b.id, type: b.type, label: b.label })))
    console.log('[SIMULATION] Edges:', design.edges.map(e => ({ id: e.id, source: e.sourceId, target: e.targetId, type: e.connectionType })))
  }

  return design
}

async function getDbUser(req) {
  return prisma.user.findUnique({
    where: { clerkId: req.userId },
    select: { id: true }
  })
}

function getClientInfo(req) {
  return {
    ipAddress: req.headers['x-forwarded-for'] || req.ip || null,
    userAgent: req.headers['user-agent'] || null,
  }
}

// ============================================================================
// POST /simulations/:designId/run
// ============================================================================

router.post('/:designId/run', simulationCreateLimiter, async (req, res) => {
  try {
    const { designId } = req.params
    console.log('[SIMULATION] Run request body:', JSON.stringify(req.body))

    const {
      trafficPattern = 'steady',
      rps = 100,
      duration = 300,
      scenario = 'none',
      monteCarloPasses = 1,
      confidenceLevel = 0.95,
      growthScenario = null,
      generateReport = true,
      deterministicSeed = null,
      targetBlockId = null,
      targetEdgeId = null,
      trafficParams = {},
    } = req.body

    const design = await getDesign(req, designId)
    if (!design) return res.status(404).json({ error: 'Design not found' })

    const user = await getDbUser(req)
    if (!user) return res.status(401).json({ error: 'User not found' })

    const validation = validateSimulationInput(
      { trafficPattern, rps, duration, scenario, monteCarloPasses, confidenceLevel, growthScenario, deterministicSeed },
      design.blocks,
      design.edges
    )
    console.log('[SIMULATION] Validation result:', JSON.stringify({
      canSimulate: validation.canSimulate,
      criticalCount: validation.criticalCount,
      warningCount: validation.warningCount,
      findings: validation.findings.map(f => ({ severity: f.severity, type: f.type, message: f.message }))
    }, null, 2))

    if (!validation.canSimulate) {
      await logAuditEvent({
        userId: user.id,
        designId,
        simulationId: null,
        action: 'simulation_rejected',
        details: {
          reason: 'validation_failed',
          criticalCount: validation.criticalCount,
          warningCount: validation.warningCount,
        },
        clientInfo: getClientInfo(req),
      })

      return res.status(400).json({
        error: 'Architecture validation failed',
        findings: validation.findings,
        topologyScore: validation.topologyScore,
        confidenceScore: validation.confidenceScore,
      })
    }

    const lockKey = designLockKey(designId)
    const lock = await acquireLock(lockKey, 600)
    if (!lock) {
      return res.status(423).json({
        error: 'A simulation is already running for this design. Please wait for it to complete.',
        code: 'CONCURRENT_SIMULATION_BLOCKED',
      })
    }

    const seed = deterministicSeed || createSimulationSeed(designId, { trafficPattern, rps, duration, scenario })
    const inputSnapshot = {
      id: designId,
      name: design.name,
      version: `${Date.now()}`,
      snapshotAt: new Date().toISOString(),
      blocks: design.blocks,
      edges: design.edges,
    }

    const simulation = await prisma.simulation.create({
      data: {
        designId,
        userId: user.id,
        status: 'pending',
        progress: 0,
        trafficPattern,
        rps,
        duration,
        scenario: scenario === 'none' ? null : scenario,
        monteCarloPasses,
        confidenceLevel,
        growthScenario,
        generateReport,
        deterministicSeed: seed,
        engineVersion: '2.0.0',
        reportVersion: '1.0.0',
        inputSnapshot,
        assumptions: {
          queueModel: 'M/M/1 approximation with capacity limits',
          networkModel: 'protocol-specific latency + jitter + packet loss',
          failureModel: 'targeted per-block with cascading propagation',
          scalingModel: 'instantaneous horizontal/vertical/auto-scaling',
          latencyDecomposition: 'network + serialization + encryption + compression + processing + queue',
          resourceModel: 'CPU + memory + thread pool + connection pool contention',
        },
        validationResult: validation,
        confidenceScore: validation.confidenceScore,
      }
    })

    await enqueueSimulation({
      simId: simulation.id,
      design: {
        id: design.id,
        name: design.name,
        ownerId: design.ownerId,
        blocks: design.blocks,
        edges: design.edges,
      },
      config: {
        seed,
        trafficPattern,
        rps,
        duration,
        scenario,
        monteCarloPasses,
        confidenceLevel,
        growthScenario,
        generateReport,
        deterministicSeed,
        targetBlockId,
        targetEdgeId,
        trafficParams,
        validation,
        startedAt: simulation.startedAt,
        assumptions: {
          queueModel: 'M/M/1 approximation with capacity limits',
          networkModel: 'protocol-specific latency + jitter + packet loss',
          failureModel: 'targeted per-block with cascading propagation',
          scalingModel: 'instantaneous horizontal/vertical/auto-scaling',
          latencyDecomposition: 'network + serialization + encryption + compression + processing + queue',
          resourceModel: 'CPU + memory + thread pool + connection pool contention',
        },
      },
      userId: user.id,
      clientInfo: getClientInfo(req),
    })

    await lock.release()

    await logAuditEvent({
      userId: user.id,
      designId,
      simulationId: simulation.id,
      action: 'simulation_enqueued',
      details: {
        trafficPattern,
        rps,
        duration,
        scenario,
        monteCarloPasses,
        growthScenario,
      },
      clientInfo: getClientInfo(req),
    })

    res.json({
      simulationId: simulation.id,
      status: 'pending',
      validation: {
        canSimulate: true,
        topologyScore: validation.topologyScore,
        confidenceScore: validation.confidenceScore,
        findings: validation.findings,
      }
    })
  } catch (err) {
    console.error('[SIMULATION] Run error:', err)
    res.status(500).json({ error: err.message })
  }
})

// ============================================================================
// GET /simulations/:id/status
// ============================================================================

router.get('/:id/status', async (req, res) => {
  try {
    const { id } = req.params

    const simulation = await prisma.simulation.findUnique({
      where: { id },
      include: { design: { select: { owner: { select: { clerkId: true } } } } }
    })

    if (!simulation) return res.status(404).json({ error: 'Not found' })
    if (simulation.design.owner.clerkId !== req.userId) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    const cached = await getCachedSimulationStatus(id, prisma)

    res.json({
      status: cached.status,
      progress: cached.progress,
      metrics: cached.metrics,
      globalMetrics: cached.globalMetrics,
      currentRps: cached.currentRps,
      validationResult: cached.validationResult,
      confidenceScore: cached.confidenceScore,
      errorMessage: cached.errorMessage,
      completedAt: cached.completedAt,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ============================================================================
// SSE SHARED REDIS SUBSCRIBER
// ============================================================================

const sseClients = new Map()

redisSubscriber.on('message', (channel, message) => {
  const match = channel.match(/^sim:([^:]+):progress$/)
  if (!match) return
  const simId = match[1]
  const clients = sseClients.get(simId)
  if (!clients || clients.size === 0) return

  try {
    const data = JSON.parse(message)
    clients.forEach((sendEvent) => {
      try {
        sendEvent(data)
      } catch (e) {
        // Client disconnected mid-write
      }
    })
  } catch (e) {
    // Ignore malformed messages
  }
})

// ============================================================================
// GET /simulations/:id/stream — SSE with Redis Pub/Sub Bridge
// ============================================================================

router.get('/:id/stream', sseLimiter, async (req, res) => {
  try {
    const { id } = req.params

    const simulation = await prisma.simulation.findUnique({
      where: { id },
      include: { design: { select: { owner: { select: { clerkId: true } } } } }
    })

    if (!simulation) return res.status(404).json({ error: 'Not found' })
    if (simulation.design.owner.clerkId !== req.userId) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')

    const sendEvent = (data) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`)
      if (res.flush) res.flush()
    }

    if (!sseClients.has(id)) sseClients.set(id, new Set())
    sseClients.get(id).add(sendEvent)

    const isFirstClient = sseClients.get(id).size === 1
    const redisChannel = `sim:${id}:progress`
    if (isFirstClient) {
      await redisSubscriber.subscribe(redisChannel)
    }

    sendEvent({
      progress: simulation.progress,
      status: simulation.status,
      metrics: simulation.metrics || {},
      global: simulation.globalMetrics || {},
      currentRps: simulation.currentRps,
      validationResult: simulation.validationResult,
      confidenceScore: simulation.confidenceScore,
    })

    if (['completed', 'stopped', 'failed'].includes(simulation.status)) {
      sseClients.get(id).delete(sendEvent)
      if (sseClients.get(id).size === 0) {
        sseClients.delete(id)
        await redisSubscriber.unsubscribe(redisChannel).catch(() => {})
      }
      return res.end()
    }

    const heartbeat = setInterval(() => {
      sendEvent({ heartbeat: true, _t: Date.now() })
    }, 15000)

    req.on('close', async () => {
      clearInterval(heartbeat)
      sseClients.get(id)?.delete(sendEvent)

      if (sseClients.get(id)?.size === 0) {
        sseClients.delete(id)
        await redisSubscriber.unsubscribe(redisChannel).catch(() => {})
      }
    })

  } catch (err) {
    console.error('[SSE] Stream error:', err.message)
    if (!res.headersSent) {
      res.status(500).json({ error: err.message })
    } else {
      res.end()
    }
  }
})

// ============================================================================
// POST /simulations/:id/stop
// ============================================================================

router.post('/:id/stop', async (req, res) => {
  try {
    const { id } = req.params
    const simulation = await prisma.simulation.findUnique({
      where: { id },
      include: { design: { select: { owner: { select: { clerkId: true } } } } }
    })

    if (!simulation) return res.status(404).json({ error: 'Not found' })
    if (simulation.design.owner.clerkId !== req.userId) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    const { removeJob } = await import('../simulation/worker/queue.js')
    await removeJob(`sim-${id}`).catch(() => {})

    await prisma.simulation.update({
      where: { id },
      data: { status: 'stopped', progress: 100 }
    })

    await invalidateSimulationStatus(id)

    const user = await getDbUser(req)
    await logAuditEvent({
      userId: user?.id,
      designId: simulation.designId,
      simulationId: id,
      action: 'simulation_stopped',
      details: { reason: 'user_requested' },
      clientInfo: getClientInfo(req),
    })

    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ============================================================================
// GET /simulations/:id/report
// ============================================================================

router.get('/:id/report', reportLimiter, async (req, res) => {
  try {
    const { id } = req.params

    const simulation = await prisma.simulation.findUnique({
      where: { id },
      include: {
        design: { select: { owner: { select: { clerkId: true } } } },
      }
    })

    if (!simulation) return res.status(404).json({ error: 'Not found' })
    if (simulation.design.owner.clerkId !== req.userId) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    const cached = await getCachedReport(id, prisma)
    if (cached) {
      return res.json(cached)
    }

    const report = await prisma.simulationReport.findFirst({
      where: { simulationId: id },
    })

    if (!report) {
      return res.status(404).json({ error: 'Report not yet generated' })
    }

    await cacheReport(id, report)

    res.json(report)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ============================================================================
// GET /designs/:designId/simulations — Paginated List
// ============================================================================

router.get('/design/:designId/list', async (req, res) => {
  try {
    const { designId } = req.params
    const limit = Math.min(parseInt(req.query.limit || '10', 10), 50)
    const offset = parseInt(req.query.offset || '0', 10)

    const design = await prisma.design.findUnique({
      where: { id: designId },
      include: { owner: { select: { clerkId: true } } }
    })

    if (!design) return res.status(404).json({ error: 'Design not found' })
    if (design.owner.clerkId !== req.userId) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    const list = await getCachedSimulationList(designId, { limit, offset }, prisma)

    res.json({
      data: list,
      pagination: { limit, offset, designId },
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ============================================================================
// GET /simulations/:id/audit
// ============================================================================

router.get('/:id/audit', async (req, res) => {
  try {
    const { id } = req.params

    const simulation = await prisma.simulation.findUnique({
      where: { id },
      include: { design: { select: { owner: { select: { clerkId: true } } } } }
    })

    if (!simulation) return res.status(404).json({ error: 'Not found' })
    if (simulation.design.owner.clerkId !== req.userId) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    const auditTrail = await prisma.auditLog.findMany({
      where: { simulationId: id },
      orderBy: { createdAt: 'asc' },
    })

    res.json({
      simulationId: id,
      count: auditTrail.length,
      events: auditTrail,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ============================================================================
// GET /simulations/:id/job-state
// ============================================================================

router.get('/:id/job-state', async (req, res) => {
  try {
    const { id } = req.params

    const simulation = await prisma.simulation.findUnique({
      where: { id },
      include: { design: { select: { owner: { select: { clerkId: true } } } } }
    })

    if (!simulation) return res.status(404).json({ error: 'Not found' })
    if (simulation.design.owner.clerkId !== req.userId) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    const jobState = await getJobState(`sim-${id}`)

    res.json({
      simulationId: id,
      dbStatus: simulation.status,
      queueStatus: jobState,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router