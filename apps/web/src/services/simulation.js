/**
 * Simulation Service (Client-Side)
 *
 * Provides utilities for:
 * - Fetching and comparing simulation reports
 * - Calculating derived metrics from simulation results
 * - Formatting simulation data for display
 * - Managing simulation history and caching
 */

import { api } from './api.js'

// ============================================================================
// REPORT NORMALIZATION
// ============================================================================

/**
 * Parse stringified JSON fields in a report record.
 * Some legacy/migrated records store nested analysis fields as JSON strings
 * rather than objects. This ensures the UI always receives objects.
 */
function normalizeReport(report) {
  if (!report) return null

  const parseIfString = (val) => {
    if (typeof val === 'string') {
      try {
        return JSON.parse(val)
      } catch {
        return null
      }
    }
    return val
  }

  return {
    ...report,
    executiveSummary: parseIfString(report.executiveSummary),
    topologyAnalysis: parseIfString(report.topologyAnalysis),
    reliabilityAnalysis: parseIfString(report.reliabilityAnalysis),
    actionPlan: parseIfString(report.actionPlan),
    performanceAnalysis: parseIfString(report.performanceAnalysis),
    scalabilityAnalysis: parseIfString(report.scalabilityAnalysis),
    costAnalysis: parseIfString(report.costAnalysis),
    securityAnalysis: parseIfString(report.securityAnalysis),
    aiInsights: parseIfString(report.aiInsights),
    failureScenarios: parseIfString(report.failureScenarios),
    metadata: parseIfString(report.metadata),
  }
}

// ============================================================================
// REPORT FETCHING
// ============================================================================

/**
 * Fetch a simulation report by simulation ID.
 */
export async function fetchSimulationReport(simulationId) {
  const report = await api.getReportBySimulationId(simulationId)
  return normalizeReport(report)
}

/**
 * Fetch all reports for a design.
 */
export async function fetchDesignReports(designId) {
  const reports = await api.getDesignReports(designId)
  return (reports || []).map(normalizeReport)
}

/**
 * Compare two simulation reports and return differences.
 */
export function compareReports(reportA, reportB) {
  if (!reportA || !reportB) return null

  const differences = {
    overallScore: reportB.overallScore - reportA.overallScore,
    architectureScore: (reportB.architectureScore || 0) - (reportA.architectureScore || 0),
    reliabilityScore: (reportB.reliabilityScore || 0) - (reportA.reliabilityScore || 0),
    performanceScore: (reportB.performanceScore || 0) - (reportA.performanceScore || 0),
    costScore: (reportB.costScore || 0) - (reportA.costScore || 0),
    securityScore: (reportB.securityScore || 0) - (reportA.securityScore || 0),
    latencyDelta: 0,
    throughputDelta: 0,
    errorRateDelta: 0,
  }

  const perfA = reportA.performanceAnalysis?.globalMetrics
  const perfB = reportB.performanceAnalysis?.globalMetrics

  if (perfA && perfB) {
    differences.latencyDelta = (perfB.avgLatencyMs || 0) - (perfA.avgLatencyMs || 0)
    differences.throughputDelta = (perfB.throughputRps || 0) - (perfA.throughputRps || 0)
    differences.errorRateDelta = (perfB.errorRate || 0) - (perfA.errorRate || 0)
  }

  differences.improved = differences.overallScore > 0
  differences.regressed = differences.overallScore < 0

  return differences
}

/**
 * Get the latest report for a design.
 */
export async function getLatestReport(designId) {
  const reports = await fetchDesignReports(designId)
  return reports[0] || null
}

// ============================================================================
// SIMULATION HISTORY
// ============================================================================

const REPORT_CACHE = new Map()
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Cache a report with TTL.
 */
export function cacheReport(reportId, report) {
  REPORT_CACHE.set(reportId, {
    data: report,
    timestamp: Date.now(),
  })
}

/**
 * Get cached report if not expired.
 */
export function getCachedReport(reportId) {
  const cached = REPORT_CACHE.get(reportId)
  if (!cached) return null
  if (Date.now() - cached.timestamp > CACHE_TTL_MS) {
    REPORT_CACHE.delete(reportId)
    return null
  }
  return normalizeReport(cached.data)
}

/**
 * Clear all cached reports.
 */
export function clearReportCache() {
  REPORT_CACHE.clear()
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  fetchSimulationReport,
  fetchDesignReports,
  compareReports,
  getLatestReport,
  cacheReport,
  getCachedReport,
  clearReportCache,
}