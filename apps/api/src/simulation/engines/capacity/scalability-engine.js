/**
 * Scalability Analysis Engine (P6)
 * 
 * Deterministic capacity, saturation, and growth projection analysis.
 * Consumes simulation results + behavioral models + graph topology.
 * 
 * P6 Changes:
 *   - SLA compliance tracking per block
 *   - Error type distribution analysis
 *   - Cost-aware bottleneck identification
 *   - All 30 properties traceable in analysis
 */

// ============================================================================
// ENGINE CONFIGURATION
// ============================================================================

const DEFAULT_SCALABILITY_CONFIG = Object.freeze({
  saturationWarningThreshold: 0.7,
  saturationCriticalThreshold: 0.9,
  growthMultipliers: [2, 5, 10],
  headroomWarningThreshold: 20,
  headroomCriticalThreshold: 10,
  capacityWeight: 0.3,
  headroomWeight: 0.3,
  scalingSupportWeight: 0.2,
  growthSustainabilityWeight: 0.2,
  maxScore: 100,
})

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

export function analyzeScalability(simulationResult, options = {}) {
  const config = { ...DEFAULT_SCALABILITY_CONFIG, ...(options.config || {}) }
  const { blockMetrics, globalMetrics, inputSnapshot } = simulationResult
  const blocks = inputSnapshot?.blocks || []
  const edges = inputSnapshot?.edges || []

  // Capacity limits per block
  const capacityLimits = calculateCapacityLimits(blocks, blockMetrics, config)

  // Saturation points
  const saturationPoints = calculateSaturationPoints(blocks, blockMetrics, config)

  // System saturation = minimum effective capacity across active constraints (spec §29).
  const systemSaturation = calculateSystemSaturation(blocks, blockMetrics, saturationPoints)

  // Bottlenecks
  const bottlenecks = identifyBottlenecks(blocks, blockMetrics, saturationPoints, config)

  // Growth: real experiments only, never baseline × formula (spec §27-28).
  const growthProjections = projectGrowth(simulationResult, config)

  // Scaling support analysis
  const scalingSupport = analyzeScalingSupport(blocks, config)

  // P6: SLA compliance analysis
  const slaCompliance = analyzeSlaCompliance(blockMetrics, blocks)

  // P6: Error type distribution
  const errorDistribution = analyzeErrorDistribution(blockMetrics, blocks)

  // Score
  const scalabilityScore = calculateScalabilityScore({
    capacityLimits,
    saturationPoints,
    bottlenecks,
    growthProjections,
    scalingSupport,
    slaCompliance,
  }, config)

  return {
    scalabilityScore,
    capacityLimits,
    saturationPoints,
    systemSaturation,
    growthProjections,
    supportsHorizontalScaling: scalingSupport.horizontal,
    supportsVerticalScaling: scalingSupport.vertical,
    supportsAutoScaling: scalingSupport.auto,
    bottlenecks,
    slaCompliance,
    errorDistribution,
    recommendations: generateScalabilityRecommendations({
      capacityLimits, saturationPoints, bottlenecks, growthProjections, scalingSupport, slaCompliance,
      totalBlocks: blocks.length,
    }, config),
    explainability: buildScalabilityExplainability({
      capacityLimits, saturationPoints, bottlenecks, growthProjections, scalingSupport, scalabilityScore, slaCompliance,
    }, config),
  }
}

// ============================================================================
// CAPACITY LIMITS
// ============================================================================

function calculateCapacityLimits(blocks, blockMetrics, config) {
  const limits = []
  const metricsMap = blockMetrics?.blocks || {}

  for (const block of blocks) {
    const behavioralModel = block.behavioralModel || {}
    const capacity = behavioralModel.capacity || {}
    const metrics = metricsMap[block.id] || {}

    const maxThroughput = capacity.maxThroughput || 1000
    const maxConcurrent = capacity.maxConcurrent || 100
    const maxQueueDepth = capacity.maxQueueDepth || 1000
    const currentThroughput = metrics.throughputRps || 0
    const currentUtilization = metrics.utilization || 0

    let limitingFactor = 'unknown'
    let limitValue = maxThroughput

    if (currentUtilization >= config.saturationCriticalThreshold) {
      limitingFactor = 'concurrent_connections'
      limitValue = maxConcurrent
    } else if (metrics.queueDepth >= maxQueueDepth * 0.9) {
      limitingFactor = 'queue_depth'
      limitValue = maxQueueDepth
    } else {
      limitingFactor = 'max_throughput'
      limitValue = maxThroughput
    }

    limits.push({
      blockId: block.id,
      blockType: block.type,
      label: block.label || block.id,
      maxRps: maxThroughput,
      maxConcurrent,
      maxQueueDepth,
      limitingFactor,
      limitValue,
      currentThroughput,
      currentUtilization: Math.round(currentUtilization * 1000) / 1000,
      description: `${block.label || block.id} (${block.type}) reaches capacity at ${limitValue} ${limitingFactor === 'max_throughput' ? 'RPS' : limitingFactor === 'concurrent_connections' ? 'concurrent' : 'queued'}`,
      evidence: { capacity, metrics },
    })
  }

  return limits
}

// ============================================================================
// SATURATION POINTS
// ============================================================================

function calculateSaturationPoints(blocks, blockMetrics, config) {
  const points = []
  const metricsMap = blockMetrics?.blocks || {}

  for (const block of blocks) {
    const behavioralModel = block.behavioralModel || {}
    const capacity = behavioralModel.capacity || {}
    const metrics = metricsMap[block.id] || {}

    const currentThroughput = metrics.throughputRps || 0
    const currentUtilization = metrics.utilization || 0
    const maxUtil = metrics.utilizationMax ?? currentUtilization
    // Observed saturation wins; theoretical effective capacity otherwise. Never
    // currentThroughput/currentUtilization division (spec §29).
    const observedSaturated = (metrics.timeSaturated || 0) > 0 || maxUtil >= 1
    const effectiveCapacity = metrics.saturationPoint || capacity.maxThroughput || 1000
    const rpsAtSaturation = observedSaturated ? currentThroughput : effectiveCapacity

    const headroomPercent = maxUtil >= 1
      ? 0
      : Math.max(0, (1 - maxUtil) * 100)

    let resource = 'throughput'
    if (maxUtil >= config.saturationCriticalThreshold) {
      resource = 'concurrent_capacity'
    } else if ((metrics.maxQueueDepth || 0) >= (capacity.maxQueueDepth || 1000) * 0.8 || (metrics.queueDropRate || 0) > 0) {
      resource = 'queue_capacity'
    }

    points.push({
      blockId: block.id,
      blockType: block.type,
      label: block.label || block.id,
      rpsAtSaturation: Math.round(rpsAtSaturation),
      basis: observedSaturated ? 'observed' : 'theoretical',
      resource,
      currentUtilization: Math.round(currentUtilization * 1000) / 1000,
      utilizationMax: Math.round(maxUtil * 1000) / 1000,
      timeSaturated: metrics.timeSaturated || 0,
      headroomPercent: Math.round(headroomPercent * 10) / 10,
      isSaturated: observedSaturated,
      isNearSaturation: !observedSaturated && maxUtil >= config.saturationWarningThreshold,
      evidence: { effectiveCapacity, currentThroughput, utilizationMax: maxUtil, timeSaturated: metrics.timeSaturated || 0 },
    })
  }

  return points
}

// System saturation = minimum effective capacity across blocks carrying traffic.
function calculateSystemSaturation(blocks, blockMetrics, saturationPoints) {
  const metricsMap = blockMetrics?.blocks || {}
  let limiting = null
  for (const point of saturationPoints) {
    const metrics = metricsMap[point.blockId] || {}
    if ((metrics.throughputRps || 0) <= 0) continue
    const cap = point.basis === 'observed' ? point.rpsAtSaturation : (point.evidence?.effectiveCapacity || point.rpsAtSaturation)
    if (limiting == null || cap < limiting.rps) {
      limiting = { rps: cap, blockId: point.blockId, label: point.label, basis: point.basis, resource: point.resource }
    }
  }
  return limiting
    ? { ...limiting, rps: Math.round(limiting.rps) }
    : { rps: null, blockId: null, label: null, basis: 'unknown', resource: 'unknown', reason: 'no_traffic_observed' }
}

// ============================================================================
// BOTTLENECKS
// ============================================================================

function identifyBottlenecks(blocks, blockMetrics, saturationPoints, config) {
  const bottlenecks = []
  const metricsMap = blockMetrics?.blocks || {}

  for (const point of saturationPoints) {
    if (point.isSaturated) {
      bottlenecks.push({
        blockId: point.blockId,
        blockType: point.blockType,
        label: point.label,
        severity: 'critical',
        message: `${point.label} is SATURATED at ${point.currentUtilization * 100}% utilization. Requests are being dropped.`,
        currentRps: point.rpsAtSaturation * point.currentUtilization,
        maxRps: point.rpsAtSaturation,
        limitingResource: point.resource,
        recommendation: 'Immediate action required: scale up, add replicas, or reduce load.',
        evidence: point.evidence,
      })
    } else if (point.isNearSaturation) {
      bottlenecks.push({
        blockId: point.blockId,
        blockType: point.blockType,
        label: point.label,
        severity: 'high',
        message: `${point.label} is near saturation at ${(point.currentUtilization * 100).toFixed(1)}% utilization. Only ${point.headroomPercent.toFixed(1)}% headroom remains.`,
        currentRps: point.rpsAtSaturation * point.currentUtilization,
        maxRps: point.rpsAtSaturation,
        limitingResource: point.resource,
        recommendation: point.headroomPercent < config.headroomCriticalThreshold
          ? 'Critical: Scale before next traffic increase.'
          : 'Warning: Monitor closely and plan scaling.',
        evidence: point.evidence,
      })
    }
  }

  // P6: also flag blocks with SLA violations as bottlenecks
  for (const block of blocks) {
    const metrics = metricsMap[block.id] || {}
    if (metrics.slaMet === false) {
      const alreadyBottlenecked = bottlenecks.some(b => b.blockId === block.id)
      if (!alreadyBottlenecked) {
        bottlenecks.push({
          blockId: block.id,
          blockType: block.type,
          label: block.label || block.id,
          severity: 'high',
          message: `${block.label || block.id} SLA target (${(metrics.slaTarget || 0.999) * 100}%) not met. Actual availability: ${(metrics.availability || 0).toFixed(2)}%.`,
          currentRps: metrics.throughputRps || 0,
          maxRps: metrics.saturationPoint || 1000,
          limitingResource: 'sla_violation',
          recommendation: 'Investigate failure modes and improve reliability.',
          evidence: { availability: metrics.availability, slaTarget: metrics.slaTarget },
        })
      }
    }
  }

  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
  bottlenecks.sort((a, b) => {
    const sDiff = severityOrder[a.severity] - severityOrder[b.severity]
    if (sDiff !== 0) return sDiff
    return b.currentRps / b.maxRps - a.currentRps / a.maxRps
  })

  return bottlenecks
}

// ============================================================================
// GROWTH PROJECTIONS
// ============================================================================

function projectGrowth(simulationResult, config) {
  // Actual growth experiments run through the same simulator (spec §27-28).
  // Each entry reports observed values; missing experiments stay unavailable.
  const experiments = simulationResult?.growthExperiments || {}
  const multipliers = config.growthMultipliers || [2, 5, 10]
  const projections = []

  for (const multiplier of multipliers) {
    const exp = experiments[`${multiplier}x`]
    if (!exp?.globalMetrics) {
      projections.push({
        trafficMultiplier: multiplier,
        status: 'unavailable',
        reason: 'no_growth_experiment',
        predictedLatencyMs: null,
        predictedErrorRate: null,
        predictedAvailability: null,
        predictedBottlenecks: [],
        isSustainable: null,
      })
      continue
    }

    const gm = exp.globalMetrics
    const saturatedBlocks = Object.entries(exp.blocks || {})
      .filter(([, b]) => (b.timeSaturated || 0) > 0 || (b.utilizationMax || 0) >= 1 || (b.queueDropRate || 0) > 0)
      .map(([id, b]) => ({
        blockId: id,
        throughputRps: b.throughputRps,
        utilizationMax: b.utilizationMax,
        timeSaturated: b.timeSaturated,
        queueDropRate: b.queueDropRate,
        saturationPoint: b.saturationPoint,
      }))

    projections.push({
      trafficMultiplier: multiplier,
      status: 'measured',
      rps: exp.rps,
      actualThroughputRps: gm.throughputRps,
      actualLatencyMs: gm.avgLatencyMs,
      actualLatencyP95Ms: gm.p95LatencyMs,
      actualErrorRate: gm.errorRate,
      actualAvailability: gm.availability,
      actualMonthlyCostUsd: gm.monthlyProjectedCostUsd,
      // Legacy predicted* keys carry observed values so existing charts keep working.
      predictedLatencyMs: gm.avgLatencyMs,
      predictedErrorRate: gm.errorRate,
      predictedAvailability: gm.availability,
      predictedBottlenecks: saturatedBlocks,
      isSustainable: saturatedBlocks.length === 0,
      evidence: { experimentRps: exp.rps, saturatedCount: saturatedBlocks.length },
    })
  }

  return projections
}

// ============================================================================
// SCALING SUPPORT
// ============================================================================

function analyzeScalingSupport(blocks, config) {
  let horizontal = false
  let vertical = false
  let auto = false

  for (const block of blocks) {
    const behavioralModel = block.behavioralModel || {}
    const scaling = behavioralModel.scalingBehavior || {}

    if (scaling.type === 'horizontal') horizontal = true
    if (scaling.type === 'vertical') vertical = true
    if (scaling.type === 'auto') {
      auto = true
      horizontal = true
    }
  }

  return { horizontal, vertical, auto }
}

// ============================================================================
// P6: SLA COMPLIANCE ANALYSIS
// ============================================================================

function analyzeSlaCompliance(blockMetrics, blocks) {
  const metricsMap = blockMetrics?.blocks || {}
  const compliance = []

  for (const block of blocks) {
    const metrics = metricsMap[block.id] || {}
    const behavioralModel = block.behavioralModel || {}
    const slaTarget = behavioralModel.availability?.slaTarget || 0.999
    const actualAvailability = (metrics.availability || 100) / 100
    const slaMet = actualAvailability >= slaTarget

    compliance.push({
      blockId: block.id,
      label: block.label || block.id,
      slaTarget,
      actualAvailability: Math.round(actualAvailability * 10000) / 10000,
      slaMet,
      gap: Math.max(0, slaTarget - actualAvailability),
      // P6: MTTR/MTBF context
      mttrMinutes: behavioralModel.reliability?.mttrMinutes || 5,
      mtbfHours: behavioralModel.reliability?.mtbfHours || 8760,
    })
  }

  return compliance
}

// ============================================================================
// P6: ERROR TYPE DISTRIBUTION
// ============================================================================

function analyzeErrorDistribution(blockMetrics, blocks) {
  const metricsMap = blockMetrics?.blocks || {}
  const distribution = {}

  for (const block of blocks) {
    const metrics = metricsMap[block.id] || {}
    const errorTypeCounts = metrics.errorTypeCounts || {}
    const totalErrors = metrics.totalErrors || 0

    for (const [type, count] of Object.entries(errorTypeCounts)) {
      if (!distribution[type]) {
        distribution[type] = { count: 0, blocks: [] }
      }
      distribution[type].count += count
      distribution[type].blocks.push({
        blockId: block.id,
        label: block.label || block.id,
        count,
        percentageOfBlockErrors: totalErrors > 0 ? (count / totalErrors) * 100 : 0,
      })
    }
  }

  // Sort by total count
  for (const type of Object.keys(distribution)) {
    distribution[type].blocks.sort((a, b) => b.count - a.count)
  }

  return distribution
}

// ============================================================================
// SCORING
// ============================================================================

function calculateScalabilityScore(inputs, config) {
  const { capacityLimits, saturationPoints, bottlenecks, growthProjections, scalingSupport, slaCompliance } = inputs

  const saturatedCount = saturationPoints.filter(p => p.isSaturated).length
  const nearSaturationCount = saturationPoints.filter(p => p.isNearSaturation && !p.isSaturated).length
  const totalBlocks = saturationPoints.length

  let capacityScore = 100
  if (totalBlocks > 0) {
    capacityScore -= (saturatedCount / totalBlocks) * 50
    capacityScore -= (nearSaturationCount / totalBlocks) * 25
  }
  capacityScore = Math.max(0, capacityScore)

  const avgHeadroom = saturationPoints.length > 0
    ? saturationPoints.reduce((s, p) => s + p.headroomPercent, 0) / saturationPoints.length
    : 100
  let headroomScore = 100
  if (avgHeadroom < config.headroomCriticalThreshold) headroomScore = 30
  else if (avgHeadroom < config.headroomWarningThreshold) headroomScore = 60
  else if (avgHeadroom < 50) headroomScore = 80

  let scalingScore = 0
  if (scalingSupport.auto) scalingScore = 100
  else if (scalingSupport.horizontal) scalingScore = 80
  else if (scalingSupport.vertical) scalingScore = 60
  else scalingScore = 30

  const measuredProjections = growthProjections.filter(p => p.status !== 'unavailable')
  const sustainableProjections = measuredProjections.filter(p => p.isSustainable).length
  // Null-aware: with no measured growth data the growth term drops out (C5 pattern).
  const growthScore = measuredProjections.length > 0
    ? (sustainableProjections / measuredProjections.length) * 100
    : null

  // P6: SLA compliance penalty
  let slaScore = 100
  if (slaCompliance && slaCompliance.length > 0) {
    const slaViolations = slaCompliance.filter(c => !c.slaMet).length
    slaScore -= (slaViolations / slaCompliance.length) * 30
    slaScore = Math.max(0, slaScore)
  }

  const weights = [
    [capacityScore, config.capacityWeight],
    [headroomScore, config.headroomWeight],
    [scalingScore, config.scalingSupportWeight],
    ...(growthScore == null ? [] : [[growthScore, config.growthSustainabilityWeight]]),
  ]
  const weightSum = weights.reduce((s, [, w]) => s + w, 0)
  const rawScore = weightSum > 0
    ? weights.reduce((s, [v, w]) => s + v * w, 0) / weightSum
    : 0

  const criticalBottlenecks = bottlenecks.filter(b => b.severity === 'critical').length
  const penalty = criticalBottlenecks * 10

  // P6: apply SLA penalty
  const slaPenalty = (100 - slaScore) * 0.2

  return Math.max(0, Math.round(rawScore - penalty - slaPenalty))
}

// ============================================================================
// RECOMMENDATIONS & EXPLAINABILITY
// ============================================================================

function generateScalabilityRecommendations(inputs, config) {
  const { capacityLimits, saturationPoints, bottlenecks, growthProjections, scalingSupport, slaCompliance, totalBlocks } = inputs
  const recommendations = []

  const critical = bottlenecks.filter(b => b.severity === 'critical')
  for (const b of critical) {
    recommendations.push({
      priority: 'critical',
      title: `Scale ${b.label} immediately`,
      description: b.message,
      blockId: b.blockId,
      estimatedEffort: null,
      estimatedImpact: null,
      supportingEvidence: [b.blockId],
      evidence: { utilizationMax: b.evidence?.utilizationMax, timeSaturated: b.evidence?.timeSaturated },
    })
  }

  const nearSat = saturationPoints.filter(p => p.isNearSaturation && !p.isSaturated)
  for (const p of nearSat) {
    recommendations.push({
      priority: 'high',
      title: `Plan scaling for ${p.label}`,
      description: `${p.label} peaked at ${(p.utilizationMax * 100).toFixed(1)}% utilization with ${p.headroomPercent.toFixed(1)}% headroom.`,
      blockId: p.blockId,
      estimatedEffort: null,
      estimatedImpact: null,
      supportingEvidence: [p.blockId],
      evidence: { utilizationMax: p.utilizationMax, headroomPercent: p.headroomPercent },
    })
  }

  const unsustainable = growthProjections.filter(p => p.isSustainable === false)
  if (unsustainable.length > 0) {
    const firstFailure = unsustainable[0]
    recommendations.push({
      priority: 'high',
      title: `Architecture cannot sustain ${firstFailure.trafficMultiplier}x growth`,
      description: `At ${firstFailure.trafficMultiplier}x traffic (${firstFailure.rps} RPS), ${firstFailure.predictedBottlenecks.length} component(s) saturated in simulation.`,
      estimatedEffort: null,
      estimatedImpact: null,
      supportingEvidence: firstFailure.predictedBottlenecks,
      evidence: { experimentRps: firstFailure.rps, errorRate: firstFailure.actualErrorRate },
    })
  }

  if (!scalingSupport.auto && totalBlocks > 3) {
    recommendations.push({
      priority: 'medium',
      title: 'Enable auto-scaling',
      description: 'No components have auto-scaling configured. Manual intervention will be required for traffic spikes.',
      estimatedEffort: null,
      estimatedImpact: null,
      supportingEvidence: ['scaling_support'],
    })
  }

  // P6: SLA compliance recommendations
  const slaViolations = (slaCompliance || []).filter(c => !c.slaMet)
  if (slaViolations.length > 0) {
    recommendations.push({
      priority: 'high',
      title: `Fix SLA violations in ${slaViolations.length} component(s)`,
      description: `Components ${slaViolations.map(c => c.label).join(', ')} are not meeting their SLA targets.`,
      estimatedEffort: null,
      estimatedImpact: null,
      supportingEvidence: slaViolations.map(c => c.blockId),
    })
  }

  return recommendations
}

function buildScalabilityExplainability(inputs, config) {
  const { capacityLimits, saturationPoints, bottlenecks, growthProjections, scalingSupport, scalabilityScore, slaCompliance } = inputs

  const saturatedCount = saturationPoints.filter(p => p.isSaturated).length
  const nearSatCount = saturationPoints.filter(p => p.isNearSaturation && !p.isSaturated).length
  const slaViolations = (slaCompliance || []).filter(c => !c.slaMet).length

  return {
    formula: 'capacity_score*0.3 + headroom_score*0.3 + scaling_score*0.2 + growth_score*0.2 - bottleneck_penalty - sla_penalty',
    inputs: {
      totalBlocks: saturationPoints.length,
      saturatedCount,
      nearSaturationCount: nearSatCount,
      bottleneckCount: bottlenecks.length,
      criticalBottleneckCount: bottlenecks.filter(b => b.severity === 'critical').length,
      growthProjectionCount: growthProjections.length,
      sustainableProjections: growthProjections.filter(p => p.isSustainable).length,
      slaViolations,
    },
    intermediateValues: {
      capacityScore: Math.max(0, 100 - (saturatedCount / Math.max(saturationPoints.length, 1)) * 50 - (nearSatCount / Math.max(saturationPoints.length, 1)) * 25),
      headroomScore: saturationPoints.length > 0 ? saturationPoints.reduce((s, p) => s + p.headroomPercent, 0) / saturationPoints.length : 100,
      scalingSupportScore: scalingSupport.auto ? 100 : scalingSupport.horizontal ? 80 : scalingSupport.vertical ? 60 : 30,
      growthSustainabilityScore: growthProjections.length > 0 ? (growthProjections.filter(p => p.isSustainable).length / growthProjections.length) * 100 : 100,
      bottleneckPenalty: bottlenecks.filter(b => b.severity === 'critical').length * 10,
      slaPenalty: (slaCompliance || []).length > 0 ? ((slaCompliance.filter(c => !c.slaMet).length / slaCompliance.length) * 30) * 0.2 : 0,
    },
    finalResult: scalabilityScore,
    confidence: null,
    confidenceReason: 'heuristic confidence not available; see evidence inputs',
  }
}