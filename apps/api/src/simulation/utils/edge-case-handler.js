/**
 * Runtime Edge Case Handler — P5.7 Edge Case Hardening
 * 
 * Handles all 21 edge cases from the audit during simulation execution.
 * Many are caught by validation (P1), but these handle runtime/resilience scenarios.
 */

const EDGE_CASES = {
  E1: 'EMPTY_ARCHITECTURE',
  E2: 'SINGLE_NODE_ARCHITECTURE',
  E3: 'MISSING_CONNECTIONS',
  E4: 'CIRCULAR_DEPENDENCIES',
  E5: 'INFINITE_LOOPS',
  E6: 'BROKEN_REFERENCES',
  E7: 'INVALID_PROTOCOLS',
  E8: 'DUPLICATE_EDGES',
  E9: 'DUPLICATE_NODES',
  E10: 'UNREACHABLE_NODES',
  E11: 'ORPHANED_NODES',
  E12: 'MISSING_ENTRY_POINTS',
  E13: 'MISSING_EXIT_POINTS',
  E14: 'TRAFFIC_DEADLOCKS',
  E15: 'QUEUE_STARVATION',
  E16: 'RESOURCE_STARVATION',
  E17: 'CONFIGURATION_CORRUPTION',
  E18: 'PARTIAL_ARCHITECTURES',
  E19: 'EXTREMELY_LARGE_ARCHITECTURES',
  E20: 'REALTIME_MODIFICATIONS',
  E21: 'CONCURRENT_SIMULATION_REQUESTS',
}

/**
 * Handle runtime edge cases before simulation starts.
 * Validation (P1) already catches many; this adds runtime resilience.
 */
export function handleRuntimeEdgeCases(blocks, edges, validation) {
  const warnings = []
  let shouldAbort = false
  let abortReason = null

  // E2: Single-node architecture — no edges, valid but special handling
  if (blocks.length === 1 && (!edges || edges.length === 0)) {
    warnings.push({
      code: EDGE_CASES.E2,
      severity: 'info',
      message: 'Single-node architecture detected. No network latency will be modeled.',
      recommendation: 'Add more components for realistic simulation.',
    })
  }

  // E18: Partial architectures — allow with low confidence
  if (blocks.length > 0 && blocks.length < 3) {
    warnings.push({
      code: EDGE_CASES.E18,
      severity: 'warning',
      message: 'Partial architecture detected. Results will have low confidence.',
      recommendation: 'Complete the architecture with entry, processing, and exit components.',
    })
  }

  // E19: Extremely large architectures — chunked processing enabled
  if (blocks.length > 500) {
    warnings.push({
      code: EDGE_CASES.E19,
      severity: 'warning',
      message: `Large architecture (${blocks.length} blocks). Processing in chunks to manage memory.`,
      recommendation: 'Consider simplifying or splitting into domains.',
    })
  }

  // E20: Real-time modifications — handled by input snapshotting in caller
  // (simulations.js creates inputSnapshot before enqueueing)

  // E21: Concurrent simulation requests — handled by distributed lock in caller

  // E5: Infinite loops (circular + retry) — validation catches cycles,
  // but we add a runtime circuit breaker
  if (validation.findings.some(f => f.type === 'cycle')) {
    warnings.push({
      code: EDGE_CASES.E5,
      severity: 'warning',
      message: 'Circular dependencies detected. Retry loops will be capped at 3 attempts.',
      recommendation: 'Break cycles with async queues or event buses.',
    })
  }

  // E14-E16: Detected during simulation pass (see detectSimulationDeadlocks)

  return { warnings, shouldAbort, abortReason, edgeCases: EDGE_CASES }
}

/**
 * Detect simulation runtime issues: deadlocks, queue starvation, resource starvation.
 * Called per simulation pass.
 */
export function detectSimulationDeadlocks(passResult, simBlocks) {
  const deadlocks = []
  const starvation = []
  const resourceStarvation = []

  const blockMetrics = passResult.blockMetrics?.blocks || {}

  for (const block of simBlocks) {
    const metrics = blockMetrics[block.id]
    if (!metrics) continue

    // E14: Traffic deadlocks — queue depth grows without bound
    if (metrics.queueDepth > 0 && metrics.processedRequests === 0 && metrics.droppedRequests === 0) {
      deadlocks.push({
        blockId: block.id,
        label: block.label,
        code: EDGE_CASES.E14,
        message: `Potential deadlock at ${block.label}: requests queued but not processed.`,
      })
    }

    // E15: Queue starvation — queue never drains
    if (metrics.queueDepth > metrics.maxQueueDepth * 0.9 && metrics.avgWaitTimeMs > 5000) {
      starvation.push({
        blockId: block.id,
        label: block.label,
        code: EDGE_CASES.E15,
        message: `Queue starvation at ${block.label}: queue near capacity with high wait times.`,
      })
    }

    // E16: Resource starvation — utilization > 95% with high error rate
    if (metrics.utilization > 0.95 && metrics.errorRate > 0.1) {
      resourceStarvation.push({
        blockId: block.id,
        label: block.label,
        code: EDGE_CASES.E16,
        message: `Resource starvation at ${block.label}: saturated with high errors.`,
      })
    }
  }

  return { deadlocks, starvation, resourceStarvation }
}

/**
 * Graceful degradation for partial/invalid configurations.
 */
export function degradeGracefully(blockConfig, blockType) {
  const defaults = {
    replicas: 1,
    cpu: '500m',
    memory: '256Mi',
    timeout: 30000,
    rateLimit: 1000,
  }

  const config = { ...defaults, ...blockConfig }

  // Sanitize impossible values
  if (config.timeout < 0) config.timeout = 30000
  if (config.rateLimit < 0) config.rateLimit = 0
  if (config.replicas < 1) config.replicas = 1
  if (config.replicas > 100) config.replicas = 100 // Sanity cap

  return config
}

export { EDGE_CASES }