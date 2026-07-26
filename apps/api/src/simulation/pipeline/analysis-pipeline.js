/**
 * Analysis Pipeline (P3)
 * 
 * Orchestrates all P3 analysis engines in a deterministic, composable pipeline.
 * Each engine runs independently and produces structured results.
 * 
 * Pipeline order:
 * 1. Reliability Engine (depends on simulation results + validation)
 * 2. Scalability Engine (depends on simulation results)
 * 3. Cost Engine (depends on simulation results + provider snapshot)
 * 4. Security Engine (depends on architecture snapshot)
 * 5. Explainability Engine (depends on all engine results)
 * 6. Confidence Engine (depends on all results + validation)
 */

import { analyzeReliability } from '../engines/reliability/reliability-engine.js'
import { analyzeScalability } from '../engines/capacity/scalability-engine.js'
import { analyzeCosts } from '../engines/cost/cost-engine.js'
import { analyzeSecurity } from '../engines/security/security-engine.js'
import { buildExplainability } from '../engines/explainability/explainability-engine.js'
import { calculateConfidence } from '../engines/explainability/confidence-engine.js'
import { buildDefaultSnapshot } from '../providers/registry.js'

// ============================================================================
// PIPELINE CONFIGURATION
// ============================================================================

const DEFAULT_PIPELINE_CONFIG = Object.freeze({
  // Engine enablement
  engines: {
    reliability: true,
    scalability: true,
    cost: true,
    security: true,
    explainability: true,
    confidence: true,
  },
  // Engine-specific config overrides
  engineConfig: {},
  // Provider snapshot (null = use default)
  providerSnapshot: null,
  // Explainability granularity
  explainabilityGranularity: 'detailed',
})

// ============================================================================
// MAIN PIPELINE
// ============================================================================

/**
 * Run the full P3 analysis pipeline.
 * 
 * @param {Object} simulationResult — Full simulation result from P2 engine
 * @param {Object} validationResult — Topology validation results from P1
 * @param {Object} options — Pipeline options
 * @returns {AnalysisPipelineResult} All analysis results
 */
export function runAnalysisPipeline(simulationResult, validationResult, options = {}) {
  const config = { ...DEFAULT_PIPELINE_CONFIG, ...options }
  const startTime = Date.now()

  const results = {
    reliability: null,
    scalability: null,
    cost: null,
    security: null,
    explainability: null,
    confidence: null,
  }

  const errors = []

  // 1. Reliability Analysis
  if (config.engines.reliability) {
    try {
      results.reliability = analyzeReliability(simulationResult, validationResult, {
        config: config.engineConfig.reliability,
      })
    } catch (err) {
      errors.push({ engine: 'reliability', error: err.message, stack: err.stack })
      results.reliability = createErrorResult('reliability', err)
    }
  }

  // 2. Scalability Analysis
  if (config.engines.scalability) {
    try {
      results.scalability = analyzeScalability(simulationResult, {
        config: config.engineConfig.scalability,
      })
    } catch (err) {
      errors.push({ engine: 'scalability', error: err.message, stack: err.stack })
      results.scalability = createErrorResult('scalability', err)
    }
  }

  // 3. Cost Analysis
  if (config.engines.cost) {
    try {
      const providerSnapshot = config.providerSnapshot || buildDefaultSnapshot()
      results.cost = analyzeCosts(simulationResult, {
        providerSnapshot,
        config: config.engineConfig.cost,
      })
    } catch (err) {
      errors.push({ engine: 'cost', error: err.message, stack: err.stack })
      results.cost = createErrorResult('cost', err)
    }
  }

  // 4. Security Analysis
  if (config.engines.security) {
    try {
      results.security = analyzeSecurity(simulationResult.inputSnapshot, simulationResult, {
        config: config.engineConfig.security,
      })
    } catch (err) {
      errors.push({ engine: 'security', error: err.message, stack: err.stack })
      results.security = createErrorResult('security', err)
    }
  }

  // 5. Explainability Analysis (depends on all above)
  if (config.engines.explainability) {
    try {
      results.explainability = buildExplainability(simulationResult, results, {
        granularity: config.explainabilityGranularity,
        config: config.engineConfig.explainability,
      })
    } catch (err) {
      errors.push({ engine: 'explainability', error: err.message, stack: err.stack })
      results.explainability = createErrorResult('explainability', err)
    }
  }

  // 6. Confidence Analysis (depends on all above)
  if (config.engines.confidence) {
    try {
      results.confidence = calculateConfidence(simulationResult, validationResult, results, {
        config: config.engineConfig.confidence,
      })
    } catch (err) {
      errors.push({ engine: 'confidence', error: err.message, stack: err.stack })
      results.confidence = createErrorResult('confidence', err)
    }
  }

  const durationMs = Date.now() - startTime

  return {
    results,
    metadata: {
      pipelineVersion: '3.0.0',
      executedAt: new Date().toISOString(),
      durationMs,
      enginesRun: Object.entries(config.engines)
        .filter(([, enabled]) => enabled)
        .map(([name]) => name),
      errors: errors.length > 0 ? errors : undefined,
    },
  }
}

// ============================================================================
// PARTIAL PIPELINE (for specific engines only)
// ============================================================================

/**
 * Run only specified engines. Useful for incremental updates or testing.
 */
export function runPartialPipeline(simulationResult, validationResult, engineNames, options = {}) {
  const engineConfig = {}
  for (const name of engineNames) {
    engineConfig[name] = true
  }

  return runAnalysisPipeline(simulationResult, validationResult, {
    ...options,
    engines: engineConfig,
  })
}

// ============================================================================
// HELPERS
// ============================================================================

function createErrorResult(engineName, error) {
  return {
    error: true,
    engine: engineName,
    errorMessage: error.message,
    errorStack: error.stack,
    // Provide minimal fallback data so report generation doesn't crash
    reliabilityScore: engineName === 'reliability' ? 0 : undefined,
    scalabilityScore: engineName === 'scalability' ? 0 : undefined,
    currentMonthlyCost: engineName === 'cost' ? 0 : undefined,
    securityScore: engineName === 'security' ? 0 : undefined,
    overallConfidence: engineName === 'confidence' ? 0 : undefined,
  }
}