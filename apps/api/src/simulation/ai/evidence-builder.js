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
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

const EVIDENCE_CONFIG = Object.freeze({
  // Severity thresholds for inclusion
  minSeverity: 'medium', // medium, high, critical
  maxEvidenceItems: 12,
  maxBlocksInSummary: 3,
  maxFindingsPerCategory: 3,

  // Metric thresholds for "abnormal"
  abnormalThresholds: {
    utilization: 0.75,
    errorRate: 0.01,
    latencyMs: 200,
    availability: 99.0,
    headroomPercent: 20,
  },
})

const SEVERITY_ORDER = Object.freeze({
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
})

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

/**
 * Build evidence packet from P3 results.
 *
 * @param {Object} p3Results — Results from analysis pipeline
 * @param {Object} aggregated — Monte Carlo aggregated results
 * @returns {EvidencePacket} Minimal evidence for AI
 */
export function buildEvidencePacket(p3Results, aggregated) {
  const config = EVIDENCE_CONFIG

  const findings = collectAbnormalFindings(p3Results, aggregated, config)
  const summary = buildArchitectureSummary(p3Results, aggregated, config)

  return {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    summary,
    findings: findings.slice(0, config.maxEvidenceItems),
    findingsCount: findings.length,
    hasCritical: findings.some(f => f.severity === 'critical'),
    hasHigh: findings.some(f => f.severity === 'high'),
    categoriesPresent: [...new Set(findings.map(f => f.category))],
  }
}

// ============================================================================
// FINDING COLLECTION
// ============================================================================

function collectAbnormalFindings(p3Results, aggregated, config) {
  const findings = []

  // Reliability findings
  findings.push(...extractReliabilityFindings(p3Results.reliabilityAnalysis, config))

  // Scalability findings
  findings.push(...extractScalabilityFindings(p3Results.scalabilityAnalysis, config))

  // Security findings
  findings.push(...extractSecurityFindings(p3Results.securityAnalysis, config))

  // Cost findings
  findings.push(...extractCostFindings(p3Results.costAnalysis, config))

  // Performance findings from aggregated metrics
  findings.push(...extractPerformanceFindings(aggregated, config))

  // Sort by severity, then by impact
  findings.sort((a, b) => {
    const sevDiff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
    if (sevDiff !== 0) return sevDiff
    return (b.impact || 0) - (a.impact || 0)
  })

  return findings
}

function extractReliabilityFindings(reliability, config) {
  const findings = []
  if (!reliability) return findings

  const spofs = reliability.singlePointsOfFailure || []
  for (const spof of spofs.slice(0, config.maxFindingsPerCategory)) {
    findings.push({
      category: 'reliability',
      severity: 'critical',
      type: 'single_point_of_failure',
      target: typeof spof === 'string' ? spof : spof.blockId,
      message: typeof spof === 'string'
        ? `${spof} has no redundancy`
        : spof.reason || `${spof.blockId} is a single point of failure`,
      metric: 'availability',
      value: reliability.availability,
      unit: 'ratio',
      impact: 25,
      evidencePath: 'reliabilityAnalysis.singlePointsOfFailure',
    })
  }

  const failureChains = reliability.failureChains || []
  for (const chain of failureChains.slice(0, config.maxFindingsPerCategory)) {
    findings.push({
      category: 'reliability',
      severity: 'high',
      type: 'failure_chain',
      target: chain.mode,
      message: chain.description || `Failure mode "${chain.mode}" cascades through ${chain.blockIds?.length || 0} blocks`,
      metric: 'failureProbability',
      value: chain.probability,
      unit: 'ratio',
      impact: 20,
      evidencePath: 'reliabilityAnalysis.failureChains',
    })
  }

  const blastRadiuses = (reliability.blastRadiuses || [])
    .filter(b => b.severity === 'critical' || b.severity === 'high')
    .slice(0, config.maxFindingsPerCategory)

  for (const br of blastRadiuses) {
    findings.push({
      category: 'reliability',
      severity: br.severity,
      type: 'blast_radius',
      target: br.blockId,
      message: `${br.label} failure affects ${br.totalAffectedBlocks} downstream blocks (${(br.affectedRatio * 100).toFixed(0)}% of architecture)`,
      metric: 'affectedRatio',
      value: br.affectedRatio,
      unit: 'ratio',
      impact: Math.round(br.affectedRatio * 30),
      evidencePath: 'reliabilityAnalysis.blastRadiuses',
    })
  }

  if (reliability.availability !== undefined && reliability.availability < config.abnormalThresholds.availability / 100) {
    findings.push({
      category: 'reliability',
      severity: reliability.availability < 0.95 ? 'critical' : 'high',
      type: 'low_availability',
      target: 'system',
      message: `System availability is ${(reliability.availability * 100).toFixed(2)}%`,
      metric: 'availability',
      value: reliability.availability,
      unit: 'ratio',
      impact: 20,
      evidencePath: 'reliabilityAnalysis.availability',
    })
  }

  return findings
}

function extractScalabilityFindings(scalability, config) {
  const findings = []
  if (!scalability) return findings

  const criticalBottlenecks = (scalability.bottlenecks || [])
    .filter(b => b.severity === 'critical')
    .slice(0, config.maxFindingsPerCategory)

  for (const b of criticalBottlenecks) {
    findings.push({
      category: 'scalability',
      severity: 'critical',
      type: 'saturated_component',
      target: b.blockId,
      message: b.message,
      metric: 'utilization',
      value: b.currentRps / b.maxRps,
      unit: 'ratio',
      impact: 25,
      evidencePath: 'scalabilityAnalysis.bottlenecks',
    })
  }

  const highBottlenecks = (scalability.bottlenecks || [])
    .filter(b => b.severity === 'high')
    .slice(0, config.maxFindingsPerCategory)

  for (const b of highBottlenecks) {
    findings.push({
      category: 'scalability',
      severity: 'high',
      type: 'near_saturation',
      target: b.blockId,
      message: b.message,
      metric: 'headroomPercent',
      value: b.evidence?.headroomPercent || 0,
      unit: 'percent',
      impact: 15,
      evidencePath: 'scalabilityAnalysis.bottlenecks',
    })
  }

  const unsustainableGrowth = (scalability.growthProjections || [])
    .filter(p => !p.isSustainable)
    .slice(0, config.maxFindingsPerCategory)

  for (const g of unsustainableGrowth) {
    findings.push({
      category: 'scalability',
      severity: 'high',
      type: 'unsustainable_growth',
      target: 'system',
      message: `Architecture cannot sustain ${g.trafficMultiplier}x traffic growth — ${g.predictedBottlenecks?.length || 0} components will saturate`,
      metric: 'predictedLatencyMs',
      value: g.predictedLatencyMs,
      unit: 'ms',
      impact: 18,
      evidencePath: 'scalabilityAnalysis.growthProjections',
    })
  }

  return findings
}

function extractSecurityFindings(security, config) {
  const findings = []
  if (!security) return findings

  const criticalFindings = (security.bySeverity?.critical || [])
    .slice(0, config.maxFindingsPerCategory)

  for (const f of criticalFindings) {
    findings.push({
      category: 'security',
      severity: 'critical',
      type: f.type || 'security_finding',
      target: f.blockId || f.edgeId || 'system',
      message: f.message,
      metric: 'securityScore',
      value: security.securityScore,
      unit: 'score',
      impact: 25,
      evidencePath: 'securityAnalysis.bySeverity.critical',
    })
  }

  const highFindings = (security.bySeverity?.high || [])
    .filter(f => f.type === 'unencrypted_communication' || f.type === 'public_exposure')
    .slice(0, config.maxFindingsPerCategory)

  for (const f of highFindings) {
    findings.push({
      category: 'security',
      severity: 'high',
      type: f.type,
      target: f.blockId || f.edgeId || 'system',
      message: f.message,
      metric: 'securityScore',
      value: security.securityScore,
      unit: 'score',
      impact: 15,
      evidencePath: `securityAnalysis.bySeverity.high`,
    })
  }

  return findings
}

function extractCostFindings(cost, config) {
  const findings = []
  if (!cost || !cost.drivers) return findings

  const topDrivers = cost.drivers
    .filter(d => d.percentageOfTotal > 30)
    .slice(0, config.maxFindingsPerCategory)

  for (const d of topDrivers) {
    findings.push({
      category: 'cost',
      severity: 'medium',
      type: 'cost_driver',
      target: d.componentId,
      message: `${d.label || d.componentId} drives ${d.percentageOfTotal.toFixed(1)}% of total cost`,
      metric: 'cost',
      value: d.cost,
      unit: 'USD',
      impact: Math.round(d.percentageOfTotal * 0.4),
      evidencePath: 'costAnalysis.drivers',
    })
  }

  return findings
}

function extractPerformanceFindings(aggregated, config) {
  const findings = []
  const globalMetrics = aggregated?.globalMetrics || {}
  const blocks = aggregated?.blockMetrics?.blocks || {}

  // Global latency
  if (globalMetrics.p99LatencyMs > config.abnormalThresholds.latencyMs) {
    findings.push({
      category: 'performance',
      severity: globalMetrics.p99LatencyMs > 500 ? 'critical' : 'high',
      type: 'high_latency',
      target: 'system',
      message: `P99 latency is ${globalMetrics.p99LatencyMs.toFixed(0)}ms`,
      metric: 'p99LatencyMs',
      value: globalMetrics.p99LatencyMs,
      unit: 'ms',
      impact: globalMetrics.p99LatencyMs > 500 ? 20 : 12,
      evidencePath: 'globalMetrics.p99LatencyMs',
    })
  }

  // Global error rate
  if (globalMetrics.errorRate > config.abnormalThresholds.errorRate) {
    findings.push({
      category: 'performance',
      severity: globalMetrics.errorRate > 0.05 ? 'critical' : 'high',
      type: 'high_error_rate',
      target: 'system',
      message: `Error rate is ${(globalMetrics.errorRate * 100).toFixed(2)}%`,
      metric: 'errorRate',
      value: globalMetrics.errorRate,
      unit: 'ratio',
      impact: globalMetrics.errorRate > 0.05 ? 20 : 12,
      evidencePath: 'globalMetrics.errorRate',
    })
  }

  // Per-block abnormal metrics (top N only)
  const abnormalBlocks = Object.entries(blocks)
    .map(([blockId, metrics]) => ({ blockId, metrics }))
    .filter(({ metrics }) => {
      return (metrics.utilization || 0) > config.abnormalThresholds.utilization ||
             (metrics.errorRate || 0) > config.abnormalThresholds.errorRate ||
             (metrics.p99LatencyMs || 0) > config.abnormalThresholds.latencyMs
    })
    .sort((a, b) => {
      const aScore = (a.metrics.utilization || 0) + (a.metrics.errorRate || 0) * 10
      const bScore = (b.metrics.utilization || 0) + (b.metrics.errorRate || 0) * 10
      return bScore - aScore
    })
    .slice(0, config.maxBlocksInSummary)

  for (const { blockId, metrics } of abnormalBlocks) {
    const parts = []
    if (metrics.utilization > config.abnormalThresholds.utilization) {
      parts.push(`${(metrics.utilization * 100).toFixed(0)}% utilization`)
    }
    if (metrics.errorRate > config.abnormalThresholds.errorRate) {
      parts.push(`${(metrics.errorRate * 100).toFixed(2)}% error rate`)
    }
    if (metrics.p99LatencyMs > config.abnormalThresholds.latencyMs) {
      parts.push(`${metrics.p99LatencyMs.toFixed(0)}ms P99 latency`)
    }

    findings.push({
      category: 'performance',
      severity: metrics.utilization > 0.95 || metrics.errorRate > 0.05 ? 'critical' : 'high',
      type: 'abnormal_block_metrics',
      target: blockId,
      message: `${blockId}: ${parts.join(', ')}`,
      metric: 'composite',
      value: metrics.utilization || metrics.errorRate || metrics.p99LatencyMs,
      unit: 'mixed',
      impact: Math.round((metrics.utilization || 0) * 20),
      evidencePath: `blockMetrics.blocks.${blockId}`,
    })
  }

  return findings
}

// ============================================================================
// ARCHITECTURE SUMMARY
// ============================================================================

function buildArchitectureSummary(p3Results, aggregated, config) {
  const reliability = p3Results.reliabilityAnalysis || {}
  const scalability = p3Results.scalabilityAnalysis || {}
  const security = p3Results.securityAnalysis || {}
  const cost = p3Results.costAnalysis || {}
  const globalMetrics = aggregated?.globalMetrics || {}

  return {
    blockCount: Object.keys(aggregated?.blockMetrics?.blocks || {}).length,
    overallAvailability: reliability.availability,
    overallScalabilityScore: scalability.scalabilityScore,
    overallSecurityScore: security.securityScore,
    overallCost: cost.currentMonthlyCost,
    globalLatencyP99: globalMetrics.p99LatencyMs,
    globalErrorRate: globalMetrics.errorRate,
    globalThroughput: globalMetrics.throughputRps,
    spofCount: (reliability.singlePointsOfFailure || []).length,
    criticalBottleneckCount: (scalability.bottlenecks || []).filter(b => b.severity === 'critical').length,
    criticalSecurityCount: (security.bySeverity?.critical || []).length,
    unsustainableGrowthAt: (scalability.growthProjections || [])
      .filter(p => !p.isSustainable)
      .map(p => `${p.trafficMultiplier}x`),
  }
}