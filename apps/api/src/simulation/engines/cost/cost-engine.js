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
  averagePayloadBytes: {
    http: 1024,
    https: 1024,
    rest: 2048,
    graphql: 4096,
    websocket: 512,
    grpc: 1024,
    kafka: 2048,
    rabbitmq: 1024,
    amqp: 1024,
    mqtt: 256,
    tcp: 512,
    udp: 256,
    sftp: 1048576,
    'event-stream': 2048,
  },
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

  // Build usage models from simulation results
  const blockUsages = calculateBlockUsages(blocks, blockMetrics, engineConfig)
  const edgeUsages = calculateEdgeUsages(edges, globalMetrics, engineConfig)

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
    currentAnnualCost: totalCost * 12,
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
    const currentReplicas = metrics.currentReplicas || scaling.minReplicas || 1
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

function calculateEdgeUsages(edges, globalMetrics, config) {
  const usages = []
  const totalRequests = globalMetrics?.totalRequests || 0
  const totalTransferredGb = estimateTotalBandwidth(edges, totalRequests, config)

  for (const edge of edges) {
    const connectionType = edge.connectionType || 'http'
    const payloadBytes = config.averagePayloadBytes[connectionType] || 1024
    const requestsThroughEdge = Math.round(totalRequests / Math.max(edges.length, 1))
    const transferredGb = (requestsThroughEdge * payloadBytes) / (1024 * 1024 * 1024)

    usages.push({
      edgeId: edge.id,
      sourceId: edge.sourceId,
      targetId: edge.targetId,
      connectionType,
      resourceType: CONNECTION_TYPE_RESOURCE_MAP[connectionType],
      requestsThroughEdge,
      transferredGb,
      payloadBytes,
    })
  }

  return usages
}

function estimateTotalBandwidth(edges, totalRequests, config) {
  if (!edges || edges.length === 0 || totalRequests === 0) return 0
  let totalBytes = 0
  for (const edge of edges) {
    const payloadBytes = config.averagePayloadBytes[edge.connectionType || 'http'] || 1024
    totalBytes += totalRequests * payloadBytes / Math.max(edges.length, 1)
  }
  return totalBytes / (1024 * 1024 * 1024)
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
    const computeCost = usage.simulatedCost.compute || 0
    const requestCost = usage.simulatedCost.request || 0
    const networkCost = usage.simulatedCost.network || 0
    const storageCost = usage.simulatedCost.storage || 0
    const totalCost = computeCost + requestCost + networkCost + storageCost

    return {
      blockId: usage.blockId,
      blockType: usage.blockType,
      label: usage.label,
      resourceType,
      totalCost: Math.round(totalCost * 100) / 100,
      currency: 'USD',
      confidence: 0.95,
      breakdown: [
        { dimension: 'compute', cost: Math.round(computeCost * 100) / 100 },
        { dimension: 'request', cost: Math.round(requestCost * 100) / 100 },
        { dimension: 'network', cost: Math.round(networkCost * 100) / 100 },
        { dimension: 'storage', cost: Math.round(storageCost * 100) / 100 },
      ],
      notes: ['Cost calculated from behavioral model properties (P6)'],
      usage,
    }
  }

  // P6: If no behavioral cost but costProfile has values, estimate from them
  const cp = usage.costProfile || usage.cost || {}
  if (cp && (cp.hourlyComputeCost || cp.perRequestCost)) {
    const computeCost = (cp.hourlyComputeCost || 0) * usage.runtimeHours * usage.currentReplicas
    const requestCost = (cp.perRequestCost || 0) * usage.monthlyRequests
    const networkCost = (cp.perGbNetworkCost || 0) * (usage.totalRequests * 1024 / (1024 * 1024 * 1024)) // assume 1KB avg
    const storageCost = (cp.storageCostPerGbMonth || 0) * usage.storageGb
    const totalCost = computeCost + requestCost + networkCost + storageCost

    return {
      blockId: usage.blockId,
      blockType: usage.blockType,
      label: usage.label,
      resourceType,
      totalCost: Math.round(totalCost * 100) / 100,
      currency: 'USD',
      confidence: 0.85,
      breakdown: [
        { dimension: 'compute', cost: Math.round(computeCost * 100) / 100 },
        { dimension: 'request', cost: Math.round(requestCost * 100) / 100 },
        { dimension: 'network', cost: Math.round(networkCost * 100) / 100 },
        { dimension: 'storage', cost: Math.round(storageCost * 100) / 100 },
      ],
      notes: ['Cost estimated from behavioral model cost profile (P6)'],
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
  const multipliers = [2, 5, 10]
  const projections = []

  for (const multiplier of multipliers) {
    let projectedCost = 0
    const projectedBreakdown = []

    for (const cost of blockCosts) {
      const scaledCost = cost.totalCost * multiplier
      projectedCost += scaledCost
      projectedBreakdown.push({
        componentId: cost.blockId,
        baseCost: cost.totalCost,
        projectedCost: scaledCost,
        scalingFactor: multiplier,
      })
    }

    for (const cost of edgeCosts) {
      const scaledCost = cost.totalCost * multiplier
      projectedCost += scaledCost
      projectedBreakdown.push({
        componentId: cost.edgeId,
        baseCost: cost.totalCost,
        projectedCost: scaledCost,
        scalingFactor: multiplier,
      })
    }

    projections.push({
      trafficMultiplier: multiplier,
      projectedMonthlyCost: Math.round(projectedCost * 100) / 100,
      projectedAnnualCost: Math.round(projectedCost * 12 * 100) / 100,
      breakdown: projectedBreakdown,
      isSustainable: true,
    })
  }

  return projections
}

function generateCostRecommendations(blockCosts, edgeCosts, totalCost) {
  const recommendations = []

  const highCost = blockCosts.filter(c => c.totalCost > totalCost * 0.2)
  for (const c of highCost) {
    recommendations.push({
      priority: 'high',
      title: `Optimize ${c.label} cost`,
      description: `Currently ${c.totalCost.toFixed(2)} USD/month. Review instance sizing, reserved capacity, or alternative providers.`,
      componentId: c.blockId,
      estimatedSavings: c.totalCost * 0.3,
      confidence: c.confidence,
    })
  }

  const lowConfidence = [...blockCosts, ...edgeCosts].filter(c => c.confidence < 0.6)
  if (lowConfidence.length > 0) {
    recommendations.push({
      priority: 'medium',
      title: 'Improve cost estimate accuracy',
      description: `${lowConfidence.length} component(s) have low-confidence cost estimates. Configure provider-specific pricing for accuracy.`,
      estimatedSavings: 0,
      confidence: 0.5,
    })
  }

  const networkCost = edgeCosts.reduce((sum, c) => sum + c.totalCost, 0)
  if (networkCost > totalCost * 0.15) {
    recommendations.push({
      priority: 'medium',
      title: 'Optimize data transfer costs',
      description: `Network costs are ${networkCost.toFixed(2)} USD/month (${((networkCost / totalCost) * 100).toFixed(1)}%). Consider caching, compression, or same-region deployment.`,
      estimatedSavings: networkCost * 0.25,
      confidence: 0.7,
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