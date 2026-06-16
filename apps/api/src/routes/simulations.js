import { Router } from 'express'
import { requireAuth, getAuth, clerkClient } from '@clerk/express'
import { prisma } from '../lib/db.js'
import { cache } from '../lib/redis.js'

const router = Router()

// Helper: Get DB user from Clerk auth
async function getDbUser(req) {
  const auth = getAuth(req)
  if (!auth?.userId) return null
  
  // Try to find existing user
  let user = await prisma.user.findUnique({
    where: { clerkId: auth.userId },
    select: { id: true, email: true, name: true, avatar: true, tier: true, githubId: true, clerkId: true }
  })
  
  // Auto-create from Clerk if not in DB yet
  if (!user) {
    try {
      const clerkUser = await clerkClient.users.getUser(auth.userId)
      const primaryEmail = clerkUser.emailAddresses?.[0]?.emailAddress
      
      user = await prisma.user.create({
        data: {
          clerkId: auth.userId,
          email: primaryEmail || `user-${auth.userId}@clerk.dev`,
          name: `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || clerkUser.username || 'User',
          avatar: clerkUser.imageUrl,
          tier: 'free',
        },
        select: { id: true, email: true, name: true, avatar: true, tier: true, githubId: true, clerkId: true }
      })
      console.log(`[AUTO-CREATE] User created: ${user.id} (${user.email})`)
    } catch (err) {
      console.error('[AUTO-CREATE] Failed:', err.message)
      return null
    }
  }
  
  return user
}

// Apply Clerk's built-in auth to all routes
router.use(requireAuth())

// Simulation state store (in-memory for now, Redis for production)
const activeSimulations = new Map()

// Queuing theory models
class QueueingModel {
  constructor(capacity, serviceRate, failureRate = 0) {
    this.capacity = capacity
    this.serviceRate = serviceRate
    this.failureRate = failureRate
    this.queue = []
    this.processing = 0
    this.totalProcessed = 0
    this.totalFailed = 0
    this.totalDropped = 0
    this.latencies = []
    this.utilizationHistory = []
  }

  process(requests, timeDelta) {
    const results = []

    for (const req of requests) {
      if (this.queue.length + this.processing < this.capacity * 2) {
        this.queue.push({ ...req, queuedAt: Date.now() })
      } else {
        this.totalDropped++
        results.push({ ...req, dropped: true, latency: 0 })
      }
    }

    const canProcess = Math.min(
      this.queue.length,
      Math.floor(this.serviceRate * timeDelta),
      this.capacity - this.processing
    )

    for (let i = 0; i < canProcess; i++) {
      const req = this.queue.shift()
      this.processing++

      const serviceTime = -Math.log(Math.random()) / this.serviceRate * 1000

      if (Math.random() < this.failureRate) {
        this.totalFailed++
        this.processing--
        this.latencies.push(serviceTime)
        results.push({ ...req, failed: true, latency: serviceTime })
      } else {
        this.totalProcessed++
        this.processing--
        this.latencies.push(serviceTime)
        results.push({ ...req, latency: serviceTime })
      }
    }

    const utilization = this.processing / this.capacity
    this.utilizationHistory.push(utilization)
    if (this.utilizationHistory.length > 100) this.utilizationHistory.shift()

    return results
  }

  getMetrics() {
    const latencies = this.latencies.slice(-1000)
    const sorted = [...latencies].sort((a, b) => a - b)

    return {
      queueDepth: this.queue.length,
      processing: this.processing,
      utilization: this.processing / this.capacity,
      avgUtilization: this.utilizationHistory.reduce((a, b) => a + b, 0) / this.utilizationHistory.length,
      totalProcessed: this.totalProcessed,
      totalFailed: this.totalFailed,
      totalDropped: this.totalDropped,
      errorRate: this.totalProcessed > 0 ? (this.totalFailed / (this.totalProcessed + this.totalFailed)) * 100 : 0,
      avgLatency: latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0,
      p50Latency: sorted[Math.floor(sorted.length * 0.5)] || 0,
      p95Latency: sorted[Math.floor(sorted.length * 0.95)] || 0,
      p99Latency: sorted[Math.floor(sorted.length * 0.99)] || 0,
      throughput: this.totalProcessed,
    }
  }
}

const BLOCK_CONFIGS = {
  'api-gateway': { capacity: 10000, serviceRate: 5000, failureRate: 0.001 },
  'service': { capacity: 1000, serviceRate: 500, failureRate: 0.005 },
  'database': { capacity: 100, serviceRate: 100, failureRate: 0.002 },
  'cache': { capacity: 50000, serviceRate: 10000, failureRate: 0.0001 },
  'message-queue': { capacity: 100000, serviceRate: 5000, failureRate: 0.001 },
  'load-balancer': { capacity: 50000, serviceRate: 20000, failureRate: 0.0005 },
  'cdn': { capacity: 100000, serviceRate: 50000, failureRate: 0.0001 },
  'client': { capacity: 100, serviceRate: 10, failureRate: 0 },
  'external-api': { capacity: 1000, serviceRate: 200, failureRate: 0.02 },
  'storage': { capacity: 5000, serviceRate: 500, failureRate: 0.001 },
}

function generateTraffic(pattern, rps, elapsed, duration) {
  switch (pattern) {
    case 'steady':
      return rps
    case 'spike': {
      const spikeStart = duration * 0.6
      const spikeEnd = spikeStart + duration * 0.1
      if (elapsed >= spikeStart && elapsed <= spikeEnd) return rps * 50
      return rps
    }
    case 'ramp':
      return rps * (1 + (elapsed / duration) * 9)
    case 'chaos':
      return rps * (1 + Math.random() * 20)
    default:
      return rps
  }
}

function applyScenario(blockModels, scenario, elapsed, duration) {
  if (!scenario || scenario === 'none') return

  switch (scenario) {
    case 'db_slowdown': {
      if (elapsed > duration * 0.4) {
        for (const [id, model] of blockModels) {
          if (id.includes('database') || id.includes('db')) {
            model.serviceRate = model.serviceRate * 0.3
            model.failureRate = Math.min(model.failureRate * 3, 0.3)
          }
        }
      }
      break
    }
    case 'cache_eviction': {
      if (elapsed > duration * 0.5) {
        for (const [id, model] of blockModels) {
          if (id.includes('cache')) {
            model.serviceRate = model.serviceRate * 0.1
            model.failureRate = 0.5
          }
        }
      }
      break
    }
    case 'region_outage': {
      if (elapsed > duration * 0.3 && elapsed < duration * 0.5) {
        const blockIds = Array.from(blockModels.keys())
        const victim = blockIds[Math.floor(Math.random() * blockIds.length)]
        const model = blockModels.get(victim)
        if (model) {
          model.serviceRate = model.serviceRate * 0.01
          model.failureRate = 0.95
        }
      }
      break
    }
    case 'ddos': {
      for (const [id, model] of blockModels) {
        if (id.includes('gateway') || id.includes('lb')) {
          model.capacity = Math.floor(model.capacity * 0.5)
        }
      }
      break
    }
  }
}

function buildSimulationGraph(blocks, edges) {
  const blockModels = new Map()
  const adjacency = new Map()

  for (const block of blocks) {
    const config = BLOCK_CONFIGS[block.data?.type] || BLOCK_CONFIGS['service']
    const customCapacity = block.data?.config?.replicas ? config.capacity * block.data.config.replicas : config.capacity
    const customRate = block.data?.config?.cpu ? config.serviceRate * parseFloat(block.data.config.cpu) : config.serviceRate

    blockModels.set(block.id, new QueueingModel(customCapacity, customRate, config.failureRate))
    adjacency.set(block.id, [])
  }

  for (const edge of edges) {
    const targets = adjacency.get(edge.source) || []
    targets.push({
      targetId: edge.target,
      connectionType: edge.data?.connectionType || 'http',
      weight: edge.data?.weight || 1,
    })
    adjacency.set(edge.source, targets)
  }

  return { blockModels, adjacency }
}

function runTick(blockModels, adjacency, trafficRps, timeDelta) {
  const metrics = {}
  const requestCounts = new Map()

  const entryBlocks = Array.from(adjacency.keys()).filter(id => {
    const hasIncoming = Array.from(adjacency.values()).some(targets =>
      targets.some(t => t.targetId === id)
    )
    return !hasIncoming
  })

  const requestsPerEntry = Math.floor(trafficRps * timeDelta / Math.max(entryBlocks.length, 1))

  for (const entryId of entryBlocks) {
    const requests = Array.from({ length: requestsPerEntry }, (_, i) => ({
      id: `req-${Date.now()}-${i}`,
      path: [entryId],
    }))
    requestCounts.set(entryId, requests)
  }

  const processed = new Set()
  const queue = [...entryBlocks]

  while (queue.length > 0) {
    const blockId = queue.shift()
    if (processed.has(blockId)) continue
    processed.add(blockId)

    const model = blockModels.get(blockId)
    const incomingRequests = requestCounts.get(blockId) || []

    const results = model.process(incomingRequests, timeDelta)
    metrics[blockId] = model.getMetrics()

    const targets = adjacency.get(blockId) || []
    const successful = results.filter(r => !r.dropped && !r.failed)

    for (const target of targets) {
      const targetRequests = requestCounts.get(target.targetId) || []
      const forwarded = successful.map(r => ({
        ...r,
        path: [...r.path, target.targetId],
      }))
      targetRequests.push(...forwarded)
      requestCounts.set(target.targetId, targetRequests)

      if (!processed.has(target.targetId)) {
        queue.push(target.targetId)
      }
    }
  }

  return { metrics, requestCounts }
}

// POST /simulations/:id/run
router.post('/:id/run', async (req, res) => {
  const user = await getDbUser(req)
  if (!user) return res.status(401).json({ error: 'User not found' })

  const { id } = req.params
  const { trafficPattern = 'steady', rps = 100, duration = 300, scenario = 'none' } = req.body

  try {
    const design = await prisma.design.findFirst({
      where: { id, ownerId: user.id },
      include: { blocks: true, edges: true }
    })

    if (!design) return res.status(404).json({ error: 'Design not found' })

    const blocks = design.blocks.map(b => ({
      id: b.id,
      data: {
        type: b.type,
        label: b.label,
        config: typeof b.config === 'string' ? JSON.parse(b.config) : b.config,
      }
    }))

    const edges = design.edges.map(e => ({
      id: e.id,
      source: e.sourceId,
      target: e.targetId,
      data: {
        connectionType: e.connectionType,
      }
    }))

    const { blockModels, adjacency } = buildSimulationGraph(blocks, edges)

    const simulation = await prisma.simulation.create({
      data: {
        designId: id,
        userId: user.id,
        trafficPattern,
        rps,
        duration,
        status: 'running',
      }
    })

    activeSimulations.set(simulation.id, {
      simulationId: simulation.id,
      blockModels,
      adjacency,
      trafficPattern,
      rps,
      duration,
      scenario,
      elapsed: 0,
      tickInterval: null,
      logs: [],
      globalMetrics: {
        totalRequests: 0,
        totalErrors: 0,
        totalDropped: 0,
        latencies: [],
      }
    })

    const timeDelta = 0.1
    const sim = activeSimulations.get(simulation.id)

    sim.tickInterval = setInterval(async () => {
      sim.elapsed += timeDelta

      const currentRps = generateTraffic(trafficPattern, rps, sim.elapsed, duration)
      applyScenario(blockModels, scenario, sim.elapsed, duration)

      const { metrics } = runTick(blockModels, adjacency, currentRps, timeDelta)

      let tickRequests = 0
      let tickErrors = 0
      let tickDropped = 0
      const tickLatencies = []

      for (const [blockId, blockMetrics] of Object.entries(metrics)) {
        tickRequests += blockMetrics.totalProcessed
        tickErrors += blockMetrics.totalFailed
        tickDropped += blockMetrics.totalDropped
        tickLatencies.push(...blockModels.get(blockId).latencies.slice(-10))
      }

      sim.globalMetrics.totalRequests += tickRequests
      sim.globalMetrics.totalErrors += tickErrors
      sim.globalMetrics.totalDropped += tickDropped
      sim.globalMetrics.latencies.push(...tickLatencies)

      await cache.set(`sim:${simulation.id}:tick`, {
        elapsed: sim.elapsed,
        progress: (sim.elapsed / duration) * 100,
        metrics,
        global: sim.globalMetrics,
        currentRps,
      }, 60)

      if (sim.elapsed >= duration) {
        clearInterval(sim.tickInterval)

        const allLatencies = sim.globalMetrics.latencies
        const sorted = [...allLatencies].sort((a, b) => a - b)

        const finalMetrics = {
          totalRequests: sim.globalMetrics.totalRequests,
          avgLatency: allLatencies.length > 0 ? allLatencies.reduce((a, b) => a + b, 0) / allLatencies.length : 0,
          p50Latency: sorted[Math.floor(sorted.length * 0.5)] || 0,
          p95Latency: sorted[Math.floor(sorted.length * 0.95)] || 0,
          p99Latency: sorted[Math.floor(sorted.length * 0.99)] || 0,
          errorRate: sim.globalMetrics.totalRequests > 0
            ? (sim.globalMetrics.totalErrors / sim.globalMetrics.totalRequests) * 100
            : 0,
          throughput: sim.globalMetrics.totalRequests / duration,
          availability: sim.globalMetrics.totalRequests > 0
            ? ((sim.globalMetrics.totalRequests - sim.globalMetrics.totalErrors) / sim.globalMetrics.totalRequests) * 100
            : 100,
          duration,
        }

        await prisma.simulation.update({
          where: { id: simulation.id },
          data: {
            status: 'completed',
            completedAt: new Date(),
            metrics: finalMetrics,
            logs: sim.logs,
          }
        })

        activeSimulations.delete(simulation.id)
        await cache.del(`sim:${simulation.id}:tick`)
      }
    }, 100)

    res.status(201).json({
      simulationId: simulation.id,
      status: 'running',
      duration,
      message: 'Simulation started',
    })

  } catch (err) {
    console.error('Simulation error:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /simulations/:id/status
router.get('/:id/status', async (req, res) => {
  const user = await getDbUser(req)
  if (!user) return res.status(401).json({ error: 'User not found' })

  try {
    const simulation = await prisma.simulation.findFirst({
      where: { id: req.params.id, userId: user.id }
    })

    if (!simulation) return res.status(404).json({ error: 'Simulation not found' })

    const tickData = await cache.get(`sim:${req.params.id}:tick`)

    res.json({
      ...simulation,
      live: tickData || null,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /simulations/:id/stop
router.post('/:id/stop', async (req, res) => {
  const user = await getDbUser(req)
  if (!user) return res.status(401).json({ error: 'User not found' })

  try {
    const sim = activeSimulations.get(req.params.id)
    if (sim) {
      clearInterval(sim.tickInterval)
      activeSimulations.delete(req.params.id)

      await prisma.simulation.update({
        where: { id: req.params.id },
        data: { status: 'stopped', completedAt: new Date() }
      })

      await cache.del(`sim:${req.params.id}:tick`)
    }

    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /simulations/:id/stream
router.get('/:id/stream', async (req, res) => {
  const user = await getDbUser(req)
  if (!user) return res.status(401).json({ error: 'User not found' })

  try {
    const simulation = await prisma.simulation.findFirst({
      where: { id: req.params.id, userId: user.id }
    })

    if (!simulation) return res.status(404).json({ error: 'Not found' })

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')

    const sendTick = async () => {
      const tickData = await cache.get(`sim:${req.params.id}:tick`)
      if (tickData) {
        res.write(`data: ${JSON.stringify(tickData)}\n\n`)
      }

      if (simulation.status === 'running' && activeSimulations.has(req.params.id)) {
        setTimeout(sendTick, 500)
      } else {
        res.write('event: end\n')
        res.write('data: {}\n\n')
        res.end()
      }
    }

    sendTick()

  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router