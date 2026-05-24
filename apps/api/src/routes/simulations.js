import { Router } from 'express'
import { prisma } from '../lib/db.js'
import { authMiddleware } from '../middleware/auth.js'
import { cache } from '../lib/redis.js'

const router = Router()

// Simulation state store (in-memory for now, Redis for production)
const activeSimulations = new Map()

// Queuing theory models
class QueueingModel {
  constructor(capacity, serviceRate, failureRate = 0) {
    this.capacity = capacity // Max concurrent requests
    this.serviceRate = serviceRate // Requests per second this block can handle
    this.failureRate = failureRate // Probability of failure (0-1)
    this.queue = []
    this.processing = 0
    this.totalProcessed = 0
    this.totalFailed = 0
    this.totalDropped = 0
    this.latencies = []
    this.utilizationHistory = []
  }

  // Process a batch of requests
  process(requests, timeDelta) {
    const results = []

    // Add incoming to queue
    for (const req of requests) {
      if (this.queue.length + this.processing < this.capacity * 2) {
        this.queue.push({ ...req, queuedAt: Date.now() })
      } else {
        this.totalDropped++
        results.push({ ...req, dropped: true, latency: 0 })
      }
    }

    // Process from queue
    const canProcess = Math.min(
      this.queue.length,
      Math.floor(this.serviceRate * timeDelta),
      this.capacity - this.processing
    )

    for (let i = 0; i < canProcess; i++) {
      const req = this.queue.shift()
      this.processing++

      // Simulate service time (exponential distribution)
      const serviceTime = -Math.log(Math.random()) / this.serviceRate * 1000

      // Check failure
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

    // Update utilization
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
      throughput: this.totalProcessed, // Total since start
    }
  }
}

// Block configuration defaults
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

// Traffic pattern generators
function generateTraffic(pattern, rps, elapsed, duration) {
  switch (pattern) {
    case 'steady':
      return rps

    case 'spike': {
      // 50x spike at 60% through duration, lasts 10% of duration
      const spikeStart = duration * 0.6
      const spikeEnd = spikeStart + duration * 0.1
      if (elapsed >= spikeStart && elapsed <= spikeEnd) {
        return rps * 50
      }
      return rps
    }

    case 'ramp': {
      // Linear ramp from 0 to 10x RPS
      return rps * (1 + (elapsed / duration) * 9)
    }

    case 'chaos': {
      // Random spikes
      return rps * (1 + Math.random() * 20)
    }

    default:
      return rps
  }
}

// Failure injection scenarios
function applyScenario(blockModels, scenario, elapsed, duration) {
  if (!scenario || scenario === 'none') return

  switch (scenario) {
    case 'db_slowdown': {
      // Database slows down at 40% mark
      if (elapsed > duration * 0.4) {
        for (const [id, model] of blockModels) {
          if (id.includes('database') || id.includes('db')) {
            model.serviceRate = model.serviceRate * 0.3 // 70% slowdown
            model.failureRate = Math.min(model.failureRate * 3, 0.3)
          }
        }
      }
      break
    }

    case 'cache_eviction': {
      // Cache fails at 50% mark (thundering herd)
      if (elapsed > duration * 0.5) {
        for (const [id, model] of blockModels) {
          if (id.includes('cache')) {
            model.serviceRate = model.serviceRate * 0.1
            model.failureRate = 0.5 // 50% miss rate
          }
        }
      }
      break
    }

    case 'region_outage': {
      // Random block fails at 30% mark
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
      // Gateway overwhelmed from start
      for (const [id, model] of blockModels) {
        if (id.includes('gateway') || id.includes('lb')) {
          model.capacity = Math.floor(model.capacity * 0.5)
        }
      }
      break
    }
  }
}

// Build simulation graph from design
function buildSimulationGraph(blocks, edges) {
  const blockModels = new Map()
  const adjacency = new Map() // source -> [targets]

  // Create queueing models for each block
  for (const block of blocks) {
    const config = BLOCK_CONFIGS[block.data?.type] || BLOCK_CONFIGS['service']
    // Override with block config if present
    const customCapacity = block.data?.config?.replicas ? config.capacity * block.data.config.replicas : config.capacity
    const customRate = block.data?.config?.cpu ? config.serviceRate * parseFloat(block.data.config.cpu) : config.serviceRate

    blockModels.set(block.id, new QueueingModel(customCapacity, customRate, config.failureRate))
    adjacency.set(block.id, [])
  }

  // Build adjacency list
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

// Run one simulation tick
function runTick(blockModels, adjacency, trafficRps, timeDelta) {
  const metrics = {}
  const requestCounts = new Map()

  // Generate requests for entry points (no incoming edges)
  const entryBlocks = Array.from(adjacency.keys()).filter(id => {
    const hasIncoming = Array.from(adjacency.values()).some(targets => 
      targets.some(t => t.targetId === id)
    )
    return !hasIncoming
  })

  // Distribute traffic to entry points
  const requestsPerEntry = Math.floor(trafficRps * timeDelta / Math.max(entryBlocks.length, 1))

  for (const entryId of entryBlocks) {
    const requests = Array.from({ length: requestsPerEntry }, (_, i) => ({
      id: `req-${Date.now()}-${i}`,
      path: [entryId],
    }))
    requestCounts.set(entryId, requests)
  }

  // Process blocks in topological order (BFS from entry points)
  const processed = new Set()
  const queue = [...entryBlocks]

  while (queue.length > 0) {
    const blockId = queue.shift()
    if (processed.has(blockId)) continue
    processed.add(blockId)

    const model = blockModels.get(blockId)
    const incomingRequests = requestCounts.get(blockId) || []

    // Process requests
    const results = model.process(incomingRequests, timeDelta)
    metrics[blockId] = model.getMetrics()

    // Forward successful requests to next blocks
    const targets = adjacency.get(blockId) || []
    const successful = results.filter(r => !r.dropped && !r.failed)

    for (const target of targets) {
      const targetRequests = requestCounts.get(target.targetId) || []
      // Add path tracking
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

// POST /simulations/:id/run — Start real simulation
router.post('/:id/run', authMiddleware, async (req, res) => {
  const { id } = req.params
  const { trafficPattern = 'steady', rps = 100, duration = 300, scenario = 'none' } = req.body

  try {
    // Get design
    const design = await prisma.design.findFirst({
      where: { id, ownerId: req.user.id },
      include: { blocks: true, edges: true }
    })

    if (!design) return res.status(404).json({ error: 'Design not found' })

    // Convert to React Flow format for simulation
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

    // Build simulation graph
    const { blockModels, adjacency } = buildSimulationGraph(blocks, edges)

    // Create simulation record
    const simulation = await prisma.simulation.create({
      data: {
        designId: id,
        userId: req.user.id,
        trafficPattern,
        rps,
        duration,
        status: 'running',
      }
    })

    // Store active simulation
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

    // Start simulation loop (100ms ticks)
    const timeDelta = 0.1 // 100ms in seconds
    const sim = activeSimulations.get(simulation.id)

    sim.tickInterval = setInterval(async () => {
      sim.elapsed += timeDelta

      // Generate traffic
      const currentRps = generateTraffic(trafficPattern, rps, sim.elapsed, duration)

      // Apply failure scenario
      applyScenario(blockModels, scenario, sim.elapsed, duration)

      // Run tick
      const { metrics } = runTick(blockModels, adjacency, currentRps, timeDelta)

      // Aggregate global metrics
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

      // Store tick data in Redis for WebSocket streaming
      await cache.set(`sim:${simulation.id}:tick`, {
        elapsed: sim.elapsed,
        progress: (sim.elapsed / duration) * 100,
        metrics,
        global: sim.globalMetrics,
        currentRps,
      }, 60)

      // Check completion
      if (sim.elapsed >= duration) {
        clearInterval(sim.tickInterval)

        // Calculate final metrics
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

        // Update simulation record
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
    }, 100) // 100ms ticks

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

// GET /simulations/:id/status — Get current simulation status
router.get('/:id/status', authMiddleware, async (req, res) => {
  try {
    const simulation = await prisma.simulation.findFirst({
      where: { id: req.params.id, userId: req.user.id }
    })

    if (!simulation) return res.status(404).json({ error: 'Simulation not found' })

    // Get live tick data if running
    const tickData = await cache.get(`sim:${req.params.id}:tick`)

    res.json({
      ...simulation,
      live: tickData || null,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /simulations/:id/stop — Stop running simulation
router.post('/:id/stop', authMiddleware, async (req, res) => {
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

// WebSocket endpoint for live streaming (REST fallback)
router.get('/:id/stream', authMiddleware, async (req, res) => {
  try {
    const simulation = await prisma.simulation.findFirst({
      where: { id: req.params.id, userId: req.user.id }
    })

    if (!simulation) return res.status(404).json({ error: 'Not found' })

    // Server-Sent Events fallback
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
