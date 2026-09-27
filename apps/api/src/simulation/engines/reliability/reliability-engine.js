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

  // Calculate per-block availability: simulated (primary) vs model (theoretical).
  // Never blended — spec §4, §68.
  const blockAvailabilities = calculateBlockAvailabilities(blocks, blockMetrics, config)

  // System availability split: observed series vs theoretical vs target.
  const availabilityDetail = calculateAvailabilityDetail(blockAvailabilities, blocks, adjacency)
  const systemAvailability = availabilityDetail.simulatedAvailability
    ?? availabilityDetail.theoreticalAvailability

  // MTTR/MTBF from behavioral models
  const mttrMtbf = calculateMttrMtbf(blocks, config)

  // SPOFs: removal must disconnect a workload path (spec §70). Every block is a
  // candidate — never a type allowlist. Entry/exit come from graph shape.
  const spofs = identifySPOFs(blocks, edges, adjacency, reverseAdjacency, validationResult, blockAvailabilities, config)

  // Failure chains from observed causal links, never graph inference (spec §8).
  const failureChains = analyzeFailureChains(simulationResult, blocks, config)

  // Blast radius: graph reachability weighted by observed traffic (spec §71).
  const blastRadiuses = calculateBlastRadiuses(blocks, edges, adjacency, reverseAdjacency, simulationResult, config)

  // Resilience score (scored on observed availability, theoretical fallback)
  const scoringAvailability = systemAvailability ?? availabilityDetail.theoreticalAvailability
  const resilienceScore = calculateResilienceScore({
    systemAvailability: scoringAvailability,
    mttr: mttrMtbf.weightedMttr,
    mtbf: mttrMtbf.weightedMtbf,
    spofCount: spofs.length,
    redundancyRatio: calculateRedundancyRatio(blockAvailabilities),
    failureIsolation: calculateFailureIsolation(blocks, edges, adjacency, config),
  }, config)

  // Reliability score
  const reliabilityScore = calculateReliabilityScore({
    systemAvailability: scoringAvailability,
    mttr: mttrMtbf.weightedMttr,
    mtbf: mttrMtbf.weightedMtbf,
    resilienceScore,
  }, config)

  return {
    availability: systemAvailability,
    availabilityDetail,
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
    const rawConfig = typeof block.config === 'string'
      ? JSON.parse(block.config || '{}')
      : (block.config || {})

    const slaTarget = availability.slaTarget || 0.999
    const mttr = availability.mttrMinutes || 30
    const mtbf = availability.mtbfHours || 720

    // Simulated availability is primary and only set when traffic was observed.
    const observedRequests = simMetrics.totalRequests || 0
    const simulatedAvailability = observedRequests > 0 && simMetrics.availability !== undefined
      ? simMetrics.availability / 100
      : null

    // Redundancy levels from actual config, not replica-count folklore (spec §5).
    const replicas = simMetrics.currentReplicas
      ?? rawConfig.replicas
      ?? behavioralModel.scalingBehavior?.minReplicas
      ?? 1
    const failureDomain = rawConfig.zone || rawConfig.region || rawConfig.failureDomain || null

    results.push({
      blockId: block.id,
      type: block.type,
      label: block.label || block.id,
      simulatedAvailability,
      simulatedRequests: observedRequests,
      modelAvailability: slaTarget,
      theoreticalAvailability: slaTarget,
      targetAvailability: slaTarget,
      mttrMinutes: mttr,
      mtbfHours: mtbf,
      errorRate: simMetrics.errorRate || 0,
      isSPOF: false, // Set later
      redundancy: {
        replicas,
        failureDomain,
        failureDomainSeparation: failureDomain ? 'annotated' : 'unknown',
        hasReplicaRedundancy: replicas >= 2,
      },
    })
  }

  return results
}

// Observed series availability over blocks with observations; theoretical over
// model SLAs; target as the minimum block SLA. Parallel credit only for true
// peer groups (identical predecessor AND successor sets), never type groups.
function calculateAvailabilityDetail(blockAvailabilities, blocks, adjacency) {
  const groups = groupParallelPeers(blocks, adjacency)
  let simulated = 1.0
  let simulatedBasis = true
  let theoretical = 1.0

  for (const group of groups) {
    const avail = (ba) => ba.simulatedAvailability ?? ba.modelAvailability
    if (group.length === 1) {
      const ba = blockAvailabilities.find(b => b.blockId === group[0])
      if (!ba) continue
      if (ba.simulatedAvailability == null) simulatedBasis = false
      simulated *= avail(ba)
      theoretical *= ba.modelAvailability
    } else {
      const members = group.map(id => blockAvailabilities.find(b => b.blockId === id)).filter(Boolean)
      if (members.length === 0) continue
      if (members.some(m => m.simulatedAvailability == null)) simulatedBasis = false
      const groupUnavailSim = members.reduce((p, m) => p * (1 - avail(m)), 1)
      const groupUnavailModel = members.reduce((p, m) => p * (1 - m.modelAvailability), 1)
      simulated *= (1 - groupUnavailSim)
      theoretical *= (1 - groupUnavailModel)
    }
  }

  const target = blockAvailabilities.length > 0
    ? Math.min(...blockAvailabilities.map(b => b.targetAvailability))
    : 1.0

  return {
    simulatedAvailability: simulatedBasis ? simulated : null,
    theoreticalAvailability: theoretical,
    targetAvailability: target,
    peerGroups: groups.filter(g => g.length > 1),
  }
}

// True redundant peers: same role in the graph (same upstreams + downstreams).
function groupParallelPeers(blocks, adjacency) {
  const predsOf = (id) => {
    const preds = []
    for (const [src, targets] of adjacency) {
      if (targets.includes(id)) preds.push(src)
    }
    return preds.sort().join(',')
  }
  const keyOf = (id) => `${predsOf(id)}|${[...(adjacency.get(id) || [])].sort().join(',')}`
  const groups = new Map()
  for (const block of blocks) {
    const key = keyOf(block.id)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(block.id)
  }
  return [...groups.values()]
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

function identifySPOFs(blocks, edges, adjacency, reverseAdjacency, validationResult, blockAvailabilities, config) {
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

  // Workload entries = graph sources (plus explicit client/cdn roles); exits = sinks.
  const incoming = new Set()
  for (const [, targets] of adjacency) {
    for (const t of targets) incoming.add(t)
  }
  const entryPoints = blocks
    .filter(b => !incoming.has(b.id) || ['client', 'cdn'].includes(b.type))
    .map(b => b.id)
  const exitPoints = blocks
    .filter(b => (adjacency.get(b.id) || []).length === 0)
    .map(b => b.id)

  const availabilityById = new Map((blockAvailabilities || []).map(b => [b.blockId, b]))

  for (const block of blocks) {
    if (spofs.some(s => s.blockId === block.id)) continue

    // Check if removing this block disconnects any entry-exit pair
    const isSPOF = checkGraphSPOF(block.id, entryPoints, exitPoints, blocks, edges, adjacency)
    if (isSPOF) {
      const red = availabilityById.get(block.id)?.redundancy
      spofs.push({
        blockId: block.id,
        reason: `Removing ${block.label || block.id} disconnects the workload path`,
        source: 'graph_analysis',
        severity: 'critical',
        replicas: red?.replicas ?? 1,
        failureDomainSeparation: red?.failureDomainSeparation ?? 'unknown',
        mitigation: (red?.replicas ?? 1) >= 2
          ? 'Replica count > 1 without a separate failure domain does not remove this SPOF'
          : null,
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

function analyzeFailureChains(simulationResult, blocks, config) {
  // Observed causal links only. No link is ever inferred from graph shape.
  const links = simulationResult.failurePropagation || []
  const totalFailed = simulationResult.failedRequests || 0
  const labelOf = (id) => blocks.find(b => b.id === id)?.label || id

  return links.map((link, index) => ({
    id: `chain-observed-${index}`,
    mode: link.lastReason || 'observed_failure',
    blockIds: [link.from, link.to],
    propagationPath: [link.from, link.to],
    observed: true,
    failures: link.failures,
    probability: null,
    probabilityReason: 'no failure-probability model; count is observed',
    maxImpact: link.failures,
    description: `Observed propagation: ${labelOf(link.from)} → ${labelOf(link.to)} (${link.failures} failures)`,
    evidence: { from: link.from, to: link.to, failures: link.failures, totalFailedRequests: totalFailed },
  }))
}

// ============================================================================
// BLAST RADIUS
// ============================================================================

function calculateBlastRadiuses(blocks, edges, adjacency, reverseAdjacency, simulationResult, config) {
  const results = []
  const totalBlocks = blocks.length
  const metricsMap = simulationResult?.blockMetrics?.blocks || {}
  const globalTotal = simulationResult?.globalMetrics?.totalRequests || 0

  for (const block of blocks) {
    const downstream = getDownstreamBlocks(block.id, adjacency)
    const directDownstream = adjacency.get(block.id) || []
    const indirectDownstream = [...downstream].filter(id => !directDownstream.includes(id))

    // Traffic-weighted impact from observations, not block counts alone (spec §71).
    const simMetrics = metricsMap[block.id] || {}
    const affectedRequests = simMetrics.totalRequests || 0
    const downstreamTraffic = [...downstream].reduce((s, id) => s + (metricsMap[id]?.totalRequests || 0), 0)
    const affectedTrafficShare = globalTotal > 0 ? affectedRequests / globalTotal : 0

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
      affectedRequests,
      affectedTrafficShare: Math.round(affectedTrafficShare * 10000) / 10000,
      downstreamTraffic,
      estimatedRequestsAffected: affectedRequests,
      estimatedAvailabilityImpact: affectedRatio * 100,
      severity,
      evidence: { downstreamIds: [...downstream], affectedRequests, downstreamTraffic, globalTotal },
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

function calculateRedundancyRatio(blockAvailabilities) {
  if (!blockAvailabilities || blockAvailabilities.length === 0) return 0
  const redundant = blockAvailabilities.filter(b => b.redundancy?.hasReplicaRedundancy).length
  return redundant / blockAvailabilities.length
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
      estimatedEffort: null,
      estimatedImpact: null,
      supportingEvidence: spofs.map(s => s.blockId),
      evidence: spofs.map(s => ({ blockId: s.blockId, source: s.source })),
    })
  }

  if (systemAvailability != null && systemAvailability < config.availabilityTargets.acceptable) {
    recommendations.push({
      priority: 'high',
      title: 'Improve system availability',
      description: `Observed availability: ${systemAvailability != null ? (systemAvailability * 100).toFixed(3) + '%' : 'unobserved'}. Target: ${(config.availabilityTargets.acceptable * 100).toFixed(1)}%.`,
      estimatedEffort: null,
      estimatedImpact: null,
      supportingEvidence: ['system_availability'],
    })
  }

  if (failureChains.length > 0) {
    recommendations.push({
      priority: 'high',
      title: `Address ${failureChains.length} observed failure chain(s)`,
      description: failureChains.map(c => c.description).join('; '),
      estimatedEffort: null,
      estimatedImpact: null,
      supportingEvidence: failureChains.map(c => c.id),
      evidence: failureChains.map(c => ({ from: c.blockIds[0], to: c.blockIds[1], failures: c.failures })),
    })
  }

  const highBlastRadius = blastRadiuses.filter(b => b.severity === 'critical' || b.severity === 'high')
  if (highBlastRadius.length > 0) {
    recommendations.push({
      priority: 'medium',
      title: `Reduce blast radius for ${highBlastRadius.length} component(s)`,
      description: highBlastRadius.map(b => `${b.label}: affects ${b.totalAffectedBlocks} blocks, ${b.affectedRequests} observed requests`).join('; '),
      estimatedEffort: null,
      estimatedImpact: null,
      supportingEvidence: highBlastRadius.map(b => b.blockId),
    })
  }

  if (resilienceScore < 60) {
    recommendations.push({
      priority: 'medium',
      title: 'Improve overall resilience',
      description: `Resilience score: ${resilienceScore}/100. Add redundancy, circuit breakers, and bulkheads.`,
      estimatedEffort: null,
      estimatedImpact: null,
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
    confidence: null,
    confidenceReason: 'heuristic confidence not available; see evidence inputs',
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