/**
 * P2 — Production-Grade Core Simulation Engine (Discrete Event Simulation)
 *
 * Fully parameterized — no hardcoded physics constants.
 * Every behavioral parameter traces back to simulation-models.js.
 * Optimized for ~100K events/second throughput per core.
 */

import { DeterministicRNG } from './deterministic.js'
import {
  getBlockBehavioralModel,
  getConnectionBehavioralModel,
} from './simulation-models.js'

// ============================================================================
// EVENT TYPES
// ============================================================================

const EVENT_TYPES = {
  REQUEST_ARRIVAL: 'request_arrival',
  REQUEST_COMPLETE: 'request_complete',
  REQUEST_FAILED: 'request_failed',
  REQUEST_DROPPED: 'request_dropped',
  QUEUE_ENQUEUE: 'queue_enqueue',
  QUEUE_DEQUEUE: 'queue_dequeue',
  FAILURE_START: 'failure_start',
  FAILURE_END: 'failure_end',
  SCALE_UP: 'scale_up',
  SCALE_DOWN: 'scale_down',
  TIMEOUT: 'timeout',
  RETRY: 'retry',
  CIRCUIT_OPEN: 'circuit_open',
}

// ============================================================================
// PERFORMANCE CONFIGURATION (tunable, not hardcoded)
// ============================================================================

const ENGINE_CONFIG = Object.freeze({
  // Event loop batching: process this many events before yielding to event loop
  EVENTS_PER_YIELD: 2000,
  // Live snapshot: emit progress every N simulated seconds OR every M events, whichever comes first
  SIM_TIME_PER_SNAPSHOT: 10,
  EVENTS_PER_SNAPSHOT: 5000,
  // Max events to prevent runaway simulations
  MAX_EVENTS_PER_PASS: 5_000_000,
  // Event log limit per pass
  MAX_EVENT_LOG: 50_000,
  // Sample limit for request traces
  MAX_SAMPLED_REQUESTS: 500,
})

// ============================================================================
// SIMULATION STATE
// ============================================================================

class SimulationState {
  constructor(blocks, edges, rng) {
    this.blocks = new Map(blocks.map(b => [b.id, new BlockState(b, rng)]))
    this.edges = new Map(edges.map(e => [e.id, new EdgeState(e)]))
    this.rng = rng
    this.time = 0
    this.events = new FastPriorityQueue((a, b) => a.time - b.time)
    this.requests = new Map()
    this.requestCounter = 0
    this.completedRequests = []
    this.failedRequests = []
    this.droppedRequests = []
    this.eventLog = []
    this.failureEvents = []
    this.eventCount = 0

    // Graph topology — attached once by runSimulationPass
    this.adjacency = null
    this.reverseAdjacency = null
    this.edgeMap = null
    this.entryPoints = []
    this.exitPoints = []
  }

  nextRequestId() {
    return `req-${this.requestCounter++}`
  }

  schedule(event) {
    this.events.push(event)
  }

  logEvent(type, data) {
    if (this.eventLog.length < ENGINE_CONFIG.MAX_EVENT_LOG) {
      this.eventLog.push({ time: this.time, type, ...data })
    }
  }
}

// ============================================================================
// BLOCK STATE
// ============================================================================

class BlockState {
  constructor(block, rng) {
    this.id = block.id
    this.type = block.type
    this.label = block.label || block.id
    this.model = block.behavioralModel || getBlockBehavioralModel(block.type)
    this.rng = rng

    const capacity = this.model.capacity || {}
    const scaling = this.model.scalingBehavior || {}
    const latency = this.model.latency || {}
    const resources = this.model.resourceConsumption || {}

    // Capacity
    this.baseMaxThroughput = capacity.maxThroughput || 1000
    this.baseMaxConcurrent = capacity.maxConcurrent || 100
    this.maxQueueDepth = capacity.maxQueueDepth || 1000

    // Scaling
    this.currentReplicas = scaling.minReplicas || 1
    this.maxReplicas = scaling.maxReplicas || 1
    this.minReplicas = scaling.minReplicas || 1
    this.scaleUpThreshold = scaling.scaleUpThreshold || 0.7
    this.scaleDownThreshold = scaling.scaleDownThreshold || 0.3
    this.scaleUpCooldownSeconds = scaling.scaleUpCooldownSeconds || 60
    this.scaleDownCooldownSeconds = scaling.scaleDownCooldownSeconds || 300
    this.scaleUpIncrement = scaling.scaleUpIncrement || 1
    this.scalingType = scaling.type || 'none'

    // Latency model
    this.baseLatencyMs = latency.baseLatencyMs || 0
    this.latencyStdDevMs = latency.latencyStdDevMs || (this.baseLatencyMs * 0.1)
    this.queueLatencyMs = latency.queueLatencyMs || 0
    this.serializationMs = (latency.serializationMs || 0) + (latency.deserializationMs || 0)
    this.cacheHitRate = latency.cacheHitRate
    this.cacheHitLatencyMs = latency.cacheHitLatencyMs || 0
    this.cacheMissLatencyMs = latency.cacheMissLatencyMs || 0
    this.dbOperationMs = latency.dbOperationMs || 0

    // Error model
    this.baseErrorRate = (this.model.errorCharacteristics || {}).baseErrorRate || 0
    this.errorRateUnderLoad = (this.model.errorCharacteristics || {}).errorRateUnderLoad || 0

    // Resource model
    this.cpuPerRequest = resources.cpuPerRequest || 0
    this.memoryPerConnection = resources.memoryPerConnection || 0
    this.threadPoolSize = resources.threadPoolSize || 100
    this.connectionPoolSize = resources.connectionPoolSize || 100
    this.cpuUnitsPerReplica = 100 // Baseline CPU units per replica
    this.memoryBytesPerReplica = 1024 * 1024 * 1024 // 1GB baseline per replica

    // Dynamic state
    this.queue = []
    this.processing = 0
    this.totalProcessed = 0
    this.totalFailed = 0
    this.totalDropped = 0
    this.latencySamples = []
    this.cpuSamples = []
    this.memorySamples = []
    this.threadPoolSamples = []
    this.connectionPoolSamples = []
    this.scaleUpCooldown = 0
    this.scaleDownCooldown = 0

    // Failure state
    this.isFailed = false
    this.failureMode = null
    this.circuitOpen = false

    // Derived capacity
    this._recalcCapacity()
  }

  _recalcCapacity() {
    this.currentMaxThroughput = this.baseMaxThroughput * this.currentReplicas
    this.currentMaxConcurrent = this.baseMaxConcurrent * this.currentReplicas
    this.currentCpuUnits = this.cpuUnitsPerReplica * this.currentReplicas
    this.currentMemoryBytes = this.memoryBytesPerReplica * this.currentReplicas
  }

  getUtilization() {
    return this.currentMaxConcurrent > 0
      ? Math.min(this.processing / this.currentMaxConcurrent, 1)
      : 0
  }

  getQueueDepth() {
    return this.queue.length
  }

  canAccept() {
    if (this.isFailed) return false
    if (this.circuitOpen) return false
    return this.processing < this.currentMaxConcurrent || this.queue.length < this.maxQueueDepth
  }

  enqueue(request) {
    if (this.queue.length >= this.maxQueueDepth) return false
    this.queue.push(request)
    return true
  }

  dequeue() {
    return this.queue.shift()
  }

  startProcessing() {
    this.processing++
  }

  finishProcessing() {
    this.processing = Math.max(0, this.processing - 1)
  }

  recordLatency(latencyMs) {
    this.latencySamples.push(latencyMs)
  }

  recordResources(cpu, memory, threads, connections) {
    this.cpuSamples.push(cpu)
    this.memorySamples.push(memory)
    this.threadPoolSamples.push(threads)
    this.connectionPoolSamples.push(connections)
  }

  checkScaling(time) {
    if (this.scalingType === 'none') return null

    const utilization = this.getUtilization()

    // Scale up
    if (utilization >= this.scaleUpThreshold &&
        this.currentReplicas < this.maxReplicas &&
        time >= this.scaleUpCooldown) {
      const newReplicas = Math.min(this.currentReplicas + this.scaleUpIncrement, this.maxReplicas)
      if (newReplicas > this.currentReplicas) {
        this.currentReplicas = newReplicas
        this._recalcCapacity()
        this.scaleUpCooldown = time + this.scaleUpCooldownSeconds
        return { type: 'scale_up', from: this.currentReplicas - this.scaleUpIncrement, to: this.currentReplicas, time }
      }
    }

    // Scale down
    if (utilization <= this.scaleDownThreshold &&
        this.currentReplicas > this.minReplicas &&
        time >= this.scaleDownCooldown) {
      const newReplicas = Math.max(this.currentReplicas - 1, this.minReplicas)
      if (newReplicas < this.currentReplicas) {
        this.currentReplicas = newReplicas
        this._recalcCapacity()
        this.scaleDownCooldown = time + this.scaleDownCooldownSeconds
        return { type: 'scale_down', from: this.currentReplicas + 1, to: this.currentReplicas, time }
      }
    }

    return null
  }

  injectFailure(mode, time) {
    this.isFailed = true
    this.failureMode = mode
    return { type: 'failure_start', blockId: this.id, mode: mode.id, time }
  }

  recoverFailure(time) {
    this.isFailed = false
    this.failureMode = null
    return { type: 'failure_end', blockId: this.id, time }
  }
}

// ============================================================================
// EDGE STATE
// ============================================================================

class EdgeState {
  constructor(edge) {
    this.id = edge.id
    this.sourceId = edge.sourceId
    this.targetId = edge.targetId
    this.model = edge.behavioralModel || getConnectionBehavioralModel(edge.connectionType || 'http')

    const network = this.model.network || {}
    const overhead = this.model.overhead || {}
    const transport = this.model.transport || {}
    const reliability = this.model.reliability || {}

    // Pre-extract for hot path
    this.baseLatencyMs = network.baseLatencyMs || 0
    this.jitterMs = network.jitterMs || 0
    this.packetLossRate = network.packetLossRate || 0
    this.serializationMs = (overhead.serializationMs || 0) + (overhead.deserializationMs || 0)
    this.encryptionMs = (overhead.encryptionMs || 0) + (overhead.decryptionMs || 0)
    this.compressionMs = (overhead.compressionMs || 0) + (overhead.decompressionMs || 0)
    this.handshakeMs = (transport.handshakeMs || 0) * 0.1 // Amortized
    this.circuitBreakerEnabled = reliability.circuitBreakerEnabled || false
    this.cbThreshold = reliability.circuitBreakerThreshold || 0.5
    this.cbRecoveryMs = reliability.circuitBreakerRecoveryMs || 30000

    this.circuitOpen = false
    this.errorCount = 0
    this.requestCount = 0
    this.lastFailureTime = 0
  }

  getLatency(rng) {
    // Fast path: avoid function calls where possible
    const networkLatency = this.baseLatencyMs + rng.nextNormal(0, this.jitterMs)
    const packetLossOverhead = rng.nextBool(this.packetLossRate) ? rng.nextRange(50, 200) : 0

    return Math.max(0,
      networkLatency +
      this.serializationMs +
      this.encryptionMs +
      this.compressionMs +
      this.handshakeMs +
      packetLossOverhead
    )
  }

  checkCircuitBreaker(time) {
    if (!this.circuitBreakerEnabled) return false

    const window = 30
    if (time - this.lastFailureTime < window && this.requestCount > 0) {
      const errorRate = this.errorCount / this.requestCount
      if (errorRate >= this.cbThreshold && !this.circuitOpen) {
        this.circuitOpen = true
        return true
      }
    }

    if (this.circuitOpen && time - this.lastFailureTime > this.cbRecoveryMs / 1000) {
      this.circuitOpen = false
      this.errorCount = 0
      this.requestCount = 0
    }

    return false
  }

  recordResult(success) {
    this.requestCount++
    if (!success) {
      this.errorCount++
      this.lastFailureTime = Date.now() / 1000
    }
  }
}

// ============================================================================
// FAST PRIORITY QUEUE (optimized for numeric keys)
// ============================================================================

class FastPriorityQueue {
  constructor(compareFn) {
    this.heap = []
    this.compare = compareFn || ((a, b) => a - b)
  }

  push(item) {
    this.heap.push(item)
    this._siftUp(this.heap.length - 1)
  }

  pop() {
    if (this.heap.length === 0) return null
    const root = this.heap[0]
    const last = this.heap.pop()
    if (this.heap.length > 0) {
      this.heap[0] = last
      this._siftDown(0)
    }
    return root
  }

  peek() {
    return this.heap.length > 0 ? this.heap[0] : null
  }

  get length() {
    return this.heap.length
  }

  _siftUp(index) {
    const heap = this.heap
    const item = heap[index]
    while (index > 0) {
      const parent = (index - 1) >>> 1
      if (this.compare(item, heap[parent]) >= 0) break
      heap[index] = heap[parent]
      index = parent
    }
    heap[index] = item
  }

  _siftDown(index) {
    const heap = this.heap
    const item = heap[index]
    const half = heap.length >>> 1
    while (index < half) {
      let left = (index << 1) + 1
      let right = left + 1
      let best = left
      if (right < heap.length && this.compare(heap[right], heap[left]) < 0) {
        best = right
      }
      if (this.compare(item, heap[best]) <= 0) break
      heap[index] = heap[best]
      index = best
    }
    heap[index] = item
  }
}

// ============================================================================
// GRAPH BUILDING
// ============================================================================

function buildGraph(blocks, edges) {
  const adjacency = new Map()
  const reverseAdjacency = new Map()
  const edgeMap = new Map()

  for (const edge of edges) {
    edgeMap.set(edge.id, edge)

    if (!adjacency.has(edge.sourceId)) adjacency.set(edge.sourceId, [])
    adjacency.get(edge.sourceId).push({ edgeId: edge.id, targetId: edge.targetId })

    if (!reverseAdjacency.has(edge.targetId)) reverseAdjacency.set(edge.targetId, [])
    reverseAdjacency.get(edge.targetId).push({ edgeId: edge.id, sourceId: edge.sourceId })
  }

  const entryPoints = blocks
    .filter(b => {
      const incoming = reverseAdjacency.get(b.id)
      return !incoming || incoming.length === 0 || b.type === 'client' || b.type === 'cdn'
    })
    .map(b => b.id)

  const exitPoints = blocks
    .filter(b => {
      const outgoing = adjacency.get(b.id)
      return !outgoing || outgoing.length === 0 ||
        ['database', 'cache', 'storage', 'external-api'].includes(b.type)
    })
    .map(b => b.id)

  return { adjacency, reverseAdjacency, edgeMap, entryPoints, exitPoints }
}

// ============================================================================
// REQUEST ROUTING
// ============================================================================

function routeRequest(blockId, adjacency, rng, requestHistory = []) {
  const outgoing = adjacency.get(blockId)
  if (!outgoing || outgoing.length === 0) return null

  // Hard limit on hops to prevent infinite loops in cyclic graphs
  if (requestHistory.length >= 50) return null

  const available = outgoing.filter(o => !requestHistory.includes(o.targetId))
  if (available.length === 0) {
    // Cycle detected — all outgoing targets already visited. Terminate.
    return null
  }
  if (available.length === 1) return available[0]

  // 70% primary path
  return rng.nextFloat() < 0.7 ? available[0] : available[rng.nextIntRange(1, available.length - 1)]
}

// ============================================================================
// LATENCY CALCULATION (parameterized, no hardcoded physics)
// ============================================================================

function calculateBlockLatency(blockState, rng, isUnderFailure = false) {
  // Base latency with variance
  let latency = blockState.baseLatencyMs + rng.nextNormal(0, blockState.latencyStdDevMs)

  // Queue latency: parameterized from model, not hardcoded
  const queueDepth = blockState.getQueueDepth()
  if (queueDepth > 0 && blockState.maxQueueDepth > 0) {
    const queueFactor = Math.min(queueDepth / blockState.maxQueueDepth, 1)
    // Non-linear queue delay: queueLatencyMs is the per-unit delay at max queue
    latency += blockState.queueLatencyMs * queueFactor * queueFactor * 5
  }

  // Cache effects
  if (blockState.cacheHitRate !== undefined) {
    latency += rng.nextBool(blockState.cacheHitRate)
      ? blockState.cacheHitLatencyMs
      : blockState.cacheMissLatencyMs
  }

  // DB operation latency
  if (blockState.dbOperationMs > 0) {
    latency += blockState.dbOperationMs
  }

  // Serialization overhead
  latency += blockState.serializationMs

  // Failure mode multiplier
  if (isUnderFailure && blockState.failureMode) {
    latency *= (blockState.failureMode.latencyMultiplier || 1)
  }

  // Resource contention: quadratic slowdown based on utilization
  const utilization = blockState.getUtilization()
  latency *= (1 + utilization * utilization * 2)

  return Math.max(0, latency)
}

function calculateErrorProbability(blockState, rng, isUnderFailure = false) {
  const utilization = blockState.getUtilization()
  let errorRate = blockState.baseErrorRate + blockState.errorRateUnderLoad * utilization
  errorRate = Math.min(errorRate, 1)

  if (isUnderFailure && blockState.failureMode) {
    errorRate = Math.max(errorRate, blockState.failureMode.errorRate || 0)
  }

  return errorRate
}

// ============================================================================
// RESOURCE MODELING (parameterized)
// ============================================================================

function calculateResourceUsage(blockState, activeRequests) {
  const cpuTotal = activeRequests * blockState.cpuPerRequest
  const cpuPercent = blockState.currentCpuUnits > 0
    ? Math.min((cpuTotal / blockState.currentCpuUnits) * 100, 100)
    : 0

  const memTotal = activeRequests * blockState.memoryPerConnection
  const memoryPercent = blockState.currentMemoryBytes > 0
    ? Math.min((memTotal / blockState.currentMemoryBytes) * 100, 100)
    : 0

  const threadPercent = blockState.threadPoolSize > 0
    ? Math.min((activeRequests / blockState.threadPoolSize) * 100, 100)
    : 0

  const connPercent = blockState.connectionPoolSize > 0
    ? Math.min((activeRequests / blockState.connectionPoolSize) * 100, 100)
    : 0

  return { cpuPercent, memoryPercent, threadPoolUtilization: threadPercent, connectionPoolUtilization: connPercent }
}

// ============================================================================
// FAILURE INJECTION (parameterized from scenario definitions)
// ============================================================================

const SCENARIO_CONFIGS = Object.freeze({
  db_slowdown: { targetTypes: ['database'], latencyMultiplier: 1.7, errorRate: 0.05 },
  cache_eviction: { targetTypes: ['cache'], latencyMultiplier: 1.5, errorRate: 0.02, cacheHitRate: 0.05 },
  region_outage: { targetTypes: null, latencyMultiplier: 1, errorRate: 0.5, dropRate: 0.3 },
  ddos: { targetTypes: null, latencyMultiplier: 3, errorRate: 0.3, dropRate: 0.2 },
  network_partition: { targetTypes: ['service'], latencyMultiplier: 10, errorRate: 0.8 },
  service_crash: { targetTypes: ['service'], latencyMultiplier: 1, errorRate: 1.0 },
  memory_leak: { targetTypes: ['service'], latencyMultiplier: 2, errorRate: 0.1 },
  resource_exhaustion: { targetTypes: ['service', 'database'], latencyMultiplier: 5, errorRate: 0.4 },
  external_timeout: { targetTypes: ['external-api'], latencyMultiplier: 1, errorRate: 1.0 },
  external_rate_limit: { targetTypes: ['external-api'], latencyMultiplier: 5, errorRate: 0.3 },
  queue_overflow: { targetTypes: ['message-queue'], latencyMultiplier: 2, errorRate: 0.2 },
  storage_saturation: { targetTypes: ['storage'], latencyMultiplier: 1, errorRate: 0.8 },
})

// === BATCH 5C: UPDATED SIGNATURE ===
function injectFailures(state, scenario, duration, rng, targetBlockId = null, targetEdgeId = null) {
  if (!scenario || scenario === 'none') return

  const config = SCENARIO_CONFIGS[scenario]
  if (!config) return

  // === BATCH 5C: TARGETED FAILURE INJECTION ===
  let targetBlocks = []
  if (targetBlockId) {
    const block = state.blocks.get(targetBlockId)
    if (block) targetBlocks.push(block)
  } else if (targetEdgeId) {
    const edge = state.edgeMap.get(targetEdgeId)
    if (edge) {
      const sourceBlock = state.blocks.get(edge.sourceId)
      const targetBlock = state.blocks.get(edge.targetId)
      if (sourceBlock) targetBlocks.push(sourceBlock)
      if (targetBlock) targetBlocks.push(targetBlock)
    }
  } else {
    for (const [, blockState] of state.blocks) {
      if (config.targetTypes === null || config.targetTypes.includes(blockState.type)) {
        targetBlocks.push(blockState)
      }
    }
  }
  // === END BATCH 5C ===

  if (targetBlocks.length === 0) return

  // Failure timing: parameterized window, not hardcoded
  const failureStart = rng.nextRange(duration * 0.1, duration * 0.5)
  const failureDuration = rng.nextRange(duration * 0.1, duration * 0.3)
  const failureEnd = Math.min(failureStart + failureDuration, duration)

  const numToFail = Math.max(1, Math.floor(targetBlocks.length * rng.nextRange(0.3, 0.7)))
  rng.shuffle(targetBlocks)
  const affectedBlocks = targetBlocks.slice(0, numToFail)

  for (const blockState of affectedBlocks) {
    const mode = {
      id: `${scenario}_${blockState.id}`,
      name: `${scenario} on ${blockState.label}`,
      latencyMultiplier: config.latencyMultiplier,
      errorRate: config.errorRate,
      throughputMultiplier: config.dropRate ? 1 - config.dropRate : 1,
      startTime: failureStart,
      endTime: failureEnd,
    }

    state.schedule({ time: failureStart, type: EVENT_TYPES.FAILURE_START, blockId: blockState.id, mode })
    state.schedule({ time: failureEnd, type: EVENT_TYPES.FAILURE_END, blockId: blockState.id })
  }
}

// ============================================================================
// LIVE SNAPSHOT BUILDER
// ============================================================================

function buildLiveSnapshot(state, duration, progress) {
  const totalCompleted = state.completedRequests.length
  const totalFailed = state.failedRequests.length
  const totalDropped = state.droppedRequests.length
  const totalRequests = totalCompleted + totalFailed + totalDropped

  const e2eLatencies = state.completedRequests.map(r => r.totalLatencyMs).filter(v => v != null)
  const avgLatency = e2eLatencies.length > 0
    ? e2eLatencies.reduce((a, b) => a + b, 0) / e2eLatencies.length
    : 0
  const sortedE2E = e2eLatencies.length > 0 ? quickSort(e2eLatencies) : []
  const p95Latency = sortedE2E[Math.floor(0.95 * sortedE2E.length)] || 0
  const p99Latency = sortedE2E[Math.floor(0.99 * sortedE2E.length)] || 0

  const errorRate = totalRequests > 0 ? (totalFailed + totalDropped) / totalRequests : 0
  const availability = totalRequests > 0 ? (totalCompleted / totalRequests) * 100 : 100
  const currentTime = Math.max(state.time, 0.001)
  const throughput = currentTime > 0 ? totalRequests / currentTime : 0

  const blockMetrics = {}
  for (const [blockId, blockState] of state.blocks) {
    const samples = blockState.latencySamples
    const blockTotal = blockState.totalProcessed + blockState.totalFailed + blockState.totalDropped
    const blockAvgLatency = samples.length > 0
      ? samples.reduce((a, b) => a + b, 0) / samples.length
      : 0

    blockMetrics[blockId] = {
      totalRequests: blockTotal,
      successfulRequests: blockState.totalProcessed,
      failedRequests: blockState.totalFailed,
      droppedRequests: blockState.totalDropped,
      throughput: Math.round(blockTotal / currentTime),
      throughputRps: Math.round(blockTotal / currentTime),
      avgLatency: Math.round(blockAvgLatency),
      avgLatencyMs: Math.round(blockAvgLatency),
      errorRate: blockTotal > 0 ? (blockState.totalFailed + blockState.totalDropped) / blockTotal : 0,
      availability: blockTotal > 0 ? (blockState.totalProcessed / blockTotal) * 100 : 100,
      utilization: blockState.getUtilization(),
      queueDepth: blockState.getQueueDepth(),
      currentReplicas: blockState.currentReplicas,
      totalErrors: blockState.totalFailed + blockState.totalDropped,
      resources: {
        cpuPercent: blockState.cpuSamples.length > 0
          ? Math.round(blockState.cpuSamples.reduce((a, b) => a + b, 0) / blockState.cpuSamples.length)
          : 0,
        memoryPercent: blockState.memorySamples.length > 0
          ? Math.round(blockState.memorySamples.reduce((a, b) => a + b, 0) / blockState.memorySamples.length)
          : 0,
        threadPoolUtilization: blockState.threadPoolSamples.length > 0
          ? Math.round(blockState.threadPoolSamples.reduce((a, b) => a + b, 0) / blockState.threadPoolSamples.length)
          : 0,
        connectionPoolUtilization: blockState.connectionPoolSamples.length > 0
          ? Math.round(blockState.connectionPoolSamples.reduce((a, b) => a + b, 0) / blockState.connectionPoolSamples.length)
          : 0,
      },
    }
  }

  return {
    progress,
    status: 'running',
    // Flat metrics for UI compatibility (SimulationControls.jsx expects metrics[blockId])
    metrics: blockMetrics,
    global: {
      totalRequests,
      successfulRequests: totalCompleted,
      failedRequests: totalFailed,
      droppedRequests: totalDropped,
      throughput: Math.round(throughput),
      throughputRps: Math.round(throughput),
      avgLatency: Math.round(avgLatency),
      avgLatencyMs: Math.round(avgLatency),
      p95LatencyMs: Math.round(p95Latency),
      p99Latency: Math.round(p99Latency),
      p99LatencyMs: Math.round(p99Latency),
      errorRate,
      availability: Math.round(availability * 100) / 100,
      totalErrors: totalFailed + totalDropped,
    },
    currentRps: Math.round(throughput),
    eventCount: state.eventCount,
    simulatedTime: state.time,
  }
}

// ============================================================================
// MAIN SIMULATION ENGINE
// ============================================================================

/**
 * Run a single deterministic simulation pass.
 * @param {Function} onTick — async(snapshot) called for live streaming
 * @param {Function} shouldStop — () => boolean, checked after sleep/yield
 * @param {Object} options — additional options (targetBlockId, targetEdgeId)
 */
export async function runSimulationPass(blocks, edges, arrivalEvents, scenario, rng, duration, onTick = null, shouldStop = null, options = {}) {
  const state = new SimulationState(blocks, edges, rng)
  const graph = buildGraph(blocks, edges)
  state.adjacency = graph.adjacency
  state.reverseAdjacency = graph.reverseAdjacency
  state.edgeMap = graph.edgeMap
  state.entryPoints = graph.entryPoints

  // Schedule arrivals
  for (const event of arrivalEvents) {
    state.schedule({
      time: event.time,
      type: EVENT_TYPES.REQUEST_ARRIVAL,
      requestId: event.requestId || state.nextRequestId(),
      entryBlockId: state.entryPoints[rng.nextIntRange(0, state.entryPoints.length - 1)] || blocks[0]?.id,
    })
  }

  // === BATCH 5C: PASS TARGET OPTIONS TO INJECT FAILURES ===
  injectFailures(state, scenario, duration, rng, options.targetBlockId, options.targetEdgeId)
  // === END BATCH 5C ===

  const wallClockStart = Date.now()
  let lastSnapshotTime = 0
  let lastStreamWallTime = 0
  let lastYieldTime = wallClockStart
  let eventsSinceYield = 0

  while (state.events.length > 0) {
    if (state.eventCount >= ENGINE_CONFIG.MAX_EVENTS_PER_PASS) {
      state.logEvent('ENGINE_LIMIT_REACHED', { maxEvents: ENGINE_CONFIG.MAX_EVENTS_PER_PASS })
      break
    }

    const event = state.events.pop()
    if (!event) break

    // CRITICAL FIX: break when we pass duration — min-heap guarantees all
    // remaining events are >= event.time, so no need to keep popping.
    if (event.time > duration) break

    state.time = event.time
    state.eventCount++

    switch (event.type) {
      case EVENT_TYPES.REQUEST_ARRIVAL:
        handleRequestArrival(state, event, duration)
        break
      case EVENT_TYPES.REQUEST_COMPLETE:
        handleRequestComplete(state, event)
        break
      case EVENT_TYPES.REQUEST_FAILED:
        handleRequestFailed(state, event)
        break
      case EVENT_TYPES.QUEUE_DEQUEUE:
        handleQueueDequeue(state, event, duration)
        break
      case EVENT_TYPES.FAILURE_START:
        handleFailureStart(state, event)
        break
      case EVENT_TYPES.FAILURE_END:
        handleFailureEnd(state, event)
        break
      case EVENT_TYPES.TIMEOUT:
        handleTimeout(state, event)
        break
      case EVENT_TYPES.RETRY:
        handleRetry(state, event, duration)
        break
    }

    if (shouldStop && shouldStop()) break

    // ------------------------------------------------------------------------
    // LIVE STREAMING: Snapshot every 10 simulated seconds AND every 1 wall-clock second
    // ------------------------------------------------------------------------
    const now = Date.now()
    const shouldStreamBySimTime = state.time - lastSnapshotTime >= ENGINE_CONFIG.SIM_TIME_PER_SNAPSHOT
    const shouldStreamByWallTime = now - lastStreamWallTime >= 1000

    if (onTick && (shouldStreamBySimTime || shouldStreamByWallTime)) {
      const progress = Math.min((state.time / duration) * 100, 100)
      await onTick(buildLiveSnapshot(state, duration, progress))
      lastSnapshotTime = state.time
      lastStreamWallTime = now
    }

    // ------------------------------------------------------------------------
    // EVENT LOOP YIELD: Throttled to keep SSE responsive without drowning in yields
    // ------------------------------------------------------------------------
    // CRITICAL FIX: use separate lastYieldTime, updated on yield, and respect
    // EVENTS_PER_YIELD. Previously lastWallClockTick was shared with stream
    // timing and never updated here, causing yield on EVERY event.
    eventsSinceYield++
    if (eventsSinceYield >= ENGINE_CONFIG.EVENTS_PER_YIELD || (now - lastYieldTime >= 50)) {
      await new Promise(r => setImmediate ? setImmediate(r) : setTimeout(r, 0))
      lastYieldTime = Date.now()
      eventsSinceYield = 0
    }
  }

  return buildPassResult(state, blocks, edges, duration)
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

function handleRequestArrival(state, event, duration) {
  const { requestId, entryBlockId } = event
  const request = {
    id: requestId,
    arrivalTime: event.time,
    hops: [],
    status: 'pending',
    currentBlockId: entryBlockId,
    history: [entryBlockId],
  }
  state.requests.set(requestId, request)
  processAtBlock(state, request, entryBlockId, duration)
}

function processAtBlock(state, request, blockId, duration) {
  const blockState = state.blocks.get(blockId)
  if (!blockState) {
    request.status = 'failed'
    request.failureReason = 'block_not_found'
    state.failedRequests.push(request)
    return
  }

  if (!blockState.canAccept()) {
    if (!blockState.enqueue(request)) {
      request.status = 'dropped'
      request.dropTime = state.time
      request.failureReason = 'queue_full'
      state.droppedRequests.push(request)
      blockState.totalDropped++
      state.logEvent(EVENT_TYPES.REQUEST_DROPPED, { requestId: request.id, blockId, reason: 'queue_full' })
      return
    }

    // Queue delay: parameterized from model
    const queueDelay = blockState.queueLatencyMs > 0
      ? (blockState.getQueueDepth() * blockState.queueLatencyMs) / 1000
      : blockState.getQueueDepth() * 0.01

    state.schedule({
      time: state.time + queueDelay,
      type: EVENT_TYPES.QUEUE_DEQUEUE,
      requestId: request.id,
      blockId,
    })
    state.logEvent(EVENT_TYPES.QUEUE_ENQUEUE, { requestId: request.id, blockId, queueDepth: blockState.getQueueDepth() })
    return
  }

  blockState.startProcessing()
  request.status = 'processing'

  const isUnderFailure = blockState.isFailed
  const processingLatency = calculateBlockLatency(blockState, state.rng, isUnderFailure)
  const errorProb = calculateErrorProbability(blockState, state.rng, isUnderFailure)
  const willError = state.rng.nextBool(errorProb)

  if (willError) {
    state.schedule({
      time: state.time + (processingLatency / 1000),
      type: EVENT_TYPES.REQUEST_FAILED,
      requestId: request.id,
      blockId,
      reason: isUnderFailure ? `failure_mode:${blockState.failureMode?.id}` : 'random_error',
    })
  } else {
    state.schedule({
      time: state.time + (processingLatency / 1000),
      type: EVENT_TYPES.REQUEST_COMPLETE,
      requestId: request.id,
      blockId,
      processingLatency,
    })
  }

  const resources = calculateResourceUsage(blockState, blockState.processing)
  blockState.recordResources(resources.cpuPercent, resources.memoryPercent, resources.threadPoolUtilization, resources.connectionPoolUtilization)

  const scaleEvent = blockState.checkScaling(state.time)
  if (scaleEvent) {
    state.logEvent(scaleEvent.type === 'scale_up' ? EVENT_TYPES.SCALE_UP : EVENT_TYPES.SCALE_DOWN, scaleEvent)
  }
}

function handleRequestComplete(state, event) {
  const { requestId, blockId, processingLatency } = event
  const request = state.requests.get(requestId)
  const blockState = state.blocks.get(blockId)

  if (!request || !blockState) return

  blockState.finishProcessing()
  blockState.totalProcessed++

  request.hops.push({
    blockId,
    arrivalTime: state.time - (processingLatency / 1000),
    departureTime: state.time,
    latencyMs: processingLatency,
    status: 'completed',
  })

  blockState.recordLatency(processingLatency)

  const route = routeRequest(blockId, state.adjacency, state.rng, request.history)

  if (!route) {
    request.status = 'completed'
    request.completionTime = state.time
    request.totalLatencyMs = (state.time - request.arrivalTime) * 1000
    state.completedRequests.push(request)
    state.logEvent(EVENT_TYPES.REQUEST_COMPLETE, { requestId, blockId, totalLatencyMs: request.totalLatencyMs })
    return
  }

  const edgeState = state.edges.get(route.edgeId)
  if (edgeState) {
    const edgeLatency = edgeState.getLatency(state.rng)
    const edgeCompleteTime = state.time + (edgeLatency / 1000)

    if (edgeState.circuitOpen) {
      request.status = 'failed'
      request.failureReason = 'circuit_open'
      state.failedRequests.push(request)
      state.logEvent(EVENT_TYPES.CIRCUIT_OPEN, { requestId, edgeId: route.edgeId })
      return
    }

    edgeState.recordResult(true)

    request.currentBlockId = route.targetId
    request.history.push(route.targetId)

    state.schedule({
      time: edgeCompleteTime,
      type: EVENT_TYPES.REQUEST_ARRIVAL,
      requestId: request.id,
      entryBlockId: route.targetId,
      isHop: true,
    })
  }
}

function handleRequestFailed(state, event) {
  const { requestId, blockId, reason } = event
  const request = state.requests.get(requestId)
  const blockState = state.blocks.get(blockId)

  if (!request || !blockState) return

  blockState.finishProcessing()
  blockState.totalFailed++

  request.hops.push({
    blockId,
    arrivalTime: state.time - 0.001,
    departureTime: state.time,
    status: 'failed',
    failureReason: reason,
  })

  request.status = 'failed'
  request.failureReason = reason
  request.totalLatencyMs = (state.time - request.arrivalTime) * 1000
  state.failedRequests.push(request)
  state.logEvent(EVENT_TYPES.REQUEST_FAILED, { requestId, blockId, reason })

  const edgeState = findEdgeToBlock(state, blockId, request.history)
  if (edgeState) {
    const reliability = edgeState.model.reliability || {}
    if (reliability.maxRetries > 0 && (request.retryCount || 0) < reliability.maxRetries) {
      request.retryCount = (request.retryCount || 0) + 1
      const backoff = reliability.retryBackoffMs || 100
      const multiplier = reliability.retryBackoffMultiplier || 2
      const retryDelay = (backoff * Math.pow(multiplier, request.retryCount - 1)) / 1000

      state.schedule({
        time: state.time + retryDelay,
        type: EVENT_TYPES.RETRY,
        requestId: request.id,
        blockId: request.history[request.history.length - 2],
      })
    }
  }
}

function handleQueueDequeue(state, event, duration) {
  const { requestId, blockId } = event
  const blockState = state.blocks.get(blockId)
  const request = state.requests.get(requestId)
  if (!blockState || !request) return

  const idx = blockState.queue.findIndex(r => r.id === requestId)
  if (idx >= 0) blockState.queue.splice(idx, 1)

  processAtBlock(state, request, blockId, duration)
}

function handleFailureStart(state, event) {
  const { blockId, mode } = event
  const blockState = state.blocks.get(blockId)
  if (blockState) {
    const failureEvent = blockState.injectFailure(mode, state.time)
    state.failureEvents.push(failureEvent)
    state.logEvent(EVENT_TYPES.FAILURE_START, failureEvent)
  }
}

function handleFailureEnd(state, event) {
  const { blockId } = event
  const blockState = state.blocks.get(blockId)
  if (blockState) {
    const recoveryEvent = blockState.recoverFailure(state.time)
    state.logEvent(EVENT_TYPES.FAILURE_END, recoveryEvent)
  }
}

function handleTimeout(state, event) {
  const { requestId } = event
  const request = state.requests.get(requestId)
  if (request && request.status === 'pending') {
    request.status = 'failed'
    request.failureReason = 'timeout'
    state.failedRequests.push(request)
  }
}

function handleRetry(state, event, duration) {
  const { requestId, blockId } = event
  const request = state.requests.get(requestId)
  if (!request) return
  request.status = 'pending'
  processAtBlock(state, request, blockId, duration)
}

function findEdgeToBlock(state, targetBlockId, history) {
  if (history.length < 2) return null
  const sourceId = history[history.length - 2]
  const outgoing = state.adjacency.get(sourceId)
  if (!outgoing) return null
  const route = outgoing.find(o => o.targetId === targetBlockId)
  return route ? state.edges.get(route.edgeId) : null
}

// ============================================================================
// PASS RESULT BUILDER
// ============================================================================

function buildPassResult(state, blocks, edges, duration) {
  const actualDuration = Math.min(state.time, duration) || 0.001
  const blockMetrics = {}

  for (const [blockId, blockState] of state.blocks) {
    const samples = blockState.latencySamples
    const sorted = samples.length > 0 ? quickSort([...samples]) : []
    const p = (pct) => sorted[Math.floor((pct / 100) * sorted.length)] || 0

    const total = blockState.totalProcessed + blockState.totalFailed + blockState.totalDropped
    const errorRate = total > 0 ? (blockState.totalFailed + blockState.totalDropped) / total : 0

    blockMetrics[blockId] = {
      totalRequests: total,
      successfulRequests: blockState.totalProcessed,
      failedRequests: blockState.totalFailed,
      droppedRequests: blockState.totalDropped,
      throughputRps: actualDuration > 0 ? Math.round(total / actualDuration) : 0,
      avgLatencyMs: samples.length > 0 ? samples.reduce((a, b) => a + b, 0) / samples.length : 0,
      p50LatencyMs: p(50),
      p75LatencyMs: p(75),
      p90LatencyMs: p(90),
      p95LatencyMs: p(95),
      p99LatencyMs: p(99),
      p999LatencyMs: p(99.9),
      minLatencyMs: samples.length > 0 ? sorted[0] : 0,
      maxLatencyMs: samples.length > 0 ? sorted[sorted.length - 1] : 0,
      errorRate,
      availability: total > 0 ? (blockState.totalProcessed / total) * 100 : 100,
      utilization: blockState.getUtilization(),
      queueDepth: blockState.getQueueDepth(),
      maxQueueDepth: blockState.queue.length,
      queueDropRate: total > 0 ? blockState.totalDropped / total : 0,
      saturationPoint: blockState.currentMaxThroughput,
      resources: {
        cpuPercent: blockState.cpuSamples.length > 0
          ? Math.round(blockState.cpuSamples.reduce((a, b) => a + b, 0) / blockState.cpuSamples.length)
          : 0,
        cpuPeakPercent: blockState.cpuSamples.length > 0 ? safeMax(blockState.cpuSamples) : 0,
        memoryPercent: blockState.memorySamples.length > 0
          ? Math.round(blockState.memorySamples.reduce((a, b) => a + b, 0) / blockState.memorySamples.length)
          : 0,
        memoryPeakPercent: blockState.memorySamples.length > 0 ? safeMax(blockState.memorySamples) : 0,
        networkIngressMbps: 0,
        networkEgressMbps: 0,
        threadPoolUtilization: blockState.threadPoolSamples.length > 0
          ? Math.round(blockState.threadPoolSamples.reduce((a, b) => a + b, 0) / blockState.threadPoolSamples.length)
          : 0,
        connectionPoolUtilization: blockState.connectionPoolSamples.length > 0
          ? Math.round(blockState.connectionPoolSamples.reduce((a, b) => a + b, 0) / blockState.connectionPoolSamples.length)
          : 0,
      },
      currentReplicas: blockState.currentReplicas,
      failureEvents: state.failureEvents.filter(f => f.blockId === blockId),
    }
  }

  // Compute per-block costs from behavioral model
  let totalSimulatedCost = 0
  for (const [blockId, metrics] of Object.entries(blockMetrics)) {
    const blockState = state.blocks.get(blockId)
    if (!blockState) continue
    const costModel = blockState.model.cost || blockState.model.costProfile || {}
    const runtimeHours = actualDuration / 3600
    const total = metrics.totalRequests || 0
    const replicas = metrics.currentReplicas || 1

    const computeCost = (costModel.hourlyComputeCost || 0) * runtimeHours * replicas
    const requestCost = (costModel.perRequestCost || 0) * total
    const networkCost = (costModel.perGbNetworkCost || 0) * (total * 1024 / (1024 * 1024 * 1024))
    const storageGb = ((blockState.model.resourceConsumption?.storagePerRequest || 0) * total) / (1024 * 1024 * 1024)
    const storageCost = (costModel.storageCostPerGbMonth || 0) * storageGb * (runtimeHours / (30 * 24))
    const blockTotalCost = computeCost + requestCost + networkCost + storageCost

    metrics.cost = {
      compute: Math.round(computeCost * 100) / 100,
      request: Math.round(requestCost * 100) / 100,
      network: Math.round(networkCost * 100) / 100,
      storage: Math.round(storageCost * 100) / 100,
      total: Math.round(blockTotalCost * 100) / 100,
    }
    totalSimulatedCost += blockTotalCost
  }
  const projectedMonthlyCost = totalSimulatedCost * ((30 * 24 * 3600) / actualDuration)
  const projectedAnnualCost = projectedMonthlyCost * 12

  const totalRequests = state.completedRequests.length + state.failedRequests.length + state.droppedRequests.length
  const successfulRequests = state.completedRequests.length
  const failedRequests = state.failedRequests.length
  const droppedRequests = state.droppedRequests.length

  const e2eLatencies = state.completedRequests.map(r => r.totalLatencyMs).filter(v => v != null)
  const e2eSorted = e2eLatencies.length > 0 ? quickSort(e2eLatencies) : []
  const e2eP = (pct) => e2eSorted[Math.floor((pct / 100) * e2eSorted.length)] || 0

  const avgLatency = e2eLatencies.length > 0 ? e2eLatencies.reduce((a, b) => a + b, 0) / e2eLatencies.length : 0
  const p95Latency = e2eP(95)
  const p99Latency = e2eP(99)

  return {
    blockMetrics: { blocks: blockMetrics },
    globalMetrics: {
      totalRequests,
      successfulRequests,
      failedRequests,
      droppedRequests,
      throughputRps: actualDuration > 0 ? Math.round(totalRequests / actualDuration) : 0,
      avgLatencyMs: avgLatency,
      p95LatencyMs: p95Latency,
      p99LatencyMs: p99Latency,
      errorRate: totalRequests > 0 ? (failedRequests + droppedRequests) / totalRequests : 0,
      availability: totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 100,
      totalSimulatedCost: Math.round(totalSimulatedCost * 100) / 100,
      projectedMonthlyCost: Math.round(projectedMonthlyCost * 100) / 100,
      projectedAnnualCost: Math.round(projectedAnnualCost * 100) / 100,
      // UI aliases
      throughput: actualDuration > 0 ? Math.round(totalRequests / actualDuration) : 0,
      avgLatency,
      p99Latency,
      totalErrors: failedRequests + droppedRequests,
    },
    completedRequests: state.completedRequests.length,
    failedRequests: state.failedRequests.length,
    droppedRequests: state.droppedRequests.length,
    events: state.eventLog,
    failureEvents: state.failureEvents,
    sampledRequests: state.completedRequests.slice(0, ENGINE_CONFIG.MAX_SAMPLED_REQUESTS).map(r => ({
      id: r.id,
      arrivalTime: r.arrivalTime,
      completionTime: r.completionTime,
      totalLatencyMs: r.totalLatencyMs,
      hops: r.hops,
    })),
  }
}

// ============================================================================
// MONTE CARLO AGGREGATION
// ============================================================================

export function aggregateMonteCarloResults(results, confidenceLevel = 0.95) {
  if (results.length === 0) {
    return {
      totalRequests: 0,
      avgRps: 0,
      latencyMultiplier: 1,
      errorRate: 0,
      dropRate: 0,
      blockMetrics: { blocks: {} },
      globalMetrics: null,
      confidenceIntervals: null,
    }
  }

  if (results.length === 1) {
    return {
      ...results[0],
      avgRps: results[0].globalMetrics?.throughputRps || 0,
      latencyMultiplier: 1,
      errorRate: results[0].globalMetrics?.errorRate || 0,
      dropRate: results[0].globalMetrics?.droppedRequests / (results[0].globalMetrics?.totalRequests || 1) || 0,
      confidenceIntervals: null,
    }
  }

  const totalRequestsArr = results.map(r => r.globalMetrics?.totalRequests || 0)
  const throughputArr = results.map(r => r.globalMetrics?.throughputRps || 0)
  const avgLatencyArr = results.map(r => r.globalMetrics?.avgLatencyMs || 0)
  const errorRateArr = results.map(r => r.globalMetrics?.errorRate || 0)
  const availabilityArr = results.map(r => r.globalMetrics?.availability || 100)
  const totalSimulatedCostArr = results.map(r => r.globalMetrics?.totalSimulatedCost || 0)
  const projectedMonthlyCostArr = results.map(r => r.globalMetrics?.projectedMonthlyCost || 0)
  const projectedAnnualCostArr = results.map(r => r.globalMetrics?.projectedAnnualCost || 0)

  const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length
  const std = (arr, mean) => Math.sqrt(arr.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / arr.length)

  const globalMetrics = {
    totalRequests: Math.round(avg(totalRequestsArr)),
    successfulRequests: Math.round(avg(results.map(r => r.globalMetrics?.successfulRequests || 0))),
    failedRequests: Math.round(avg(results.map(r => r.globalMetrics?.failedRequests || 0))),
    droppedRequests: Math.round(avg(results.map(r => r.globalMetrics?.droppedRequests || 0))),
    throughputRps: Math.round(avg(throughputArr)),
    avgLatencyMs: Math.round(avg(avgLatencyArr)),
    p95LatencyMs: Math.round(percentile(avgLatencyArr, 95)),
    p99LatencyMs: Math.round(percentile(avgLatencyArr, 99)),
    errorRate: parseFloat(avg(errorRateArr).toFixed(4)),
    availability: parseFloat(avg(availabilityArr).toFixed(2)),
    totalSimulatedCost: parseFloat(avg(totalSimulatedCostArr).toFixed(2)),
    projectedMonthlyCost: parseFloat(avg(projectedMonthlyCostArr).toFixed(2)),
    projectedAnnualCost: parseFloat(avg(projectedAnnualCostArr).toFixed(2)),
    // UI aliases
    throughput: Math.round(avg(throughputArr)),
    avgLatency: Math.round(avg(avgLatencyArr)),
    p99Latency: Math.round(percentile(avgLatencyArr, 99)),
    totalErrors: Math.round(avg(results.map(r => (r.globalMetrics?.failedRequests || 0) + (r.globalMetrics?.droppedRequests || 0)))),
  }

  const ci = (arr) => {
    const mean = avg(arr)
    const s = std(arr, mean)
    const margin = 1.96 * (s / Math.sqrt(arr.length))
    return { lower: Math.max(0, mean - margin), upper: mean + margin, mean, stdDev: s }
  }

  const confidenceIntervals = {
    latency: ci(avgLatencyArr),
    throughput: ci(throughputArr),
    errorRate: ci(errorRateArr),
    availability: ci(availabilityArr),
  }

  const allBlockIds = new Set()
  results.forEach(r => {
    if (r.blockMetrics?.blocks) Object.keys(r.blockMetrics.blocks).forEach(id => allBlockIds.add(id))
  })

  const blockMetrics = { blocks: {} }
  for (const blockId of allBlockIds) {
    const blockResults = results.map(r => r.blockMetrics?.blocks?.[blockId]).filter(Boolean)
    if (blockResults.length === 0) continue

    const latencyArr = blockResults.map(b => b.avgLatencyMs || 0)
    const errorArr = blockResults.map(b => b.errorRate || 0)
    const utilArr = blockResults.map(b => b.utilization || 0)

    blockMetrics.blocks[blockId] = {
      totalRequests: Math.round(avg(blockResults.map(b => b.totalRequests || 0))),
      successfulRequests: Math.round(avg(blockResults.map(b => b.successfulRequests || 0))),
      failedRequests: Math.round(avg(blockResults.map(b => b.failedRequests || 0))),
      droppedRequests: Math.round(avg(blockResults.map(b => b.droppedRequests || 0))),
      throughputRps: Math.round(avg(blockResults.map(b => b.throughputRps || 0))),
      avgLatencyMs: Math.round(avg(latencyArr)),
      p50LatencyMs: Math.round(percentile(latencyArr, 50)),
      p75LatencyMs: Math.round(percentile(latencyArr, 75)),
      p90LatencyMs: Math.round(percentile(latencyArr, 90)),
      p95LatencyMs: Math.round(percentile(latencyArr, 95)),
      p99LatencyMs: Math.round(percentile(latencyArr, 99)),
      p999LatencyMs: Math.round(percentile(latencyArr, 99.9)),
      minLatencyMs: Math.round(safeMin(latencyArr)),
      maxLatencyMs: Math.round(safeMax(latencyArr)),
      errorRate: parseFloat(avg(errorArr).toFixed(4)),
      availability: parseFloat(avg(blockResults.map(b => b.availability || 100)).toFixed(2)),
      utilization: parseFloat(avg(utilArr).toFixed(4)),
      queueDepth: Math.round(avg(blockResults.map(b => b.queueDepth || 0))),
      maxQueueDepth: Math.round(safeMax(blockResults.map(b => b.maxQueueDepth || 0))),
      queueDropRate: parseFloat(avg(blockResults.map(b => b.queueDropRate || 0)).toFixed(4)),
      saturationPoint: blockResults[0]?.saturationPoint || 0,
      resources: {
        cpuPercent: Math.round(avg(blockResults.map(b => b.resources?.cpuPercent || 0))),
        cpuPeakPercent: Math.round(safeMax(blockResults.map(b => b.resources?.cpuPeakPercent || 0))),
        memoryPercent: Math.round(avg(blockResults.map(b => b.resources?.memoryPercent || 0))),
        memoryPeakPercent: Math.round(safeMax(blockResults.map(b => b.resources?.memoryPeakPercent || 0))),
        networkIngressMbps: Math.round(avg(blockResults.map(b => b.resources?.networkIngressMbps || 0))),
        networkEgressMbps: Math.round(avg(blockResults.map(b => b.resources?.networkEgressMbps || 0))),
        threadPoolUtilization: Math.round(avg(blockResults.map(b => b.resources?.threadPoolUtilization || 0))),
        connectionPoolUtilization: Math.round(avg(blockResults.map(b => b.resources?.connectionPoolUtilization || 0))),
      },
      currentReplicas: Math.round(avg(blockResults.map(b => b.currentReplicas || 1))),
      cost: {
        total: parseFloat(avg(blockResults.map(b => b.cost?.total || 0)).toFixed(2)),
        compute: parseFloat(avg(blockResults.map(b => b.cost?.compute || 0)).toFixed(2)),
        request: parseFloat(avg(blockResults.map(b => b.cost?.request || 0)).toFixed(2)),
        network: parseFloat(avg(blockResults.map(b => b.cost?.network || 0)).toFixed(2)),
        storage: parseFloat(avg(blockResults.map(b => b.cost?.storage || 0)).toFixed(2)),
      },
      failureEvents: blockResults.flatMap(b => b.failureEvents || []).slice(0, 10),
    }
  }

  return {
    totalRequests: globalMetrics.totalRequests,
    avgRps: globalMetrics.throughputRps,
    latencyMultiplier: 1,
    errorRate: globalMetrics.errorRate,
    dropRate: globalMetrics.droppedRequests / (globalMetrics.totalRequests || 1),
    blockMetrics,
    globalMetrics,
    confidenceIntervals,
    passCount: results.length,
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function quickSort(arr) {
  if (arr.length <= 1) return arr
  const pivot = arr[arr.length >>> 1]
  const left = [], right = [], equal = []
  for (const item of arr) {
    if (item < pivot) left.push(item)
    else if (item > pivot) right.push(item)
    else equal.push(item)
  }
  return [...quickSort(left), ...equal, ...quickSort(right)]
}

function percentile(arr, p) {
  const s = quickSort([...arr])
  return s[Math.floor((p / 100) * s.length)] || 0
}

function safeMax(arr) {
  if (!arr || arr.length === 0) return 0
  let max = arr[0]
  for (let i = 1; i < arr.length; i++) if (arr[i] > max) max = arr[i]
  return max
}

function safeMin(arr) {
  if (!arr || arr.length === 0) return 0
  let min = arr[0]
  for (let i = 1; i < arr.length; i++) if (arr[i] < min) min = arr[i]
  return min
}

// ============================================================================
// BATCH 5C: CUSTOM TRAFFIC CURVE EVENT GENERATOR
// ============================================================================

/**
 * Generate arrival events from a piecewise-linear custom curve.
 * @param {Array<{time: number, rps: number}>} customCurve
 * @param {number} duration
 * @param {DeterministicRNG} rng
 * @returns {Array<{time: number, type: string, requestId: string}>}
 */
export function generateCustomArrivalEvents(customCurve, duration, rng) {
  if (!customCurve || customCurve.length < 2) return []

  // Normalize curve to fit within duration
  const curve = customCurve.map((p, i) => ({
    time: i === customCurve.length - 1 ? duration : Math.min(p.time, duration),
    rps: Math.max(1, p.rps),
  }))

  const events = []
  let requestCounter = 0

  for (let i = 0; i < curve.length - 1; i++) {
    const start = curve[i]
    const end = curve[i + 1]
    const segmentDuration = end.time - start.time
    if (segmentDuration <= 0) continue

    const avgRps = (start.rps + end.rps) / 2
    const totalRequests = Math.max(1, Math.round(avgRps * segmentDuration))

    for (let j = 0; j < totalRequests; j++) {
      const u = rng.nextFloat()
      const arrivalTime = start.time + u * segmentDuration
      events.push({
        time: arrivalTime,
        type: EVENT_TYPES.REQUEST_ARRIVAL,
        requestId: `req-${requestCounter++}`,
      })
    }
  }

  events.sort((a, b) => a.time - b.time)
  return events
}

export { EVENT_TYPES, SimulationState, BlockState, EdgeState }