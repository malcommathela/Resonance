/**
 * Metrics Calculator (Client-Side)
 *
 * Utilities for calculating derived metrics from simulation results,
 * formatting values for display, and computing score aggregates.
 *
 * Batch 3 (Missing Data Handling):
 *   - calculatePerformanceGrade no longer converts insufficient data into an
 *     "F Critical" grade — it returns an explicit N/A grade instead
 *   - formatResourceUtilization guards each field individually (null/100 = 0
 *     was rendering missing data as a real "0%")
 *
 * Batch 4 (Code Quality):
 *   - getGradeFromScore is now the single source of truth for grade mapping
 *   - aggregateBlockMetrics uses throughput-weighted averages instead of
 *     unweighted means (a block with 1M requests no longer equals a block
 *     with 10 requests in the aggregate)
 */

// ============================================================================
// FORMATTING UTILITIES
// ============================================================================

/**
 * Format a number with appropriate units (ms, RPS, %, etc.).
 */
export function formatMetric(value, unit, options = {}) {
  if (value === null || value === undefined || isNaN(value)) return '—'

  const { decimals = 1, compact = false } = options

  switch (unit) {
    case 'ms':
      if (value < 1) return `${(value * 1000).toFixed(0)}μs`
      if (value < 1000) return `${value.toFixed(decimals)}ms`
      return `${(value / 1000).toFixed(decimals)}s`
    case 'rps':
      if (compact && value >= 1000) return `${(value / 1000).toFixed(1)}k RPS`
      return `${Math.round(value)} RPS`
    case 'percent':
      // C2: Detect if value is already in percentage form (>= 1) or decimal (0-1)
      const normalizedValue = value > 1 ? value / 100 : value
      return `${(normalizedValue * 100).toFixed(decimals)}%`
    case 'bytes':
      if (value < 1024) return `${value.toFixed(0)} B`
      if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`
      if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MB`
      return `${(value / 1024 ** 3).toFixed(2)} GB`
    case 'cost':
      return `$${value.toFixed(2)}`
    case 'count':
      if (compact && value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
      if (compact && value >= 1000) return `${(value / 1000).toFixed(1)}k`
      return value.toLocaleString()
    default:
      return `${value.toFixed(decimals)}`
  }
}

/**
 * Format a latency distribution for display.
 */
export function formatLatencyDistribution(metrics) {
  if (!metrics) return null

  return {
    avg: formatMetric(metrics.avgLatencyMs, 'ms'),
    p50: formatMetric(metrics.p50LatencyMs, 'ms'),
    p75: formatMetric(metrics.p75LatencyMs, 'ms'),
    p90: formatMetric(metrics.p90LatencyMs, 'ms'),
    p95: formatMetric(metrics.p95LatencyMs, 'ms'),
    p99: formatMetric(metrics.p99LatencyMs, 'ms'),
    p999: formatMetric(metrics.p999LatencyMs, 'ms'),
    min: formatMetric(metrics.minLatencyMs, 'ms'),
    max: formatMetric(metrics.maxLatencyMs, 'ms'),
  }
}

/**
 * Format resource utilization for display.
 * Batch 3: guard each field — null/100 coerces to 0 and was rendering
 * missing resource data as a real "0%" reading.
 */
export function formatResourceUtilization(resources) {
  if (!resources) return null

  const pct = (v) => (v === null || v === undefined || isNaN(v))
    ? '—'
    : formatMetric(v / 100, 'percent', { decimals: 0 })

  return {
    cpu: pct(resources.cpuPercent),
    cpuPeak: pct(resources.cpuPeakPercent),
    memory: pct(resources.memoryPercent),
    memoryPeak: pct(resources.memoryPeakPercent),
    threads: pct(resources.threadPoolUtilization),
    connections: pct(resources.connectionPoolUtilization),
  }
}

// ============================================================================
// SCORE CALCULATIONS
// ============================================================================

/**
 * Calculate a health score from 0-100 based on simulation metrics.
 * Returns { score, status, missingFields? } — score is null when data is insufficient.
 */
export function calculateHealthScore(globalMetrics, slaConfig = null) {
  // C1: Require minimum data presence — never return 100 for empty data
  if (!globalMetrics) {
    return { score: null, status: 'insufficient_data', missingFields: ['globalMetrics'] }
  }

  const required = ['totalRequests', 'avgLatencyMs', 'errorRate', 'availability']
  const missing = required.filter(k => globalMetrics[k] == null)
  if (missing.length > 0) {
    return { score: null, status: 'insufficient_data', missingFields: missing }
  }

  let score = 100

  if (slaConfig) {
    // B1: SLA-aware scoring when design config is available
    const { latencySlaMs = 200, slaTarget = 0.999 } = slaConfig
    const avgLatency = globalMetrics.avgLatencyMs || 0
    if (avgLatency > latencySlaMs) {
      const overage = (avgLatency - latencySlaMs) / latencySlaMs
      score -= Math.min(30, overage * 20)
    }
    const errorRate = globalMetrics.errorRate || 0
    const errorBudget = 1 - slaTarget
    if (errorRate > errorBudget && errorBudget > 0) {
      const overage = (errorRate - errorBudget) / errorBudget
      score -= Math.min(40, overage * 20)
    }
    const availability = globalMetrics.availability || 100
    const availabilityTarget = slaTarget * 100
    if (availability < availabilityTarget && availabilityTarget > 0) {
      const gap = (availabilityTarget - availability) / availabilityTarget
      score -= Math.min(30, gap * 50)
    }
  } else {
    // Fallback: industry-standard thresholds (only used when backend score unavailable)
    const avgLatency = globalMetrics.avgLatencyMs || 0
    if (avgLatency > 500) score -= 30
    else if (avgLatency > 200) score -= 20
    else if (avgLatency > 100) score -= 10
    else if (avgLatency > 50) score -= 5

    const errorRate = globalMetrics.errorRate || 0
    if (errorRate > 0.1) score -= 40
    else if (errorRate > 0.05) score -= 25
    else if (errorRate > 0.01) score -= 15
    else if (errorRate > 0.001) score -= 5

    const availability = globalMetrics.availability || 100
    if (availability < 95) score -= 30
    else if (availability < 99) score -= 20
    else if (availability < 99.9) score -= 10
    else if (availability < 99.99) score -= 5
  }

  // Dropped request penalty
  const totalRequests = globalMetrics.totalRequests || 0
  const droppedRequests = globalMetrics.droppedRequests || 0
  const dropRate = totalRequests > 0 ? droppedRequests / totalRequests : 0
  if (dropRate > 0.1) score -= 20
  else if (dropRate > 0.01) score -= 10
  else if (dropRate > 0.001) score -= 5

  return { score: Math.max(0, Math.min(100, Math.round(score))), status: 'ok' }
}

/**
 * D1: Single source of truth for grade mapping.
 * Returns { grade, color, label } for any numeric score 0-100.
 * Null/undefined/NaN → N/A grade (never fabricates an F).
 */
export function getGradeFromScore(score) {
  if (score === null || score === undefined || isNaN(score)) {
    return { grade: 'N/A', color: '#6b7280', label: 'No data' }
  }
  if (score >= 95) return { grade: 'A+', color: '#22c55e', label: 'Excellent' }
  if (score >= 90) return { grade: 'A', color: '#22c55e', label: 'Excellent' }
  if (score >= 85) return { grade: 'A-', color: '#22c55e', label: 'Very Good' }
  if (score >= 80) return { grade: 'B+', color: '#84cc16', label: 'Good' }
  if (score >= 75) return { grade: 'B', color: '#84cc16', label: 'Good' }
  if (score >= 70) return { grade: 'B-', color: '#eab308', label: 'Fair' }
  if (score >= 65) return { grade: 'C+', color: '#eab308', label: 'Fair' }
  if (score >= 60) return { grade: 'C', color: '#f59e0b', label: 'Fair' }
  if (score >= 55) return { grade: 'C-', color: '#f97316', label: 'Poor' }
  if (score >= 50) return { grade: 'D+', color: '#f97316', label: 'Poor' }
  if (score >= 40) return { grade: 'D', color: '#ef4444', label: 'Critical' }
  return { grade: 'F', color: '#dc2626', label: 'Critical' }
}

/**
 * Calculate a performance grade (A-F) from metrics.
 * Batch 3: insufficient data returns an explicit N/A grade — missing data
 * must never render as "F Critical" (that is a fabricated failure).
 *
 * Batch 4: Delegates grade mapping to getGradeFromScore (single source of
 * truth). This wrapper only adds health-status context when data is missing.
 */
export function calculatePerformanceGrade(globalMetrics, slaConfig = null) {
  const health = calculateHealthScore(globalMetrics, slaConfig)

  if (health.score === null || health.score === undefined) {
    return {
      ...getGradeFromScore(null),
      label: 'Insufficient data',
      status: health.status,
      missingFields: health.missingFields,
    }
  }

  return getGradeFromScore(health.score)
}

/**
 * Calculate bottleneck severity for a block.
 */
export function calculateBottleneckSeverity(blockMetrics) {
  if (!blockMetrics) return null

  const factors = []
  const utilization = blockMetrics.utilization || 0
  const errorRate = blockMetrics.errorRate || 0
  const queueDepth = blockMetrics.queueDepth || 0
  const maxQueue = blockMetrics.maxQueueDepth || 1

  if (utilization > 0.95) factors.push({ type: 'utilization', severity: 'critical', message: 'Near 100% utilization' })
  else if (utilization > 0.8) factors.push({ type: 'utilization', severity: 'high', message: 'High utilization' })
  else if (utilization > 0.6) factors.push({ type: 'utilization', severity: 'medium', message: 'Moderate utilization' })

  if (errorRate > 0.1) factors.push({ type: 'errors', severity: 'critical', message: 'High error rate' })
  else if (errorRate > 0.01) factors.push({ type: 'errors', severity: 'high', message: 'Elevated error rate' })
  else if (errorRate > 0.001) factors.push({ type: 'errors', severity: 'medium', message: 'Some errors' })

  const queueUtilization = maxQueue > 0 ? queueDepth / maxQueue : 0
  if (queueUtilization > 0.9) factors.push({ type: 'queue', severity: 'critical', message: 'Queue nearly full' })
  else if (queueUtilization > 0.7) factors.push({ type: 'queue', severity: 'high', message: 'Queue backing up' })
  else if (queueUtilization > 0.5) factors.push({ type: 'queue', severity: 'medium', message: 'Queue growing' })

  const overallSeverity = factors.some(f => f.severity === 'critical') ? 'critical'
    : factors.some(f => f.severity === 'high') ? 'high'
    : factors.some(f => f.severity === 'medium') ? 'medium'
    : 'low'

  return { severity: overallSeverity, factors }
}

/**
 * Aggregate metrics across multiple blocks.
 *
 * Batch 4: All averages are now throughput-weighted. A block handling 1M
 * requests contributes 100,000× more to the aggregate error rate than a
 * block handling 10 requests. Previously, unweighted averaging made the
 * aggregate statistically meaningless.
 */
export function aggregateBlockMetrics(blockMetricsMap) {
  if (!blockMetricsMap) return null

  const entries = Object.values(blockMetricsMap)
  if (entries.length === 0) return null

  // Weight by throughputRps when available; fall back to totalRequests
  const weightOf = (m) => m.throughputRps || m.totalRequests || 0

  const totals = entries.reduce((acc, m) => {
    const w = weightOf(m)
    return {
      totalRequests: acc.totalRequests + (m.totalRequests || 0),
      successfulRequests: acc.successfulRequests + (m.successfulRequests || 0),
      failedRequests: acc.failedRequests + (m.failedRequests || 0),
      droppedRequests: acc.droppedRequests + (m.droppedRequests || 0),
      throughputRps: acc.throughputRps + (m.throughputRps || 0),
      avgLatencyMs: acc.avgLatencyMs + (m.avgLatencyMs || 0) * w,
      p95LatencyMs: acc.p95LatencyMs + (m.p95LatencyMs || 0) * w,
      p99LatencyMs: acc.p99LatencyMs + (m.p99LatencyMs || 0) * w,
      utilization: acc.utilization + (m.utilization || 0) * w,
      totalWeight: acc.totalWeight + w,
    }
  }, {
    totalRequests: 0, successfulRequests: 0, failedRequests: 0, droppedRequests: 0,
    throughputRps: 0, avgLatencyMs: 0, p95LatencyMs: 0, p99LatencyMs: 0,
    utilization: 0, totalWeight: 0,
  })

  const w = totals.totalWeight

  return {
    totalRequests: totals.totalRequests,
    successfulRequests: totals.successfulRequests,
    failedRequests: totals.failedRequests,
    droppedRequests: totals.droppedRequests,
    throughputRps: totals.throughputRps,
    // Weighted averages — throughput-weighted so high-traffic blocks dominate
    avgLatencyMs: w > 0 ? totals.avgLatencyMs / w : 0,
    // Percentile aggregation is inherently approximate; weighting by throughput
    // is the best practical correction for mixed-load architectures.
    p95LatencyMs: w > 0 ? totals.p95LatencyMs / w : 0,
    p99LatencyMs: w > 0 ? totals.p99LatencyMs / w : 0,
    // Error rate is total failed / total requests (not an average of rates)
    errorRate: totals.totalRequests > 0 ? totals.failedRequests / totals.totalRequests : 0,
    utilization: w > 0 ? totals.utilization / w : 0,
    blockCount: entries.length,
  }
}

// ============================================================================
// TREND ANALYSIS
// ============================================================================

/**
 * Calculate trend direction from a series of values.
 */
export function calculateTrend(values) {
  if (!values || values.length < 2) return { direction: 'stable', change: 0 }

  const first = values[0]
  const last = values[values.length - 1]
  const change = last - first
  const percentChange = first !== 0 ? (change / first) * 100 : 0

  let direction = 'stable'
  if (Math.abs(percentChange) < 1) direction = 'stable'
  else if (change > 0) direction = 'increasing'
  else direction = 'decreasing'

  return { direction, change, percentChange }
}

/**
 * Detect anomalies in a metric series (simple Z-score).
 */
export function detectAnomalies(values, threshold = 2) {
  if (!values || values.length < 3) return []

  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const stdDev = Math.sqrt(values.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / values.length)

  return values.map((v, i) => {
    const zScore = stdDev > 0 ? Math.abs(v - mean) / stdDev : 0
    return {
      index: i,
      value: v,
      zScore,
      isAnomaly: zScore > threshold,
    }
  })
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  formatMetric,
  formatLatencyDistribution,
  formatResourceUtilization,
  calculateHealthScore,
  getGradeFromScore,
  calculatePerformanceGrade,
  calculateBottleneckSeverity,
  aggregateBlockMetrics,
  calculateTrend,
  detectAnomalies,
}