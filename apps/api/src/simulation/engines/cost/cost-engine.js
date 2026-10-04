/**
 * Cost Simulation Engine (P6)
 * 
 * Deterministic, explainable cost analysis for architecture simulations.
 * Consumes simulation results + provider snapshot + behavioral models.
 * Produces structured cost breakdowns with full traceability.
 * 
 * P6 Changes:
 *   - Now consumes real cost data from simulation engine (hourlyComputeCost, perRequestCost, perGbNetworkCost, storageCostPerGbMonth)
 *   - Cost simulation returns real values (not 0) when behavioral model cost properties are set
 *   - Full traceability: every cost traces to a specific property
 */

import {
  ProviderSnapshot,
  BLOCK_TYPE_RESOURCE_MAP,
  CONNECTION_TYPE_RESOURCE_MAP,
  PRICING_DIMENSIONS,
  RESOURCE_TYPES,
  buildDefaultSnapshot,
} from '../../providers/registry.js'

// ============================================================================
// ENGINE CONFIGURATION
// ============================================================================

const DEFAULT_COST_CONFIG = Object.freeze({
  secondsPerMonth: 30 * 24 * 60 * 60,
  defaultProvider: 'generic',
  defaultRegion: 'us-east-1',
  // No invented per-type payload bytes (spec §16): unknown payload bills 0, labeled unknown.
  highConfidenceThreshold: 0.8,
  mediumConfidenceThreshold: 0.5,
})

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

export function analyzeCosts(simulationResult, options = {}) {
  const {
    providerSnapshot = buildDefaultSnapshot(),
    config = {},
    userOverrides = {},
  } = options

  const engineConfig = { ...DEFAULT_COST_CONFIG, ...config }
  const { blockMetrics, globalMetrics, inputSnapshot } = simulationResult
  const blocks = inputSnapshot?.blocks || []
  const edges = inputSnapshot?.edges || []

  // Build usage models from simulation observations (never invented splits)
  const blockUsages = calculateBlockUsages(blocks, blockMetrics, engineConfig)
  const edgeUsages = calculateEdgeUsages(edges, simulationResult, engineConfig)

  // Calculate costs per component
  const blockCosts = []
  const edgeCosts = []
  let totalCost = 0
  let totalConfidence = 0
  let confidenceCount = 0

  for (const usage of blockUsages) {
    const override = userOverrides[usage.blockId]
    const cost = calculateBlockCost(usage, providerSnapshot, engineConfig, override)
    blockCosts.push(cost)
    totalCost += cost.totalCost
    totalConfidence += cost.confidence
    confidenceCount++
  }

  for (const usage of edgeUsages) {
    const cost = calculateEdgeCost(usage, providerSnapshot, engineConfig)
    edgeCosts.push(cost)
    totalCost += cost.totalCost
    totalConfidence += cost.confidence
    confidenceCount++
  }

  const avgConfidence = confidenceCount > 0 ? totalConfidence / confidenceCount : 0

  return {
    currentMonthlyCost: totalCost,
    currentAnnualCost: Math.round(totalCost * 12 * 100) / 100,
    totalCost,
    currency: 'USD',
    confidence: avgConfidence,
    breakdown: {
      blocks: blockCosts,
      edges: edgeCosts,
    },
    drivers: identifyCostDrivers(blockCosts, edgeCosts, totalCost),
    growthProjections: projectGrowthCosts(blockCosts, edgeCosts, simulationResult, engineConfig),
    recommendations: generateCostRecommendations(blockCosts, edgeCosts, totalCost),
    assumptions: buildCostAssumptions(engineConfig, providerSnapshot),
    explainability: buildCostExplainability(blockCosts, edgeCosts, totalCost),
  }
}

// ============================================================================
// USAGE CALCULATION
// ============================================================================

function calculateBlockUsages(blocks, blockMetrics, config) {
  const usages = []
  const metricsMap = blockMetrics?.blocks || {}

  for (const block of blocks) {
    const metrics = metricsMap[block.id] || {}
    const behavioralModel = block.behavioralModel || {}
    const costProfile = behavioralModel.cost || behavioralModel.costProfile || {}
    const capacity = behavioralModel.capacity || {}
    const scaling = behavioralModel.scalingBehavior || {}
    const resources = behavioralModel.resourceConsumption || {}

    const rawConfig = typeof block.config === 'string'
      ? JSON.parse(block.config || '{}')
      : (block.config || {})

    const totalRequests = metrics.totalRequests || 0
    const throughputRps = metrics.throughputRps || 0
    const currentReplicas = metrics.currentReplicas || rawConfig.replicas || scaling.minReplicas || 1
    const avgLatencyMs = metrics.avgLatencyMs || 0

    // Runtime hours = simulation duration scaled to month
    const runtimeHours = config.secondsPerMonth / 3600

    // Compute: based on replicas and CPU/memory
    const cpuPerReplica = parseCpuToVcpu(rawConfig.cpu) || (resources.cpuPerRequest ? 1 : 1)
    const vcpuHours = currentReplicas * runtimeHours * cpuPerReplica
    const ramGb = (resources.memoryPerConnection || 0) * currentReplicas / (1024 * 1024 * 1024)
    const ramGbHours = ramGb * runtimeHours

    // Requests
    const monthlyRequests = throughputRps * config.secondsPerMonth

    // Storage (for databases, storage blocks)
    const storageGb = (resources.storagePerRequest || 0) * monthlyRequests / (1024 * 1024 * 1024)
    const storageGbHours = storageGb * runtimeHours

    // P6: Use behavioral model cost properties if available
    const hasBehavioralCost = costProfile.hourlyComputeCost !== undefined ||
      costProfile.perRequestCost !== undefined ||
      costProfile.perGbNetworkCost !== undefined ||
      costProfile.storageCostPerGbMonth !== undefined

    usages.push({
      blockId: block.id,
      blockType: block.type,
      label: block.label || block.id,
      resourceType: BLOCK_TYPE_RESOURCE_MAP[block.type],
      runtimeHours,
      vcpuHours,
      ramGbHours,
      monthlyRequests,
      storageGb,
      storageGbHours,
      currentReplicas,
      avgLatencyMs,
      totalRequests,
      costProfile,
      capacity,
      // P6: flag for behavioral model cost
      hasBehavioralCost,
      // P6: actual simulated cost from engine (if available)
      simulatedCost: metrics.cost || null,
    })
  }

  return usages
}

function calculateEdgeUsages(edges, simulationResult, config) {
  const usages = []
  // Real per-edge observations from the discrete-event engine (spec §15, §67).
  const observed = simulationResult?.edgeMetrics || {}

  for (const edge of edges) {
    const connectionType = edge.connectionType || 'http'
    const obs = observed[edge.id]
    const requestsThroughEdge = obs ? obs.requests : null
    const transferredBytes = obs ? (obs.bytesSent || 0) + (obs.bytesReceived || 0) : null

    usages.push({
      edgeId: edge.id,
      sourceId: edge.sourceId,
      targetId: edge.targetId,
      connectionType,
      resourceType: CONNECTION_TYPE_RESOURCE_MAP[connectionType],
      requestsThroughEdge,
      transferredGb: transferredBytes != null ? transferredBytes / (1024 * 1024 * 1024) : null,
      transferredBytes,
      payloadBytes: null,
      payloadProvenance: 'unknown',
      observed: !!obs,
    })
  }

  return usages
}

// ============================================================================
// COST CALCULATION
// ============================================================================

function calculateBlockCost(usage, providerSnapshot, config, userOverride = null) {
  const provider = userOverride?.provider || config.defaultProvider
  const region = userOverride?.region || config.defaultRegion
  const resourceType = usage.resourceType

  // P6: If user override exists, use it exclusively
  if (userOverride?.monthlyCost !== undefined) {
    return {
      blockId: usage.blockId,
      blockType: usage.blockType,
      label: usage.label,
      resourceType,
      totalCost: userOverride.monthlyCost,
      currency: userOverride.currency || 'USD',
      confidence: 1.0,
      breakdown: [{ dimension: 'user_override', cost: userOverride.monthlyCost }],
      notes: ['User-provided cost override'],
    }
  }

  // P6: If behavioral model cost properties are available, use them for real cost calculation
  if (usage.hasBehavioralCost && usage.simulatedCost) {
    const costProfile = usage.costProfile || {}
    // Unit-explicit projections when the engine provides them; window sums otherwise.
    const sim = usage.simulatedCost
    const computeCost = sim.compute || 0
    const requestCost = sim.request || 0
    const networkCost = sim.network || 0
    const storageCost = sim.storage || 0
    const monthlyCost = sim.monthlyProjectedCostUsd ?? (computeCost + requestCost + networkCost + storageCost)
    const totalCost = monthlyCost
    // Defined calculation, not a written constant (spec §75).
    const pricedDims = ['hourlyComputeCost', 'perRequestCost', 'perGbNetworkCost', 'storageCostPerGbMonth']
      .filter(k => costProfile[k] !== undefined && costProfile[k] !== null).length
    const measuredConfidence = Math.round((0.5 + 0.5 * (pricedDims / 4)) * 100) / 100

    const windowSum = computeCost + requestCost + networkCost + storageCost
    const toMonthly = (v) => Math.round(v * (windowSum > 0 ? monthlyCost / windowSum : 0) * 100) / 100

    return {
      blockId: usage.blockId,
      blockType: usage.blockType,
      label: usage.label,
      resourceType,
      totalCost: Math.round(totalCost * 100) / 100,
      currency: 'USD',
      confidence: measuredConfidence,
      confidenceFormula: 'cost-confidence-v1: 0.5 base + 0.5 × priced-dimension share',
      breakdown: [
        { dimension: 'compute', cost: toMonthly(computeCost) },
        { dimension: 'request', cost: toMonthly(requestCost) },
        { dimension: 'network', cost: toMonthly(networkCost) },
        { dimension: 'storage', cost: toMonthly(storageCost) },
      ],
      notes: ['Monthly-projected cost from measured simulation-window usage (replica-seconds/attempts/edge bytes)'],
      usage,
    }
  }

  // P6: If no behavioral cost but costProfile has values, estimate from them
  const cp = usage.costProfile || usage.cost || {}
  if (cp && (cp.hourlyComputeCost || cp.perRequestCost)) {
    const computeCost = (cp.hourlyComputeCost || 0) * usage.runtimeHours * usage.currentReplicas
    const requestCost = (cp.perRequestCost || 0) * usage.monthlyRequests
    // No invented 1KB/request: unobserved payload bytes bill 0 with low confidence.
    const networkCost = 0
    const storageCost = (cp.storageCostPerGbMonth || 0) * usage.storageGb
    const totalCost = computeCost + requestCost + networkCost + storageCost

    return {
      blockId: usage.blockId,
      blockType: usage.blockType,
      label: usage.label,
      resourceType,
      totalCost: Math.round(totalCost * 100) / 100,
      currency: 'USD',
      confidence: 0.5,
      confidenceFormula: 'cost-confidence-v1: 0.5 without observed byte billing, 0.9+ with behavioral+observed usage',
      breakdown: [
        { dimension: 'compute', cost: Math.round(computeCost * 100) / 100 },
        { dimension: 'request', cost: Math.round(requestCost * 100) / 100 },
        { dimension: 'network', cost: 0 },
        { dimension: 'storage', cost: Math.round(storageCost * 100) / 100 },
      ],
      notes: ['Cost estimated from behavioral model cost profile (P6)', 'Network cost unknown: no observed payload bytes for this path'],
      usage,
    }
  }

  // Fallback: provider snapshot pricing
  if (!resourceType) {
    return {
      blockId: usage.blockId,
      blockType: usage.blockType,
      label: usage.label,
      resourceType: null,
      totalCost: 0,
      currency: 'USD',
      confidence: 0,
      breakdown: [],
      notes: [`Block type "${usage.blockType}" has no associated resource type`],
    }
  }

  const pricing = providerSnapshot.getPricing(provider, resourceType, region)
  if (!pricing) {
    return {
      blockId: usage.blockId,
      blockType: usage.blockType,
      label: usage.label,
      resourceType,
      totalCost: 0,
      currency: 'USD',
      confidence: 0,
      breakdown: [],
      notes: [`No pricing found for ${resourceType} from ${provider}`],
    }
  }

  const usageMap = {}
  if (pricing.pricing[PRICING_DIMENSIONS.PER_HOUR]) {
    usageMap[PRICING_DIMENSIONS.PER_HOUR] = usage.runtimeHours
  }
  if (pricing.pricing[PRICING_DIMENSIONS.PER_VCPU_HOUR]) {
    usageMap[PRICING_DIMENSIONS.PER_VCPU_HOUR] = usage.vcpuHours
  }
  if (pricing.pricing[PRICING_DIMENSIONS.PER_GB_RAM_HOUR]) {
    usageMap[PRICING_DIMENSIONS.PER_GB_RAM_HOUR] = usage.ramGbHours
  }
  if (pricing.pricing[PRICING_DIMENSIONS.PER_REQUEST]) {
    usageMap[PRICING_DIMENSIONS.PER_REQUEST] = usage.monthlyRequests
  }
  if (pricing.pricing[PRICING_DIMENSIONS.PER_GB_STORED]) {
    usageMap[PRICING_DIMENSIONS.PER_GB_STORED] = usage.storageGb
  }
  if (pricing.pricing[PRICING_DIMENSIONS.PER_GB_STORAGE_HOUR]) {
    usageMap[PRICING_DIMENSIONS.PER_GB_STORAGE_HOUR] = usage.storageGbHours
  }

  const result = providerSnapshot.calculateCost(provider, resourceType, usageMap, region)

  return {
    blockId: usage.blockId,
    blockType: usage.blockType,
    label: usage.label,
    resourceType,
    totalCost: result.cost,
    currency: result.currency,
    confidence: result.confidence,
    breakdown: result.breakdown,
    notes: result.notes,
    usage,
    pricing,
  }
}

function calculateEdgeCost(usage, providerSnapshot, config) {
  const provider = config.defaultProvider
  const region = config.defaultRegion
  const resourceType = usage.resourceType

  if (!resourceType) {
    return {
      edgeId: usage.edgeId,
      connectionType: usage.connectionType,
      totalCost: 0,
      currency: 'USD',
      confidence: 0,
      breakdown: [],
      notes: ['No resource type for connection'],
    }
  }

  // Honest absence: unobserved edges cost nothing known, not an invented split.
  if (!usage.observed) {
    return {
      edgeId: usage.edgeId,
      sourceId: usage.sourceId,
      targetId: usage.targetId,
      connectionType: usage.connectionType,
      resourceType,
      totalCost: 0,
      currency: 'USD',
      confidence: 0,
      breakdown: [],
      notes: ['No observed edge traffic for this run; cost unknown, not estimated'],
      usage,
    }
  }

  const pricing = providerSnapshot.getPricing(provider, resourceType, region)
  if (!pricing) {
    return {
      edgeId: usage.edgeId,
      connectionType: usage.connectionType,
      totalCost: 0,
      currency: 'USD',
      confidence: 0,
      breakdown: [],
      notes: [`No pricing found for ${resourceType}`],
    }
  }

  const usageMap = {}
  if (pricing.pricing[PRICING_DIMENSIONS.PER_GB_TRANSFERRED]) {
    usageMap[PRICING_DIMENSIONS.PER_GB_TRANSFERRED] = usage.transferredGb
  }
  if (pricing.pricing[PRICING_DIMENSIONS.PER_REQUEST]) {
    usageMap[PRICING_DIMENSIONS.PER_REQUEST] = usage.requestsThroughEdge
  }

  const result = providerSnapshot.calculateCost(provider, resourceType, usageMap, region)

  return {
    edgeId: usage.edgeId,
    sourceId: usage.sourceId,
    targetId: usage.targetId,
    connectionType: usage.connectionType,
    totalCost: result.cost,
    currency: result.currency,
    confidence: result.confidence,
    breakdown: result.breakdown,
    notes: result.notes,
    usage,
    pricing,
  }
}

// ============================================================================
// ANALYSIS
// ============================================================================

function identifyCostDrivers(blockCosts, edgeCosts, totalCost) {
  const allCosts = [
    ...blockCosts.map(c => ({ ...c, componentType: 'block' })),
    ...edgeCosts.map(c => ({ ...c, componentType: 'edge' })),
  ]

  const sorted = allCosts
    .filter(c => c.totalCost > 0)
    .sort((a, b) => b.totalCost - a.totalCost)

  const drivers = sorted.map((c, index) => {
    const percentage = totalCost > 0 ? (c.totalCost / totalCost) * 100 : 0
    return {
      rank: index + 1,
      componentId: c.blockId || c.edgeId,
      componentType: c.componentType,
      label: c.label || `${c.sourceId}→${c.targetId}`,
      resourceType: c.resourceType,
      cost: c.totalCost,
      percentageOfTotal: Math.round(percentage * 100) / 100,
      confidence: c.confidence,
      recommendation: generateDriverRecommendation(c, percentage),
    }
  })

  return drivers
}

function generateDriverRecommendation(costEntry, percentage) {
  if (percentage > 40) {
    return `This component drives ${percentage.toFixed(1)}% of total cost. Consider right-sizing, using reserved instances, or switching to a lower-cost provider.`
  }
  if (percentage > 20) {
    return `Significant cost contributor at ${percentage.toFixed(1)}%. Review capacity and scaling configuration.`
  }
  if (costEntry.confidence < 0.5) {
    return 'Cost estimate has low confidence — configure provider pricing for accuracy.'
  }
  return 'Cost is within expected range.'
}

function projectGrowthCosts(blockCosts, edgeCosts, simulationResult, config) {
  // Real growth experiments only — never cost × multiplier (spec §28, §32).
  const experiments = simulationResult?.growthExperiments || {}
  const expKeys = Object.keys(experiments)
    .map(k => ({ key: k, m: parseFloat(k) }))
    .filter(x => Number.isFinite(x.m) && experiments[x.key]?.globalMetrics)
    .sort((a, b) => a.m - b.m)

  if (expKeys.length === 0) {
    return [2, 5, 10].map(multiplier => ({
      trafficMultiplier: multiplier,
      projectedMonthlyCost: null,
      projectedAnnualCost: null,
      status: 'unavailable',
      reason: 'no_growth_experiment',
      breakdown: [],
      isSustainable: null,
    }))
  }

  return expKeys
    .filter(({ m }) => m !== 1)
    .map(({ key, m: multiplier }) => {
      const exp = experiments[key]
      const gm = exp.globalMetrics || {}
      const windowHours = (exp.durationSeconds || 60) / 3600
      // Fixed (capacity) vs variable (usage) split from measured experiment costs.
      const capShare = gm.capacityCostUsd || 0
      const useShare = gm.usageCostUsd ?? ((gm.simulationWindowCostUsd || 0) - capShare)
      const windowCost = gm.simulationWindowCostUsd ?? 0
      const hourly = windowHours > 0 ? windowCost / windowHours : 0
      return {
        trafficMultiplier: multiplier,
        projectedMonthlyCost: Math.round(hourly * 24 * 30 * 100) / 100,
        projectedAnnualCost: Math.round(hourly * 24 * 365 * 100) / 100,
        status: 'measured',
        reason: `single-pass ${multiplier}x experiment, same architecture/policies/model`,
        breakdown: [
          { dimension: 'capacity', windowCost: capShare },
          { dimension: 'usage', windowCost: Math.max(0, useShare) },
        ],
        experiment: {
          rps: exp.rps,
          throughputRps: gm.throughputRps,
          errorRate: gm.errorRate,
          availability: gm.availability,
        },
        isSustainable: null,
      }
    })
}

function generateCostRecommendations(blockCosts, edgeCosts, totalCost) {
  const recommendations = []

  const highCost = blockCosts.filter(c => c.totalCost > totalCost * 0.2)
  for (const c of highCost) {
    recommendations.push({
      priority: 'high',
      title: `Optimize ${c.label} cost`,
      description: `Currently ${c.totalCost.toFixed(2)} USD/month (${((c.totalCost / totalCost) * 100).toFixed(1)}% of total). Review instance sizing or reserved capacity.`,
      componentId: c.blockId,
      // No invented savings model — null until a validated model exists (spec §34, §77).
      estimatedSavings: null,
      confidence: c.confidence,
      evidence: { blockId: c.blockId, monthlyCost: c.totalCost, breakdown: c.breakdown },
    })
  }

  const lowConfidence = [...blockCosts, ...edgeCosts].filter(c => c.confidence < 0.6)
  if (lowConfidence.length > 0) {
    recommendations.push({
      priority: 'medium',
      title: 'Improve cost estimate accuracy',
      description: `${lowConfidence.length} component(s) have low-confidence cost estimates. Configure provider-specific pricing for accuracy.`,
      estimatedSavings: null,
      confidence: 0.5,
    })
  }

  const networkCost = edgeCosts.reduce((sum, c) => sum + c.totalCost, 0)
  if (networkCost > totalCost * 0.15) {
    recommendations.push({
      priority: 'medium',
      title: 'Optimize data transfer costs',
      description: `Network costs are ${networkCost.toFixed(2)} USD/month (${((networkCost / totalCost) * 100).toFixed(1)}%). Consider caching, compression, or same-region deployment.`,
      estimatedSavings: null,
      confidence: 0.5,
    })
  }

  return recommendations
}

function buildCostAssumptions(config, providerSnapshot) {
  return {
    secondsPerMonth: config.secondsPerMonth,
    defaultProvider: config.defaultProvider,
    defaultRegion: config.defaultRegion,
    providerCount: Object.keys(providerSnapshot.providers).length,
    providerVersion: providerSnapshot.version,
    fetchedAt: providerSnapshot.fetchedAt,
    notes: [
      'Costs are estimated based on simulation traffic patterns and may differ from actual billing.',
      'Storage costs assume average write rate; read-heavy workloads may differ.',
      'Network costs assume average payload size; large payloads or cross-region traffic increase costs.',
      'AI service costs vary widely by model and token count — user override recommended.',
    ],
  }
}

function buildCostExplainability(blockCosts, edgeCosts, totalCost) {
  return {
    formula: 'Sum of (usage_amount * rate) for each resource dimension per component',
    inputs: {
      blockCount: blockCosts.length,
      edgeCount: edgeCosts.length,
      totalComponents: blockCosts.length + edgeCosts.length,
      componentsWithPricing: [...blockCosts, ...edgeCosts].filter(c => c.confidence > 0).length,
    },
    intermediateValues: {
      blockCostSum: blockCosts.reduce((s, c) => s + c.totalCost, 0),
      edgeCostSum: edgeCosts.reduce((s, c) => s + c.totalCost, 0),
      averageBlockCost: blockCosts.length > 0 ? blockCosts.reduce((s, c) => s + c.totalCost, 0) / blockCosts.length : 0,
      averageEdgeCost: edgeCosts.length > 0 ? edgeCosts.reduce((s, c) => s + c.totalCost, 0) / edgeCosts.length : 0,
    },
    finalResult: totalCost,
    confidence: totalCost > 0 ? [...blockCosts, ...edgeCosts].reduce((s, c) => s + c.confidence, 0) / (blockCosts.length + edgeCosts.length) : 0,
  }
}

function parseCpuToVcpu(cpuStr) {
  if (!cpuStr) return 1
  if (typeof cpuStr === 'number') return cpuStr
  const match = String(cpuStr).match(/^(\d+(?:\.\d+)?)(m?)$/i)
  if (!match) return 1
  const val = parseFloat(match[1])
  return match[2] === 'm' ? val / 1000 : val
}