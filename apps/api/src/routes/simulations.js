import { Router } from 'express'
import { requireAuth, getAuth, clerkClient } from '@clerk/express'
import { prisma } from '../lib/db.js'

const router = Router()

// ============================================================
// IN-MEMORY STATE (replaces Redis entirely)
// ============================================================
const tickCache = new Map()        // simId -> latest tick data
const statusCache = new Map()      // cacheKey -> { data, timestamp }
const CACHE_TTL_MS = 800

async function getDbUser(req) {
  const auth = getAuth(req)
  if (!auth?.userId) return null
  let user = await prisma.user.findUnique({
    where: { clerkId: auth.userId },
    select: { id: true, email: true, name: true, avatar: true, tier: true, githubId: true, clerkId: true }
  })
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
    } catch (err) {
      console.error('[AUTO-CREATE] Failed:', err.message)
      return null
    }
  }
  return user
}

async function requireApiAuth(req, res, next) {
  const auth = getAuth(req)
  if (!auth?.userId) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  next()
}
router.use(requireApiAuth)

// ============================================================
// M/M/c QUEUEING SIMULATION ENGINE
// ============================================================

class MMCQueue {
  constructor(blockId, blockType, config) {
    this.blockId = blockId
    this.blockType = blockType
    this.config = config || {}
    const base = this.getBaseConfig(blockType)
    this.servers = Math.max(1, this.config.replicas || base.defaultReplicas)
    this.baseServiceRate = base.serviceRate
    this.capacity = base.capacity * this.servers
    this.failureRate = base.failureRate
    this.baseLatency = base.baseLatency
    const cpuCores = this.parseCpu(this.config.cpu)
    this.serviceRate = this.baseServiceRate * cpuCores * (1 + 0.1 * (this.servers - 1))
    const memoryMB = this.parseMemory(this.config.memory)
    this.capacity += Math.floor(memoryMB / 100)
    if (blockType === 'database') this.applyDatabaseTuning()
    else if (blockType === 'cache') this.applyCacheTuning()
    else if (blockType === 'message-queue') this.applyQueueTuning()
    this.queue = []
    this.busyServers = 0
    this.totalProcessed = 0
    this.totalFailed = 0
    this.totalDropped = 0
    this.latencies = []
    this.utilizationHistory = []
    this.processingRequests = new Map()
    this.isDegraded = false
    this.degradationFactor = 1.0
  }

  getBaseConfig(type) {
    const configs = {
      'api-gateway':    { serviceRate: 8000,  capacity: 5000,  failureRate: 0.0005, baseLatency: 2,  defaultReplicas: 2 },
      'service':        { serviceRate: 500,   capacity: 800,   failureRate: 0.002,  baseLatency: 15, defaultReplicas: 2 },
      'database':       { serviceRate: 150,   capacity: 150,   failureRate: 0.001,  baseLatency: 8,  defaultReplicas: 1 },
      'cache':          { serviceRate: 50000, capacity: 50000,  failureRate: 0.0001, baseLatency: 1,  defaultReplicas: 1 },
      'message-queue':  { serviceRate: 8000,  capacity: 100000, failureRate: 0.0005, baseLatency: 5,  defaultReplicas: 3 },
      'load-balancer':  { serviceRate: 20000, capacity: 20000,  failureRate: 0.0002, baseLatency: 1,  defaultReplicas: 2 },
      'cdn':            { serviceRate: 50000, capacity: 100000,  failureRate: 0.0001, baseLatency: 0.5, defaultReplicas: 3 },
      'client':         { serviceRate: 50,    capacity: 100,    failureRate: 0,      baseLatency: 0,  defaultReplicas: 1 },
      'external-api':   { serviceRate: 100,   capacity: 500,    failureRate: 0.01,   baseLatency: 80, defaultReplicas: 1 },
      'storage':        { serviceRate: 300,   capacity: 2000,   failureRate: 0.001,  baseLatency: 25, defaultReplicas: 1 },
    }
    return configs[type] || configs['service']
  }

  parseCpu(cpuStr) {
    if (!cpuStr) return 1
    const match = String(cpuStr).match(/([0-9.]+)/)
    return match ? parseFloat(match[1]) : 1
  }

  parseMemory(memStr) {
    if (!memStr) return 512
    const match = String(memStr).match(/([0-9.]+)/)
    if (!match) return 512
    const val = parseFloat(match[1])
    if (String(memStr).toLowerCase().includes('gi')) return val * 1024
    if (String(memStr).toLowerCase().includes('mi')) return val
    return val
  }

  applyDatabaseTuning() {
    const engine = this.config.engine || 'postgres'
    const multipliers = { postgres: 1.0, mysql: 0.9, mongodb: 1.1, redis: 2.0 }
    this.serviceRate *= (multipliers[engine] || 1.0)
    const poolSize = this.config.connectionPool || this.config.maxConnections || 20
    this.capacity = Math.min(this.capacity, poolSize * 2)
  }

  applyCacheTuning() {
    const eviction = this.config.eviction || 'allkeys-lru'
    const hitRates = { 'allkeys-lru': 0.85, 'allkeys-lfu': 0.90, 'volatile-lru': 0.80, 'noeviction': 0.95 }
    this.expectedHitRate = hitRates[eviction] || 0.85
    const maxMem = this.parseMemory(this.config.maxMemory)
    this.capacity = Math.max(this.capacity, maxMem * 100)
  }

  applyQueueTuning() {
    const partitions = this.config.partitions || 1
    const replication = this.config.replication || 1
    this.serviceRate *= Math.sqrt(partitions) * (0.5 + replication * 0.5)
    this.servers = partitions
  }

  degrade(factor, failureMultiplier = 1) {
    this.isDegraded = true
    this.degradationFactor = factor
    this.serviceRate *= factor
    this.failureRate = Math.min(this.failureRate * failureMultiplier, 0.5)
  }

  process(requests, timeDelta) {
    const results = []
    const effectiveServiceRate = this.serviceRate * this.degradationFactor
    for (const req of requests) {
      const inSystem = this.queue.length + this.busyServers
      if (inSystem < this.capacity) {
        this.queue.push({ ...req, queuedAt: Date.now() })
      } else {
        this.totalDropped++
        results.push({ ...req, dropped: true, latency: 0, blockId: this.blockId })
      }
    }
    const canStart = Math.min(this.queue.length, this.servers - this.busyServers)
    for (let i = 0; i < canStart; i++) {
      const req = this.queue.shift()
      this.busyServers++
      const serviceTime = this.generateServiceTime(effectiveServiceRate)
      this.processingRequests.set(req.id, { startTime: Date.now(), serviceTime, req })
    }
    const now = Date.now()
    for (const [reqId, proc] of this.processingRequests.entries()) {
      if (now - proc.startTime >= proc.serviceTime) {
        this.processingRequests.delete(reqId)
        this.busyServers--
        this.totalProcessed++
        const totalLatency = now - proc.req.queuedAt + proc.serviceTime + this.baseLatency
        if (Math.random() < this.failureRate) {
          this.totalFailed++
          this.latencies.push(totalLatency)
          results.push({ ...proc.req, failed: true, latency: totalLatency, blockId: this.blockId })
        } else {
          this.latencies.push(totalLatency)
          results.push({ ...proc.req, latency: totalLatency, blockId: this.blockId })
        }
      }
    }
    const utilization = this.busyServers / this.servers
    this.utilizationHistory.push(utilization)
    if (this.utilizationHistory.length > 100) this.utilizationHistory.shift()
    return results
  }

  generateServiceTime(rate) {
    const k = 2
    let sum = 0
    for (let i = 0; i < k; i++) {
      sum += -Math.log(Math.random()) / (rate / k)
    }
    return sum * 1000
  }

  getMetrics() {
    const latencies = this.latencies.slice(-1000)
    const sorted = [...latencies].sort((a, b) => a - b)
    const avgLatency = latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0
    return {
      blockId: this.blockId,
      blockType: this.blockType,
      queueDepth: this.queue.length,
      busyServers: this.busyServers,
      totalServers: this.servers,
      utilization: this.busyServers / this.servers,
      avgUtilization: this.utilizationHistory.reduce((a, b) => a + b, 0) / Math.max(this.utilizationHistory.length, 1),
      totalProcessed: this.totalProcessed,
      totalFailed: this.totalFailed,
      totalDropped: this.totalDropped,
      errorRate: this.totalProcessed > 0 ? (this.totalFailed / (this.totalProcessed + this.totalFailed)) * 100 : 0,
      dropRate: (this.totalProcessed + this.totalFailed + this.totalDropped) > 0 
        ? (this.totalDropped / (this.totalProcessed + this.totalFailed + this.totalDropped)) * 100 : 0,
      avgLatency: Math.round(avgLatency),
      p50Latency: Math.round(sorted[Math.floor(sorted.length * 0.5)] || 0),
      p95Latency: Math.round(sorted[Math.floor(sorted.length * 0.95)] || 0),
      p99Latency: Math.round(sorted[Math.floor(sorted.length * 0.99)] || 0),
      throughput: this.totalProcessed,
      isDegraded: this.isDegraded,
      config: { replicas: this.servers, serviceRate: Math.round(this.serviceRate), capacity: this.capacity }
    }
  }
}

const NETWORK_LATENCY = { http: 8, grpc: 3, websocket: 5, event: 12, db: 3 }

function generateTraffic(pattern, baseRps, elapsed, duration) {
  switch (pattern) {
    case 'steady': return baseRps
    case 'spike': {
      const spikeStart = duration * 0.6
      const spikeEnd = spikeStart + duration * 0.1
      const spikePeak = spikeStart + (spikeEnd - spikeStart) * 0.5
      if (elapsed >= spikeStart && elapsed <= spikeEnd) {
        const normalized = (elapsed - spikePeak) / ((spikeEnd - spikeStart) / 2)
        return baseRps * (1 + 49 * Math.exp(-normalized * normalized))
      }
      return baseRps
    }
    case 'ramp': return baseRps * (1 + (elapsed / duration) * 9)
    case 'chaos': {
      const noise = Math.sin(elapsed * 0.8) * 0.3 + Math.sin(elapsed * 2.3) * 0.2 + Math.random() * 0.5
      return baseRps * Math.max(0.1, 1 + noise * 5)
    }
    default: return baseRps
  }
}

function applyScenario(blockModels, scenario, elapsed, duration) {
  if (!scenario || scenario === 'none') return
  switch (scenario) {
    case 'db_slowdown': {
      if (elapsed > duration * 0.4) {
        for (const [id, model] of blockModels) {
          if (model.blockType === 'database') model.degrade(0.3, 3)
        }
      }
      break
    }
    case 'cache_eviction': {
      if (elapsed > duration * 0.5) {
        for (const [id, model] of blockModels) {
          if (model.blockType === 'cache') model.degrade(0.1, 10)
        }
      }
      break
    }
    case 'region_outage': {
      const outageStart = duration * 0.3
      const outageEnd = duration * 0.5
      if (elapsed > outageStart && elapsed < outageEnd) {
        const blockIds = Array.from(blockModels.keys())
        const victim = blockIds[Math.floor(Math.random() * blockIds.length)]
        const model = blockModels.get(victim)
        if (model) model.degrade(0.01, 50)
      }
      break
    }
    case 'ddos': {
      for (const [id, model] of blockModels) {
        if (model.blockType === 'api-gateway' || model.blockType === 'load-balancer') {
          model.capacity = Math.floor(model.capacity * 0.3)
        }
      }
      break
    }
  }
}

function buildSimulationGraph(blocks, edges) {
  const blockModels = new Map()
  const adjacency = new Map()
  const edgeWeights = new Map()
  for (const block of blocks) {
    const model = new MMCQueue(block.id, block.data?.type || 'service', block.data?.config || {})
    blockModels.set(block.id, model)
    adjacency.set(block.id, [])
    edgeWeights.set(block.id, [])
  }
  for (const edge of edges) {
    const targets = adjacency.get(edge.source) || []
    const weights = edgeWeights.get(edge.source) || []
    const connectionType = edge.data?.connectionType || 'http'
    const weight = edge.data?.weight || 1
    const latency = NETWORK_LATENCY[connectionType] || 10
    targets.push({ targetId: edge.target, connectionType, weight, latency })
    weights.push({ targetId: edge.target, weight })
    adjacency.set(edge.source, targets)
    edgeWeights.set(edge.source, weights)
  }
  for (const [sourceId, weights] of edgeWeights) {
    const totalWeight = weights.reduce((sum, t) => sum + t.weight, 0)
    if (totalWeight > 0) {
      edgeWeights.set(sourceId, weights.map(t => ({ ...t, targetId: t.targetId, weight: t.weight / totalWeight })))
    }
  }
  return { blockModels, adjacency, edgeWeights }
}

function runTick(blockModels, adjacency, edgeWeights, trafficRps, timeDelta) {
  const metrics = {}
  const requestCounts = new Map()
  const allTargets = new Set()
  for (const targets of adjacency.values()) targets.forEach(t => allTargets.add(t.targetId))
  const entryBlocks = Array.from(adjacency.keys()).filter(id => !allTargets.has(id))
  const requestsPerEntry = Math.max(1, Math.floor(trafficRps * timeDelta / Math.max(entryBlocks.length, 1)))
  for (const entryId of entryBlocks) {
    const requests = Array.from({ length: requestsPerEntry }, (_, i) => ({
      id: `req-${Date.now()}-${Math.random().toString(36).slice(2, 9)}-${i}`,
      path: [entryId],
      accumulatedLatency: 0,
      startTime: Date.now(),
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
    const weights = edgeWeights.get(blockId) || []
    const successful = results.filter(r => !r.dropped && !r.failed)
    for (const req of successful) {
      if (targets.length === 0) continue
      const rand = Math.random()
      let cumulative = 0
      let selectedTarget = targets[0]
      for (const weighted of weights) {
        cumulative += weighted.weight
        if (rand <= cumulative) {
          selectedTarget = targets.find(t => t.targetId === weighted.targetId)
          break
        }
      }
      if (!selectedTarget) continue
      const targetRequests = requestCounts.get(selectedTarget.targetId) || []
      targetRequests.push({
        ...req,
        path: [...req.path, selectedTarget.targetId],
        accumulatedLatency: req.accumulatedLatency + selectedTarget.latency + req.latency,
      })
      requestCounts.set(selectedTarget.targetId, targetRequests)
      if (!processed.has(selectedTarget.targetId)) queue.push(selectedTarget.targetId)
    }
  }
  return { metrics, requestCounts }
}

const activeSimulations = new Map()

// ============================================================
// POST /simulations/:id/run
// Only 2 DB writes: start and completion
// ============================================================
router.post('/:id/run', async (req, res) => {
  const user = await getDbUser(req)
  if (!user) return res.status(401).json({ error: 'User not found' })

  const { id } = req.params
  const { trafficPattern = 'steady', rps = 100, duration = 300, scenario = 'none', warmupSeconds = 5 } = req.body

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
      data: { connectionType: e.connectionType, weight: e.data?.weight || 1 }
    }))

    const { blockModels, adjacency, edgeWeights } = buildSimulationGraph(blocks, edges)

    // DB WRITE #1: create simulation record
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

    const simState = {
      simulationId: simulation.id,
      blockModels, adjacency, edgeWeights,
      trafficPattern, rps, duration, scenario,
      elapsed: 0, warmupElapsed: 0,
      tickInterval: null, logs: [],
      globalMetrics: { totalRequests: 0, totalErrors: 0, totalDropped: 0, latencies: [] },
      isWarmup: true,
      startTime: Date.now(),
    }

    activeSimulations.set(simulation.id, simState)

    const timeDelta = 0.1

    simState.tickInterval = setInterval(async () => {
      simState.elapsed += timeDelta

      if (simState.isWarmup) {
        simState.warmupElapsed += timeDelta
        if (simState.warmupElapsed >= warmupSeconds) {
          simState.isWarmup = false
          for (const model of blockModels.values()) {
            model.totalProcessed = 0
            model.totalFailed = 0
            model.totalDropped = 0
            model.latencies = []
          }
          simState.globalMetrics = { totalRequests: 0, totalErrors: 0, totalDropped: 0, latencies: [] }
        }
      }

      const currentRps = generateTraffic(trafficPattern, rps, simState.elapsed, duration)
      applyScenario(blockModels, scenario, simState.elapsed, duration)

      const { metrics } = runTick(blockModels, adjacency, edgeWeights, currentRps, timeDelta)

      let tickRequests = 0, tickErrors = 0, tickDropped = 0
      const tickLatencies = []

      for (const [blockId, blockMetrics] of Object.entries(metrics)) {
        tickRequests += blockMetrics.totalProcessed
        tickErrors += blockMetrics.totalFailed
        tickDropped += blockMetrics.totalDropped
        tickLatencies.push(...blockModels.get(blockId).latencies.slice(-10))
      }

      if (!simState.isWarmup) {
        simState.globalMetrics.totalRequests += tickRequests
        simState.globalMetrics.totalErrors += tickErrors
        simState.globalMetrics.totalDropped += tickDropped
        simState.globalMetrics.latencies.push(...tickLatencies)
      }

      const tickData = {
        elapsed: simState.elapsed,
        progress: Math.min((simState.elapsed / duration) * 100, 100),
        metrics,
        global: simState.isWarmup ? null : simState.globalMetrics,
        currentRps,
        isWarmup: simState.isWarmup,
        scenarioActive: scenario !== 'none' && simState.elapsed > duration * 0.3,
      }

      // IN-MEMORY ONLY — no Redis, no DB
      tickCache.set(simulation.id, tickData)

      if (simState.elapsed >= duration) {
        clearInterval(simState.tickInterval)

        const allLatencies = simState.globalMetrics.latencies
        const sorted = [...allLatencies].sort((a, b) => a - b)
        const effectiveDuration = duration - warmupSeconds

        const finalMetrics = {
          totalRequests: simState.globalMetrics.totalRequests,
          avgLatency: allLatencies.length > 0 ? allLatencies.reduce((a, b) => a + b, 0) / allLatencies.length : 0,
          p50Latency: sorted[Math.floor(sorted.length * 0.5)] || 0,
          p95Latency: sorted[Math.floor(sorted.length * 0.95)] || 0,
          p99Latency: sorted[Math.floor(sorted.length * 0.99)] || 0,
          errorRate: simState.globalMetrics.totalRequests > 0
            ? (simState.globalMetrics.totalErrors / simState.globalMetrics.totalRequests) * 100 : 0,
          dropRate: (simState.globalMetrics.totalRequests + simState.globalMetrics.totalErrors + simState.globalMetrics.totalDropped) > 0
            ? (simState.globalMetrics.totalDropped / (simState.globalMetrics.totalRequests + simState.globalMetrics.totalErrors + simState.globalMetrics.totalDropped)) * 100 : 0,
          throughput: effectiveDuration > 0 ? simState.globalMetrics.totalRequests / effectiveDuration : 0,
          availability: simState.globalMetrics.totalRequests > 0
            ? ((simState.globalMetrics.totalRequests - simState.globalMetrics.totalErrors) / simState.globalMetrics.totalRequests) * 100 : 100,
          duration, warmupSeconds,
          blocksAnalyzed: blocks.length,
          edgesAnalyzed: edges.length,
        }

        // DB WRITE #2: update completion
        await prisma.simulation.update({
          where: { id: simulation.id },
          data: { status: 'completed', completedAt: new Date(), metrics: finalMetrics, logs: simState.logs }
        })

        activeSimulations.delete(simulation.id)
        tickCache.delete(simulation.id)
      }
    }, 100)

    res.status(201).json({
      simulationId: simulation.id,
      status: 'running',
      duration,
      warmupSeconds,
      blocksCount: blocks.length,
      edgesCount: edges.length,
      message: 'Simulation started',
    })

  } catch (err) {
    console.error('Simulation error:', err)
    res.status(500).json({ error: err.message })
  }
})

// ============================================================
// GET /simulations/:id/status — cached, minimal DB
// ============================================================
router.get('/:id/status', async (req, res) => {
  const user = await getDbUser(req)
  if (!user) return res.status(401).json({ error: 'User not found' })

  const simId = req.params.id
  const cacheKey = `status:${simId}:${user.id}`

  try {
    const cached = statusCache.get(cacheKey)
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
      return res.json(cached.data)
    }

    const simulation = await prisma.simulation.findFirst({
      where: { id: simId, userId: user.id },
      select: {
        id: true, status: true, trafficPattern: true, rps: true,
        duration: true, metrics: true, startedAt: true, completedAt: true,
        createdAt: true, updatedAt: true,
      }
    })
    if (!simulation) return res.status(404).json({ error: 'Simulation not found' })

    const tickData = tickCache.get(simId)
    const result = { ...simulation, metrics: simulation.metrics || tickData?.global, live: tickData || null }

    statusCache.set(cacheKey, { data: result, timestamp: Date.now() })
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ============================================================
// POST /simulations/:id/stop
// ============================================================
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
      tickCache.delete(req.params.id)
    }
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ============================================================
// GET /simulations/:id/stream — SSE, memory only
// ============================================================
router.get('/:id/stream', async (req, res) => {
  const user = await getDbUser(req)
  if (!user) return res.status(401).json({ error: 'User not found' })

  try {
    const sim = await prisma.simulation.findFirst({
      where: { id: req.params.id, userId: user.id },
      select: { id: true, status: true }
    })
    if (!sim) return res.status(404).json({ error: 'Not found' })

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.flushHeaders?.()

    const tickData = tickCache.get(req.params.id)
    if (tickData) {
      res.write(`data: ${JSON.stringify(tickData)}\n\n`)
    }

    let pollCount = 0
    const MAX_POLLS = 6000
    const POLL_MS = 500

    const sendTick = async () => {
      pollCount++
      if (pollCount > MAX_POLLS) {
        res.write('event: end\n')
        res.write('data: {\"reason\":\"timeout\"}\n\n')
        res.end()
        return
      }

      try {
        // MEMORY ONLY — no DB, no Redis
        const data = tickCache.get(req.params.id)
        if (data) {
          res.write(`data: ${JSON.stringify(data)}\n\n`)
        }

        const isActive = activeSimulations.has(req.params.id)

        // Check DB only every 10 polls (5s)
        let dbStatus = sim.status
        if (pollCount % 10 === 0) {
          const dbSim = await prisma.simulation.findUnique({
            where: { id: req.params.id },
            select: { status: true }
          })
          if (dbSim) dbStatus = dbSim.status
        }

        if (dbStatus === 'running' && isActive) {
          setTimeout(sendTick, POLL_MS)
        } else if (dbStatus === 'completed' || dbStatus === 'stopped' || dbStatus === 'failed') {
          const finalData = tickCache.get(req.params.id)
          if (finalData) {
            res.write(`data: ${JSON.stringify({ ...finalData, progress: 100, status: dbStatus })}\n\n`)
          }
          res.write('event: end\n')
          res.write(`data: {\"status\":\"${dbStatus}\"}\n\n`)
          res.end()
        } else {
          res.write('event: end\n')
          res.write('data: {\"status\":\"unknown\"}\n\n')
          res.end()
        }
      } catch (err) {
        console.error('SSE poll error:', err)
        res.write('event: error\n')
        res.write(`data: {\"error\":\"${err.message}\"}\n\n`)
        res.end()
      }
    }

    sendTick()

    req.on('close', () => {})

  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router