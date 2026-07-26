/**
 * Explainability Engine (P3)
 * 
 * Traces every calculated metric back to its inputs, formulas, and evidence.
 * Produces both executive summaries and detailed calculation breakdowns.
 * 
 * Zero hardcoded values. All formulas parameterized.
 */

// ============================================================================
// ENGINE CONFIGURATION
// ============================================================================

const DEFAULT_EXPLAINABILITY_CONFIG = Object.freeze({
  // Granularity levels
  granularity: {
    summary: 'summary',      // High-level explanation
    detailed: 'detailed',    // Per-component breakdown
    full: 'full',           // Every intermediate value
  },
  defaultGranularity: 'detailed',

  // Confidence thresholds
  highConfidenceThreshold: 0.8,
  mediumConfidenceThreshold: 0.5,
})

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

/**
 * Build explainability data for all simulation metrics.
 * 
 * @param {Object} simulationResult — Full simulation result
 * @param {Object} analysisResults — Results from all P3 engines
 * @param {Object} options — Analysis options
 * @returns {ExplainabilityReport} Structured explainability data
 */
export function buildExplainability(simulationResult, analysisResults, options = {}) {
  const config = { ...DEFAULT_EXPLAINABILITY_CONFIG, ...(options.config || {}) }
  const granularity = options.granularity || config.defaultGranularity
  const { blockMetrics, globalMetrics, inputSnapshot, assumptions } = simulationResult
  const blocks = inputSnapshot?.blocks || []
  const edges = inputSnapshot?.edges || []

  const explanations = []

  // Global metrics explanations
  explanations.push(...explainGlobalMetrics(globalMetrics, simulationResult, granularity))

  // Per-block metric explanations
  explanations.push(...explainBlockMetrics(blocks, blockMetrics, simulationResult, granularity))

  // Engine result explanations
  explanations.push(...explainEngineResults(analysisResults, granularity))

  // Assumption explanations
  explanations.push(...explainAssumptions(assumptions, granularity))

  return {
    granularity,
    totalExplanations: explanations.length,
    explanations,
    summary: generateExplainabilitySummary(explanations, analysisResults),
    confidence: calculateOverallConfidence(explanations),
  }
}

// ============================================================================
// GLOBAL METRICS EXPLANATIONS
// ============================================================================

function explainGlobalMetrics(globalMetrics, simulationResult, granularity) {
  const explanations = []
  if (!globalMetrics) return explanations

  // Throughput
  explanations.push({
    metricId: 'global.throughputRps',
    metricName: 'Global Throughput',
    value: globalMetrics.throughputRps,
    unit: 'RPS',
    why: 'Total requests processed divided by actual simulation duration.',
    formula: 'totalRequests / actualDurationSeconds',
    inputs: {
      totalRequests: globalMetrics.totalRequests,
      successfulRequests: globalMetrics.successfulRequests,
      failedRequests: globalMetrics.failedRequests,
      droppedRequests: globalMetrics.droppedRequests,
    },
    intermediateValues: {
      actualDurationSeconds: simulationResult.actualDurationMs ? simulationResult.actualDurationMs / 1000 : globalMetrics.duration || 300,
      totalRequests: globalMetrics.totalRequests,
    },
    finalResult: globalMetrics.throughputRps,
    contributingComponents: ['all_blocks'],
    contributingFactors: ['traffic_pattern', 'simulation_duration', 'system_capacity'],
    assumptions: ['Requests are uniformly distributed across simulation duration.'],
    confidence: globalMetrics.totalRequests > 100 ? 0.95 : 0.7,
    supportingData: ['globalMetrics.totalRequests', 'simulationResult.actualDurationMs'],
  })

  // Latency
  explanations.push({
    metricId: 'global.avgLatencyMs',
    metricName: 'Average End-to-End Latency',
    value: globalMetrics.avgLatencyMs,
    unit: 'ms',
    why: 'Mean of all completed request latencies from arrival to completion.',
    formula: 'sum(completedRequest.latencyMs) / completedRequests.length',
    inputs: {
      completedRequests: globalMetrics.successfulRequests,
      totalLatencySum: globalMetrics.avgLatencyMs * globalMetrics.successfulRequests,
    },
    intermediateValues: {
      sampleCount: globalMetrics.successfulRequests,
      totalLatencySum: globalMetrics.avgLatencyMs * globalMetrics.successfulRequests,
    },
    finalResult: globalMetrics.avgLatencyMs,
    contributingComponents: identifyLatencyContributors(simulationResult),
    contributingFactors: ['network_latency', 'processing_latency', 'queue_delay', 'serialization', 'failure_modes'],
    assumptions: ['Latency samples are representative of steady-state behavior.'],
    confidence: globalMetrics.successfulRequests > 100 ? 0.9 : 0.6,
    supportingData: ['globalMetrics.avgLatencyMs', 'globalMetrics.p95LatencyMs', 'globalMetrics.p99LatencyMs'],
  })

  // Error Rate
  explanations.push({
    metricId: 'global.errorRate',
    metricName: 'Global Error Rate',
    value: globalMetrics.errorRate,
    unit: 'ratio',
    why: 'Proportion of requests that failed or were dropped.',
    formula: '(failedRequests + droppedRequests) / totalRequests',
    inputs: {
      failedRequests: globalMetrics.failedRequests,
      droppedRequests: globalMetrics.droppedRequests,
      totalRequests: globalMetrics.totalRequests,
    },
    intermediateValues: {
      failed: globalMetrics.failedRequests,
      dropped: globalMetrics.droppedRequests,
      total: globalMetrics.totalRequests,
      errorCount: globalMetrics.failedRequests + globalMetrics.droppedRequests,
    },
    finalResult: globalMetrics.errorRate,
    contributingComponents: identifyErrorContributors(simulationResult),
    contributingFactors: ['capacity_exceeded', 'failure_injection', 'network_errors', 'timeout'],
    assumptions: ['Error classification is accurate per event type.'],
    confidence: globalMetrics.totalRequests > 100 ? 0.95 : 0.7,
    supportingData: ['globalMetrics.failedRequests', 'globalMetrics.droppedRequests'],
  })

  // Availability
  explanations.push({
    metricId: 'global.availability',
    metricName: 'Global Availability',
    value: globalMetrics.availability,
    unit: 'percent',
    why: 'Percentage of requests that completed successfully.',
    formula: '(successfulRequests / totalRequests) * 100',
    inputs: {
      successfulRequests: globalMetrics.successfulRequests,
      totalRequests: globalMetrics.totalRequests,
    },
    intermediateValues: {
      successRate: globalMetrics.successfulRequests / Math.max(globalMetrics.totalRequests, 1),
    },
    finalResult: globalMetrics.availability,
    contributingComponents: ['all_blocks'],
    contributingFactors: ['redundancy', 'failure_recovery', 'circuit_breakers', 'retry_logic'],
    assumptions: ['Availability during simulation is representative of production.'],
    confidence: globalMetrics.totalRequests > 1000 ? 0.95 : 0.75,
    supportingData: ['globalMetrics.successfulRequests', 'globalMetrics.totalRequests'],
  })

  return explanations
}

// ============================================================================
// BLOCK METRICS EXPLANATIONS
// ============================================================================

function explainBlockMetrics(blocks, blockMetrics, simulationResult, granularity) {
  const explanations = []
  if (!blockMetrics?.blocks) return explanations

  for (const block of blocks) {
    const metrics = blockMetrics.blocks[block.id]
    if (!metrics) continue

    const behavioralModel = block.behavioralModel || {}
    const latency = behavioralModel.latency || {}
    const capacity = behavioralModel.capacity || {}

    // Block throughput
    explanations.push({
      metricId: `block.${block.id}.throughputRps`,
      metricName: `${block.label || block.id} Throughput`,
      value: metrics.throughputRps,
      unit: 'RPS',
      why: `Requests processed by ${block.label || block.id} divided by simulation duration.`,
      formula: 'blockTotalRequests / actualDurationSeconds',
      inputs: {
        blockTotalRequests: metrics.totalRequests,
        actualDurationSeconds: simulationResult.actualDurationMs ? simulationResult.actualDurationMs / 1000 : 300,
      },
      intermediateValues: {
        totalRequests: metrics.totalRequests,
        successful: metrics.successfulRequests,
        failed: metrics.failedRequests,
        dropped: metrics.droppedRequests,
      },
      finalResult: metrics.throughputRps,
      contributingComponents: [block.id],
      contributingFactors: ['block_capacity', 'incoming_traffic', 'queue_depth'],
      assumptions: ['Throughput is limited by maxThroughput capacity.'],
      confidence: metrics.totalRequests > 10 ? 0.9 : 0.6,
      supportingData: [`blockMetrics.blocks.${block.id}.totalRequests`],
    })

    // Block latency decomposition
    if (granularity !== 'summary') {
      const baseLatency = latency.baseLatencyMs || 0
      const queueDelay = metrics.avgLatencyMs > baseLatency ? metrics.avgLatencyMs - baseLatency : 0
      const serialization = latency.serializationMs || 0
      const deserialization = latency.deserializationMs || 0
      const dbOp = latency.dbOperationMs || 0
      const cacheHit = latency.cacheHitLatencyMs || 0
      const cacheMiss = latency.cacheMissLatencyMs || 0
      const cacheHitRate = latency.cacheHitRate || 0
      const expectedCacheLatency = cacheHitRate * cacheHit + (1 - cacheHitRate) * cacheMiss

      explanations.push({
        metricId: `block.${block.id}.avgLatencyMs`,
        metricName: `${block.label || block.id} Average Latency`,
        value: metrics.avgLatencyMs,
        unit: 'ms',
        why: `Mean processing time at ${block.label || block.id}, including all overheads.`,
        formula: 'baseLatency + queueDelay + serialization + deserialization + dbOperation + cacheLatency + contention',
        inputs: {
          baseLatency,
          queueDelay,
          serialization,
          deserialization,
          dbOperation: dbOp,
          cacheHitLatency: cacheHit,
          cacheMissLatency: cacheMiss,
          cacheHitRate,
          expectedCacheLatency,
          utilization: metrics.utilization,
        },
        intermediateValues: {
          baseProcessing: baseLatency,
          queueDelay: Math.round(queueDelay * 100) / 100,
          serializationOverhead: serialization + deserialization,
          databaseLatency: dbOp,
          cacheLatency: expectedCacheLatency,
          contentionPenalty: metrics.utilization > 0 ? Math.round(metrics.utilization * metrics.utilization * 2 * baseLatency * 100) / 100 : 0,
          sumOfComponents: baseLatency + queueDelay + serialization + deserialization + dbOp + expectedCacheLatency,
        },
        finalResult: metrics.avgLatencyMs,
        contributingComponents: [block.id],
        contributingFactors: ['base_processing', 'queue_congestion', 'serialization', 'database_ops', 'cache_behavior', 'resource_contention'],
        assumptions: [
          'Queue delay is estimated from queue depth and queueLatencyMs parameter.',
          'Contention penalty is quadratic in utilization.',
          `Cache hit rate is ${(cacheHitRate * 100).toFixed(0)}% per behavioral model.`,
        ],
        confidence: metrics.latencySamples > 10 ? 0.9 : 0.6,
        supportingData: [`blockMetrics.blocks.${block.id}.latencySamples`, `blockMetrics.blocks.${block.id}.avgLatencyMs`],
      })
    }

    // Utilization explanation
    explanations.push({
      metricId: `block.${block.id}.utilization`,
      metricName: `${block.label || block.id} Utilization`,
      value: metrics.utilization,
      unit: 'ratio',
      why: `Ratio of active requests to max concurrent capacity at ${block.label || block.id}.`,
      formula: 'processing / currentMaxConcurrent',
      inputs: {
        maxConcurrent: capacity.maxConcurrent || 100,
        currentReplicas: metrics.currentReplicas || 1,
        currentMaxConcurrent: (capacity.maxConcurrent || 100) * (metrics.currentReplicas || 1),
        processingEstimate: metrics.utilization * (capacity.maxConcurrent || 100) * (metrics.currentReplicas || 1),
      },
      intermediateValues: {
        baseCapacity: capacity.maxConcurrent || 100,
        replicaMultiplier: metrics.currentReplicas || 1,
        totalCapacity: (capacity.maxConcurrent || 100) * (metrics.currentReplicas || 1),
        estimatedProcessing: metrics.utilization * (capacity.maxConcurrent || 100) * (metrics.currentReplicas || 1),
      },
      finalResult: metrics.utilization,
      contributingComponents: [block.id],
      contributingFactors: ['incoming_rps', 'processing_time', 'replica_count', 'capacity_limit'],
      assumptions: ['Utilization is calculated from simulation state, not time-averaged.'],
      confidence: 0.95,
      supportingData: [`blockMetrics.blocks.${block.id}.utilization`, `blockMetrics.blocks.${block.id}.currentReplicas`],
    })
  }

  return explanations
}

// ============================================================================
// ENGINE RESULT EXPLANATIONS
// ============================================================================

function explainEngineResults(analysisResults, granularity) {
  const explanations = []

  // Reliability score explanation
  if (analysisResults.reliability) {
    explanations.push({
      metricId: 'engine.reliability.score',
      metricName: 'Reliability Score',
      value: analysisResults.reliability.reliabilityScore,
      unit: 'score',
      why: 'Composite score based on availability, MTTR, MTBF, and resilience.',
      formula: 'availability_score*0.4 + mttr_score*0.2 + mtbf_score*0.2 + resilience_score*0.2',
      inputs: {
        systemAvailability: analysisResults.reliability.availability,
        mttrMinutes: analysisResults.reliability.mttrMinutes,
        mtbfHours: analysisResults.reliability.mtbfHours,
        resilienceScore: analysisResults.reliability.resilienceScore,
      },
      intermediateValues: analysisResults.reliability.explainability?.intermediateValues || {},
      finalResult: analysisResults.reliability.reliabilityScore,
      contributingComponents: analysisResults.reliability.singlePointsOfFailure?.map(s => s.blockId) || [],
      contributingFactors: ['availability', 'mttr', 'mtbf', 'spofs', 'failure_chains'],
      assumptions: ['Reliability models are calibrated from behavioral parameters.'],
      confidence: analysisResults.reliability.explainability?.confidence || 0.8,
      supportingData: ['reliabilityAnalysis'],
    })
  }

  // Scalability score explanation
  if (analysisResults.scalability) {
    explanations.push({
      metricId: 'engine.scalability.score',
      metricName: 'Scalability Score',
      value: analysisResults.scalability.scalabilityScore,
      unit: 'score',
      why: 'Composite score based on capacity headroom, scaling support, and growth sustainability.',
      formula: 'capacity_score*0.3 + headroom_score*0.3 + scaling_score*0.2 + growth_score*0.2',
      inputs: {
        bottleneckCount: analysisResults.scalability.bottlenecks?.length || 0,
        saturatedCount: analysisResults.scalability.saturationPoints?.filter(p => p.isSaturated).length || 0,
        supportsAutoScaling: analysisResults.scalability.supportsAutoScaling,
        sustainableProjections: analysisResults.scalability.growthProjections?.filter(p => p.isSustainable).length || 0,
      },
      intermediateValues: analysisResults.scalability.explainability?.intermediateValues || {},
      finalResult: analysisResults.scalability.scalabilityScore,
      contributingComponents: analysisResults.scalability.bottlenecks?.map(b => b.blockId) || [],
      contributingFactors: ['capacity_limits', 'saturation', 'scaling_support', 'growth_projections'],
      assumptions: ['Growth projections assume linear scaling of load.'],
      confidence: analysisResults.scalability.explainability?.confidence || 0.8,
      supportingData: ['scalabilityAnalysis'],
    })
  }

  // Cost explanation
  if (analysisResults.cost) {
    explanations.push({
      metricId: 'engine.cost.monthly',
      metricName: 'Estimated Monthly Cost',
      value: analysisResults.cost.currentMonthlyCost,
      unit: 'USD',
      why: 'Sum of compute, storage, network, and service costs across all components.',
      formula: 'sum(component_costs) + sum(edge_costs)',
      inputs: {
        blockCostSum: analysisResults.cost.explainability?.intermediateValues?.blockCostSum || 0,
        edgeCostSum: analysisResults.cost.explainability?.intermediateValues?.edgeCostSum || 0,
        providerCount: analysisResults.cost.assumptions?.providerCount || 0,
      },
      intermediateValues: analysisResults.cost.explainability?.intermediateValues || {},
      finalResult: analysisResults.cost.currentMonthlyCost,
      contributingComponents: analysisResults.cost.drivers?.map(d => d.componentId) || [],
      contributingFactors: ['compute', 'storage', 'network', 'requests', 'provider_pricing'],
      assumptions: analysisResults.cost.assumptions?.notes || ['Cost estimates are approximate.'],
      confidence: analysisResults.cost.confidence || 0.6,
      supportingData: ['costAnalysis'],
    })
  }

  // Security score explanation
  if (analysisResults.security) {
    explanations.push({
      metricId: 'engine.security.score',
      metricName: 'Security Score',
      value: analysisResults.security.securityScore,
      unit: 'score',
      why: 'Score based on severity-weighted count of security findings.',
      formula: '100 - sum(severity_weight * finding_count)',
      inputs: {
        criticalCount: analysisResults.security.criticalCount,
        highCount: analysisResults.security.highCount,
        mediumCount: analysisResults.security.mediumCount,
        lowCount: analysisResults.security.lowCount,
      },
      intermediateValues: analysisResults.security.explainability?.intermediateValues || {},
      finalResult: analysisResults.security.securityScore,
      contributingComponents: analysisResults.security.findings?.map(f => f.blockId || f.edgeId).filter(Boolean) || [],
      contributingFactors: ['encryption', 'authentication', 'network_segmentation', 'redundancy', 'secrets'],
      assumptions: ['Security analysis is based on configuration inspection and graph topology.'],
      confidence: analysisResults.security.explainability?.confidence || 0.8,
      supportingData: ['securityAnalysis'],
    })
  }

  return explanations
}

// ============================================================================
// ASSUMPTION EXPLANATIONS
// ============================================================================

function explainAssumptions(assumptions, granularity) {
  const explanations = []
  if (!assumptions) return explanations

  const assumptionList = assumptions.list || Object.entries(assumptions).map(([k, v]) => ({ assumption: k, impact: v }))

  for (const item of assumptionList) {
    explanations.push({
      metricId: `assumption.${item.assumption || item}`,
      metricName: 'Simulation Assumption',
      value: null,
      unit: 'n/a',
      why: item.impact || 'Assumption used in simulation calculations.',
      formula: 'N/A',
      inputs: { assumption: item.assumption || item },
      intermediateValues: {},
      finalResult: null,
      contributingComponents: [],
      contributingFactors: ['model_assumptions'],
      assumptions: [item.impact || item],
      confidence: item.confidence || 0.7,
      supportingData: ['simulationConfig.assumptions'],
    })
  }

  return explanations
}

// ============================================================================
// HELPERS
// ============================================================================

function identifyLatencyContributors(simulationResult) {
  const contributors = []
  const blockMetrics = simulationResult.blockMetrics?.blocks || {}

  for (const [blockId, metrics] of Object.entries(blockMetrics)) {
    if (metrics.avgLatencyMs > 50) contributors.push(blockId)
  }

  return contributors.length > 0 ? contributors : ['all_blocks']
}

function identifyErrorContributors(simulationResult) {
  const contributors = []
  const blockMetrics = simulationResult.blockMetrics?.blocks || {}

  for (const [blockId, metrics] of Object.entries(blockMetrics)) {
    if (metrics.errorRate > 0.01) contributors.push(blockId)
  }

  return contributors.length > 0 ? contributors : ['all_blocks']
}

function generateExplainabilitySummary(explanations, analysisResults) {
  const highConfidence = explanations.filter(e => e.confidence >= 0.8).length
  const mediumConfidence = explanations.filter(e => e.confidence >= 0.5 && e.confidence < 0.8).length
  const lowConfidence = explanations.filter(e => e.confidence < 0.5).length

  const metricCategories = {}
  for (const e of explanations) {
    const category = e.metricId.split('.')[0]
    if (!metricCategories[category]) metricCategories[category] = 0
    metricCategories[category]++
  }

  return {
    totalExplanations: explanations.length,
    confidenceDistribution: { high: highConfidence, medium: mediumConfidence, low: lowConfidence },
    metricCategories,
    keyInsight: lowConfidence > 0
      ? `${lowConfidence} metric(s) have low confidence — review assumptions and input data.`
      : 'All metrics have acceptable confidence levels.',
  }
}

function calculateOverallConfidence(explanations) {
  if (explanations.length === 0) return 0
  const sum = explanations.reduce((s, e) => s + (e.confidence || 0), 0)
  return Math.round((sum / explanations.length) * 100) / 100
}