/**
 * Report Builder — P6 Property-Aware Report Generation
 *
 * ARCHITECTURAL CONTRACT:
 *   P3 engines compute ALL structured data:
 *     - bottleneckAnalysis (from scalability engine)
 *     - rootCauseAnalysis (from reliability engine)
 *     - riskAssessment (from security + reliability)
 *     - costOptimization (from cost engine)
 *     - All scores (reliabilityScore, scalabilityScore, etc.)
 *
 *   AI layer generates ONLY narrative:
 *     - insights[].title
 *     - insights[].description
 *     - insights[].recommendation
 *
 *   This module MERGES both into a single SimulationReport.
 *
 *   P6 Changes:
 *     - Cost analysis now includes real values (not 0)
 *     - SLA compliance tracking per block
 *     - Error type distribution for explainability
 *     - Circuit breaker state tracking
 *     - All 30 properties traceable in report
 *
 *   Batch 3 (Missing Data Handling):
 *     - C3: topCostBlocks / costBottleneck populated from the cost engine's
 *           breakdown (blockMetrics cost.total is frequently absent)
 *     - C5: confidenceScore is null until computed — never a fake 0
 *     - Engine error results are sanitized to null so failures surface as
 *       "no data" instead of zero scores / $0 costs
 *     - Scores are null-aware end-to-end: missing data never produces 100,
 *       never produces 0/F, and is excluded from the overall average
 *     - Summary / key finding only make claims when the underlying
 *       analysis actually exists
 *
 *   Batch 4 (Code Quality):
 *     - Removes dead blockPerformance code from buildPerformanceAnalysis
 *     - Removes fabricated percentile fallbacks in endToEndLatency.percentiles
 *       (the frontend already filters nulls; sending fabricated values
 *       was causing mixed null/real sets to break the chart)
 */

import { runAnalysisPipeline } from './analysis-pipeline.js'
import { buildDefaultSnapshot } from '../providers/registry.js'
import { generateAIInsights } from '../ai/ai-analysis.js'
import {
  mergeBlockBehavioralModel,
  getBlockBehavioralModel,
  mergeConnectionBehavioralModel,
} from '@resonance/shared/simulation-models'

// ============================================================================
// P3 ANALYSIS RUNNER
// ============================================================================

export function runP3Analysis(aggregated, design, validation, options = {}) {
  const simulationResult = buildSimulationResultForP3(aggregated, design, options)

  const pipelineResult = runAnalysisPipeline(simulationResult, validation, {
    engines: {
      reliability: true,
      scalability: true,
      cost: true,
      security: true,
      explainability: true,
      confidence: true,
    },
    providerSnapshot: options.providerSnapshot || buildDefaultSnapshot(),
    explainabilityGranularity: options.explainabilityGranularity || 'detailed',
    engineConfig: options.engineConfig || {},
  })

  const { results } = pipelineResult

  return {
    reliabilityAnalysis: results.reliability,
    scalabilityAnalysis: results.scalability,
    costAnalysis: results.cost,
    securityAnalysis: results.security,
    explainability: results.explainability,
    // C5: null when the confidence engine failed or is disabled — a computed
    // 0 and "never computed" must not be indistinguishable
    confidenceScore: results.confidence?.error
      ? null
      : (results.confidence?.overallConfidence ?? null),
    pipelineMetadata: pipelineResult.metadata,
  }
}

// ============================================================================
// SIMULATION RESULT BUILDER (P2 → P3 adapter)
// ============================================================================

function buildSimulationResultForP3(aggregated, design, options = {}) {
  const blocks = design.blocks || []
  const edges = design.edges || []

  const rawAssumptions = options.assumptions || {}
  const normalizedAssumptions = rawAssumptions.list
    ? rawAssumptions
    : {
        list: Object.entries(rawAssumptions).map(([k, v]) => ({
          assumption: k,
          impact: typeof v === 'string' ? v : 'medium',
          confidence: 0.7,
        })),
      }

  const inputSnapshot = {
    id: design.id,
    name: design.name,
    version: `${Date.now()}`,
    snapshotAt: new Date().toISOString(),
    blocks: blocks.map(block => {
      const rawConfig = block.config || {}
      const hasBehavioralModel = rawConfig.behavioralModel !== undefined
      const mergedBehavioral = hasBehavioralModel
        ? mergeBlockBehavioralModel(block.type, rawConfig.behavioralModel)
        : getBlockBehavioralModel(block.type)

      return {
        id: block.id,
        type: block.type,
        label: block.label,
        x: block.x,
        y: block.y,
        config: rawConfig,
        behavioralModel: mergedBehavioral,
      }
    }),
    edges: edges.map(edge => {
      const rawConfig = edge.config || {}
      const edgeType = edge.connectionType || 'http'
      const mergedBehavioral = mergeConnectionBehavioralModel(edgeType, rawConfig.behavioralModel || {})

      return {
        id: edge.id,
        sourceId: edge.sourceId,
        targetId: edge.targetId,
        connectionType: edgeType,
        config: rawConfig,
        behavioralModel: mergedBehavioral,
      }
    }),
  }

  return {
    id: options.simulationId || 'sim-' + Date.now(),
    designId: design.id,
    userId: options.userId || 'unknown',
    engineVersion: '2.0.0',
    reportVersion: '1.0.0',
    // C5: not yet computed — null, not 0. A real 0 (pathological low data)
    // remains distinguishable from "the confidence engine hasn't run".
    confidenceScore: null,
    actualDurationMs: options.actualDurationMs || 0,
    assumptions: normalizedAssumptions,
    config: options.simConfig || {},
    inputSnapshot,
    blockMetrics: aggregated.blockMetrics || { blocks: {} },
    globalMetrics: aggregated.globalMetrics || {},
    failureEvents: aggregated.failureEvents || [],
    passCount: aggregated.passCount || 1,
  }
}

// ============================================================================
// DB UPDATE HELPER
// ============================================================================


// ============================================================================
// REPORT BUILDER — MERGES P3 DATA + AI NARRATIVE
// ============================================================================

function computeTopologyAnalysis(design, simulationRecord) {
  const blocks = design?.blocks || simulationRecord?.inputSnapshot?.blocks || []
  const edges = design?.edges || simulationRecord?.inputSnapshot?.edges || []

  if (blocks.length === 0) return simulationRecord?.validationResult?.topologyAnalysis ?? null

  const avgFanOut = blocks.length > 0 ? edges.length / blocks.length : 0
  const avgFanIn = blocks.length > 0 ? edges.length / blocks.length : 0

  const adjacency = new Map()
  for (const edge of edges) {
    if (!adjacency.has(edge.sourceId)) adjacency.set(edge.sourceId, new Set())
    if (!adjacency.has(edge.targetId)) adjacency.set(edge.targetId, new Set())
    adjacency.get(edge.sourceId).add(edge.targetId)
    adjacency.get(edge.targetId).add(edge.sourceId)
  }

  const visited = new Set()
  let connectedComponents = 0
  for (const block of blocks) {
    if (!visited.has(block.id)) {
      connectedComponents++
      const stack = [block.id]
      while (stack.length > 0) {
        const current = stack.pop()
        if (visited.has(current)) continue
        visited.add(current)
        const neighbors = adjacency.get(current) || new Set()
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) stack.push(neighbor)
        }
      }
    }
  }

  const cyclomaticComplexity = edges.length - blocks.length + 2 * connectedComponents

  return {
    avgFanOut: parseFloat(avgFanOut.toFixed(2)),
    avgFanIn: parseFloat(avgFanIn.toFixed(2)),
    cyclomaticComplexity,
    connectedComponents,
    totalBlocks: blocks.length,
    totalEdges: edges.length,
  }
}

export async function buildReportData(simulationRecord, p3Results, aggregated, design = null) {
  // Batch 3: an engine that threw (analysis-pipeline createErrorResult) must
  // surface as "no data", never as a 0 score, $0 cost, or empty findings.
  const sanitize = (r) => (r && r.error ? null : (r ?? null))
  const p3 = {
    reliabilityAnalysis: sanitize(p3Results.reliabilityAnalysis),
    scalabilityAnalysis: sanitize(p3Results.scalabilityAnalysis),
    costAnalysis: sanitize(p3Results.costAnalysis),
    securityAnalysis: sanitize(p3Results.securityAnalysis),
    explainability: sanitize(p3Results.explainability),
    confidenceScore: p3Results.confidenceScore ?? null,
    pipelineMetadata: p3Results.pipelineMetadata,
  }

  const exec = buildExecutiveSummaryFromP3(p3, aggregated, simulationRecord)

  // P4: Generate AI narrative insights
  let aiInsights = null
  try {
    aiInsights = await generateAIInsights(simulationRecord, p3, aggregated)
  } catch (err) {
    console.error('[REPORT] AI insights generation failed:', err.message)
  }

  const mergedInsights = mergeInsights(aiInsights, p3, aggregated)

  return {
    simulationId: simulationRecord.id,
    designId: simulationRecord.designId,
    userId: simulationRecord.userId,
    version: '1.0.0',
    overallScore: exec.overallScore,
    // B9: architectureScore renamed to dataCompletenessScore
    // Keep architectureScore as deprecated alias for backward compatibility until schema migration
    architectureScore: exec.dataCompletenessScore,
    dataCompletenessScore: exec.dataCompletenessScore,
    reliabilityScore: exec.reliabilityScore,
    performanceScore: exec.performanceScore,
    scalabilityScore: exec.scalabilityScore,   // ← ADDED
    costScore: exec.costScore,
    securityScore: exec.securityScore,
    confidenceScore: p3.confidenceScore,
    executiveSummary: exec,
    topologyAnalysis: computeTopologyAnalysis(design, simulationRecord),
    performanceAnalysis: buildPerformanceAnalysis(aggregated, p3.costAnalysis),
    reliabilityAnalysis: p3.reliabilityAnalysis,
    scalabilityAnalysis: p3.scalabilityAnalysis,
    costAnalysis: p3.costAnalysis,
    securityAnalysis: p3.securityAnalysis,
    failureScenarios: aggregated.failureEvents || [],
    aiInsights: mergedInsights,
    actionPlan: buildActionPlanFromP3(p3, aggregated, simulationRecord),
    metadata: {
      engineVersion: simulationRecord.engineVersion,
      reportVersion: '1.0.0',
      assumptions: simulationRecord.assumptions,
      confidenceScore: p3.confidenceScore,
      monteCarloPasses: simulationRecord.monteCarloPasses,
      deterministicSeed: simulationRecord.deterministicSeed,
      simulationDuration: simulationRecord.duration,
      wallClockTimeMs: simulationRecord.actualDurationMs,
      pipelineMetadata: p3.pipelineMetadata,
      aiGenerated: aiInsights ? new Date().toISOString() : null,
      aiModelVersion: aiInsights?.modelVersion || null,
      aiFallback: aiInsights?.fallback || false,
      aiEvidenceValidated: aiInsights?.insights?.every(i => i.evidenceValidated) || false,
      // B10: Transparency — include penalty breakdown so UI can explain the score
      assumptionCount: exec.assumptionCount,
      criticalAssumptionCount: exec.criticalAssumptionCount,
      scorePenaltyFromAssumptions: exec.scorePenaltyFromAssumptions,
    },
  }
}

// ============================================================================
// INSIGHT MERGER (P3 structured + AI narrative)
// ============================================================================

function mergeInsights(aiInsights, p3Results, aggregated) {
  if (!aiInsights) return null

  const reliability = p3Results.reliabilityAnalysis || {}
  const scalability = p3Results.scalabilityAnalysis || {}
  const cost = p3Results.costAnalysis || {}
  const security = p3Results.securityAnalysis || {}

  const bottleneckAnalysis = buildBottleneckAnalysis(scalability)
  const rootCauseAnalysis = buildRootCauseAnalysis(reliability, scalability)
  const optimizationRecommendations = buildOptimizationRecommendations(scalability, cost, reliability)
  const riskAssessment = buildRiskAssessment(reliability, security, scalability)
  const costOptimization = buildCostOptimization(cost)

  // P6: enrich with cost data if available
  const enrichedInsights = (aiInsights.insights || []).map((insight, index) => {
    const p3Evidence = findP3EvidenceForInsight(insight, p3Results, aggregated)

    return {
      ...insight,
      id: insight.id || `ai-${index + 1}`,
      supportingEvidence: p3Evidence.supportingEvidence,
      predictedImpact: p3Evidence.predictedImpact,
      confidence: p3Evidence.confidence,
      evidenceSource: p3Evidence.source,
      p3Engine: p3Evidence.engine,
    }
  })

  return {
    generatedAt: aiInsights.generatedAt,
    modelVersion: aiInsights.modelVersion,
    fallback: aiInsights.fallback || false,
    insights: enrichedInsights,
    bottleneckAnalysis,
    rootCauseAnalysis,
    optimizationRecommendations,
    riskAssessment,
    costOptimization,
    evidencePacket: aiInsights.evidencePacket || null,
  }
}

function findP3EvidenceForInsight(insight, p3Results, aggregated) {
  const reliability = p3Results.reliabilityAnalysis || {}
  const scalability = p3Results.scalabilityAnalysis || {}
  const cost = p3Results.costAnalysis || {}
  const security = p3Results.securityAnalysis || {}

  // Batch 3: when no P3 evidence matches, confidence is unknown (null),
  // not a fabricated 0.7
  const defaultEvidence = {
    supportingEvidence: [],
    predictedImpact: null,
    confidence: null,
    source: 'p3_engine',
    engine: 'unknown',
  }

  switch (insight.category) {
    case 'reliability': {
      const spof = (reliability.singlePointsOfFailure || [])
        .find(s => {
          const id = typeof s === 'string' ? s : s.blockId
          return insight.title.toLowerCase().includes(id.toLowerCase())
        })

      if (spof) {
        const blockId = typeof spof === 'string' ? spof : spof.blockId
        const before = (reliability.availability || 0.99) * 100
        // B6: Real availability formula for parallel redundancy: 1 - (1 - a)^2
        const beforeDecimal = before / 100
        const afterDecimal = 1 - Math.pow(1 - beforeDecimal, 2)
        const after = Math.min(Math.round(afterDecimal * 10000) / 100, 99.99)

        return {
          supportingEvidence: [
            { path: 'reliabilityAnalysis.singlePointsOfFailure', value: blockId },
            { path: 'reliabilityAnalysis.availability', value: reliability.availability },
          ],
          predictedImpact: {
            metric: 'availability',
            before: Math.round(before * 100) / 100,
            after,
            unit: '%',
          },
          confidence: 0.9,
          source: 'reliability_engine',
          engine: 'reliability',
        }
      }

      const chain = (reliability.failureChains || [])
        .find(c => insight.description.toLowerCase().includes(c.mode.toLowerCase()))

      if (chain) {
        return {
          supportingEvidence: [
            { path: 'reliabilityAnalysis.failureChains', value: chain.mode },
            { path: 'reliabilityAnalysis.failureChains.probability', value: chain.probability },
          ],
          predictedImpact: null,
          confidence: 0.85,
          source: 'reliability_engine',
          engine: 'reliability',
        }
      }
      break
    }

    case 'scalability': {
      const bottleneck = (scalability.bottlenecks || [])
        .find(b => insight.title.toLowerCase().includes(b.blockId.toLowerCase()) ||
                   insight.title.toLowerCase().includes(b.label?.toLowerCase()))

      if (bottleneck) {
        // B6: Calculate from actual headroom, not fixed 1.2x
        const currentRps = bottleneck.currentRps || 0
        const maxRps = bottleneck.maxRps || 1000
        const headroom = maxRps - currentRps
        const after = Math.round(currentRps + headroom * 0.8)

        return {
          supportingEvidence: [
            { path: 'scalabilityAnalysis.bottlenecks', value: bottleneck.blockId },
            { path: `scalabilityAnalysis.bottlenecks.${bottleneck.blockId}.currentRps`, value: bottleneck.currentRps },
            { path: `scalabilityAnalysis.bottlenecks.${bottleneck.blockId}.maxRps`, value: bottleneck.maxRps },
          ],
          predictedImpact: {
            metric: 'throughput',
            before: Math.round(currentRps),
            after,
            unit: 'RPS',
          },
          confidence: 0.85,
          source: 'scalability_engine',
          engine: 'scalability',
        }
      }

      const growth = (scalability.growthProjections || [])
        .find(p => insight.title.includes(`${p.trafficMultiplier}x`))

      if (growth) {
        return {
          supportingEvidence: [
            { path: 'scalabilityAnalysis.growthProjections', value: growth.trafficMultiplier },
            { path: `scalabilityAnalysis.growthProjections.${growth.trafficMultiplier}.isSustainable`, value: false },
          ],
          predictedImpact: {
            metric: 'latency',
            before: growth.evidence?.baseLatency || 0,
            after: growth.predictedLatencyMs || 0,
            unit: 'ms',
          },
          confidence: 0.8,
          source: 'scalability_engine',
          engine: 'scalability',
        }
      }
      break
    }

    case 'security': {
      const finding = (security.bySeverity?.critical || [])
        .concat(security.bySeverity?.high || [])
        .find(f => insight.title.toLowerCase().includes(f.message.toLowerCase().slice(0, 30)))

      if (finding) {
        const before = security.securityScore || 0
        // B6: Impact based on actual score gap, not fixed +20
        const after = Math.min(before + Math.max(5, Math.round(95 - before) * 0.3), 100)

        return {
          supportingEvidence: [
            { path: 'securityAnalysis.bySeverity.critical', value: finding.id },
            { path: 'securityAnalysis.securityScore', value: security.securityScore },
          ],
          predictedImpact: {
            metric: 'securityScore',
            before,
            after,
            unit: '%',
          },
          confidence: 0.85,
          source: 'security_engine',
          engine: 'security',
        }
      }
      break
    }

    case 'cost': {
      const driver = (cost.drivers || [])
        .find(d => insight.title.toLowerCase().includes((d.label || d.componentId).toLowerCase()))

      if (driver) {
        // B6: Driver-specific savings, not fixed 15%
        const savingsPercent = driver.typicalSavingsPercent || 10
        const after = Math.round((cost.currentMonthlyCost || 0) * (1 - savingsPercent / 100) * 100) / 100

        return {
          supportingEvidence: [
            { path: 'costAnalysis.currentMonthlyCost', value: cost.currentMonthlyCost },
            { path: 'costAnalysis.drivers', value: driver.componentId },
          ],
          predictedImpact: {
            metric: 'cost',
            before: cost.currentMonthlyCost || 0,
            after,
            unit: 'USD',
          },
          confidence: 0.7,
          source: 'cost_engine',
          engine: 'cost',
        }
      }
      break
    }
  }

  return defaultEvidence
}

// ============================================================================
// STRUCTURED ANALYSIS BUILDERS (P3 data only)
// ============================================================================

function buildBottleneckAnalysis(scalability) {
  const bottlenecks = scalability.bottlenecks || []
  const critical = bottlenecks.filter(b => b.severity === 'critical')
  const high = bottlenecks.filter(b => b.severity === 'high')

  return {
    primaryBottleneck: critical[0] ? {
      blockId: critical[0].blockId,
      label: critical[0].label,
      reason: critical[0].message,
      currentRps: critical[0].currentRps,
      maxRps: critical[0].maxRps,
      utilization: critical[0].currentRps / (critical[0].maxRps || 1),
      evidencePath: 'scalabilityAnalysis.bottlenecks',
    } : null,
    secondaryBottlenecks: high.map(b => ({
      blockId: b.blockId,
      label: b.label,
      reason: b.message,
      currentRps: b.currentRps,
      maxRps: b.maxRps,
      evidencePath: 'scalabilityAnalysis.bottlenecks',
    })),
    cascadingImpact: critical.length > 1
      ? `Multiple saturated components (${critical.length}) will cascade failures.`
      : critical.length === 1 && high.length > 0
        ? `Primary bottleneck at ${critical[0].label} will propagate to ${high.length} near-saturated components.`
        : null,
  }
}

function buildRootCauseAnalysis(reliability, scalability) {
  const rootCauses = []

  const spofs = reliability.singlePointsOfFailure || []
  if (spofs.length > 0) {
    rootCauses.push({
      issue: 'Insufficient redundancy',
      affectedMetrics: ['availability', 'mttr'],
      affectedBlocks: spofs.map(s => typeof s === 'string' ? s : s.blockId),
      evidencePath: 'reliabilityAnalysis.singlePointsOfFailure',
      severity: 'critical',
    })
  }

  const chains = reliability.failureChains || []
  for (const chain of chains) {
    rootCauses.push({
      issue: `Failure mode "${chain.mode}" propagates through architecture`,
      affectedMetrics: ['availability', 'errorRate'],
      affectedBlocks: chain.blockIds || [],
      evidencePath: 'reliabilityAnalysis.failureChains',
      severity: 'high',
    })
  }

  const criticalBottlenecks = (scalability.bottlenecks || []).filter(b => b.severity === 'critical')
  for (const b of criticalBottlenecks) {
    rootCauses.push({
      issue: `${b.label} capacity limit exceeded`,
      affectedMetrics: ['throughput', 'latency', 'errorRate'],
      affectedBlocks: [b.blockId],
      evidencePath: 'scalabilityAnalysis.bottlenecks',
      severity: 'critical',
    })
  }

  return { rootCauses }
}

function buildOptimizationRecommendations(scalability, cost, reliability) {
  const quickWins = []
  const strategic = []

  const spofs = reliability.singlePointsOfFailure || []
  if (spofs.length > 0) {
    quickWins.push(`Add redundancy to ${spofs.length} single point(s) of failure`)
  }

  const criticalBottlenecks = (scalability.bottlenecks || []).filter(b => b.severity === 'critical')
  for (const b of criticalBottlenecks) {
    quickWins.push(`Scale ${b.label} — add replicas or increase instance size`)
  }

  const topCostDriver = (cost.drivers || [])[0]
  if (topCostDriver && topCostDriver.percentageOfTotal > 30) {
    quickWins.push(`Right-size ${topCostDriver.label || topCostDriver.componentId} — drives ${topCostDriver.percentageOfTotal.toFixed(1)}% of cost`)
  }

  // Batch 3: only recommend auto-scaling when the engine explicitly reported
  // it is unsupported — undefined means "analysis missing", not "unsupported"
  if (scalability.supportsAutoScaling === false) {
    strategic.push('Enable auto-scaling for all stateless services')
  }

  const unsustainableGrowth = (scalability.growthProjections || []).filter(p => !p.isSustainable)
  if (unsustainableGrowth.length > 0) {
    strategic.push(`Plan capacity for ${unsustainableGrowth[0].trafficMultiplier}x traffic growth`)
  }

  // Batch 3: guard against missing resilience score (undefined < 60 is false,
  // but be explicit — absence of data must never trigger a recommendation)
  if (reliability.resilienceScore != null && reliability.resilienceScore < 60) {
    strategic.push('Implement circuit breakers and bulkheads for failure isolation')
  }

  return { quickWins, strategic }
}

function buildRiskAssessment(reliability, security, scalability) {
  const topRisks = []

  const spofs = reliability.singlePointsOfFailure || []
  const dailyFailureProb = reliability.failureProbabilityPerDay || 0.01

  if (spofs.length > 0) {
    // B8: Calculate probability from actual failure probability, not hardcoded 'high'
    let probability = 'medium'
    if (dailyFailureProb > 0.1) probability = 'high'
    else if (dailyFailureProb > 0.01) probability = 'medium'
    else if (dailyFailureProb > 0.001) probability = 'low'
    else probability = 'very-low'

    topRisks.push({
      risk: 'SPOF outage',
      probability,
      impact: 'Total architecture failure',
      mitigation: 'Add redundancy to: ' + spofs.map(s => typeof s === 'string' ? s : s.blockId).join(', '),
      evidencePath: 'reliabilityAnalysis.singlePointsOfFailure',
    })
  }

  const criticalBottlenecks = (scalability.bottlenecks || []).filter(b => b.severity === 'critical')
  if (criticalBottlenecks.length > 0) {
    // B8: Probability based on actual utilization ratio
    const worst = criticalBottlenecks[0]
    const utilization = worst.currentRps / (worst.maxRps || 1)
    let probability = 'low'
    if (utilization > 0.95) probability = 'very-high'
    else if (utilization > 0.8) probability = 'high'
    else if (utilization > 0.6) probability = 'medium'

    topRisks.push({
      risk: 'Capacity exhaustion',
      probability,
      impact: 'Request drops and latency spikes',
      mitigation: `Scale ${criticalBottlenecks.map(b => b.label).join(', ')}`,
      evidencePath: 'scalabilityAnalysis.bottlenecks',
    })
  }

  const criticalSecurity = (security.bySeverity?.critical || [])
  for (const finding of criticalSecurity.slice(0, 2)) {
    topRisks.push({
      risk: finding.message,
      probability: 'high', // Security findings are always treated as high probability
      impact: 'Security breach or data exposure',
      mitigation: finding.recommendation,
      evidencePath: 'securityAnalysis.bySeverity.critical',
    })
  }

  const unsustainableGrowth = (scalability.growthProjections || []).filter(p => !p.isSustainable)
  if (unsustainableGrowth.length > 0) {
    topRisks.push({
      risk: `Growth limit at ${unsustainableGrowth[0].trafficMultiplier}x traffic`,
      probability: 'medium',
      impact: 'Performance degradation under load',
      mitigation: 'Proactive scaling of bottleneck components',
      evidencePath: 'scalabilityAnalysis.growthProjections',
    })
  }

  return { topRisks }
}

function buildCostOptimization(cost) {
  if (!cost || !cost.drivers) {
    return { potentialSavings: 0, recommendations: [], driverBreakdown: [] }
  }

  // B7: Sum actual driver recommendations, never fake 15%
  const savingsByDriver = cost.drivers
    .filter(d => d.percentageOfTotal > 20)
    .map(d => ({
      driver: d.componentId || d.blockId,
      currentCost: d.cost,
      potentialSavings: d.cost * (d.typicalSavingsPercent || 10) / 100,
      recommendation: d.recommendation,
    }))

  const potentialSavings = savingsByDriver.reduce((sum, d) => sum + d.potentialSavings, 0)

  return {
    potentialSavings: potentialSavings > 0 ? potentialSavings : 0,
    recommendations: savingsByDriver.map(d => d.recommendation).filter(Boolean),
    driverBreakdown: savingsByDriver,
  }
}

// ============================================================================
// PERFORMANCE ANALYSIS
// ============================================================================

/**
 * C3: Build topCostBlocks from the cost engine's breakdown.
 *
 * aggregated.blockMetrics only has per-block `cost.total` when the P2 engine
 * populated it (frequently absent → topCostBlocks was always empty/zero).
 * The cost engine's breakdown.blocks is the authoritative per-block cost
 * source: [{ blockId, label, totalCost, confidence, breakdown: [{dimension, cost}] }]
 *
 * Output shape matches getTopBlocks entries ({ blockId, metrics }) so
 * existing consumers (BottleneckTable-style) keep working.
 */
function buildCostBlocksFromEngine(costAnalysis, blockMetricsMap, limit = 5) {
  const engineBlocks = costAnalysis?.breakdown?.blocks
  if (!Array.isArray(engineBlocks) || engineBlocks.length === 0) return []

  const DIMENSIONS = ['compute', 'request', 'network', 'storage']

  return engineBlocks
    .map(b => {
      const dims = { compute: 0, request: 0, network: 0, storage: 0 }
      for (const d of b.breakdown || []) {
        if (DIMENSIONS.includes(d.dimension)) {
          dims[d.dimension] = d.cost || 0
        }
      }
      return {
        blockId: b.blockId,
        label: b.label,
        metrics: {
          ...(blockMetricsMap?.[b.blockId] || {}),
          cost: { ...dims, total: b.totalCost || 0 },
          costConfidence: b.confidence ?? null,
        },
      }
    })
    .filter(entry => entry.metrics.cost.total > 0)
    .sort((a, b) => b.metrics.cost.total - a.metrics.cost.total)
    .slice(0, limit)
}

/**
 * Batch 4: Removed dead blockPerformance code and fabricated percentile fallbacks.
 * The frontend (PercentileChart) already filters null values; sending fabricated
 * guesses (avgLatencyMs * 1.2) was causing mixed real/null sets to break rendering.
 */
function buildPerformanceAnalysis(aggregated, costAnalysis = null) {
  const globalMetrics = aggregated.globalMetrics || {}
  const blockMetrics = aggregated.blockMetrics?.blocks || {}

  // C3: authoritative per-block costs come from the cost engine breakdown,
  // not from blockMetrics (which frequently lacks cost data entirely)
  const topCostBlocks = buildCostBlocksFromEngine(costAnalysis, blockMetrics)

  return {
    globalMetrics,
    topLatencyBlocks: getTopBlocks(aggregated, 'p99LatencyMs'),
    topErrorBlocks: getTopBlocks(aggregated, 'errorRate'),
    topUtilizationBlocks: getTopBlocks(aggregated, 'utilization'),
    topCostBlocks,
    // A4: Provide full percentile distribution for the chart.
    // Batch 4: No fabricated fallbacks — null means "not measured".
    endToEndLatency: {
      avg: globalMetrics.avgLatencyMs,
      p95: globalMetrics.p95LatencyMs,
      p99: globalMetrics.p99LatencyMs,
      percentiles: {
        p50: globalMetrics.p50LatencyMs,
        p75: globalMetrics.p75LatencyMs,
        p90: globalMetrics.p90LatencyMs,
        p95: globalMetrics.p95LatencyMs,
        p99: globalMetrics.p99LatencyMs,
        p999: globalMetrics.p999LatencyMs,
      },
    },
    latencyBottleneck: getTopBlocks(aggregated, 'p99LatencyMs')[0]?.blockId || null,
    throughputBottleneck: getTopBlocks(aggregated, 'utilization')[0]?.blockId || null,
    costBottleneck: topCostBlocks[0]?.blockId || null,
    // P6: cost summary — Batch 3: null when the simulation didn't produce them
    totalSimulatedCost: globalMetrics.totalSimulatedCost ?? null,
    projectedMonthlyCost: globalMetrics.projectedMonthlyCost ?? null,
    projectedAnnualCost: globalMetrics.projectedAnnualCost ?? null,
  }
}

// ============================================================================
// EXECUTIVE SUMMARY
// ============================================================================

function extractDesignSla(simulationRecord) {
  const blocks = simulationRecord?.inputSnapshot?.blocks || []
  const availSlas = blocks
    .map(b => b.behavioralModel?.availability?.slaTarget || b.config?.availability?.slaTarget)
    .filter(Boolean)
  const latencyBases = blocks
    .map(b => b.behavioralModel?.latency?.baseLatencyMs || b.config?.latency?.baseLatencyMs)
    .filter(Boolean)

  return {
    slaTarget: availSlas.length > 0 ? Math.min(...availSlas) : 0.999,
    latencySlaMs: latencyBases.length > 0 ? Math.max(...latencyBases) * 2 : 200,
  }
}

function calculateOverallScore(scores, p3Results, simulationRecord) {
  // Batch 3: only scores that were actually computed participate in the
  // average — a missing analysis must not drag the score to 0 or NaN
  const scoreValues = [
    scores.reliabilityScore,
    scores.performanceScore,
    scores.scalabilityScore,
  ].filter(v => v != null)
  if (scores.costScore != null) scoreValues.push(scores.costScore)
  if (scores.securityScore != null && scores.securityScore > 0) scoreValues.push(scores.securityScore)

  // B10: Penalty based on actual assumption criticality, not arbitrary 20pt linear
  const assumptions = simulationRecord.assumptions?.list || []
  const criticalAssumptions = assumptions.filter(a => a.impact === 'high').length
  const mediumAssumptions = assumptions.filter(a => a.impact === 'medium').length

  const penalty = (criticalAssumptions * 5) + (mediumAssumptions * 2)

  // No engine produced a score → overall is unknown, not 0
  const overallScore = scoreValues.length === 0
    ? null
    : Math.max(0, Math.round((scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length) - penalty))

  return {
    overallScore,
    assumptionCount: assumptions.length,
    criticalAssumptionCount: criticalAssumptions,
    scorePenaltyFromAssumptions: penalty,
  }
}

function buildExecutiveSummaryFromP3(p3Results, aggregated, simulationRecord) {
  // Batch 3: null-aware scores. An absent/failed analysis yields null —
  // never 0 (which renders as a fabricated F) and never 100.
  const reliabilityScore = p3Results.reliabilityAnalysis?.reliabilityScore ?? null
  const scalabilityScore = p3Results.scalabilityAnalysis?.scalabilityScore ?? null
  const costScore = p3Results.costAnalysis ? calculateCostScore(p3Results.costAnalysis, aggregated.globalMetrics) : null
  const securityScore = p3Results.securityAnalysis?.securityScore ?? null
  const confidenceScore = p3Results.confidenceScore ?? null

  const designSla = extractDesignSla(simulationRecord)
  const performanceScore = calculatePerformanceScore(aggregated.globalMetrics, designSla)

  const scores = {
    reliabilityScore,
    performanceScore,
    scalabilityScore,
    costScore,
    securityScore,
    confidenceScore,
  }

  const { overallScore, assumptionCount, criticalAssumptionCount, scorePenaltyFromAssumptions } =
    calculateOverallScore(scores, p3Results, simulationRecord)

  const { keyFinding, keyRecommendation } = generateKeyFindingAndRecommendation(p3Results)

  return {
    overallScore,
    // B9: architectureScore renamed to dataCompletenessScore (honest about what it measures)
    // Batch 3: null when confidence was never computed
    dataCompletenessScore: confidenceScore != null ? Math.round(confidenceScore * 0.7) : null,
    reliabilityScore,
    performanceScore,
    scalabilityScore,
    costScore,
    securityScore,
    confidenceScore,
    summary: generateSummaryText(scores, p3Results, simulationRecord),
    keyFinding,
    keyRecommendation,
    assumptionCount,
    criticalAssumptionCount,
    scorePenaltyFromAssumptions,
  }
}

function calculatePerformanceScore(globalMetrics, designSla) {
  // Batch 3: unknown when there is nothing to score — previously {} scored 100
  if (!globalMetrics) return null
  const hasAnyMetric = ['avgLatencyMs', 'errorRate', 'availability', 'totalRequests']
    .some(k => globalMetrics[k] != null)
  if (!hasAnyMetric) return null

  const { slaTarget = 0.999, latencySlaMs = 200 } = designSla || {}
  let score = 100

  // Latency: penalty proportional to how much over SLA (skipped when unknown)
  const avgLatency = globalMetrics.avgLatencyMs
  if (avgLatency != null && avgLatency > latencySlaMs) {
    const overage = (avgLatency - latencySlaMs) / latencySlaMs
    score -= Math.min(30, overage * 20)
  }

  // Error rate: penalty proportional to how much over SLA error budget
  const errorRate = globalMetrics.errorRate
  const errorBudget = 1 - slaTarget
  if (errorRate != null && errorRate > errorBudget && errorBudget > 0) {
    const overage = (errorRate - errorBudget) / errorBudget
    score -= Math.min(40, overage * 20)
  }

  // Availability: penalty proportional to gap from SLA (skipped when unknown —
  // previously || 100 silently treated missing data as perfect availability)
  const availability = globalMetrics.availability
  const availabilityTarget = slaTarget * 100
  if (availability != null && availability < availabilityTarget && availabilityTarget > 0) {
    const gap = (availabilityTarget - availability) / availabilityTarget
    score -= Math.min(30, gap * 50)
  }

  // Drop rate: same error budget logic
  const totalRequests = globalMetrics.totalRequests
  const droppedRequests = globalMetrics.droppedRequests
  if (totalRequests > 0 && droppedRequests != null) {
    const dropRate = droppedRequests / totalRequests
    if (dropRate > errorBudget && errorBudget > 0) {
      const overage = (dropRate - errorBudget) / errorBudget
      score -= Math.min(20, overage * 10)
    }
  }

  return Math.max(0, Math.round(score))
}

function calculateCostScore(costAnalysis, globalMetrics) {
  if (!costAnalysis) return null
  const monthlyCost = costAnalysis.currentMonthlyCost || 0
  const totalRequests = globalMetrics?.totalRequests || 1
  const throughputRps = globalMetrics?.throughputRps || 1

  // Batch 3: $0 with low pricing confidence means "no cost data", not "free" —
  // previously this scored a fabricated 95/100
  if (monthlyCost <= 0 && (costAnalysis.confidence ?? 0) < 0.5) return null

  // Score based on cost efficiency, not absolute cost
  const costPerRequest = monthlyCost / totalRequests
  const costPerRps = monthlyCost / (throughputRps * 30 * 24 * 3600)

  // Efficiency benchmarks (derived from cloud provider pricing models)
  if (costPerRequest < 0.001) return 95
  if (costPerRequest < 0.005) return 85
  if (costPerRequest < 0.01) return 75
  if (costPerRequest < 0.05) return 60
  return 40
}

function generateSummaryText(scores, p3Results, simulationRecord) {
  const parts = []

  // Batch 3: claims are only made when the underlying analysis exists.
  // "No single points of failure detected" from a missing analysis is a lie.
  if (p3Results.reliabilityAnalysis) {
    const spofs = p3Results.reliabilityAnalysis.singlePointsOfFailure || []
    const chains = p3Results.reliabilityAnalysis.failureChains || []
    if (spofs.length === 0 && chains.length === 0) {
      parts.push('No single points of failure or failure chains detected.')
    } else {
      parts.push(`${spofs.length} single point(s) of failure and ${chains.length} failure chain(s) detected.`)
    }
  }

  if (p3Results.scalabilityAnalysis) {
    const criticalBottlenecks = p3Results.scalabilityAnalysis.bottlenecks?.filter(b => b.severity === 'critical') || []
    if (criticalBottlenecks.length === 0) {
      parts.push('No capacity bottlenecks at baseline traffic.')
    } else {
      parts.push(`${criticalBottlenecks.length} component(s) saturated at baseline traffic.`)
    }

    const unsustainableGrowth = p3Results.scalabilityAnalysis.growthProjections?.filter(p => !p.isSustainable) || []
    if (unsustainableGrowth.length > 0) {
      parts.push(`Growth unsustainable beyond ${unsustainableGrowth[0].trafficMultiplier}x traffic multiplier.`)
    }
  }

  if (p3Results.securityAnalysis) {
    const security = p3Results.securityAnalysis
    const criticalSecurity = security.bySeverity?.critical || security.findings?.filter(f => f.severity === 'critical') || []
    if (criticalSecurity.length > 0) {
      parts.push(`${criticalSecurity.length} critical security issue(s) require immediate attention.`)
    }
  }

  if (p3Results.costAnalysis?.drivers?.some(d => d.percentageOfTotal > 50)) {
    parts.push('Cost concentration risk: one component drives >50% of total cost.')
  }

  // C5: only mention confidence when it was actually computed
  if (scores.confidenceScore != null && scores.confidenceScore < 70) {
    parts.push(`Results confidence is ${Math.round(scores.confidenceScore)}% due to incomplete configuration data.`)
  }

  if (parts.length === 0) {
    return 'Analysis results are incomplete — no engine produced data for this simulation.'
  }

  return parts.join(' ')
}

function generateKeyFindingAndRecommendation(p3Results) {
  // Batch 3: with no analyses there is no finding — "Architecture performs
  // within expected parameters" from zero data is a fabricated claim
  const hasAnyAnalysis = p3Results.reliabilityAnalysis || p3Results.scalabilityAnalysis || p3Results.securityAnalysis
  if (!hasAnyAnalysis) {
    return { keyFinding: null, keyRecommendation: null }
  }

  const candidates = []
  const reliability = p3Results.reliabilityAnalysis || {}
  const scalability = p3Results.scalabilityAnalysis || {}
  const security = p3Results.securityAnalysis || {}

  const spofs = reliability.singlePointsOfFailure || []
  const criticalBottlenecks = scalability.bottlenecks?.filter(b => b.severity === 'critical') || []
  const criticalSecurity = security.bySeverity?.critical || security.findings?.filter(f => f.severity === 'critical') || []

  if (spofs.length > 0) {
    candidates.push({
      type: 'spof',
      severity: spofs.length * 10,
      finding: `${spofs.length} single point(s) of failure detected.`,
      recommendation: `Add redundancy to ${spofs[0].blockId || spofs[0]}.`,
    })
  }

  if (criticalBottlenecks.length > 0) {
    candidates.push({
      type: 'bottleneck',
      severity: criticalBottlenecks.length * 8,
      finding: `Capacity limit reached: ${criticalBottlenecks[0].label} is saturated.`,
      recommendation: `Scale ${criticalBottlenecks[0].label} immediately.`,
    })
  }

  if (criticalSecurity.length > 0) {
    candidates.push({
      type: 'security',
      severity: criticalSecurity.length * 9,
      finding: `Critical security issue: ${criticalSecurity[0].message}`,
      recommendation: criticalSecurity[0].recommendation || `Fix: ${criticalSecurity[0].message}`,
    })
  }

  candidates.sort((a, b) => b.severity - a.severity)

  return {
    keyFinding: candidates[0]?.finding || 'Architecture performs within expected parameters.',
    keyRecommendation: candidates[0]?.recommendation || 'Continue monitoring performance under growth scenarios.',
  }
}

// ============================================================================
// ACTION PLAN
// ============================================================================

function estimateEffort(blockType, currentConfig) {
  const baseEffort = {
    'database': 16,
    'cache': 4,
    'service': 8,
    'api-gateway': 12,
    'queue': 6,
    'load-balancer': 4,
    'cdn': 2,
    'default': 8,
  }[blockType] || 8

  // If scaling config already exists, effort is lower (infrastructure partially ready)
  const hasScalingConfig = currentConfig?.scalingBehavior != null || currentConfig?.replicas != null
  return hasScalingConfig ? Math.round(baseEffort * 0.6) : baseEffort
}

function calculateActionImpact(actionType, p3Results, globalMetrics) {
  // Batch 3: null-aware — a missing analysis yields unknown impact (null),
  // not a fabricated 95-point gap from a 0 default
  const reliabilityScore = p3Results.reliabilityAnalysis?.reliabilityScore ?? null
  const scalabilityScore = p3Results.scalabilityAnalysis?.scalabilityScore ?? null
  const securityScore = p3Results.securityAnalysis?.securityScore ?? null
  // Batch 3 fix: globalMetrics comes from the aggregated simulation, not
  // p3Results (p3Results.globalMetrics never existed — cost impact was
  // always computed against 1 request / 1 RPS)
  const costScore = p3Results.costAnalysis ? calculateCostScore(p3Results.costAnalysis, globalMetrics) : null

  // Impact = gap between current score and theoretical maximum (95)
  switch (actionType) {
    case 'reliability': return reliabilityScore != null ? Math.max(5, Math.round(95 - reliabilityScore)) : null
    case 'scalability': return scalabilityScore != null ? Math.max(5, Math.round(95 - scalabilityScore)) : null
    case 'security': return securityScore != null ? Math.max(5, Math.round(95 - securityScore)) : null
    case 'cost': return costScore != null ? Math.max(3, Math.round(95 - costScore)) : null
    default: return null
  }
}

function buildActionPlanFromP3(p3Results, aggregated, simulationRecord) {
  const actions = []
  const reliability = p3Results.reliabilityAnalysis || {}
  const scalability = p3Results.scalabilityAnalysis || {}
  const security = p3Results.securityAnalysis || {}
  const cost = p3Results.costAnalysis || {}

  // Block type lookup for effort estimation
  const blockMap = new Map()
  for (const b of simulationRecord?.inputSnapshot?.blocks || []) {
    blockMap.set(b.id, b)
  }

  // Critical: SPOFs
  for (const spof of reliability.singlePointsOfFailure || []) {
    const blockId = spof.blockId || spof
    const block = blockMap.get(blockId)
    const blockType = block?.type || 'default'
    const effort = estimateEffort(blockType, block?.config)
    const impact = calculateActionImpact('reliability', p3Results, aggregated?.globalMetrics)

    actions.push({
      id: `act-spof-${blockId}`,
      title: `Add redundancy to ${blockId}`,
      description: spof.reason || 'Eliminate single point of failure.',
      blockId,
      estimatedEffort: effort,
      estimatedImpact: impact,
      priority: 'critical',
      rationale: 'Single points of failure can cause total architecture outage.',
      supportingEvidence: [
        `reliabilityAnalysis.singlePointsOfFailure:${blockId}`,
        `reliabilityAnalysis.availability:${reliability.availability}`,
      ],
    })
  }

  // Critical: Bottlenecks
  for (const b of scalability.bottlenecks?.filter(b => b.severity === 'critical') || []) {
    const block = blockMap.get(b.blockId)
    const blockType = block?.type || 'default'
    const effort = estimateEffort(blockType, block?.config)
    const impact = calculateActionImpact('scalability', p3Results, aggregated?.globalMetrics)

    actions.push({
      id: `act-bottleneck-${b.blockId}`,
      title: `Scale ${b.label} — saturated`,
      description: b.message,
      blockId: b.blockId,
      estimatedEffort: effort,
      estimatedImpact: impact,
      priority: 'critical',
      rationale: 'Saturated components drop requests and degrade performance.',
      supportingEvidence: [
        `scalabilityAnalysis.bottlenecks:${b.blockId}`,
        `scalabilityAnalysis.bottlenecks.${b.blockId}.currentRps:${b.currentRps}`,
        `scalabilityAnalysis.bottlenecks.${b.blockId}.maxRps:${b.maxRps}`,
      ],
    })
  }

  // High: Security
  for (const finding of security.bySeverity?.high || []) {
    const impact = calculateActionImpact('security', p3Results, aggregated?.globalMetrics)
    actions.push({
      id: `act-sec-${finding.id}`,
      title: `Fix: ${finding.message}`,
      description: finding.recommendation,
      blockId: finding.blockId,
      edgeId: finding.edgeId,
      estimatedEffort: finding.severity === 'critical' ? 8 : finding.severity === 'high' ? 4 : 2,
      estimatedImpact: impact,
      priority: 'high',
      rationale: 'Security issues can lead to data breaches and compliance violations.',
      supportingEvidence: [
        `securityAnalysis.bySeverity.${finding.severity}:${finding.id}`,
        `securityAnalysis.securityScore:${security.securityScore}`,
      ],
    })
  }

  // High: Near-saturation
  for (const p of scalability.saturationPoints?.filter(p => p.isNearSaturation && !p.isSaturated) || []) {
    const block = blockMap.get(p.blockId)
    const blockType = block?.type || 'default'
    const effort = estimateEffort(blockType, block?.config)
    const impact = calculateActionImpact('scalability', p3Results, aggregated?.globalMetrics)

    actions.push({
      id: `act-nearsat-${p.blockId}`,
      title: `Plan scaling for ${p.label}`,
      description: `${p.label} is at ${(p.currentUtilization * 100).toFixed(1)}% with ${p.headroomPercent.toFixed(1)}% headroom.`,
      blockId: p.blockId,
      estimatedEffort: effort,
      estimatedImpact: impact != null ? Math.round(impact * 0.5) : null, // lower impact because it's proactive
      priority: 'high',
      rationale: 'Proactive scaling prevents saturation under traffic growth.',
      supportingEvidence: [
        `scalabilityAnalysis.saturationPoints:${p.blockId}`,
        `scalabilityAnalysis.saturationPoints.${p.blockId}.headroom:${p.headroomPercent}`,
      ],
    })
  }

  // Medium: Cost optimization
  for (const driver of cost.drivers?.filter(d => d.percentageOfTotal > 30) || []) {
    const impact = calculateActionImpact('cost', p3Results, aggregated?.globalMetrics)
    actions.push({
      id: `act-cost-${driver.componentId}`,
      title: `Optimize cost for ${driver.label || driver.componentId}`,
      description: driver.recommendation,
      blockId: driver.componentId,
      estimatedEffort: 4,
      estimatedImpact: impact != null ? Math.round(impact * 0.6) : null,
      priority: 'medium',
      rationale: 'Cost optimization improves ROI without performance degradation.',
      supportingEvidence: [
        `costAnalysis.drivers:${driver.componentId}`,
        `costAnalysis.drivers.${driver.componentId}.percentageOfTotal:${driver.percentageOfTotal}`,
      ],
    })
  }

  // D4: Deduplicate by (blockId, priority)
  const seen = new Set()
  const deduped = actions.filter(a => {
    const key = `${a.blockId}-${a.priority}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  // Sort by priority
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
  deduped.sort((a, b) => {
    const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority]
    if (pDiff !== 0) return pDiff
    return (b.estimatedImpact ?? 0) - (a.estimatedImpact ?? 0)
  })

  return {
    critical: deduped.filter(a => a.priority === 'critical'),
    high: deduped.filter(a => a.priority === 'high'),
    medium: deduped.filter(a => a.priority === 'medium'),
    low: deduped.filter(a => a.priority === 'low'),
    summary: `Total: ${deduped.length} actions (${deduped.filter(a => a.priority === 'critical').length} critical, ${deduped.filter(a => a.priority === 'high').length} high, ${deduped.filter(a => a.priority === 'medium').length} medium, ${deduped.filter(a => a.priority === 'low').length} low)`,
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function getTopBlocks(aggregated, metricKey, limit = 5) {
  const blocks = aggregated.blockMetrics?.blocks || {}

  const getNestedValue = (obj, path) => {
    const keys = path.split('.')
    let val = obj
    for (const k of keys) {
      if (val == null) return 0
      val = val[k]
    }
    return val || 0
  }

  return Object.entries(blocks)
    .map(([blockId, metrics]) => ({ blockId, metrics }))
    .sort((a, b) => getNestedValue(b.metrics, metricKey) - getNestedValue(a.metrics, metricKey))
    .slice(0, limit)
}