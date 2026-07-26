/**
 * Simulation Renderer (Client-Side)
 *
 * Utilities for rendering simulation results in the UI:
 * - Color coding for severity levels
 * - Chart data preparation (for recharts, chart.js, etc.)
 * - Status badge generation
 * - Progress visualization helpers
 *
 * Batch 4 (Code Quality):
 *   - getScoreColor handles null (no longer renders missing scores as red)
 *   - prepareExecutiveSummary uses ?? instead of || 0 (no fabricated failures)
 */

// ============================================================================
// SEVERITY COLORS & BADGES — Tokenized for dark mode
// ============================================================================

export const SEVERITY_COLORS = {
  critical: {
    bg: 'rgb(var(--error-rgb))',
    text: 'rgb(var(--text-primary-rgb))',
    border: 'rgb(var(--error-rgb))',
    light: 'rgb(var(--error-rgb) / 0.1)'
  },
  high: {
    bg: 'rgb(var(--warning-rgb))',
    text: 'rgb(var(--text-primary-rgb))',
    border: 'rgb(var(--warning-rgb))',
    light: 'rgb(var(--warning-rgb) / 0.1)'
  },
  medium: {
    bg: 'rgb(var(--warning-rgb))',
    text: 'rgb(var(--text-primary-rgb))',
    border: 'rgb(var(--warning-rgb))',
    light: 'rgb(var(--warning-rgb) / 0.1)'
  },
  low: {
    bg: 'rgb(var(--text-muted-rgb))',
    text: 'rgb(var(--text-primary-rgb))',
    border: 'rgb(var(--text-muted-rgb))',
    light: 'rgb(var(--text-muted-rgb) / 0.1)'
  },
  info: {
    bg: 'rgb(var(--text-muted-rgb))',
    text: 'rgb(var(--text-primary-rgb))',
    border: 'rgb(var(--text-muted-rgb))',
    light: 'rgb(var(--text-muted-rgb) / 0.1)'
  },
  success: {
    bg: 'rgb(var(--success-rgb))',
    text: 'rgb(var(--text-primary-rgb))',
    border: 'rgb(var(--success-rgb))',
    light: 'rgb(var(--success-rgb) / 0.1)'
  },
  warning: {
    bg: 'rgb(var(--warning-rgb))',
    text: 'rgb(var(--text-primary-rgb))',
    border: 'rgb(var(--warning-rgb))',
    light: 'rgb(var(--warning-rgb) / 0.1)'
  },
}

export const STATUS_COLORS = {
  running: { bg: 'rgb(var(--text-muted-rgb))', text: 'rgb(var(--text-primary-rgb))', pulse: true },
  completed: { bg: 'rgb(var(--success-rgb))', text: 'rgb(var(--text-primary-rgb))', pulse: false },
  stopped: { bg: 'rgb(var(--text-muted-rgb))', text: 'rgb(var(--text-primary-rgb))', pulse: false },
  failed: { bg: 'rgb(var(--error-rgb))', text: 'rgb(var(--text-primary-rgb))', pulse: false },
  validated: { bg: 'rgb(var(--accent-rgb))', text: 'rgb(var(--neutral-rgb))', pulse: true },
  pending: { bg: 'rgb(var(--warning-rgb))', text: 'rgb(var(--text-primary-rgb))', pulse: true },
}

/**
 * Get color config for a severity level.
 */
export function getSeverityColor(severity) {
  return SEVERITY_COLORS[severity?.toLowerCase()] || SEVERITY_COLORS.info
}

/**
 * Get color config for a simulation status.
 */
export function getStatusColor(status) {
  return STATUS_COLORS[status?.toLowerCase()] || STATUS_COLORS.info
}

// ============================================================================
// CHART DATA PREPARATION
// ============================================================================

/**
 * Prepare latency distribution data for a histogram chart.
 */
export function prepareLatencyHistogram(blockMetrics, options = {}) {
  if (!blockMetrics) return []

  const { bins = 20, blockIds = null } = options
  const entries = blockIds
    ? blockIds.map(id => blockMetrics[id]).filter(Boolean)
    : Object.values(blockMetrics)

  if (entries.length === 0) return []

  const allLatencies = []
  for (const m of entries) {
    if (m.latencySamples && m.latencySamples.length > 0) {
      allLatencies.push(...m.latencySamples)
    } else {
      allLatencies.push(m.minLatencyMs || 0, m.avgLatencyMs || 0, m.maxLatencyMs || 0)
    }
  }

  if (allLatencies.length === 0) return []

  const min = Math.min(...allLatencies)
  const max = Math.max(...allLatencies)
  const range = max - min || 1
  const binWidth = range / bins

  const histogram = Array(bins).fill(0).map((_, i) => ({
    binStart: min + i * binWidth,
    binEnd: min + (i + 1) * binWidth,
    count: 0,
    label: `${(min + i * binWidth).toFixed(0)}-${(min + (i + 1) * binWidth).toFixed(0)}ms`,
  }))

  for (const lat of allLatencies) {
    const binIdx = Math.min(Math.floor((lat - min) / binWidth), bins - 1)
    histogram[binIdx].count++
  }

  return histogram
}

/**
 * Prepare time-series data for a traffic/throughput chart.
 */
export function prepareTrafficTimeSeries(trafficCurve, blockMetrics, options = {}) {
  if (!trafficCurve) return []

  const { metric = 'rps', aggregate = 'sum' } = options

  return trafficCurve.map(point => ({
    time: point.time,
    targetRps: point.rps,
    actualRps: aggregate === 'sum'
      ? Object.values(blockMetrics || {}).reduce((sum, m) => sum + (m.throughputRps || 0), 0)
      : Object.values(blockMetrics || {})[0]?.throughputRps || 0,
  }))
}

/**
 * Prepare block comparison data for a bar chart.
 */
export function prepareBlockComparison(blockMetrics, metric = 'avgLatencyMs', options = {}) {
  if (!blockMetrics) return []

  const { topN = 10, sort = 'desc' } = options

  const entries = Object.entries(blockMetrics)
    .map(([id, m]) => ({
      id,
      label: m.label || id,
      value: m[metric] || 0,
      ...m,
    }))
    .sort((a, b) => sort === 'desc' ? b.value - a.value : a.value - b.value)
    .slice(0, topN)

  return entries
}

/**
 * Prepare resource utilization data for a stacked bar chart.
 */
export function prepareResourceUtilization(blockMetrics, options = {}) {
  if (!blockMetrics) return []

  const entries = Object.entries(blockMetrics).map(([id, m]) => {
    const r = m.resources || {}
    return {
      id,
      label: m.label || id,
      cpu: r.cpuPercent || 0,
      memory: r.memoryPercent || 0,
      threads: r.threadPoolUtilization || 0,
      connections: r.connectionPoolUtilization || 0,
      utilization: m.utilization || 0,
    }
  })

  return entries
}

/**
 * Prepare percentile data for a percentile chart.
 * D2: Prefer global end-to-end percentiles — averaging block P99s is statistically meaningless
 */
export function preparePercentiles(blockMetrics, globalMetrics = null, blockId = null) {
  if (globalMetrics) {
    const percentiles = [
      { percentile: 'P50', value: globalMetrics.p50LatencyMs || globalMetrics.avgLatencyMs, label: 'Median' },
      { percentile: 'P75', value: globalMetrics.p75LatencyMs, label: '75th' },
      { percentile: 'P90', value: globalMetrics.p90LatencyMs, label: '90th' },
      { percentile: 'P95', value: globalMetrics.p95LatencyMs, label: '95th' },
      { percentile: 'P99', value: globalMetrics.p99LatencyMs, label: '99th' },
      { percentile: 'P99.9', value: globalMetrics.p999LatencyMs || globalMetrics.p99LatencyMs, label: '99.9th' },
    ].filter(p => p.value != null && p.value > 0)
    return percentiles
  }

  // Fallback: block-level averages (only used when no global data available)
  if (!blockMetrics) return []

  const entries = blockId
    ? [blockMetrics[blockId]].filter(Boolean)
    : Object.values(blockMetrics)

  if (entries.length === 0) return []

  const avgPercentile = (key) => {
    const values = entries.map(m => m[key] || 0).filter(v => v > 0)
    return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0
  }

  return [
    { percentile: 'P50', value: avgPercentile('p50LatencyMs'), label: 'Median' },
    { percentile: 'P75', value: avgPercentile('p75LatencyMs'), label: '75th' },
    { percentile: 'P90', value: avgPercentile('p90LatencyMs'), label: '90th' },
    { percentile: 'P95', value: avgPercentile('p95LatencyMs'), label: '95th' },
    { percentile: 'P99', value: avgPercentile('p99LatencyMs'), label: '99th' },
    { percentile: 'P99.9', value: avgPercentile('p999LatencyMs'), label: '99.9th' },
  ].filter(p => p.value > 0)
}

// ============================================================================
// PROGRESS & STATUS RENDERING — Tokenized
// ============================================================================

/**
 * Generate a progress bar style object based on percentage.
 */
export function getProgressStyle(progress, options = {}) {
  const { height = 4, color = null } = options

  let barColor = color
  if (!barColor) {
    if (progress >= 100) barColor = 'rgb(var(--success-rgb))'
    else if (progress >= 75) barColor = 'rgb(var(--text-muted-rgb))'
    else if (progress >= 50) barColor = 'rgb(var(--accent-rgb))'
    else if (progress >= 25) barColor = 'rgb(var(--warning-rgb))'
    else barColor = 'rgb(var(--error-rgb))'
  }

  return {
    container: {
      width: '100%',
      height: `${height}px`,
      backgroundColor: 'rgb(var(--bg-tertiary-rgb))',
      borderRadius: `${height / 2}px`,
      overflow: 'hidden',
    },
    bar: {
      width: `${Math.min(progress, 100)}%`,
      height: '100%',
      backgroundColor: barColor,
      borderRadius: `${height / 2}px`,
      transition: 'width 0.3s ease',
    },
  }
}

/**
 * Generate a utilization gauge style.
 */
export function getUtilizationGaugeStyle(utilization, options = {}) {
  const { size = 40, strokeWidth = 4 } = options
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - Math.min(utilization, 1))

  let color = 'rgb(var(--success-rgb))'
  if (utilization > 0.9) color = 'rgb(var(--error-rgb))'
  else if (utilization > 0.7) color = 'rgb(var(--warning-rgb))'
  else if (utilization > 0.5) color = 'rgb(var(--warning-rgb))'

  return {
    size,
    strokeWidth,
    radius,
    circumference,
    offset,
    color,
    percentage: Math.round(utilization * 100),
  }
}

// ============================================================================
// REPORT SECTION RENDERING — Tokenized score colors
// ============================================================================

/**
 * Batch 4: null-aware — a missing score renders as muted gray, never red.
 */
function getScoreColor(score) {
  if (score == null || isNaN(score)) return '#6b7280'
  if (score >= 90) return 'rgb(var(--success-rgb))'
  if (score >= 80) return 'rgb(var(--success-rgb))'
  if (score >= 70) return 'rgb(var(--warning-rgb))'
  if (score >= 60) return 'rgb(var(--warning-rgb))'
  if (score >= 50) return 'rgb(var(--warning-rgb))'
  return 'rgb(var(--error-rgb))'
}

/**
 * Prepare report data for the executive summary view.
 *
 * Batch 4: Uses ?? null instead of || 0 so missing scores are omitted
 * rather than rendered as fabricated 0/failure grades.
 */
export function prepareExecutiveSummary(report) {
  if (!report) return null

  const exec = report.executiveSummary || {}
  const scores = [
    { label: 'Architecture', value: exec.architectureScore ?? null, color: getScoreColor(exec.architectureScore) },
    { label: 'Reliability', value: exec.reliabilityScore ?? null, color: getScoreColor(exec.reliabilityScore) },
    { label: 'Performance', value: exec.performanceScore ?? null, color: getScoreColor(exec.performanceScore) },
    { label: 'Cost', value: exec.costScore ?? null, color: getScoreColor(exec.costScore) },
    { label: 'Security', value: exec.securityScore ?? null, color: getScoreColor(exec.securityScore) },
    { label: 'Confidence', value: exec.confidenceScore ?? null, color: getScoreColor(exec.confidenceScore) },
  ].filter(s => s.value !== null && s.value !== undefined)

  return {
    overallScore: report.overallScore ?? null,
    summary: exec.summary || '',
    keyFinding: exec.keyFinding || '',
    keyRecommendation: exec.keyRecommendation || '',
    scores,
    generatedAt: report.generatedAt,
    version: report.version,
  }
}

/**
 * Prepare action plan data for rendering.
 */
export function prepareActionPlan(report) {
  if (!report?.actionPlan) return null

  const { critical = [], high = [], medium = [], low = [] } = report.actionPlan

  return [
    ...critical.map(a => ({ ...a, priority: 'critical', priorityColor: SEVERITY_COLORS.critical })),
    ...high.map(a => ({ ...a, priority: 'high', priorityColor: SEVERITY_COLORS.high })),
    ...medium.map(a => ({ ...a, priority: 'medium', priorityColor: SEVERITY_COLORS.medium })),
    ...low.map(a => ({ ...a, priority: 'low', priorityColor: SEVERITY_COLORS.low })),
  ]
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  SEVERITY_COLORS,
  STATUS_COLORS,
  getSeverityColor,
  getStatusColor,
  prepareLatencyHistogram,
  prepareTrafficTimeSeries,
  prepareBlockComparison,
  prepareResourceUtilization,
  preparePercentiles,
  getProgressStyle,
  getUtilizationGaugeStyle,
  prepareExecutiveSummary,
  prepareActionPlan,
}