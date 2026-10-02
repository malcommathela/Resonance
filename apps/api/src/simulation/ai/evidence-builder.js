/**
 * Evidence Builder — P3 → AI Contract
 *
 * Extracts ONLY abnormal findings from P3 engine results.
 * Produces a minimal, structured evidence packet for AI consumption.
 *
 * Rules:
 * - AI never sees normal/healthy metrics
 * - AI never sees full perBlock dumps
 * - AI receives only findings that require explanation
 * - All structured data (scores, bottlenecks, risks, costs) stays in P3
 * - Missing/unavailable/failed analysis is NEVER presented as a measurement
 *   (a measured zero stays a measured zero; anything else is explicit unknown)
 */

import {
  CANONICAL_MODEL_VERSION,
  SIMULATION_ENGINE_VERSION,
  REPORT_SCHEMA_VERSION,
} from '@resonance/shared/canonical-model'

// ============================================================================
// CONFIGURATION
// ============================================================================

export const EVIDENCE_SCHEMA_VERSION = '2.0.0'

const EVIDENCE_CONFIG = Object.freeze({
  // Severity thresholds for inclusion
  minSeverity: 'medium', // medium, high, critical
  maxEvidenceItems: 12,
  maxBlocksInSummary: 3,
  maxFindingsPerCategory: 3,
})

// Threshold policy. Values are product rules predating this contract — kept
// byte-identical so measured-data behavior doesn't shift. Documented here so
// no new threshold can slip in undocumented: engine-provided thresholds live
// in the engines, everything AI-side lives below with its provenance.
export const THRESHOLD_POLICY = Object.freeze({
  utilization: { value: 0.75, source: 'product-rule', note: 'block utilization above this is abnormal' },
  errorRate: { value: 0.01, source: 'product-rule', note: 'ratio (0-1), NOT percent — engine reports ratios' },
  latencyMs: { value: 200, source: 'product-rule', note: 'P99 latency above this (ms) is abnormal' },
  criticalLatencyMs: { value: 500, source: 'product-rule', note: 'P99 latency above this (ms) is critical' },
  availability: { value: 0.99, source: 'product-rule', note: 'ratio (0-1); system availability below this is abnormal' },
  criticalAvailability: { value: 0.95, source: 'product-rule', note: 'ratio (0-1); below this is critical' },
  criticalUtilization: { value: 0.95, source: 'product-rule', note: 'ratio (0-1); block saturation' },
  criticalErrorRate: { value: 0.05, source: 'product-rule', note: 'ratio (0-1); block/system critical' },
  headroomPercent: { value: 20, source: 'engine', note: 'informational only; engine owns headroom math' },
  costDriverPercent: { value: 30, source: 'product-rule', note: 'cost share above this (%) is a driver finding' },
  healthyScore: { value: 80, source: 'product-rule', note: 'score at/above this supports a healthy-state narrative (with evaluated data)' },
  minSeverity: { value: 'medium', source: 'product-rule', note: 'lower severities never enter the packet' },
})

const SEVERITY_ORDER = Object.freeze({
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
})

// ============================================================================
// DATA-VALIDITY PRIMITIVES
// ============================================================================

// The ONLY number gate in this file. Everything measured flows through it:
// finite numbers pass (including legitimate 0), null/undefined/NaN/Infinity/
// non-numbers do not. `null < 0.99 === true` in JS — never compare raw.
export function isMeasured(value) {
  return typeof value === 'number' && Number.isFinite(value)
}

// A growth experiment counts as measured-unsustainable ONLY when the engine
// explicitly says so. `status: 'unavailable'` / `isSustainable: null` is
// missing data, never failure.
export function isMeasuredUnsustainable(projection) {
  return !!projection
    && projection.status !== 'unavailable'
    && projection.isSustainable === false
}

// Per-analysis evaluation state. buildReportData sanitizes engine errors to
// null; raw pipeline results may also carry { error: true }. Both mean the
// analysis cannot support ANY claim — including healthy claims.
export function analysisStatus(analysis) {
  if (analysis == null) return 'not-evaluated'
  if (analysis.error === true) return 'failed'
  return 'evaluated'
}

// Stable finding identity: deterministic for identical input, so insights,
// validation, and retries all reference the same id.
export function findingId(category, type, target) {
  return `ev-${category}:${type}:${target ?? 'system'}`
}

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

/**
 * Build evidence packet from P3 results.
 *
 * @param {Object} p3Results — Results from analysis pipeline (sanitized: null
 *   where an engine failed or never ran)
 * @param {Object} aggregated — Monte Carlo aggregated results
 * @param {Object} context — Optional traceability: { simulation: {
 *   id, designId, scenario, trafficPattern, rps, duration, monteCarloPasses,
 *   deterministicSeed }, versions: { canonicalModel, engine, reportSchema, dto } }
 * @returns {EvidencePacket} Minimal evidence for AI
 */
export function buildEvidencePacket(p3Results, aggregated, context = {}) {
  const results = p3Results || {}
  const findings = collectAbnormalFindings(results, aggregated)
  const summary = buildArchitectureSummary(results, aggregated)
  const statuses = {
    reliability: analysisStatus(results.reliabilityAnalysis),
    scalability: analysisStatus(results.scalabilityAnalysis),
    security: analysisStatus(results.securityAnalysis),
    cost: analysisStatus(results.costAnalysis),
    performance: aggregated?.globalMetrics != null ? 'evaluated' : 'not-evaluated',
  }
  const unavailable = Object.entries(statuses)
    .filter(([, status]) => status !== 'evaluated')
    .map(([category, status]) => ({
      category,
      status,
      reason: status === 'failed'
        ? 'analysis engine failed; absence of findings is not evidence of health'
        : 'analysis missing; absence of findings is not evidence of health',
    }))

  const sim = context.simulation || {}
  const ver = context.versions || {}

  return {
    schemaVersion: EVIDENCE_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    simulation: {
      id: sim.id ?? null,
      designId: sim.designId ?? null,
      scenario: sim.scenario ?? null,
      trafficPattern: sim.trafficPattern ?? null,
      rps: isMeasured(sim.rps) ? sim.rps : null,
      duration: isMeasured(sim.duration) ? sim.duration : null,
      monteCarloPasses: isMeasured(sim.monteCarloPasses) ? sim.monteCarloPasses : null,
      deterministicSeed: sim.deterministicSeed ?? null,
    },
    versions: {
      canonicalModel: ver.canonicalModel || CANONICAL_MODEL_VERSION,
      engine: ver.engine || SIMULATION_ENGINE_VERSION,
      reportSchema: ver.reportSchema || REPORT_SCHEMA_VERSION,
      dto: ver.dto ?? null,
    },
    summary,
    analysisStatus: statuses,
    unavailable,
    findings: findings.slice(0, EVIDENCE_CONFIG.maxEvidenceItems),
    findingsCount: findings.length,
    hasCritical: findings.some(f => f.severity === 'critical'),
    hasHigh: findings.some(f => f.severity === 'high'),
    categoriesPresent: [...new Set(findings.map(f => f.category))],
  }
}

// ============================================================================
// FINDING COLLECTION
// ============================================================================

function collectAbnormalFindings(p3Results, aggregated) {
  const findings = []

  // Reliability findings
  findings.push(...extractReliabilityFindings(p3Results.reliabilityAnalysis))

  // Scalability findings
  findings.push(...extractScalabilityFindings(p3Results.scalabilityAnalysis))

  // Security findings
  findings.push(...extractSecurityFindings(p3Results.securityAnalysis))

  // Cost findings
  findings.push(...extractCostFindings(p3Results.costAnalysis))

  // Performance findings from aggregated metrics
  findings.push(...extractPerformanceFindings(aggregated))

  // Sort by severity, then by impact
  findings.sort((a, b) => {
    const sevDiff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
    if (sevDiff !== 0) return sevDiff
    return (b.impact || 0) - (a.impact || 0)
  })

  return findings
}

function extractReliabilityFindings(reliability) {
  const findings = []
  if (analysisStatus(reliability) !== 'evaluated') return findings
  const T = THRESHOLD_POLICY

  const spofs = reliability.singlePointsOfFailure || []
  for (const spof of spofs.slice(0, EVIDENCE_CONFIG.maxFindingsPerCategory)) {
    const target = typeof spof === 'string' ? spof : spof.blockId
    findings.push({
      id: findingId('reliability', 'single_point_of_failure', target),
      category: 'reliability',
      severity: 'critical',
      type: 'single_point_of_failure',
      target,
      message: typeof spof === 'string'
        ? `${spof} has no redundancy`
        : spof.reason || `${spof.blockId} is a single point of failure`,
      metric: 'availability',
      value: isMeasured(reliability.availability) ? reliability.availability : null,
      unit: 'ratio',
      status: 'observed',
      impact: 25,
      evidencePath: 'reliabilityAnalysis.singlePointsOfFailure',
    })
  }

  const failureChains = reliability.failureChains || []
  for (const chain of failureChains.slice(0, EVIDENCE_CONFIG.maxFindingsPerCategory)) {
    findings.push({
      id: findingId('reliability', 'failure_chain', chain.mode),
      category: 'reliability',
      severity: 'high',
      type: 'failure_chain',
      target: chain.mode,
      message: chain.description || `Failure mode "${chain.mode}" cascades through ${chain.blockIds?.length || 0} blocks`,
      metric: 'failureProbability',
      value: isMeasured(chain.probability) ? chain.probability : null,
      unit: 'ratio',
      status: 'observed',
      impact: 20,
      evidencePath: 'reliabilityAnalysis.failureChains',
    })
  }

  const blastRadiuses = (reliability.blastRadiuses || [])
    .filter(b => b.severity === 'critical' || b.severity === 'high')
    .slice(0, EVIDENCE_CONFIG.maxFindingsPerCategory)

  for (const br of blastRadiuses) {
    findings.push({
      id: findingId('reliability', 'blast_radius', br.blockId),
      category: 'reliability',
      severity: br.severity,
      type: 'blast_radius',
      target: br.blockId,
      message: isMeasured(br.affectedRatio)
        ? `${br.label} failure affects ${br.totalAffectedBlocks} downstream blocks (${(br.affectedRatio * 100).toFixed(0)}% of architecture)`
        : `${br.label} failure affects downstream blocks (affected ratio unavailable)`,
      metric: 'affectedRatio',
      value: isMeasured(br.affectedRatio) ? br.affectedRatio : null,
      unit: 'ratio',
      status: 'observed',
      impact: isMeasured(br.affectedRatio) ? Math.round(br.affectedRatio * 30) : 10,
      evidencePath: 'reliabilityAnalysis.blastRadiuses',
    })
  }

  if (isMeasured(reliability.availability) && reliability.availability < T.availability.value) {
    findings.push({
      id: findingId('reliability', 'low_availability', 'system'),
      category: 'reliability',
      severity: reliability.availability < T.criticalAvailability.value ? 'critical' : 'high',
      type: 'low_availability',
      target: 'system',
      message: `System availability is ${(reliability.availability * 100).toFixed(2)}%`,
      metric: 'availability',
      value: reliability.availability,
      unit: 'ratio',
      status: 'observed',
      impact: 20,
      evidencePath: 'reliabilityAnalysis.availability',
    })
  }

  return findings
}

function extractScalabilityFindings(scalability) {
  const findings = []
  if (analysisStatus(scalability) !== 'evaluated') return findings

  const criticalBottlenecks = (scalability.bottlenecks || [])
    .filter(b => b.severity === 'critical')
    .slice(0, EVIDENCE_CONFIG.maxFindingsPerCategory)

  for (const b of criticalBottlenecks) {
    const utilization = isMeasured(b.maxRps) && b.maxRps > 0 && isMeasured(b.currentRps)
      ? b.currentRps / b.maxRps
      : null
    findings.push({
      id: findingId('scalability', 'saturated_component', b.blockId),
      category: 'scalability',
      severity: 'critical',
      type: 'saturated_component',
      target: b.blockId,
      message: b.message,
      metric: 'utilization',
      value: utilization,
      unit: 'ratio',
      status: 'derived',
      recommendation: typeof b.recommendation === 'string' ? b.recommendation : null,
      impact: 25,
      evidencePath: 'scalabilityAnalysis.bottlenecks',
    })
  }

  const highBottlenecks = (scalability.bottlenecks || [])
    .filter(b => b.severity === 'high')
    .slice(0, EVIDENCE_CONFIG.maxFindingsPerCategory)

  for (const b of highBottlenecks) {
    findings.push({
      id: findingId('scalability', 'near_saturation', b.blockId),
      category: 'scalability',
      severity: 'high',
      type: 'near_saturation',
      target: b.blockId,
      message: b.message,
      metric: 'headroomPercent',
      value: isMeasured(b.evidence?.headroomPercent) ? b.evidence.headroomPercent : null,
      unit: 'percent',
      status: 'observed',
      recommendation: typeof b.recommendation === 'string' ? b.recommendation : null,
      impact: 15,
      evidencePath: 'scalabilityAnalysis.bottlenecks',
    })
  }

  const unsustainableGrowth = (scalability.growthProjections || [])
    .filter(isMeasuredUnsustainable)
    .slice(0, EVIDENCE_CONFIG.maxFindingsPerCategory)

  for (const g of unsustainableGrowth) {
    findings.push({
      id: findingId('scalability', 'unsustainable_growth', `${g.trafficMultiplier}x`),
      category: 'scalability',
      severity: 'high',
      type: 'unsustainable_growth',
      target: 'system',
      message: `Architecture cannot sustain ${g.trafficMultiplier}x traffic growth — ${g.predictedBottlenecks?.length || 0} components will saturate`,
      metric: 'predictedLatencyMs',
      value: isMeasured(g.predictedLatencyMs) ? g.predictedLatencyMs : null,
      unit: 'ms',
      status: 'observed',
      recommendation: typeof g.recommendation === 'string' ? g.recommendation : null,
      impact: 18,
      evidencePath: 'scalabilityAnalysis.growthProjections',
    })
  }

  return findings
}

function extractSecurityFindings(security) {
  const findings = []
  if (analysisStatus(security) !== 'evaluated') return findings

  const criticalFindings = (security.bySeverity?.critical || [])
    .slice(0, EVIDENCE_CONFIG.maxFindingsPerCategory)

  for (const f of criticalFindings) {
    findings.push({
      id: findingId('security', f.type || 'security_finding', f.blockId || f.edgeId || 'system'),
      category: 'security',
      severity: 'critical',
      type: f.type || 'security_finding',
      target: f.blockId || f.edgeId || 'system',
      message: f.message,
      metric: 'securityScore',
      value: isMeasured(security.securityScore) ? security.securityScore : null,
      unit: 'score',
      status: 'observed',
      recommendation: typeof f.recommendation === 'string' ? f.recommendation : null,
      impact: 25,
      evidencePath: 'securityAnalysis.bySeverity.critical',
    })
  }

  const highFindings = (security.bySeverity?.high || [])
    .filter(f => f.type === 'unencrypted_communication' || f.type === 'public_exposure')
    .slice(0, EVIDENCE_CONFIG.maxFindingsPerCategory)

  for (const f of highFindings) {
    findings.push({
      id: findingId('security', f.type, f.blockId || f.edgeId || 'system'),
      category: 'security',
      severity: 'high',
      type: f.type,
      target: f.blockId || f.edgeId || 'system',
      message: f.message,
      metric: 'securityScore',
      value: isMeasured(security.securityScore) ? security.securityScore : null,
      unit: 'score',
      status: 'observed',
      recommendation: typeof f.recommendation === 'string' ? f.recommendation : null,
      impact: 15,
      evidencePath: `securityAnalysis.bySeverity.high`,
    })
  }

  return findings
}

function extractCostFindings(cost) {
  const findings = []
  if (analysisStatus(cost) !== 'evaluated') return findings
  if (!cost.drivers) return findings

  const topDrivers = cost.drivers
    .filter(d => isMeasured(d.percentageOfTotal) && d.percentageOfTotal > THRESHOLD_POLICY.costDriverPercent.value)
    .slice(0, EVIDENCE_CONFIG.maxFindingsPerCategory)

  for (const d of topDrivers) {
    findings.push({
      id: findingId('cost', 'cost_driver', d.componentId),
      category: 'cost',
      severity: 'medium',
      type: 'cost_driver',
      target: d.componentId,
      message: `${d.label || d.componentId} drives ${d.percentageOfTotal.toFixed(1)}% of total cost`,
      metric: 'cost',
      value: isMeasured(d.cost) ? d.cost : null,
      unit: 'USD',
      status: 'observed',
      recommendation: typeof d.recommendation === 'string' ? d.recommendation : null,
      impact: Math.round(d.percentageOfTotal * 0.4),
      evidencePath: 'costAnalysis.drivers',
    })
  }

  return findings
}

function extractPerformanceFindings(aggregated) {
  const findings = []
  const T = THRESHOLD_POLICY
  const globalMetrics = aggregated?.globalMetrics || {}
  const blocks = aggregated?.blockMetrics?.blocks || {}

  // Global latency
  if (isMeasured(globalMetrics.p99LatencyMs) && globalMetrics.p99LatencyMs > T.latencyMs.value) {
    findings.push({
      id: findingId('performance', 'high_latency', 'system'),
      category: 'performance',
      severity: globalMetrics.p99LatencyMs > T.criticalLatencyMs.value ? 'critical' : 'high',
      type: 'high_latency',
      target: 'system',
      message: `P99 latency is ${globalMetrics.p99LatencyMs.toFixed(0)}ms`,
      metric: 'p99LatencyMs',
      value: globalMetrics.p99LatencyMs,
      unit: 'ms',
      status: 'observed',
      impact: globalMetrics.p99LatencyMs > T.criticalLatencyMs.value ? 20 : 12,
      evidencePath: 'globalMetrics.p99LatencyMs',
    })
  }

  // Global error rate (ratio 0-1 per the engine contract — never percent)
  if (isMeasured(globalMetrics.errorRate) && globalMetrics.errorRate > T.errorRate.value) {
    findings.push({
      id: findingId('performance', 'high_error_rate', 'system'),
      category: 'performance',
      severity: globalMetrics.errorRate > T.criticalErrorRate.value ? 'critical' : 'high',
      type: 'high_error_rate',
      target: 'system',
      message: `Error rate is ${(globalMetrics.errorRate * 100).toFixed(2)}%`,
      metric: 'errorRate',
      value: globalMetrics.errorRate,
      unit: 'ratio',
      status: 'observed',
      impact: globalMetrics.errorRate > T.criticalErrorRate.value ? 20 : 12,
      evidencePath: 'globalMetrics.errorRate',
    })
  }

  // Per-block abnormal metrics (top N only)
  const abnormalBlocks = Object.entries(blocks)
    .map(([blockId, metrics]) => ({ blockId, metrics: metrics || {} }))
    .filter(({ metrics }) => {
      return (isMeasured(metrics.utilization) && metrics.utilization > T.utilization.value) ||
             (isMeasured(metrics.errorRate) && metrics.errorRate > T.errorRate.value) ||
             (isMeasured(metrics.p99LatencyMs) && metrics.p99LatencyMs > T.latencyMs.value)
    })
    .sort((a, b) => {
      const aScore = (a.metrics.utilization || 0) + (a.metrics.errorRate || 0) * 10
      const bScore = (b.metrics.utilization || 0) + (b.metrics.errorRate || 0) * 10
      return bScore - aScore
    })
    .slice(0, EVIDENCE_CONFIG.maxBlocksInSummary)

  for (const { blockId, metrics } of abnormalBlocks) {
    const parts = []
    if (isMeasured(metrics.utilization) && metrics.utilization > T.utilization.value) {
      parts.push(`${(metrics.utilization * 100).toFixed(0)}% utilization`)
    }
    if (isMeasured(metrics.errorRate) && metrics.errorRate > T.errorRate.value) {
      parts.push(`${(metrics.errorRate * 100).toFixed(2)}% error rate`)
    }
    if (isMeasured(metrics.p99LatencyMs) && metrics.p99LatencyMs > T.latencyMs.value) {
      parts.push(`${metrics.p99LatencyMs.toFixed(0)}ms P99 latency`)
    }

    const primaryValue = isMeasured(metrics.utilization)
      ? metrics.utilization
      : isMeasured(metrics.errorRate)
        ? metrics.errorRate
        : metrics.p99LatencyMs
    findings.push({
      id: findingId('performance', 'abnormal_block_metrics', blockId),
      category: 'performance',
      severity: (isMeasured(metrics.utilization) && metrics.utilization > T.criticalUtilization.value)
        || (isMeasured(metrics.errorRate) && metrics.errorRate > T.criticalErrorRate.value)
        ? 'critical' : 'high',
      type: 'abnormal_block_metrics',
      target: blockId,
      message: `${blockId}: ${parts.join(', ')}`,
      metric: 'composite',
      value: primaryValue,
      unit: 'mixed',
      status: 'derived',
      impact: isMeasured(metrics.utilization) ? Math.round(metrics.utilization * 20) : 10,
      evidencePath: `blockMetrics.blocks.${blockId}`,
    })
  }

  return findings
}

// ============================================================================
// ARCHITECTURE SUMMARY
// ============================================================================

function buildArchitectureSummary(p3Results, aggregated) {
  const reliability = p3Results.reliabilityAnalysis || {}
  const scalability = p3Results.scalabilityAnalysis || {}
  const security = p3Results.securityAnalysis || {}
  const cost = p3Results.costAnalysis || {}
  const globalMetrics = aggregated?.globalMetrics || {}

  return {
    blockCount: Object.keys(aggregated?.blockMetrics?.blocks || {}).length,
    // Unknown stays unknown: null/undefined pass through, never 0.
    overallAvailability: isMeasured(reliability.availability) ? reliability.availability : null,
    overallScalabilityScore: isMeasured(scalability.scalabilityScore) ? scalability.scalabilityScore : null,
    overallSecurityScore: isMeasured(security.securityScore) ? security.securityScore : null,
    overallCost: isMeasured(cost.currentMonthlyCost) ? cost.currentMonthlyCost : null,
    globalLatencyP99: isMeasured(globalMetrics.p99LatencyMs) ? globalMetrics.p99LatencyMs : null,
    globalErrorRate: isMeasured(globalMetrics.errorRate) ? globalMetrics.errorRate : null,
    globalThroughput: isMeasured(globalMetrics.throughputRps) ? globalMetrics.throughputRps : null,
    spofCount: (reliability.singlePointsOfFailure || []).length,
    criticalBottleneckCount: (scalability.bottlenecks || []).filter(b => b.severity === 'critical').length,
    criticalSecurityCount: (security.bySeverity?.critical || []).length,
    unsustainableGrowthAt: (scalability.growthProjections || [])
      .filter(isMeasuredUnsustainable)
      .map(p => `${p.trafficMultiplier}x`),
  }
}
