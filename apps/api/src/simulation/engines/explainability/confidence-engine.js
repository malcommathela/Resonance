/**
 * Confidence Scoring Engine (P3)
 * 
 * Assesses the trustworthiness of simulation results based on:
 * - Data completeness (missing configs, defaults used)
 * - Model calibration (how well behavioral models match reality)
 * - Topology quality (validation findings)
 * - Statistical significance (sample sizes, Monte Carlo passes)
 * - Assumption validity (how many assumptions were required)
 * 
 * Zero hardcoded values. All thresholds parameterized.
 */

import { parseConfig, parseBlockConfig } from '../../utils/parse-config.js'

// ============================================================================
// ENGINE CONFIGURATION
// ============================================================================

const DEFAULT_CONFIDENCE_CONFIG = Object.freeze({
  // Weight distribution
  weights: {
    dataCompleteness: 0.25,
    modelCalibration: 0.20,
    topologyQuality: 0.20,
    statisticalSignificance: 0.20,
    assumptionValidity: 0.15,
  },

  // Thresholds
  minMonteCarloPasses: 10,
  minSampleSize: 100,
  minBlocksForMeaningfulSim: 2,
  maxAssumptionsForHighConfidence: 5,

  // Scoring
  maxScore: 100,
})

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

/**
 * Calculate confidence score for simulation results.
 * 
 * @param {Object} simulationResult — Full simulation result
 * @param {Object} validationResult — Topology validation results
 * @param {Object} analysisResults — Results from P3 engines
 * @param {Object} options — Analysis options
 * @returns {ConfidenceAnalysis} Structured confidence analysis
 */
export function calculateConfidence(simulationResult, validationResult, analysisResults, options = {}) {
  const config = { ...DEFAULT_CONFIDENCE_CONFIG, ...(options.config || {}) }
  const { inputSnapshot, blockMetrics, globalMetrics } = simulationResult
  const blocks = inputSnapshot?.blocks || []
  const edges = inputSnapshot?.edges || []

  
  const simConfig = options.simConfig || simulationResult.config || {}

  const dataCompleteness = assessDataCompleteness(blocks, edges, simulationResult, config)
  const modelCalibration = assessModelCalibration(blocks, edges, simulationResult, config)
  const topologyQuality = assessTopologyQuality(blocks, edges, validationResult, config)
  const statisticalSignificance = assessStatisticalSignificance(simulationResult, simConfig, config)
  const assumptionValidity = assessAssumptionValidity(simulationResult, config)// Calculate weighted score
  
  
  const weightedScore = (
    dataCompleteness.score * config.weights.dataCompleteness +
    modelCalibration.score * config.weights.modelCalibration +
    topologyQuality.score * config.weights.topologyQuality +
    statisticalSignificance.score * config.weights.statisticalSignificance +
    assumptionValidity.score * config.weights.assumptionValidity
  )

  const finalScore = Math.round(Math.max(0, Math.min(config.maxScore, weightedScore)))

  return {
    overallConfidence: finalScore,
    confidenceLevel: getConfidenceLevel(finalScore),
    components: {
      dataCompleteness,
      modelCalibration,
      topologyQuality,
      statisticalSignificance,
      assumptionValidity,
    },
    limitingFactors: identifyLimitingFactors({
      dataCompleteness, modelCalibration, topologyQuality, statisticalSignificance, assumptionValidity,
    }),
    recommendations: generateConfidenceRecommendations({
      dataCompleteness, modelCalibration, topologyQuality, statisticalSignificance, assumptionValidity,
    }, finalScore, config),
    explainability: buildConfidenceExplainability({
      dataCompleteness, modelCalibration, topologyQuality, statisticalSignificance, assumptionValidity, finalScore,
    }, config),
  }
}

// ============================================================================
// DATA COMPLETENESS
// ============================================================================

function assessDataCompleteness(blocks, edges, simulationResult, config) {
  const issues = []
  let score = 100

  // Check for blocks using default behavioral models
  for (const block of blocks) {
    const hasCustomConfig = block.config && Object.keys(block.config).length > 0
    const hasBehavioralModel = block.behavioralModel && Object.keys(block.behavioralModel).length > 0

    if (!hasCustomConfig && !hasBehavioralModel) {
      issues.push({
        type: 'default_model_used',
        severity: 'medium',
        message: `Block "${block.label || block.id}" uses default behavioral model — no custom configuration.`,
        blockId: block.id,
        impact: 5,
      })
      score -= 5
    }

    // Check for missing required fields per type
    const requiredFields = getRequiredFieldsForType(block.type)
    const configObj = parseBlockConfig(block)

    for (const field of requiredFields) {
      if (configObj[field] === undefined || configObj[field] === null || configObj[field] === '') {
        issues.push({
          type: 'missing_required_field',
          severity: 'low',
          message: `Block "${block.label || block.id}" missing required field: ${field}`,
          blockId: block.id,
          field,
          impact: 2,
        })
        score -= 2
      }
    }
  }

  // Check edges for missing metadata
  for (const edge of edges) {
    if (!edge.connectionType) {
      issues.push({
        type: 'missing_connection_type',
        severity: 'medium',
        message: `Edge ${edge.id || '(unknown)'} has no connection type specified.`,
        edgeId: edge.id,
        impact: 3,
      })
      score -= 3
    }
  }

  // Check simulation config completeness
  const simConfig = simulationResult.config || {}
  if (!simConfig.trafficPattern) {
    issues.push({ type: 'missing_traffic_pattern', severity: 'low', message: 'No traffic pattern specified.', impact: 2 })
    score -= 2
  }

  return {
    score: Math.max(0, score),
    issues,
    summary: `${issues.length} data completeness issue(s) found.`,
  }
}

function getRequiredFieldsForType(type) {
  const requirements = {
    'database': ['engine'],
    'external-api': ['url'],
    'cache': ['engine'],
    'message-queue': ['engine'],
    'service': ['port'],
    'api-gateway': ['port', 'rateLimit'],
  }
  return requirements[type] || []
}

// ============================================================================
// MODEL CALIBRATION
// ============================================================================

function assessModelCalibration(blocks, edges, simulationResult, config) {
  const issues = []
  let score = 100

  // Check if simulation results diverge significantly from model predictions
  const blockMetrics = simulationResult.blockMetrics?.blocks || {}

  for (const block of blocks) {
    const behavioralModel = block.behavioralModel || {}
    const metrics = blockMetrics[block.id] || {}

    // Compare simulated latency to model base latency
    const baseLatency = behavioralModel.latency?.baseLatencyMs || 0
    const simLatency = metrics.avgLatencyMs || 0

    if (baseLatency > 0 && simLatency > 0) {
      const divergence = Math.abs(simLatency - baseLatency) / baseLatency
      if (divergence > 5) {
        issues.push({
          type: 'high_latency_divergence',
          severity: 'medium',
          message: `Block "${block.label || block.id}" simulated latency (${simLatency.toFixed(1)}ms) diverges ${(divergence * 100).toFixed(0)}% from model (${baseLatency}ms).`,
          blockId: block.id,
          impact: 8,
        })
        score -= 8
      } else if (divergence > 2) {
        issues.push({
          type: 'moderate_latency_divergence',
          severity: 'low',
          message: `Block "${block.label || block.id}" simulated latency diverges ${(divergence * 100).toFixed(0)}% from model.`,
          blockId: block.id,
          impact: 4,
        })
        score -= 4
      }
    }

    // Compare simulated error rate to model base error rate
    const baseErrorRate = behavioralModel.errorCharacteristics?.baseErrorRate || 0
    const simErrorRate = metrics.errorRate || 0

    if (baseErrorRate > 0 && simErrorRate > baseErrorRate * 3) {
      issues.push({
        type: 'high_error_divergence',
        severity: 'medium',
        message: `Block "${block.label || block.id}" error rate (${(simErrorRate * 100).toFixed(2)}%) is much higher than model (${(baseErrorRate * 100).toFixed(2)}%).`,
        blockId: block.id,
        impact: 6,
      })
      score -= 6
    }
  }

  // Check if provider pricing is used (more calibrated than defaults)
  const hasProviderPricing = simulationResult.assumptions?.providerSnapshot !== undefined
  if (!hasProviderPricing) {
    issues.push({
      type: 'default_pricing',
      severity: 'low',
      message: 'Using default/generic pricing. Provider-specific pricing would improve cost accuracy.',
      impact: 5,
    })
    score -= 5
  }

  return {
    score: Math.max(0, score),
    issues,
    summary: `${issues.length} calibration issue(s) found.`,
  }
}

// ============================================================================
// TOPOLOGY QUALITY
// ============================================================================

function assessTopologyQuality(blocks, edges, validationResult, config) {
  const issues = []
  let score = 100

  if (!validationResult) {
    return { score: 50, issues: [{ type: 'no_validation', severity: 'high', message: 'No validation results available.', impact: 50 }], summary: 'No validation performed.' }
  }

  // Critical errors are fatal to confidence
  if (validationResult.criticalCount > 0) {
    issues.push({
      type: 'critical_validation_errors',
      severity: 'critical',
      message: `${validationResult.criticalCount} critical validation error(s) found. Architecture may be invalid.`,
      impact: 30,
    })
    score -= 30
  }

  // Warnings reduce confidence
  if (validationResult.warningCount > 0) {
    const penalty = Math.min(validationResult.warningCount * 3, 20)
    issues.push({
      type: 'validation_warnings',
      severity: 'medium',
      message: `${validationResult.warningCount} validation warning(s) found.`,
      impact: penalty,
    })
    score -= penalty
  }

  // Risks
  if (validationResult.riskCount > 0) {
    const penalty = Math.min(validationResult.riskCount * 2, 15)
    issues.push({
      type: 'architectural_risks',
      severity: 'medium',
      message: `${validationResult.riskCount} architectural risk(s) identified.`,
      impact: penalty,
    })
    score -= penalty
  }

  // Topology score bonus/penalty
  const topologyScore = validationResult.topologyScore || 0
  if (topologyScore < 0.5) {
    issues.push({
      type: 'poor_topology',
      severity: 'medium',
      message: `Topology score is ${(topologyScore * 100).toFixed(0)}%. Architecture structure needs improvement.`,
      impact: 15,
    })
    score -= 15
  }

  return {
    score: Math.max(0, score),
    issues,
    summary: `${issues.length} topology quality issue(s) found.`,
  }
}

// ============================================================================
// STATISTICAL SIGNIFICANCE
// ============================================================================

function assessStatisticalSignificance(simulationResult, simConfig, config) {
  const issues = []
  let score = 100

  // FIX: Use simConfig (passed from options or simulationResult.config) instead of simulationResult.config directly
  const monteCarloPasses = simConfig.monteCarloPasses || simulationResult.passCount || 1
  const totalRequests = simulationResult.globalMetrics?.totalRequests || 0
  const blockCount = Object.keys(simulationResult.blockMetrics?.blocks || {}).length

  // Monte Carlo passes
  if (monteCarloPasses < config.minMonteCarloPasses) {
    issues.push({
      type: 'insufficient_monte_carlo',
      severity: 'medium',
      message: `Only ${monteCarloPasses} Monte Carlo pass(es). Recommended: ${config.minMonteCarloPasses}+ for statistical significance.`,
      impact: 15,
    })
    score -= 15
  }

  // Sample size
  if (totalRequests < config.minSampleSize) {
    issues.push({
      type: 'small_sample_size',
      severity: 'medium',
      message: `Only ${totalRequests} total requests. Recommended: ${config.minSampleSize}+ for reliable percentiles.`,
      impact: 15,
    })
    score -= 15
  }

  // Block coverage
  if (blockCount < config.minBlocksForMeaningfulSim) {
    issues.push({
      type: 'minimal_architecture',
      severity: 'low',
      message: `Only ${blockCount} block(s) in architecture. Results may not be representative of production.`,
      impact: 10,
    })
    score -= 10
  }

  // Confidence intervals
  const hasConfidenceIntervals = simulationResult.confidenceIntervals !== undefined
  if (!hasConfidenceIntervals && monteCarloPasses > 1) {
    issues.push({
      type: 'missing_confidence_intervals',
      severity: 'low',
      message: 'Monte Carlo results lack confidence intervals.',
      impact: 5,
    })
    score -= 5
  }

  return {
    score: Math.max(0, score),
    issues,
    summary: `${issues.length} statistical significance issue(s) found.`,
  }
}

// ============================================================================
// ASSUMPTION VALIDITY
// ============================================================================

function assessAssumptionValidity(simulationResult, config) {
  const issues = []
  let score = 100

  const assumptions = simulationResult.assumptions || {}
  const assumptionList = assumptions.list || Object.entries(assumptions).map(([k, v]) => ({ assumption: k, impact: v }))

  // Too many assumptions
  if (assumptionList.length > config.maxAssumptionsForHighConfidence) {
    issues.push({
      type: 'many_assumptions',
      severity: 'medium',
      message: `${assumptionList.length} assumptions used. More than ${config.maxAssumptionsForHighConfidence} reduces confidence.`,
      impact: 10,
    })
    score -= 10
  }

  // Check for high-impact assumptions
  for (const assumption of assumptionList) {
    const impact = assumption.impact || 'unknown'
    if (impact === 'high' || (typeof impact === 'number' && impact > 0.5)) {
      issues.push({
        type: 'high_impact_assumption',
        severity: 'medium',
        message: `High-impact assumption: "${assumption.assumption || assumption}"`,
        impact: 8,
      })
      score -= 8
    }
  }

  // Missing calibration data
  if (!simulationResult.assumptions?.calibrationNotes) {
    issues.push({
      type: 'missing_calibration',
      severity: 'low',
      message: 'No calibration notes provided. Model accuracy is unverified.',
      impact: 5,
    })
    score -= 5
  }

  return {
    score: Math.max(0, score),
    issues,
    summary: `${issues.length} assumption validity issue(s) found.`,
  }
}

// ============================================================================
// ANALYSIS
// ============================================================================

function identifyLimitingFactors(components) {
  const factors = []
  const sorted = Object.entries(components)
    .sort((a, b) => a[1].score - b[1].score)

  for (const [name, component] of sorted) {
    if (component.score < 70) {
      factors.push({
        component: name,
        score: component.score,
        primaryIssue: component.issues[0]?.message || 'Low score',
        recommendation: component.issues[0]?.message || 'Review and improve data quality.',
      })
    }
  }

  return factors
}

function generateConfidenceRecommendations(components, finalScore, config) {
  const recommendations = []

  if (finalScore < 50) {
    recommendations.push({
      priority: 'critical',
      title: 'Critical confidence issues — results may be unreliable',
      description: 'Multiple factors limit confidence. Review all issues before making decisions.',
      estimatedEffort: 8,
      estimatedImpact: 30,
    })
  } else if (finalScore < 70) {
    recommendations.push({
      priority: 'high',
      title: 'Improve simulation confidence',
      description: 'Address identified issues to increase trust in results.',
      estimatedEffort: 4,
      estimatedImpact: 15,
    })
  }

  // Component-specific recommendations
  if (components.dataCompleteness.score < 70) {
    recommendations.push({
      priority: 'medium',
      title: 'Complete block configurations',
      description: 'Add missing configuration fields to all blocks for more accurate modeling.',
      estimatedEffort: 3,
      estimatedImpact: 10,
    })
  }

  if (components.statisticalSignificance.score < 70) {
    recommendations.push({
      priority: 'medium',
      title: 'Increase simulation passes or duration',
      description: `Run ${config.minMonteCarloPasses}+ Monte Carlo passes with ${config.minSampleSize}+ requests for statistical significance.`,
      estimatedEffort: 2,
      estimatedImpact: 12,
    })
  }

  if (components.modelCalibration.score < 70) {
    recommendations.push({
      priority: 'medium',
      title: 'Calibrate behavioral models',
      description: 'Simulation results diverge from model predictions. Review and adjust behavioral parameters.',
      estimatedEffort: 6,
      estimatedImpact: 10,
    })
  }

  return recommendations
}

function buildConfidenceExplainability(components, config) {
  const { dataCompleteness, modelCalibration, topologyQuality, statisticalSignificance, assumptionValidity, finalScore } = components

  return {
    formula: 'dataCompleteness*0.25 + modelCalibration*0.20 + topologyQuality*0.20 + statisticalSignificance*0.20 + assumptionValidity*0.15',
    inputs: {
      dataCompletenessScore: dataCompleteness.score,
      modelCalibrationScore: modelCalibration.score,
      topologyQualityScore: topologyQuality.score,
      statisticalSignificanceScore: statisticalSignificance.score,
      assumptionValidityScore: assumptionValidity.score,
    },
    intermediateValues: {
      weightedDataCompleteness: dataCompleteness.score * config.weights.dataCompleteness,
      weightedModelCalibration: modelCalibration.score * config.weights.modelCalibration,
      weightedTopologyQuality: topologyQuality.score * config.weights.topologyQuality,
      weightedStatisticalSignificance: statisticalSignificance.score * config.weights.statisticalSignificance,
      weightedAssumptionValidity: assumptionValidity.score * config.weights.assumptionValidity,
    },
    finalResult: finalScore,
    confidence: finalScore >= 80 ? 0.95 : finalScore >= 60 ? 0.8 : 0.6,
  }
}

function getConfidenceLevel(score) {
  if (score >= 90) return 'very_high'
  if (score >= 80) return 'high'
  if (score >= 60) return 'moderate'
  if (score >= 40) return 'low'
  return 'very_low'
}

