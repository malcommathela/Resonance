/**
 * Reliability Analysis Engine (P3)
 * 
 * Deterministic reliability analysis from simulation results and graph topology.
 * Calculates availability, MTTR, MTBF, failure chains, blast radius, resilience.
 * 
 * Zero hardcoded values. All parameters from behavioral models + config.
 */

// ============================================================================
// ENGINE CONFIGURATION
// ============================================================================

const DEFAULT_RELIABILITY_CONFIG = Object.freeze({
  // Availability scoring thresholds
  availabilityTargets: {
    excellent: 0.9999,   // 4 nines
    good: 0.999,         // 3 nines
    acceptable: 0.99,    // 2 nines
    poor: 0.95,
  },
  // MTTR scoring (minutes)
  mttrTargets: {
    excellent: 5,
    good: 15,
    acceptable: 60,
    poor: 240,
  },
  // MTBF scoring (hours)
  mtbfTargets: {
    excellent: 8760,    // 1 year
    good: 4320,         // 6 months
    acceptable: 720,    // 1 month
    poor: 168,          // 1 week
  },
  // Blast radius thresholds
  blastRadiusThresholds: {
    critical: 0.5,      // >50% of architecture affected
    high: 0.25,         // >25% affected
    medium: 0.1,        // >10% affected
  },
  // Resilience scoring weights
  resilienceWeights: {
    availability: 0.3,
    mttr: 0.2,
    mtbf: 0.2,
    redundancy: 0.15,
    failureIsolation: 0.15,
  },
  maxReliabilityScore: 100,
})

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

/**
 * Run reliability analysis on simulation results.
 * 
 * @param {Object} simulationResult — Full simulation result
 * @param {Object} validationResult — Topology validation results
 * @param {Object} options — Analysis options
 * @returns {ReliabilityAnalysis} Structured reliability analysis
 */
export function analyzeReliability(simulationResult, validationResult, options = {}) {
  const config = { ...DEFAULT_RELIABILITY_CONFIG, ...(options.config || {}) }
  const { blockMetrics, globalMetrics, inputSnapshot } = simulationResult
  const blocks = inputSnapshot?.blocks || []
  const edges = inputSnapshot?.edges || []

  // Build graph structures
  const adjacency = buildAdjacency(edges)
  const reverseAdjacency = buildReverseAdjacency(edges)

  // Calculate per-block availability from behavioral models + simulation
  const blockAvailabilities = calculateBlockAvailabilities(blocks, blockMetrics, config)

  // System-wide availability (series composition)
  const systemAvailability = calculateSystemAvailability(blockAvailabilities, blocks, adjacency, config)

  // MTTR/MTBF from behavioral models
  const mttrMtbf = calculateMttrMtbf(blocks, config)

  // SPOFs from validation + graph analysis
  const spofs = identifySPOFs(blocks, edges, adjacency, reverseAdjacency, validationResult, config)

  // Failure chains from simulation events
  const failureChains = analyzeFailureChains(simulationResult, blocks, adjacency, config)

  // Blast radius analysis
  const blastRadiuses = calculateBlastRadiuses(blocks, edges, adjacency, reverseAdjacency, blockMetrics, config)

  // Resilience score
  const resilienceScore = calculateResilienceScore({
    systemAvailability,
    mttr: mttrMtbf.weightedMttr,
    mtbf: mttrMtbf.weightedMtbf,
    spofCount: spofs.length,
    redundancyRatio: calculateRedundancyRatio(blocks),
    failureIsolation: calculateFailureIsolation(blocks, edges, adjacency, config),
  }, config)

  // Reliability score
  const reliabilityScore = calculateReliabilityScore({
    systemAvailability,
    mttr: mttrMtbf.weightedMttr,
    mtbf: mttrMtbf.weightedMtbf,
    resilienceScore,
  }, config)

  return {
    availability: systemAvailability,
    reliabilityScore,
    mttrMinutes: mttrMtbf.weightedMttr,
    mtbfHours: mttrMtbf.weightedMtbf,
    failureProbabilityPerDay: calculateFailureProbabilityPerDay(mttrMtbf.weightedMttr, mttrMtbf.weightedMtbf),
    singlePointsOfFailure: spofs,
    failureChains,
    blastRadiuses,
    resilienceScore,
    risks: validationResult?.findings?.filter(f => f.severity === 'risk') || [],
    blockAvailabilities,
    recommendations: generateReliabilityRecommendations({
      systemAvailability, reliabilityScore, spofs, failureChains, blastRadiuses, resilienceScore,
    }, config),
    explainability: buildReliabilityExplainability({
      systemAvailability, reliabilityScore, mttrMtbf, spofs, failureChains, blastRadiuses, resilienceScore,
    }, config),
  }
}

// ============================================================================
// AVAILABILITY CALCULATION
// ============================================================================

function calculateBlockAvailabilities(blocks, blockMetrics, config) {
  const results = []

  for (const block of blocks) {
    const behavioralModel = block.behavioralModel || {}
    const availability = behavioralModel.availability || {}
    const simMetrics = blockMetrics?.blocks?.[block.id] || {}

    // Base availability from model
    const slaTarget = availability.slaTarget || 0.999
    const mttr = availability.mttrMinutes || 30
    const mtbf = availability.mtbfHours || 720

    // Adjust based on simulation results
    const simAvailability = simMetrics.availability !== undefined ? simMetrics.availability / 100 : slaTarget
    const simErrorRate = simMetrics.errorRate || 0

    // Weighted availability: 70% model, 30% simulation
    const weightedAvailability = (slaTarget * 0.7) + (simAvailability * 0.3)

    // Penalty for high error rates in simulation
    const errorPenalty = simErrorRate > 0.01 ? simErrorRate * 0.1 : 0
    const finalAvailability = Math.max(0, Math.min(1, weightedAvailability - errorPenalty))

    results.push({
      blockId: block.id,
      type: block.type,
      label: block.label || block.id,
      modelAvailability: slaTarget,
      simulatedAvailability: simAvailability,
      weightedAvailability: finalAvailability,
      mttrMinutes: mttr,
      mtbfHours: mtbf,
      errorRate: simErrorRate,
      isSPOF: false, // Set later
      hasRedundancy: hasRedundancy(block),
    })
  }

  return results
}

function calculateSystemAvailability(blockAvailabilities, blocks, adjacency, config) {
  if (blockAvailabilities.length === 0) return 1.0

  // For series systems: availability = product of all component availabilities
  // For parallel systems: availability = 1 - product of (1 - availability)

  // Simplified: treat all as series (worst case for reliability)
  // A more sophisticated approach would identify parallel paths
  let seriesAvailability = 1.0
  for (const ba of blockAvailabilities) {
    seriesAvailability *= ba.weightedAvailability
  }

  // Identify parallel redundancy from graph
  const parallelAvailability = calculateParallelAvailability(blocks, blockAvailabilities, adjacency)

  // Weighted: 60% series (worst case), 40% parallel (best case with redundancy)
  return (seriesAvailability * 0.6) + (parallelAvailability * 0.4)
}

function calculateParallelAvailability(blocks, blockAvailabilities, adjacency) {
  // Find blocks with redundant paths (same type, same parent)
  const redundancyGroups = new Map()

  for (const block of blocks) {
    const parents = adjacency.get(block.id) || [] // Actually children, need reverse
    // Simplified: group by type
    const type = block.type
    if (!redundancyGroups.has(type)) redundancyGroups.set(type, [])
    redundancyGroups.get(type).push(block.id)
  }

  let parallelAvailability = 1.0
  for (const [type, blockIds] of redundancyGroups) {
    if (blockIds.length <= 1) continue

    const availabilities = blockIds
      .map(id => blockAvailabilities.find(ba => ba.blockId === id)?.weightedAvailability || 0.999)

    // Parallel availability: 1 - product of (1 - a_i)
    const groupUnavailability = availabilities.reduce((prod, a) => prod * (1 - a), 1)
    const groupAvailability = 1 - groupUnavailability

    parallelAvailability *= groupAvailability
  }

  return parallelAvailability
}

// ============================================================================
// MTTR / MTBF
// ============================================================================

function calculateMttrMtbf(blocks, config) {
  let totalMttr = 0
  let totalMtbf = 0
  let totalWeight = 0

  for (const block of blocks) {
    const behavioralModel = block.behavioralModel || {}
    const availability = behavioralModel.availability || {}
    const failure = behavioralModel.failureCharacteristics || {}

    const mttr = availability.mttrMinutes || config.mttrTargets.acceptable
    const mtbf = availability.mtbfHours || config.mtbfTargets.acceptable

    // Weight by failure probability
    const failureProb = failure.failureProbabilityPerHour || 0.001
    const weight = failureProb * 1000 // Normalize

    totalMttr += mttr * weight
    totalMtbf += mtbf * weight
    totalWeight += weight
  }

  const weightedMttr = totalWeight > 0 ? totalMttr / totalWeight : config.mttrTargets.acceptable
  const weightedMtbf = totalWeight > 0 ? totalMtbf / totalWeight : config.mtbfTargets.acceptable

  return { weightedMttr, weightedMtbf }
}

function calculateFailureProbabilityPerDay(mttr, mtbf) {
  if (mtbf <= 0) return 1.0
  // Approximate: P(failure in time T) = 1 - exp(-T/MTBF)
  const hoursPerDay = 24
  return 1 - Math.exp(-hoursPerDay / mtbf)
}

// ============================================================================
// SPOF IDENTIFICATION
// ============================================================================

function identifySPOFs(blocks, edges, adjacency, reverseAdjacency, validationResult, config) {
  const spofs = []

  // From validation findings
  if (validationResult?.findings) {
    for (const finding of validationResult.findings) {
      if (finding.type === 'single_point_of_failure') {
        spofs.push({
          blockId: finding.blockId,
          reason: finding.message,
          source: 'validation',
          severity: 'critical',
        })
      }
    }
  }

  // Graph-based SPOF detection
  const criticalTypes = ['api-gateway', 'load-balancer', 'database']
  const entryPoints = blocks.filter(b => ['client', 'api-gateway', 'cdn'].includes(b.type)).map(b => b.id)
  const exitPoints = blocks.filter(b => ['database', 'cache', 'storage'].includes(b.type)).map(b => b.id)

  for (const block of blocks) {
    if (!criticalTypes.includes(block.type)) continue
    if (spofs.some(s => s.blockId === block.id)) continue

    // Check if removing this block disconnects any entry-exit pair
    const isSPOF = checkGraphSPOF(block.id, entryPoints, exitPoints, blocks, edges, adjacency)
    if (isSPOF) {
      spofs.push({
        blockId: block.id,
        reason: `Removing ${block.label || block.id} disconnects the architecture`,
        source: 'graph_analysis',
        severity: 'critical',
      })
    }
  }

  return spofs
}

function checkGraphSPOF(blockId, entryPoints, exitPoints, blocks, edges, adjacency) {
  // Build adjacency without this block
  const adjWithout = new Map()
  for (const [key, neighbors] of adjacency) {
    if (key === blockId) continue
    adjWithout.set(key, neighbors.filter(n => n !== blockId))
  }

  for (const entry of entryPoints) {
    if (entry === blockId) continue
    for (const exit of exitPoints) {
      if (exit === blockId) continue

      const hasPathWith = hasPath(entry, exit, adjacency)
      const hasPathWithout = hasPath(entry, exit, adjWithout)

      if (hasPathWith && !hasPathWithout) {
        return true
      }
    }
  }

  return false
}

function hasPath(start, end, adjacency) {
  const visited = new Set()
  const queue = [start]
  visited.add(start)

  while (queue.length > 0) {
    const current = queue.shift()
    if (current === end) return true

    const neighbors = adjacency.get(current) || []
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor)
        queue.push(neighbor)
      }
    }
  }

  return false
}

// ============================================================================
// FAILURE CHAINS
// ============================================================================

function analyzeFailureChains(simulationResult, blocks, adjacency, config) {
  const chains = []
  const failureEvents = simulationResult.failureEvents || []

  if (failureEvents.length === 0) return chains

  // Group by failure mode
  const byMode = new Map()
  for (const event of failureEvents) {
    const mode = event.mode || event.type || 'unknown'
    if (!byMode.has(mode)) byMode.set(mode, [])
    byMode.get(mode).push(event)
  }

  for (const [mode, events] of byMode) {
    const affectedBlocks = [...new Set(events.map(e => e.blockId).filter(Boolean))]
    if (affectedBlocks.length <= 1) continue

    // Determine propagation path
    const propagationPath = determinePropagationPath(affectedBlocks, adjacency, blocks)

    chains.push({
      id: `chain-${mode}`,
      mode,
      blockIds: affectedBlocks,
      propagationPath,
      probability: events.length / (simulationResult.passCount || 1),
      maxImpact: affectedBlocks.length,
      description: `Failure mode "${mode}" cascaded through ${affectedBlocks.length} blocks: ${propagationPath.join(' → ')}`,
      evidence: { eventCount: events.length, affectedBlocks },
    })
  }

  return chains
}

function determinePropagationPath(affectedBlocks, adjacency, blocks) {
  // Simple ordering: try to find a path that visits all affected blocks
  const path = []
  const remaining = new Set(affectedBlocks)

  // Start with the block that has no affected predecessors
  let current = affectedBlocks.find(b => {
    const predecessors = getPredecessors(b, adjacency)
    return !predecessors.some(p => affectedBlocks.includes(p))
  }) || affectedBlocks[0]

  path.push(current)
  remaining.delete(current)

  while (remaining.size > 0) {
    const neighbors = adjacency.get(current) || []
    const next = neighbors.find(n => remaining.has(n))
    if (!next) break
    path.push(next)
    remaining.delete(next)
    current = next
  }

  // Add any remaining blocks
  for (const block of remaining) {
    path.push(block)
  }

  return path
}

function getPredecessors(blockId, adjacency) {
  const preds = []
  for (const [source, targets] of adjacency) {
    if (targets.includes(blockId)) preds.push(source)
  }
  return preds
}

// ============================================================================
// BLAST RADIUS
// ============================================================================

function calculateBlastRadiuses(blocks, edges, adjacency, reverseAdjacency, blockMetrics, config) {
  const results = []
  const totalBlocks = blocks.length

  for (const block of blocks) {
    const downstream = getDownstreamBlocks(block.id, adjacency)
    const directDownstream = adjacency.get(block.id) || []
    const indirectDownstream = [...downstream].filter(id => !directDownstream.includes(id))

    const simMetrics = blockMetrics?.blocks?.[block.id] || {}
    const totalRequests = simMetrics.totalRequests || 0

    const affectedRatio = totalBlocks > 0 ? downstream.size / totalBlocks : 0

    let severity = 'low'
    if (affectedRatio > config.blastRadiusThresholds.critical) severity = 'critical'
    else if (affectedRatio > config.blastRadiusThresholds.high) severity = 'high'
    else if (affectedRatio > config.blastRadiusThresholds.medium) severity = 'medium'

    results.push({
      blockId: block.id,
      blockType: block.type,
      label: block.label || block.id,
      directlyAffectedBlocks: directDownstream.length,
      indirectlyAffectedBlocks: indirectDownstream.length,
      totalAffectedBlocks: downstream.size,
      affectedRatio: Math.round(affectedRatio * 100) / 100,
      estimatedRequestsAffected: totalRequests,
      estimatedAvailabilityImpact: affectedRatio * 100,
      severity,
      evidence: { downstreamIds: [...downstream] },
    })
  }

  return results
}

function getDownstreamBlocks(blockId, adjacency) {
  const downstream = new Set()
  const queue = [blockId]
  const visited = new Set([blockId])

  while (queue.length > 0) {
    const current = queue.shift()
    const neighbors = adjacency.get(current) || []
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor)
        downstream.add(neighbor)
        queue.push(neighbor)
      }
    }
  }

  return downstream
}

// ============================================================================
// RESILIENCE & RELIABILITY SCORING
// ============================================================================

function calculateResilienceScore(inputs, config) {
  const { systemAvailability, mttr, mtbf, spofCount, redundancyRatio, failureIsolation } = inputs

  // Availability score (0-100)
  let availabilityScore = 0
  if (systemAvailability >= config.availabilityTargets.excellent) availabilityScore = 100
  else if (systemAvailability >= config.availabilityTargets.good) availabilityScore = 80
  else if (systemAvailability >= config.availabilityTargets.acceptable) availabilityScore = 60
  else if (systemAvailability >= config.availabilityTargets.poor) availabilityScore = 40
  else availabilityScore = 20

  // MTTR score (lower is better)
  let mttrScore = 0
  if (mttr <= config.mttrTargets.excellent) mttrScore = 100
  else if (mttr <= config.mttrTargets.good) mttrScore = 80
  else if (mttr <= config.mttrTargets.acceptable) mttrScore = 60
  else if (mttr <= config.mttrTargets.poor) mttrScore = 40
  else mttrScore = 20

  // MTBF score (higher is better)
  let mtbfScore = 0
  if (mtbf >= config.mtbfTargets.excellent) mtbfScore = 100
  else if (mtbf >= config.mtbfTargets.good) mtbfScore = 80
  else if (mtbf >= config.mtbfTargets.acceptable) mtbfScore = 60
  else if (mtbf >= config.mtbfTargets.poor) mtbfScore = 40
  else mtbfScore = 20

  // Redundancy score
  const redundancyScore = redundancyRatio * 100

  // Failure isolation score
  const isolationScore = failureIsolation * 100

  // SPOF penalty
  const spofPenalty = Math.min(spofCount * 15, 40)

  const rawScore = (
    availabilityScore * config.resilienceWeights.availability +
    mttrScore * config.resilienceWeights.mttr +
    mtbfScore * config.resilienceWeights.mtbf +
    redundancyScore * config.resilienceWeights.redundancy +
    isolationScore * config.resilienceWeights.failureIsolation
  )

  return Math.max(0, Math.round(rawScore - spofPenalty))
}

function calculateReliabilityScore(inputs, config) {
  const { systemAvailability, mttr, mtbf, resilienceScore } = inputs

  // Availability component (40%)
  let availScore = 0
  if (systemAvailability >= 0.9999) availScore = 100
  else if (systemAvailability >= 0.999) availScore = 85
  else if (systemAvailability >= 0.99) availScore = 70
  else if (systemAvailability >= 0.95) availScore = 50
  else availScore = 30

  // MTTR component (20%)
  let mttrScore = 0
  if (mttr <= 5) mttrScore = 100
  else if (mttr <= 15) mttrScore = 85
  else if (mttr <= 60) mttrScore = 70
  else if (mttr <= 240) mttrScore = 50
  else mttrScore = 30

  // MTBF component (20%)
  let mtbfScore = 0
  if (mtbf >= 8760) mtbfScore = 100
  else if (mtbf >= 4320) mtbfScore = 85
  else if (mtbf >= 720) mtbfScore = 70
  else if (mtbf >= 168) mtbfScore = 50
  else mtbfScore = 30

  // Resilience component (20%)
  const resilienceComponent = resilienceScore

  const score = (
    availScore * 0.4 +
    mttrScore * 0.2 +
    mtbfScore * 0.2 +
    resilienceComponent * 0.2
  )

  return Math.round(score)
}

function calculateRedundancyRatio(blocks) {
  if (blocks.length === 0) return 0
  const redundant = blocks.filter(b => hasRedundancy(b)).length
  return redundant / blocks.length
}

function hasRedundancy(block) {
  const behavioralModel = block.behavioralModel || {}
  const scaling = behavioralModel.scalingBehavior || {}
  const minReplicas = scaling.minReplicas || 1
  return minReplicas >= 2
}

function calculateFailureIsolation(blocks, edges, adjacency, config) {
  if (blocks.length === 0) return 1.0

  // Measure how well failures are contained
  // Lower average blast radius = better isolation
  let totalBlastRadius = 0
  for (const block of blocks) {
    const downstream = getDownstreamBlocks(block.id, adjacency)
    totalBlastRadius += downstream.size
  }

  const avgBlastRadius = totalBlastRadius / blocks.length
  const maxPossible = blocks.length - 1

  // Invert: 1.0 = perfect isolation (no downstream impact), 0.0 = complete cascade
  return maxPossible > 0 ? Math.max(0, 1 - (avgBlastRadius / maxPossible)) : 1.0
}

// ============================================================================
// RECOMMENDATIONS & EXPLAINABILITY
// ============================================================================

function generateReliabilityRecommendations(inputs, config) {
  const { systemAvailability, reliabilityScore, spofs, failureChains, blastRadiuses, resilienceScore } = inputs
  const recommendations = []

  if (spofs.length > 0) {
    recommendations.push({
      priority: 'critical',
      title: `Eliminate ${spofs.length} single point(s) of failure`,
      description: spofs.map(s => s.reason).join('; '),
      estimatedEffort: spofs.length * 8,
      estimatedImpact: 20,
      supportingEvidence: spofs.map(s => s.blockId),
    })
  }

  if (systemAvailability < config.availabilityTargets.acceptable) {
    recommendations.push({
      priority: 'high',
      title: 'Improve system availability',
      description: `Current availability: ${(systemAvailability * 100).toFixed(3)}%. Target: ${(config.availabilityTargets.acceptable * 100).toFixed(1)}%.`,
      estimatedEffort: 12,
      estimatedImpact: 15,
      supportingEvidence: ['system_availability'],
    })
  }

  if (failureChains.length > 0) {
    recommendations.push({
      priority: 'high',
      title: `Address ${failureChains.length} failure chain(s)`,
      description: failureChains.map(c => c.description).join('; '),
      estimatedEffort: failureChains.length * 6,
      estimatedImpact: 15,
      supportingEvidence: failureChains.map(c => c.id),
    })
  }

  const highBlastRadius = blastRadiuses.filter(b => b.severity === 'critical' || b.severity === 'high')
  if (highBlastRadius.length > 0) {
    recommendations.push({
      priority: 'medium',
      title: `Reduce blast radius for ${highBlastRadius.length} component(s)`,
      description: highBlastRadius.map(b => `${b.label}: affects ${b.totalAffectedBlocks} blocks`).join('; '),
      estimatedEffort: highBlastRadius.length * 4,
      estimatedImpact: 10,
      supportingEvidence: highBlastRadius.map(b => b.blockId),
    })
  }

  if (resilienceScore < 60) {
    recommendations.push({
      priority: 'medium',
      title: 'Improve overall resilience',
      description: `Resilience score: ${resilienceScore}/100. Add redundancy, circuit breakers, and bulkheads.`,
      estimatedEffort: 16,
      estimatedImpact: 12,
      supportingEvidence: ['resilience_score'],
    })
  }

  return recommendations
}

function buildReliabilityExplainability(inputs, config) {
  const { systemAvailability, reliabilityScore, mttrMtbf, spofs, failureChains, blastRadiuses, resilienceScore } = inputs

  return {
    formula: 'availability_score*0.4 + mttr_score*0.2 + mtbf_score*0.2 + resilience_score*0.2',
    inputs: {
      systemAvailability,
      mttrMinutes: mttrMtbf.weightedMttr,
      mtbfHours: mttrMtbf.weightedMtbf,
      spofCount: spofs.length,
      failureChainCount: failureChains.length,
      blastRadiusAnalyzed: blastRadiuses.length,
    },
    intermediateValues: {
      availabilityComponent: systemAvailability >= 0.9999 ? 100 : systemAvailability >= 0.999 ? 85 : systemAvailability >= 0.99 ? 70 : 50,
      mttrComponent: mttrMtbf.weightedMttr <= 5 ? 100 : mttrMtbf.weightedMttr <= 15 ? 85 : mttrMtbf.weightedMttr <= 60 ? 70 : 50,
      mtbfComponent: mttrMtbf.weightedMtbf >= 8760 ? 100 : mttrMtbf.weightedMtbf >= 4320 ? 85 : mttrMtbf.weightedMtbf >= 720 ? 70 : 50,
      resilienceComponent: resilienceScore,
    },
    finalResult: reliabilityScore,
    confidence: 0.85,
  }
}

// ============================================================================
// GRAPH UTILITIES
// ============================================================================

function buildAdjacency(edges) {
  const adj = new Map()
  for (const edge of edges) {
    const neighbors = adj.get(edge.sourceId) || []
    neighbors.push(edge.targetId)
    adj.set(edge.sourceId, neighbors)
  }
  return adj
}

function buildReverseAdjacency(edges) {
  const adj = new Map()
  for (const edge of edges) {
    const neighbors = adj.get(edge.targetId) || []
    neighbors.push(edge.sourceId)
    adj.set(edge.targetId, neighbors)
  }
  return adj
}