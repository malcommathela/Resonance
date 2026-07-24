/**
 * Simulation Validation Engine — Production Grade
 *
 * Validates architecture topology, block/edge properties, and simulation
 * configuration before any simulation run. Hard requirement: no simulation
 * executes until validation succeeds.
 *
 * Batch 4 (P6) — Property-aware validation. Every configurable property is
 * checked against strict rules with severity classification.
 */

import {
  getSupportedBlockTypes,
  getSupportedConnectionTypes,
} from '@resonance/shared/simulation-models'

import {
  TRAFFIC_PATTERNS as TRAFFIC_PATTERNS_MAP,
  normalizeTrafficPattern,
} from '@resonance/shared/traffic-models'

// ============================================================================
// SHARED CONSTANTS
// ============================================================================


const CONNECTION_TYPES = ['http', 'https', 'grpc', 'tcp', 'udp', 'websocket', 'kafka', 'database']
const TRAFFIC_PATTERNS = Object.keys(TRAFFIC_PATTERNS_MAP)

const SUPPORTED_BLOCK_TYPES = new Set(getSupportedBlockTypes())
const SUPPORTED_CONNECTION_TYPES = new Set(getSupportedConnectionTypes())

// ============================================================================
// VALIDATION CONSTANTS
// ============================================================================

const SEVERITY = {
  CRITICAL: 'critical',
  WARNING: 'warning',
  INFO: 'info',
  RISK: 'risk',
}

const FINDING_TYPES = {
  // Critical errors
  EMPTY_ARCHITECTURE: 'empty_architecture',
  MISSING_NODES: 'missing_nodes',
  BROKEN_EDGES: 'broken_edges',
  INVALID_REFERENCES: 'invalid_references',
  INVALID_CONFIG: 'invalid_config',
  NEGATIVE_CAPACITY: 'negative_capacity',
  NEGATIVE_LATENCY: 'negative_latency',
  IMPOSSIBLE_VALUE: 'impossible_value',
  UNSUPPORTED_PROTOCOL: 'unsupported_protocol',
  CONFIGURATION_CORRUPTION: 'configuration_corruption',
  DUPLICATE_NODE: 'duplicate_node',
  DUPLICATE_EDGE: 'duplicate_edge',

  // Property validation (Batch 4)
  INVALID_REPLICAS: 'invalid_replicas',
  INVALID_CPU_LIMIT: 'invalid_cpu_limit',
  INVALID_MEMORY_LIMIT: 'invalid_memory_limit',
  INVALID_RATE_LIMIT: 'invalid_rate_limit',
  INVALID_TIMEOUT: 'invalid_timeout',
  INVALID_BASE_LATENCY: 'invalid_base_latency',
  INVALID_ERROR_RATE: 'invalid_error_rate',
  INVALID_MTTR: 'invalid_mttr',
  INVALID_MTBF: 'invalid_mtbf',
  INVALID_SCALE_THRESHOLD: 'invalid_scale_threshold',
  INVALID_MAX_REPLICAS: 'invalid_max_replicas',
  INVALID_AUTO_SCALING: 'invalid_auto_scaling',
  INVALID_COST: 'invalid_cost',
  INVALID_PROTOCOL: 'invalid_protocol',
  INVALID_NETWORK_LATENCY: 'invalid_network_latency',
  INVALID_RETRY_COUNT: 'invalid_retry_count',
  INVALID_CIRCUIT_BREAKER_THRESHOLD: 'invalid_circuit_breaker_threshold',
  INVALID_MAX_THROUGHPUT: 'invalid_max_throughput',
  INVALID_TLS: 'invalid_tls',
  INVALID_TRAFFIC_PATTERN: 'invalid_traffic_pattern',
  INVALID_RPS: 'invalid_rps',
  INVALID_DURATION: 'invalid_duration',
  INVALID_SEED: 'invalid_seed',
  INVALID_CAPACITY: 'invalid_capacity',
  INVALID_CONFIG_VALUE: 'invalid_config_value',

  // Warnings
  ISOLATED_NODE: 'isolated_node',
  DEAD_END: 'dead_end',
  CYCLE: 'cycle',
  TRAFFIC_BLACK_HOLE: 'traffic_black_hole',
  REDUNDANT_PATH: 'redundant_path',
  UNUSED_SERVICE: 'unused_service',
  EXCESSIVE_FAN_OUT: 'excessive_fan_out',
  EXCESSIVE_FAN_IN: 'excessive_fan_in',

  // Architectural risks
  SINGLE_POINT_OF_FAILURE: 'single_point_of_failure',
  MISSING_REDUNDANCY: 'missing_redundancy',
  TIGHT_COUPLING: 'tight_coupling',
  CASCADING_DEPENDENCY: 'cascading_dependency',
  RESOURCE_CONCENTRATION: 'resource_concentration',

  // Structural
  MISSING_ENTRY_POINT: 'missing_entry_point',
  MISSING_EXIT_POINT: 'missing_exit_point',
  ORPHANED_NODE: 'orphaned_node',
  UNREACHABLE_NODE: 'unreachable_node',
}

// Thresholds
const EXCESSIVE_FAN_OUT_THRESHOLD = 10
const EXCESSIVE_FAN_IN_THRESHOLD = 10
const TIGHT_COUPLING_THRESHOLD = 5
const CASCADING_DEPTH_THRESHOLD = 5
const RESOURCE_CLUSTER_DISTANCE = 200

// ============================================================================
// HELPERS
// ============================================================================

function parseConfig(config) {
  if (config === null || config === undefined) return {}
  if (typeof config === 'string') {
    try {
      return JSON.parse(config)
    } catch {
      return null
    }
  }
  if (typeof config === 'object') return config
  return null
}

function makeFinding(id, severity, type, message, opts = {}) {
  return {
    id,
    severity,
    type,
    message,
    ...opts,
  }
}

function isInteger(val) {
  return typeof val === 'number' && Number.isInteger(val) && !Number.isNaN(val)
}

function isNonNegativeFloat(val) {
  return typeof val === 'number' && val >= 0 && !Number.isNaN(val)
}

function isFloatInRange(val, min, max) {
  return typeof val === 'number' && val >= min && val <= max && !Number.isNaN(val)
}

function isBoolean(val) {
  return typeof val === 'boolean'
}

function isNonEmptyString(val) {
  return typeof val === 'string' && val.length > 0
}

// ============================================================================
// MAIN VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate architecture topology only.
 * Backward-compatible entrypoint for UI pre-checks.
 */
export function validateArchitecture(blocks, edges) {
  const findings = []

  // Critical
  findings.push(...checkEmptyArchitecture(blocks))
  findings.push(...checkMissingNodes(blocks, edges))
  findings.push(...checkBrokenEdges(blocks, edges))
  findings.push(...checkInvalidReferences(blocks, edges))
  findings.push(...checkInvalidConfigs(blocks))
  findings.push(...checkNegativeValues(blocks))
  findings.push(...checkUnsupportedProtocols(edges))
  findings.push(...checkDuplicateNodes(blocks))
  findings.push(...checkDuplicateEdges(edges))
  findings.push(...checkConfigurationCorruption(blocks, edges))

  // Warnings
  findings.push(...checkIsolatedNodes(blocks, edges))
  findings.push(...checkDeadEnds(blocks, edges))
  findings.push(...checkCycles(blocks, edges))
  findings.push(...checkTrafficBlackHoles(blocks, edges))
  findings.push(...checkRedundantPaths(blocks, edges))
  findings.push(...checkUnusedServices(blocks, edges))
  findings.push(...checkExcessiveFanOut(blocks, edges))
  findings.push(...checkExcessiveFanIn(blocks, edges))

  // Risks
  findings.push(...checkSinglePointsOfFailure(blocks, edges))
  findings.push(...checkMissingRedundancy(blocks, edges))
  findings.push(...checkTightCoupling(blocks, edges))
  findings.push(...checkCascadingDependencies(blocks, edges))
  findings.push(...checkResourceConcentration(blocks, edges))

  // Structural
  findings.push(...checkMissingEntryPoints(blocks, edges))
  findings.push(...checkMissingExitPoints(blocks, edges))
  findings.push(...checkOrphanedNodes(blocks, edges))
  findings.push(...checkUnreachableNodes(blocks, edges))

  return buildResult(findings, blocks, edges)
}

/**
 * Full simulation input validation — topology + properties + config.
 * Call this from processor.js before starting any simulation run.
 */
export function validateSimulationInput(simulationConfig, blocks, edges) {
  const findings = []

  // Topology
  findings.push(...validateArchitecture(blocks, edges).findings)

  // Block properties
  if (blocks) {
    for (const block of blocks) {
      findings.push(...validateBlockProperties(block))
    }
  }

  // Edge properties
  if (edges) {
    for (const edge of edges) {
      findings.push(...validateEdgeProperties(edge))
    }
  }

  // Simulation config
  if (simulationConfig) {
    findings.push(...validateSimulationConfig(simulationConfig))
  }

  return buildResult(findings, blocks, edges)
}

/**
 * Validate a single block's properties. Useful for real-time PropertyPanel validation.
 */
export function validateBlock(block) {
  return buildResult(validateBlockProperties(block), [block], [])
}

/**
 * Validate a single edge's properties.
 */
export function validateEdge(edge) {
  return buildResult(validateEdgeProperties(edge), [], [edge])
}

// ============================================================================
// PROPERTY VALIDATION — BLOCKS (Batch 4 + Batch 3 behavioral model)
// ============================================================================

function validateBlockProperties(block) {
  const findings = []
  const config = parseConfig(block.config) || {}
  const label = block.label || block.id || 'Unnamed block'

  // --- Critical ---

  // replicas: integer >= 1
  if (config.replicas !== undefined) {
    if (!isInteger(config.replicas) || config.replicas < 1) {
      findings.push(makeFinding(
        `val-replicas-${block.id}`,
        SEVERITY.CRITICAL,
        FINDING_TYPES.INVALID_REPLICAS,
        `Block "${label}" has invalid replicas: ${config.replicas}. Must be an integer >= 1.`,
        { blockId: block.id, property: 'replicas', currentValue: config.replicas, recommendation: 'Set replicas to a whole number >= 1.' }
      ))
    }
  }

  // cpuLimit: must match /^\d+[m]?$/
  if (config.cpuLimit !== undefined && config.cpuLimit !== null && config.cpuLimit !== '') {
    if (!/^\d+[m]?$/.test(String(config.cpuLimit))) {
      findings.push(makeFinding(
        `val-cpu-${block.id}`,
        SEVERITY.CRITICAL,
        FINDING_TYPES.INVALID_CPU_LIMIT,
        `Block "${label}" has invalid cpuLimit: "${config.cpuLimit}". Must match pattern like "500m" or "2".`,
        { blockId: block.id, property: 'cpuLimit', currentValue: config.cpuLimit, recommendation: 'Use format like "500m" (millicores) or "2" (cores).' }
      ))
    }
  }

  // memoryLimit: must match /^\d+(Mi|Gi|Ki)?$/
  if (config.memoryLimit !== undefined && config.memoryLimit !== null && config.memoryLimit !== '') {
    if (!/^\d+(Mi|Gi|Ki)?$/.test(String(config.memoryLimit))) {
      findings.push(makeFinding(
        `val-mem-${block.id}`,
        SEVERITY.CRITICAL,
        FINDING_TYPES.INVALID_MEMORY_LIMIT,
        `Block "${label}" has invalid memoryLimit: "${config.memoryLimit}". Must match pattern like "1Gi", "512Mi".`,
        { blockId: block.id, property: 'memoryLimit', currentValue: config.memoryLimit, recommendation: 'Use format like "1Gi", "512Mi", or "1024Ki".' }
      ))
    }
  }

  // timeoutMs / timeout: integer >= 1
  const timeoutMs = config.timeoutMs ?? config.timeout
  if (timeoutMs !== undefined) {
    if (!isInteger(timeoutMs) || timeoutMs < 1) {
      findings.push(makeFinding(
        `val-timeout-${block.id}`,
        SEVERITY.CRITICAL,
        FINDING_TYPES.INVALID_TIMEOUT,
        `Block "${label}" has invalid timeout: ${timeoutMs}ms. Must be an integer >= 1.`,
        { blockId: block.id, property: 'timeoutMs', currentValue: timeoutMs, recommendation: 'Set timeout to a positive integer in milliseconds.' }
      ))
    }
  }

  // --- Warnings ---

  // rateLimit: integer >= 1
  if (config.rateLimit !== undefined) {
    if (!isInteger(config.rateLimit) || config.rateLimit < 1) {
      findings.push(makeFinding(
        `val-rate-${block.id}`,
        SEVERITY.WARNING,
        FINDING_TYPES.INVALID_RATE_LIMIT,
        `Block "${label}" has invalid rateLimit: ${config.rateLimit}. Must be an integer >= 1.`,
        { blockId: block.id, property: 'rateLimit', currentValue: config.rateLimit, recommendation: 'Set rateLimit to a positive integer (req/sec).' }
      ))
    }
  }

  // baseLatencyMs: float >= 0
  if (config.baseLatencyMs !== undefined) {
    if (!isNonNegativeFloat(config.baseLatencyMs)) {
      findings.push(makeFinding(
        `val-latency-${block.id}`,
        SEVERITY.WARNING,
        FINDING_TYPES.INVALID_BASE_LATENCY,
        `Block "${label}" has invalid baseLatencyMs: ${config.baseLatencyMs}. Must be >= 0.`,
        { blockId: block.id, property: 'baseLatencyMs', currentValue: config.baseLatencyMs, recommendation: 'Set baseLatencyMs to a non-negative number.' }
      ))
    }
  }

  // baseErrorRate: float 0–1
  if (config.baseErrorRate !== undefined) {
    if (!isFloatInRange(config.baseErrorRate, 0, 1)) {
      findings.push(makeFinding(
        `val-err-${block.id}`,
        SEVERITY.WARNING,
        FINDING_TYPES.INVALID_ERROR_RATE,
        `Block "${label}" has invalid baseErrorRate: ${config.baseErrorRate}. Must be between 0 and 1.`,
        { blockId: block.id, property: 'baseErrorRate', currentValue: config.baseErrorRate, recommendation: 'Set baseErrorRate to a decimal between 0 and 1.' }
      ))
    }
  }

  // mttrSeconds / mttr: integer >= 1
  const mttr = config.mttrSeconds ?? config.mttr
  if (mttr !== undefined) {
    if (!isInteger(mttr) || mttr < 1) {
      findings.push(makeFinding(
        `val-mttr-${block.id}`,
        SEVERITY.WARNING,
        FINDING_TYPES.INVALID_MTTR,
        `Block "${label}" has invalid MTTR: ${mttr}. Must be an integer >= 1 second.`,
        { blockId: block.id, property: 'mttrSeconds', currentValue: mttr, recommendation: 'Set MTTR to a positive integer (seconds).' }
      ))
    }
  }

  // mtbfSeconds / mtbf: integer >= mttr
  const mtbf = config.mtbfSeconds ?? config.mtbf
  if (mtbf !== undefined) {
    if (!isInteger(mtbf) || mtbf < 1) {
      findings.push(makeFinding(
        `val-mtbf-${block.id}`,
        SEVERITY.WARNING,
        FINDING_TYPES.INVALID_MTBF,
        `Block "${label}" has invalid MTBF: ${mtbf}. Must be an integer >= 1 second.`,
        { blockId: block.id, property: 'mtbfSeconds', currentValue: mtbf, recommendation: 'Set MTBF to a positive integer (seconds).' }
      ))
    } else if (mttr !== undefined && mtbf < mttr) {
      findings.push(makeFinding(
        `val-mtbf-lt-mttr-${block.id}`,
        SEVERITY.WARNING,
        FINDING_TYPES.INVALID_MTBF,
        `Block "${label}" has MTBF (${mtbf}s) less than MTTR (${mttr}s). Mean time between failures should exceed recovery time.`,
        { blockId: block.id, property: 'mtbfSeconds', currentValue: mtbf, recommendation: 'Ensure MTBF >= MTTR for realistic reliability modeling.' }
      ))
    }
  }

  // scaleUpThreshold: float 0–1
  if (config.scaleUpThreshold !== undefined) {
    if (!isFloatInRange(config.scaleUpThreshold, 0, 1)) {
      findings.push(makeFinding(
        `val-scale-up-${block.id}`,
        SEVERITY.WARNING,
        FINDING_TYPES.INVALID_SCALE_THRESHOLD,
        `Block "${label}" has invalid scaleUpThreshold: ${config.scaleUpThreshold}. Must be between 0 and 1.`,
        { blockId: block.id, property: 'scaleUpThreshold', currentValue: config.scaleUpThreshold, recommendation: 'Set scaleUpThreshold to a decimal between 0 and 1 (e.g., 0.7).' }
      ))
    }
  }

  // scaleDownThreshold: float 0–1, < scaleUpThreshold
  if (config.scaleDownThreshold !== undefined) {
    if (!isFloatInRange(config.scaleDownThreshold, 0, 1)) {
      findings.push(makeFinding(
        `val-scale-down-${block.id}`,
        SEVERITY.WARNING,
        FINDING_TYPES.INVALID_SCALE_THRESHOLD,
        `Block "${label}" has invalid scaleDownThreshold: ${config.scaleDownThreshold}. Must be between 0 and 1.`,
        { blockId: block.id, property: 'scaleDownThreshold', currentValue: config.scaleDownThreshold, recommendation: 'Set scaleDownThreshold to a decimal between 0 and 1 (e.g., 0.3).' }
      ))
    } else if (config.scaleUpThreshold !== undefined && config.scaleDownThreshold >= config.scaleUpThreshold) {
      findings.push(makeFinding(
        `val-scale-order-${block.id}`,
        SEVERITY.WARNING,
        FINDING_TYPES.INVALID_SCALE_THRESHOLD,
        `Block "${label}" has scaleDownThreshold (${config.scaleDownThreshold}) >= scaleUpThreshold (${config.scaleUpThreshold}). Scale-down must be lower than scale-up.`,
        { blockId: block.id, property: 'scaleDownThreshold', currentValue: config.scaleDownThreshold, recommendation: 'Ensure scaleDownThreshold < scaleUpThreshold to prevent flapping.' }
      ))
    }
  }

  // maxReplicas: >= minReplicas
  if (config.maxReplicas !== undefined) {
    if (!isInteger(config.maxReplicas) || config.maxReplicas < 1) {
      findings.push(makeFinding(
        `val-max-rep-${block.id}`,
        SEVERITY.WARNING,
        FINDING_TYPES.INVALID_MAX_REPLICAS,
        `Block "${label}" has invalid maxReplicas: ${config.maxReplicas}. Must be an integer >= 1.`,
        { blockId: block.id, property: 'maxReplicas', currentValue: config.maxReplicas, recommendation: 'Set maxReplicas to a whole number >= 1.' }
      ))
    } else if (config.minReplicas !== undefined && config.maxReplicas < config.minReplicas) {
      findings.push(makeFinding(
        `val-max-lt-min-${block.id}`,
        SEVERITY.WARNING,
        FINDING_TYPES.INVALID_MAX_REPLICAS,
        `Block "${label}" has maxReplicas (${config.maxReplicas}) < minReplicas (${config.minReplicas}).`,
        { blockId: block.id, property: 'maxReplicas', currentValue: config.maxReplicas, recommendation: 'Ensure maxReplicas >= minReplicas.' }
      ))
    }
  }

  // autoScaling: if true, maxReplicas and minReplicas required
  if (config.autoScaling === true) {
    if (config.maxReplicas === undefined || config.minReplicas === undefined) {
      findings.push(makeFinding(
        `val-autoscale-${block.id}`,
        SEVERITY.WARNING,
        FINDING_TYPES.INVALID_AUTO_SCALING,
        `Block "${label}" has autoScaling enabled but is missing minReplicas or maxReplicas.`,
        { blockId: block.id, property: 'autoScaling', currentValue: true, recommendation: 'Set both minReplicas and maxReplicas when autoScaling is enabled.' }
      ))
    }
  }

  // --- Info ---

  // costPerHour: float >= 0
  if (config.costPerHour !== undefined) {
    if (!isNonNegativeFloat(config.costPerHour)) {
      findings.push(makeFinding(
        `val-cost-hr-${block.id}`,
        SEVERITY.INFO,
        FINDING_TYPES.INVALID_COST,
        `Block "${label}" has invalid costPerHour: ${config.costPerHour}. Must be >= 0.`,
        { blockId: block.id, property: 'costPerHour', currentValue: config.costPerHour, recommendation: 'Set costPerHour to a non-negative number.' }
      ))
    }
  }

  // costPerRequest: float >= 0
  if (config.costPerRequest !== undefined) {
    if (!isNonNegativeFloat(config.costPerRequest)) {
      findings.push(makeFinding(
        `val-cost-req-${block.id}`,
        SEVERITY.INFO,
        FINDING_TYPES.INVALID_COST,
        `Block "${label}" has invalid costPerRequest: ${config.costPerRequest}. Must be >= 0.`,
        { blockId: block.id, property: 'costPerRequest', currentValue: config.costPerRequest, recommendation: 'Set costPerRequest to a non-negative number.' }
      ))
    }
  }

  // --- Batch 3 Behavioral Model Properties ---

  // maxConnections: integer >= 1
  if (config.maxConnections !== undefined) {
    if (!isInteger(config.maxConnections) || config.maxConnections < 1) {
      findings.push(makeFinding(
        `val-max-conn-${block.id}`,
        SEVERITY.WARNING,
        FINDING_TYPES.INVALID_CAPACITY,
        `Block "${label}" has invalid maxConnections: ${config.maxConnections}. Must be an integer >= 1.`,
        { blockId: block.id, property: 'maxConnections', currentValue: config.maxConnections, recommendation: 'Set maxConnections to a positive integer.' }
      ))
    }
  }

  // maxPartitions: integer >= 1
  if (config.maxPartitions !== undefined) {
    if (!isInteger(config.maxPartitions) || config.maxPartitions < 1) {
      findings.push(makeFinding(
        `val-max-part-${block.id}`,
        SEVERITY.WARNING,
        FINDING_TYPES.INVALID_CAPACITY,
        `Block "${label}" has invalid maxPartitions: ${config.maxPartitions}. Must be an integer >= 1.`,
        { blockId: block.id, property: 'maxPartitions', currentValue: config.maxPartitions, recommendation: 'Set maxPartitions to a positive integer.' }
      ))
    }
  }

  // errorDistribution: enum
  if (config.errorDistribution !== undefined) {
    if (!['uniform', 'exponential', 'burst'].includes(config.errorDistribution)) {
      findings.push(makeFinding(
        `val-err-dist-${block.id}`,
        SEVERITY.WARNING,
        FINDING_TYPES.INVALID_CONFIG_VALUE,
        `Block "${label}" has invalid errorDistribution: "${config.errorDistribution}". Must be "uniform", "exponential", or "burst".`,
        { blockId: block.id, property: 'errorDistribution', currentValue: config.errorDistribution, recommendation: 'Choose "uniform", "exponential", or "burst".' }
      ))
    }
  }

  // slaTarget: float 0–1
  if (config.slaTarget !== undefined) {
    if (!isFloatInRange(config.slaTarget, 0, 1)) {
      findings.push(makeFinding(
        `val-sla-${block.id}`,
        SEVERITY.WARNING,
        FINDING_TYPES.INVALID_CONFIG_VALUE,
        `Block "${label}" has invalid slaTarget: ${config.slaTarget}. Must be between 0 and 1.`,
        { blockId: block.id, property: 'slaTarget', currentValue: config.slaTarget, recommendation: 'Set slaTarget to a decimal between 0 and 1 (e.g., 0.9999).' }
      ))
    }
  }

  // mttrMinutes: integer >= 1
  if (config.mttrMinutes !== undefined) {
    if (!isInteger(config.mttrMinutes) || config.mttrMinutes < 1) {
      findings.push(makeFinding(
        `val-mttr-min-${block.id}`,
        SEVERITY.WARNING,
        FINDING_TYPES.INVALID_MTTR,
        `Block "${label}" has invalid mttrMinutes: ${config.mttrMinutes}. Must be an integer >= 1.`,
        { blockId: block.id, property: 'mttrMinutes', currentValue: config.mttrMinutes, recommendation: 'Set mttrMinutes to a positive integer.' }
      ))
    }
  }

  // mtbfHours: integer >= 1
  if (config.mtbfHours !== undefined) {
    if (!isInteger(config.mtbfHours) || config.mtbfHours < 1) {
      findings.push(makeFinding(
        `val-mtbf-hr-${block.id}`,
        SEVERITY.WARNING,
        FINDING_TYPES.INVALID_MTBF,
        `Block "${label}" has invalid mtbfHours: ${config.mtbfHours}. Must be an integer >= 1.`,
        { blockId: block.id, property: 'mtbfHours', currentValue: config.mtbfHours, recommendation: 'Set mtbfHours to a positive integer.' }
      ))
    }
  }

  // storagePerRequest: float >= 0
  if (config.storagePerRequest !== undefined) {
    if (!isNonNegativeFloat(config.storagePerRequest)) {
      findings.push(makeFinding(
        `val-stor-req-${block.id}`,
        SEVERITY.WARNING,
        FINDING_TYPES.INVALID_CONFIG_VALUE,
        `Block "${label}" has invalid storagePerRequest: ${config.storagePerRequest}. Must be >= 0.`,
        { blockId: block.id, property: 'storagePerRequest', currentValue: config.storagePerRequest, recommendation: 'Set storagePerRequest to a non-negative number (GB).' }
      ))
    }
  }

  // hourlyComputeCost: float >= 0
  if (config.hourlyComputeCost !== undefined) {
    if (!isNonNegativeFloat(config.hourlyComputeCost)) {
      findings.push(makeFinding(
        `val-comp-cost-${block.id}`,
        SEVERITY.INFO,
        FINDING_TYPES.INVALID_COST,
        `Block "${label}" has invalid hourlyComputeCost: ${config.hourlyComputeCost}. Must be >= 0.`,
        { blockId: block.id, property: 'hourlyComputeCost', currentValue: config.hourlyComputeCost, recommendation: 'Set hourlyComputeCost to a non-negative number.' }
      ))
    }
  }

  // perRequestCost: float >= 0
  if (config.perRequestCost !== undefined) {
    if (!isNonNegativeFloat(config.perRequestCost)) {
      findings.push(makeFinding(
        `val-req-cost-${block.id}`,
        SEVERITY.INFO,
        FINDING_TYPES.INVALID_COST,
        `Block "${label}" has invalid perRequestCost: ${config.perRequestCost}. Must be >= 0.`,
        { blockId: block.id, property: 'perRequestCost', currentValue: config.perRequestCost, recommendation: 'Set perRequestCost to a non-negative number.' }
      ))
    }
  }

  // perGbNetworkCost: float >= 0
  if (config.perGbNetworkCost !== undefined) {
    if (!isNonNegativeFloat(config.perGbNetworkCost)) {
      findings.push(makeFinding(
        `val-net-cost-${block.id}`,
        SEVERITY.INFO,
        FINDING_TYPES.INVALID_COST,
        `Block "${label}" has invalid perGbNetworkCost: ${config.perGbNetworkCost}. Must be >= 0.`,
        { blockId: block.id, property: 'perGbNetworkCost', currentValue: config.perGbNetworkCost, recommendation: 'Set perGbNetworkCost to a non-negative number.' }
      ))
    }
  }

  // storageCostPerGbMonth: float >= 0
  if (config.storageCostPerGbMonth !== undefined) {
    if (!isNonNegativeFloat(config.storageCostPerGbMonth)) {
      findings.push(makeFinding(
        `val-stor-cost-${block.id}`,
        SEVERITY.INFO,
        FINDING_TYPES.INVALID_COST,
        `Block "${label}" has invalid storageCostPerGbMonth: ${config.storageCostPerGbMonth}. Must be >= 0.`,
        { blockId: block.id, property: 'storageCostPerGbMonth', currentValue: config.storageCostPerGbMonth, recommendation: 'Set storageCostPerGbMonth to a non-negative number.' }
      ))
    }
  }

  // failureProbabilityPerHour: float 0–1
  if (config.failureProbabilityPerHour !== undefined) {
    if (!isFloatInRange(config.failureProbabilityPerHour, 0, 1)) {
      findings.push(makeFinding(
        `val-fail-prob-${block.id}`,
        SEVERITY.WARNING,
        FINDING_TYPES.INVALID_CONFIG_VALUE,
        `Block "${label}" has invalid failureProbabilityPerHour: ${config.failureProbabilityPerHour}. Must be between 0 and 1.`,
        { blockId: block.id, property: 'failureProbabilityPerHour', currentValue: config.failureProbabilityPerHour, recommendation: 'Set failureProbabilityPerHour to a decimal between 0 and 1.' }
      ))
    }
  }

  // recoveryProbabilityPerMinute: float 0–1
  if (config.recoveryProbabilityPerMinute !== undefined) {
    if (!isFloatInRange(config.recoveryProbabilityPerMinute, 0, 1)) {
      findings.push(makeFinding(
        `val-rec-prob-${block.id}`,
        SEVERITY.WARNING,
        FINDING_TYPES.INVALID_CONFIG_VALUE,
        `Block "${label}" has invalid recoveryProbabilityPerMinute: ${config.recoveryProbabilityPerMinute}. Must be between 0 and 1.`,
        { blockId: block.id, property: 'recoveryProbabilityPerMinute', currentValue: config.recoveryProbabilityPerMinute, recommendation: 'Set recoveryProbabilityPerMinute to a decimal between 0 and 1.' }
      ))
    }
  }

  // failureModes: array of { probability: float 0-1, affectedDownstreamBlocks: string[] }
  if (config.failureModes !== undefined) {
    if (!Array.isArray(config.failureModes)) {
      findings.push(makeFinding(
        `val-fail-modes-arr-${block.id}`,
        SEVERITY.WARNING,
        FINDING_TYPES.INVALID_CONFIG_VALUE,
        `Block "${label}" has invalid failureModes: must be an array.`,
        { blockId: block.id, property: 'failureModes', currentValue: config.failureModes, recommendation: 'Set failureModes to an array of failure mode objects.' }
      ))
    } else {
      for (let i = 0; i < config.failureModes.length; i++) {
        const fm = config.failureModes[i]
        if (!fm || typeof fm !== 'object') {
          findings.push(makeFinding(
            `val-fail-mode-${block.id}-${i}`,
            SEVERITY.WARNING,
            FINDING_TYPES.INVALID_CONFIG_VALUE,
            `Block "${label}" failureModes[${i}] is not an object.`,
            { blockId: block.id, property: `failureModes[${i}]`, currentValue: fm, recommendation: 'Each failure mode must be an object with probability and affectedDownstreamBlocks.' }
          ))
          continue
        }
        if (typeof fm.probability !== 'number' || fm.probability < 0 || fm.probability > 1) {
          findings.push(makeFinding(
            `val-fail-prob-${block.id}-${i}`,
            SEVERITY.WARNING,
            FINDING_TYPES.INVALID_CONFIG_VALUE,
            `Block "${label}" failureModes[${i}].probability is invalid: ${fm.probability}. Must be between 0 and 1.`,
            { blockId: block.id, property: `failureModes[${i}].probability`, currentValue: fm.probability, recommendation: 'Set probability to a decimal between 0 and 1.' }
          ))
        }
        if (!Array.isArray(fm.affectedDownstreamBlocks)) {
          findings.push(makeFinding(
            `val-fail-blast-${block.id}-${i}`,
            SEVERITY.WARNING,
            FINDING_TYPES.INVALID_CONFIG_VALUE,
            `Block "${label}" failureModes[${i}].affectedDownstreamBlocks must be an array of block IDs.`,
            { blockId: block.id, property: `failureModes[${i}].affectedDownstreamBlocks`, currentValue: fm.affectedDownstreamBlocks, recommendation: 'Set affectedDownstreamBlocks to an array of block ID strings.' }
          ))
        }
      }
    }
  }

  // requiresAuth: boolean
  if (config.requiresAuth !== undefined && !isBoolean(config.requiresAuth)) {
    findings.push(makeFinding(
      `val-auth-${block.id}`,
      SEVERITY.WARNING,
      FINDING_TYPES.INVALID_CONFIG_VALUE,
      `Block "${label}" requiresAuth must be a boolean.`,
      { blockId: block.id, property: 'requiresAuth', currentValue: config.requiresAuth, recommendation: 'Set requiresAuth to true or false.' }
    ))
  }

  // encryptTraffic: boolean
  if (config.encryptTraffic !== undefined && !isBoolean(config.encryptTraffic)) {
    findings.push(makeFinding(
      `val-enc-${block.id}`,
      SEVERITY.WARNING,
      FINDING_TYPES.INVALID_CONFIG_VALUE,
      `Block "${label}" encryptTraffic must be a boolean.`,
      { blockId: block.id, property: 'encryptTraffic', currentValue: config.encryptTraffic, recommendation: 'Set encryptTraffic to true or false.' }
    ))
  }

  return findings
}

// ============================================================================
// PROPERTY VALIDATION — EDGES (Batch 4 + Batch 3 behavioral model)
// ============================================================================

function validateEdgeProperties(edge) {
  const findings = []
  const data = parseConfig(edge.data) || {}
  const config = { ...data, ...edge }
  const edgeLabel = edge.id || `${edge.sourceId || '?'}-${edge.targetId || '?'}`

  // protocol / connectionType: must be supported
  const rawProtocol = config.protocol || config.connectionType || data.connectionType || 'http'
  const protocol = normalizeProtocol(rawProtocol)
  if (!SUPPORTED_CONNECTION_TYPES.has(protocol)) {
    findings.push(makeFinding(
      `val-proto-${edge.id || 'unknown'}`,
      SEVERITY.CRITICAL,
      FINDING_TYPES.UNSUPPORTED_PROTOCOL,
      `Edge ${edgeLabel} uses unsupported protocol: "${rawProtocol}"`,
      { edgeId: edge.id, property: 'protocol', currentValue: rawProtocol, recommendation: `Use a supported protocol: ${Array.from(SUPPORTED_CONNECTION_TYPES).join(', ')}` }
    ))
  }

  // networkLatencyMs: float >= 0
  if (config.networkLatencyMs != null) {
    if (!isNonNegativeFloat(config.networkLatencyMs)) {
      findings.push(makeFinding(
        `val-net-lat-${edge.id}`,
        SEVERITY.WARNING,
        FINDING_TYPES.INVALID_NETWORK_LATENCY,
        `Edge ${edgeLabel} has invalid networkLatencyMs: ${config.networkLatencyMs}. Must be >= 0.`,
        { edgeId: edge.id, property: 'networkLatencyMs', currentValue: config.networkLatencyMs, recommendation: 'Set networkLatencyMs to a non-negative number.' }
      ))
    }
  }

  // retryCount: integer >= 0
  if (config.retryCount != null) {
    if (!isInteger(config.retryCount) || config.retryCount < 0) {
      findings.push(makeFinding(
        `val-retry-${edge.id}`,
        SEVERITY.WARNING,
        FINDING_TYPES.INVALID_RETRY_COUNT,
        `Edge ${edgeLabel} has invalid retryCount: ${config.retryCount}. Must be an integer >= 0.`,
        { edgeId: edge.id, property: 'retryCount', currentValue: config.retryCount, recommendation: 'Set retryCount to a non-negative integer.' }
      ))
    }
  }

  // circuitBreakerThreshold: float 0–1
  if (config.circuitBreakerThreshold != null) {
    if (!isFloatInRange(config.circuitBreakerThreshold, 0, 1)) {
      findings.push(makeFinding(
        `val-cb-thresh-${edge.id}`,
        SEVERITY.WARNING,
        FINDING_TYPES.INVALID_CIRCUIT_BREAKER_THRESHOLD,
        `Edge ${edgeLabel} has invalid circuitBreakerThreshold: ${config.circuitBreakerThreshold}. Must be between 0 and 1.`,
        { edgeId: edge.id, property: 'circuitBreakerThreshold', currentValue: config.circuitBreakerThreshold, recommendation: 'Set circuitBreakerThreshold to a decimal between 0 and 1 (e.g., 0.5).' }
      ))
    }
  }

  // maxThroughput: integer >= 1
  if (config.maxThroughput != null) {
    if (!isInteger(config.maxThroughput) || config.maxThroughput < 1) {
      findings.push(makeFinding(
        `val-max-tput-${edge.id}`,
        SEVERITY.WARNING,
        FINDING_TYPES.INVALID_MAX_THROUGHPUT,
        `Edge ${edgeLabel} has invalid maxThroughput: ${config.maxThroughput}. Must be an integer >= 1.`,
        { edgeId: edge.id, property: 'maxThroughput', currentValue: config.maxThroughput, recommendation: 'Set maxThroughput to a positive integer (req/sec).' }
      ))
    }
  }

  // tlsEnabled: boolean
  if (config.tlsEnabled != null && !isBoolean(config.tlsEnabled)) {
    findings.push(makeFinding(
      `val-tls-${edge.id}`,
      SEVERITY.WARNING,
      FINDING_TYPES.INVALID_TLS,
      `Edge ${edgeLabel} has invalid tlsEnabled: must be a boolean.`,
      { edgeId: edge.id, property: 'tlsEnabled', currentValue: config.tlsEnabled, recommendation: 'Set tlsEnabled to true or false.' }
    ))
  }

  // timeoutMs: integer >= 1
  if (config.timeoutMs != null) {
    if (!isInteger(config.timeoutMs) || config.timeoutMs < 1) {
      findings.push(makeFinding(
        `val-edge-timeout-${edge.id}`,
        SEVERITY.CRITICAL,
        FINDING_TYPES.INVALID_TIMEOUT,
        `Edge ${edgeLabel} has invalid timeoutMs: ${config.timeoutMs}. Must be an integer >= 1.`,
        { edgeId: edge.id, property: 'timeoutMs', currentValue: config.timeoutMs, recommendation: 'Set timeoutMs to a positive integer in milliseconds.' }
      ))
    }
  }

  // --- Batch 3 Edge Behavioral Model ---

  // keepAlive: boolean
  if (config.keepAlive != null && !isBoolean(config.keepAlive)) {
    findings.push(makeFinding(
      `val-ka-${edge.id}`,
      SEVERITY.WARNING,
      FINDING_TYPES.INVALID_CONFIG_VALUE,
      `Edge ${edgeLabel} keepAlive must be a boolean.`,
      { edgeId: edge.id, property: 'keepAlive', currentValue: config.keepAlive, recommendation: 'Set keepAlive to true or false.' }
    ))
  }

  // keepAliveTimeoutMs: integer >= 1
  if (config.keepAliveTimeoutMs != null) {
    if (!isInteger(config.keepAliveTimeoutMs) || config.keepAliveTimeoutMs < 1) {
      findings.push(makeFinding(
        `val-ka-to-${edge.id}`,
        SEVERITY.WARNING,
        FINDING_TYPES.INVALID_CONFIG_VALUE,
        `Edge ${edgeLabel} has invalid keepAliveTimeoutMs: ${config.keepAliveTimeoutMs}. Must be an integer >= 1.`,
        { edgeId: edge.id, property: 'keepAliveTimeoutMs', currentValue: config.keepAliveTimeoutMs, recommendation: 'Set keepAliveTimeoutMs to a positive integer (ms).' }
      ))
    }
  }

  // compressionRatio: float > 0
  if (config.compressionRatio != null) {
    if (typeof config.compressionRatio !== 'number' || config.compressionRatio <= 0 || Number.isNaN(config.compressionRatio)) {
      findings.push(makeFinding(
        `val-comp-ratio-${edge.id}`,
        SEVERITY.WARNING,
        FINDING_TYPES.INVALID_CONFIG_VALUE,
        `Edge ${edgeLabel} has invalid compressionRatio: ${config.compressionRatio}. Must be > 0.`,
        { edgeId: edge.id, property: 'compressionRatio', currentValue: config.compressionRatio, recommendation: 'Set compressionRatio to a positive number (e.g., 0.7 for 30%% reduction).' }
      ))
    }
  }

  // compressionMs: float >= 0
  if (config.compressionMs != null) {
    if (!isNonNegativeFloat(config.compressionMs)) {
      findings.push(makeFinding(
        `val-comp-ms-${edge.id}`,
        SEVERITY.WARNING,
        FINDING_TYPES.INVALID_CONFIG_VALUE,
        `Edge ${edgeLabel} has invalid compressionMs: ${config.compressionMs}. Must be >= 0.`,
        { edgeId: edge.id, property: 'compressionMs', currentValue: config.compressionMs, recommendation: 'Set compressionMs to a non-negative number.' }
      ))
    }
  }

  // decompressionMs: float >= 0
  if (config.decompressionMs != null) {
    if (!isNonNegativeFloat(config.decompressionMs)) {
      findings.push(makeFinding(
        `val-decomp-ms-${edge.id}`,
        SEVERITY.WARNING,
        FINDING_TYPES.INVALID_CONFIG_VALUE,
        `Edge ${edgeLabel} has invalid decompressionMs: ${config.decompressionMs}. Must be >= 0.`,
        { edgeId: edge.id, property: 'decompressionMs', currentValue: config.decompressionMs, recommendation: 'Set decompressionMs to a non-negative number.' }
      ))
    }
  }

  // bandwidthMbps: float >= 0
  if (config.bandwidthMbps != null) {
    if (!isNonNegativeFloat(config.bandwidthMbps)) {
      findings.push(makeFinding(
        `val-bw-${edge.id}`,
        SEVERITY.WARNING,
        FINDING_TYPES.INVALID_CONFIG_VALUE,
        `Edge ${edgeLabel} has invalid bandwidthMbps: ${config.bandwidthMbps}. Must be >= 0.`,
        { edgeId: edge.id, property: 'bandwidthMbps', currentValue: config.bandwidthMbps, recommendation: 'Set bandwidthMbps to a non-negative number.' }
      ))
    }
  }

  // mtuBytes: integer >= 1
  if (config.mtuBytes != null) {
    if (!isInteger(config.mtuBytes) || config.mtuBytes < 1) {
      findings.push(makeFinding(
        `val-mtu-${edge.id}`,
        SEVERITY.WARNING,
        FINDING_TYPES.INVALID_CONFIG_VALUE,
        `Edge ${edgeLabel} has invalid mtuBytes: ${config.mtuBytes}. Must be an integer >= 1.`,
        { edgeId: edge.id, property: 'mtuBytes', currentValue: config.mtuBytes, recommendation: 'Set mtuBytes to a positive integer (e.g., 1500).' }
      ))
    }
  }

  // circuitBreakerHalfOpenRequests: integer >= 1
  if (config.circuitBreakerHalfOpenRequests != null) {
    if (!isInteger(config.circuitBreakerHalfOpenRequests) || config.circuitBreakerHalfOpenRequests < 1) {
      findings.push(makeFinding(
        `val-cb-half-${edge.id}`,
        SEVERITY.WARNING,
        FINDING_TYPES.INVALID_CONFIG_VALUE,
        `Edge ${edgeLabel} has invalid circuitBreakerHalfOpenRequests: ${config.circuitBreakerHalfOpenRequests}. Must be an integer >= 1.`,
        { edgeId: edge.id, property: 'circuitBreakerHalfOpenRequests', currentValue: config.circuitBreakerHalfOpenRequests, recommendation: 'Set circuitBreakerHalfOpenRequests to a positive integer.' }
      ))
    }
  }

  // maxRps: integer >= 1
  if (config.maxRps != null) {
    if (!isInteger(config.maxRps) || config.maxRps < 1) {
      findings.push(makeFinding(
        `val-max-rps-${edge.id}`,
        SEVERITY.WARNING,
        FINDING_TYPES.INVALID_MAX_THROUGHPUT,
        `Edge ${edgeLabel} has invalid maxRps: ${config.maxRps}. Must be an integer >= 1.`,
        { edgeId: edge.id, property: 'maxRps', currentValue: config.maxRps, recommendation: 'Set maxRps to a positive integer (req/sec).' }
      ))
    }
  }

  // maxConcurrent: integer >= 1
  if (config.maxConcurrent != null) {
    if (!isInteger(config.maxConcurrent) || config.maxConcurrent < 1) {
      findings.push(makeFinding(
        `val-max-conc-${edge.id}`,
        SEVERITY.WARNING,
        FINDING_TYPES.INVALID_CAPACITY,
        `Edge ${edgeLabel} has invalid maxConcurrent: ${config.maxConcurrent}. Must be an integer >= 1.`,
        { edgeId: edge.id, property: 'maxConcurrent', currentValue: config.maxConcurrent, recommendation: 'Set maxConcurrent to a positive integer.' }
      ))
    }
  }

  // maxPayloadBytes: integer >= 1
  if (config.maxPayloadBytes != null) {
    if (!isInteger(config.maxPayloadBytes) || config.maxPayloadBytes < 1) {
      findings.push(makeFinding(
        `val-max-payload-${edge.id}`,
        SEVERITY.WARNING,
        FINDING_TYPES.INVALID_CONFIG_VALUE,
        `Edge ${edgeLabel} has invalid maxPayloadBytes: ${config.maxPayloadBytes}. Must be an integer >= 1.`,
        { edgeId: edge.id, property: 'maxPayloadBytes', currentValue: config.maxPayloadBytes, recommendation: 'Set maxPayloadBytes to a positive integer (bytes).' }
      ))
    }
  }

  // mTLS: boolean
  if (config.mTLS != null && !isBoolean(config.mTLS)) {
    findings.push(makeFinding(
      `val-mtls-${edge.id}`,
      SEVERITY.WARNING,
      FINDING_TYPES.INVALID_CONFIG_VALUE,
      `Edge ${edgeLabel} mTLS must be a boolean.`,
      { edgeId: edge.id, property: 'mTLS', currentValue: config.mTLS, recommendation: 'Set mTLS to true or false.' }
    ))
  }

  return findings
}

// ============================================================================
// SIMULATION CONFIG VALIDATION
// ============================================================================

function validateSimulationConfig(config) {
  const findings = []

  // trafficPattern: must be in TRAFFIC_PATTERNS
  if (config.trafficPattern != null) {
    const normalized = normalizeTrafficPattern(config.trafficPattern)
    if (!TRAFFIC_PATTERNS.includes(normalized)) {
      findings.push(makeFinding(
        'val-traffic-pattern',
        SEVERITY.CRITICAL,
        FINDING_TYPES.INVALID_TRAFFIC_PATTERN,
        `Invalid trafficPattern: "${config.trafficPattern}". Must be one of: ${TRAFFIC_PATTERNS.join(', ')}.`,
        { property: 'trafficPattern', currentValue: config.trafficPattern, recommendation: `Choose from: ${TRAFFIC_PATTERNS.join(', ')}.` }
      ))
    }
  }

  // rps: integer >= 1
  if (config.rps != null) {
    if (!isInteger(config.rps) || config.rps < 1) {
      findings.push(makeFinding(
        'val-rps',
        SEVERITY.CRITICAL,
        FINDING_TYPES.INVALID_RPS,
        `Invalid rps: ${config.rps}. Must be an integer >= 1.`,
        { property: 'rps', currentValue: config.rps, recommendation: 'Set rps to a positive integer (requests per second).' }
      ))
    }
  }

  // duration: integer >= 10
  if (config.duration != null) {
    if (!isInteger(config.duration) || config.duration < 10) {
      findings.push(makeFinding(
        'val-duration',
        SEVERITY.CRITICAL,
        FINDING_TYPES.INVALID_DURATION,
        `Invalid duration: ${config.duration}s. Must be an integer >= 10.`,
        { property: 'duration', currentValue: config.duration, recommendation: 'Set duration to at least 10 seconds.' }
      ))
    }
  }

  // deterministicSeed: if provided, must be string
  if (config.deterministicSeed != null) {
    if (typeof config.deterministicSeed !== 'string') {
      findings.push(makeFinding(
        'val-seed',
        SEVERITY.INFO,
        FINDING_TYPES.INVALID_SEED,
        `Invalid deterministicSeed: must be a string.`,
        { property: 'deterministicSeed', currentValue: config.deterministicSeed, recommendation: 'Provide a string seed for deterministic runs.' }
      ))
    }
  }

  // monteCarloPasses: integer >= 1
  if (config.monteCarloPasses != null) {
    if (!isInteger(config.monteCarloPasses) || config.monteCarloPasses < 1) {
      findings.push(makeFinding(
        'val-monte',
        SEVERITY.WARNING,
        FINDING_TYPES.INVALID_CONFIG_VALUE,
        `Invalid monteCarloPasses: ${config.monteCarloPasses}. Must be an integer >= 1.`,
        { property: 'monteCarloPasses', currentValue: config.monteCarloPasses, recommendation: 'Set monteCarloPasses to a positive integer.' }
      ))
    }
  }

  // confidenceLevel: float 0–1
  if (config.confidenceLevel != null) {
    if (!isFloatInRange(config.confidenceLevel, 0, 1)) {
      findings.push(makeFinding(
        'val-confidence',
        SEVERITY.WARNING,
        FINDING_TYPES.INVALID_CONFIG_VALUE,
        `Invalid confidenceLevel: ${config.confidenceLevel}. Must be between 0 and 1.`,
        { property: 'confidenceLevel', currentValue: config.confidenceLevel, recommendation: 'Set confidenceLevel to a decimal between 0 and 1 (e.g., 0.95).' }
      ))
    }
  }

  return findings
}

// ============================================================================
// TOPOLOGY VALIDATION (existing logic, preserved & enhanced)
// ============================================================================

function checkEmptyArchitecture(blocks) {
  const findings = []
  if (!blocks || blocks.length === 0) {
    findings.push(makeFinding(
      'val-empty-arch',
      SEVERITY.CRITICAL,
      FINDING_TYPES.EMPTY_ARCHITECTURE,
      'Architecture is empty. Add at least one component before running simulation.',
      { recommendation: 'Add an entry point (e.g., API Gateway or Client) and at least one service.' }
    ))
  }
  return findings
}

function checkMissingNodes(blocks, edges) {
  const findings = []
  if (!blocks || blocks.length === 0) return findings

  const blockIds = new Set(blocks.map(b => b.id))
  for (const edge of (edges || [])) {
    if (!blockIds.has(edge.sourceId)) {
      findings.push(makeFinding(
        `val-missing-src-${edge.id}`,
        SEVERITY.CRITICAL,
        FINDING_TYPES.MISSING_NODES,
        `Edge references missing source block: ${edge.sourceId}`,
        { edgeId: edge.id, affectedBlockIds: [edge.sourceId], recommendation: 'Delete this edge or restore the missing source block.' }
      ))
    }
    if (!blockIds.has(edge.targetId)) {
      findings.push(makeFinding(
        `val-missing-tgt-${edge.id}`,
        SEVERITY.CRITICAL,
        FINDING_TYPES.MISSING_NODES,
        `Edge references missing target block: ${edge.targetId}`,
        { edgeId: edge.id, affectedBlockIds: [edge.targetId], recommendation: 'Delete this edge or restore the missing target block.' }
      ))
    }
  }
  return findings
}

function checkBrokenEdges(blocks, edges) {
  const findings = []
  if (!edges) return findings

  for (const edge of edges) {
    if (!edge.sourceId || !edge.targetId) {
      findings.push(makeFinding(
        `val-broken-${edge.id || 'unknown'}`,
        SEVERITY.CRITICAL,
        FINDING_TYPES.BROKEN_EDGES,
        `Edge ${edge.id || '(unknown)'} is missing source or target reference.`,
        { edgeId: edge.id, recommendation: 'Delete and recreate this connection.' }
      ))
    }
  }
  return findings
}

function checkInvalidReferences(blocks, edges) {
  const findings = []
  if (!edges) return findings

  for (const edge of edges) {
    if (edge.sourceId === edge.targetId) {
      findings.push(makeFinding(
        `val-self-ref-${edge.id}`,
        SEVERITY.CRITICAL,
        FINDING_TYPES.INVALID_REFERENCES,
        `Block ${edge.sourceId} has a self-referencing edge. Self-loops are not supported.`,
        { edgeId: edge.id, blockId: edge.sourceId, affectedBlockIds: [edge.sourceId], recommendation: 'Remove the self-loop or replace with an explicit retry mechanism.' }
      ))
    }
  }
  return findings
}

function checkInvalidConfigs(blocks) {
  const findings = []
  if (!blocks) return findings

  for (const block of blocks) {
    const config = parseConfig(block.config) || {}

    if (block.type === 'database') {
      if (!config.engine) {
        findings.push(makeFinding(
          `val-config-db-${block.id}`,
          SEVERITY.CRITICAL,
          FINDING_TYPES.INVALID_CONFIG,
          `Database block "${block.label || block.id}" is missing engine configuration.`,
          { blockId: block.id, recommendation: 'Set the database engine (e.g., postgres, mysql, mongodb).' }
        ))
      }
    }

    if (block.type === 'external-api') {
      if (!config.url) {
        findings.push(makeFinding(
          `val-config-ext-${block.id}`,
          SEVERITY.WARNING,
          FINDING_TYPES.INVALID_CONFIG,
          `External API block "${block.label || block.id}" has no URL configured.`,
          { blockId: block.id, recommendation: 'Set the external API URL for accurate latency modeling.' }
        ))
      }
    }
  }
  return findings
}

function checkNegativeValues(blocks) {
  const findings = []
  if (!blocks) return findings

  for (const block of blocks) {
    const config = parseConfig(block.config) || {}

    if (config.rateLimit !== undefined && config.rateLimit < 0) {
      findings.push(makeFinding(
        `val-neg-rate-${block.id}`,
        SEVERITY.CRITICAL,
        FINDING_TYPES.NEGATIVE_CAPACITY,
        `Block "${block.label || block.id}" has negative rate limit: ${config.rateLimit}`,
        { blockId: block.id, recommendation: 'Set rate limit to a positive number or 0 for unlimited.' }
      ))
    }

    if (config.port !== undefined && (config.port < 0 || config.port > 65535)) {
      findings.push(makeFinding(
        `val-neg-port-${block.id}`,
        SEVERITY.CRITICAL,
        FINDING_TYPES.IMPOSSIBLE_VALUE,
        `Block "${block.label || block.id}" has invalid port: ${config.port}`,
        { blockId: block.id, recommendation: 'Port must be between 0 and 65535.' }
      ))
    }

    if (config.timeout !== undefined && config.timeout < 0) {
      findings.push(makeFinding(
        `val-neg-timeout-${block.id}`,
        SEVERITY.CRITICAL,
        FINDING_TYPES.NEGATIVE_LATENCY,
        `Block "${block.label || block.id}" has negative timeout: ${config.timeout}`,
        { blockId: block.id, recommendation: 'Timeout must be a positive number in milliseconds.' }
      ))
    }
  }
  return findings
}

function normalizeProtocol(rawProtocol) {
  const aliases = {
    db: 'tcp',
    database: 'tcp',
    sql: 'tcp',
    nosql: 'tcp',
    redis: 'tcp',
    mongo: 'tcp',
    postgres: 'tcp',
  }
  return aliases[rawProtocol] || rawProtocol || 'http'
}

function checkUnsupportedProtocols(edges) {
  const findings = []
  if (!edges) return findings

  for (const edge of edges) {
    const rawProtocol = edge.connectionType || edge.data?.connectionType || 'http'
    const protocol = normalizeProtocol(rawProtocol)
    if (!SUPPORTED_CONNECTION_TYPES.has(protocol)) {
      findings.push(makeFinding(
        `val-proto-${edge.id}`,
        SEVERITY.CRITICAL,
        FINDING_TYPES.UNSUPPORTED_PROTOCOL,
        `Edge ${edge.id} uses unsupported protocol: "${rawProtocol}"`,
        { edgeId: edge.id, recommendation: `Use a supported protocol: ${Array.from(SUPPORTED_CONNECTION_TYPES).join(', ')}` }
      ))
    }
  }
  return findings
}

function checkDuplicateNodes(blocks) {
  const findings = []
  if (!blocks) return findings

  const seen = new Map()
  for (const block of blocks) {
    if (seen.has(block.id)) {
      findings.push(makeFinding(
        `val-dup-node-${block.id}`,
        SEVERITY.CRITICAL,
        FINDING_TYPES.DUPLICATE_NODE,
        `Duplicate block ID detected: ${block.id}`,
        { blockId: block.id, affectedBlockIds: [block.id], recommendation: 'Each block must have a unique ID. Delete the duplicate.' }
      ))
    }
    seen.set(block.id, true)
  }
  return findings
}

function checkDuplicateEdges(edges) {
  const findings = []
  if (!edges) return findings

  const seen = new Map()
  for (const edge of edges) {
    const key = `${edge.sourceId}->${edge.targetId}`
    if (seen.has(key)) {
      findings.push(makeFinding(
        `val-dup-edge-${edge.id}`,
        SEVERITY.WARNING,
        FINDING_TYPES.DUPLICATE_EDGE,
        `Duplicate edge detected: ${edge.sourceId} \u2192 ${edge.targetId}`,
        { edgeId: edge.id, affectedBlockIds: [edge.sourceId, edge.targetId], recommendation: 'Merge duplicate edges or remove the redundant connection.' }
      ))
    }
    seen.set(key, true)
  }
  return findings
}

function checkConfigurationCorruption(blocks, edges) {
  const findings = []

  for (const block of (blocks || [])) {
    const parsed = parseConfig(block.config)
    if (parsed === null) {
      findings.push(makeFinding(
        `val-corrupt-cfg-${block.id}`,
        SEVERITY.CRITICAL,
        FINDING_TYPES.CONFIGURATION_CORRUPTION,
        `Block "${block.label || block.id}" has corrupted configuration (not valid JSON).`,
        { blockId: block.id, recommendation: 'Reset block configuration to defaults.' }
      ))
    }
  }

  for (const edge of (edges || [])) {
    const edgeData = parseConfig(edge.data)
    if (edge.data !== undefined && edge.data !== null && edgeData === null) {
      findings.push(makeFinding(
        `val-corrupt-edge-${edge.id}`,
        SEVERITY.CRITICAL,
        FINDING_TYPES.CONFIGURATION_CORRUPTION,
        `Edge ${edge.id} has corrupted data (not valid JSON).`,
        { edgeId: edge.id, recommendation: 'Delete and recreate this connection.' }
      ))
    }
  }

  return findings
}

function checkIsolatedNodes(blocks, edges) {
  const findings = []
  if (!blocks || !edges) return findings

  const connected = new Set()
  for (const edge of edges) {
    connected.add(edge.sourceId)
    connected.add(edge.targetId)
  }

  for (const block of blocks) {
    if (!connected.has(block.id)) {
      findings.push(makeFinding(
        `val-isolated-${block.id}`,
        SEVERITY.WARNING,
        FINDING_TYPES.ISOLATED_NODE,
        `Block "${block.label || block.id}" is isolated \u2014 no connections.`,
        { blockId: block.id, recommendation: 'Connect this block to the architecture or remove it.' }
      ))
    }
  }
  return findings
}

function checkDeadEnds(blocks, edges) {
  const findings = []
  if (!blocks || !edges) return findings

  const hasOutgoing = new Set(edges.map(e => e.sourceId))
  const hasIncoming = new Set(edges.map(e => e.targetId))
  const terminalTypes = new Set(['client', 'storage', 'database', 'cache', 'message-queue'])

  for (const block of blocks) {
    const isTerminal = terminalTypes.has(block.type)
    if (hasIncoming.has(block.id) && !hasOutgoing.has(block.id) && !isTerminal) {
      findings.push(makeFinding(
        `val-deadend-${block.id}`,
        SEVERITY.WARNING,
        FINDING_TYPES.DEAD_END,
        `Block "${block.label || block.id}" is a dead end \u2014 receives traffic but has no outgoing connections.`,
        { blockId: block.id, recommendation: 'Add an outgoing connection or mark as a terminal component.' }
      ))
    }
  }
  return findings
}

function checkCycles(blocks, edges) {
  const findings = []
  if (!blocks || !edges || edges.length === 0) return findings

  const adjacency = buildAdjacencyList(edges)
  const visited = new Set()
  const recursionStack = new Set()

  function dfs(nodeId, path = []) {
    visited.add(nodeId)
    recursionStack.add(nodeId)
    path.push(nodeId)

    const neighbors = adjacency.get(nodeId) || []
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (dfs(neighbor, [...path])) {
          return true
        }
      } else if (recursionStack.has(neighbor)) {
        const cycleStart = path.indexOf(neighbor)
        const cycle = path.slice(cycleStart)
        const cycleBlockIds = [...cycle, neighbor]
        const cycleBlocks = blocks.filter(b => cycleBlockIds.includes(b.id))

        findings.push(makeFinding(
          `val-cycle-${cycle.join('-')}`,
          SEVERITY.WARNING,
          FINDING_TYPES.CYCLE,
          `Circular dependency detected: ${cycleBlocks.map(b => b.label || b.id).join(' \u2192 ')}`,
          { affectedBlockIds: cycleBlockIds, recommendation: 'Break the cycle with an async queue, event bus, or redesign the dependency graph.' }
        ))
        return true
      }
    }

    recursionStack.delete(nodeId)
    return false
  }

  for (const block of blocks) {
    if (!visited.has(block.id)) {
      dfs(block.id)
    }
  }

  return findings
}

function checkTrafficBlackHoles(blocks, edges) {
  const findings = []
  if (!blocks || !edges) return findings

  const hasOutgoing = new Set(edges.map(e => e.sourceId))
  const storageTypes = new Set(['database', 'cache', 'storage', 'message-queue'])

  for (const block of blocks) {
    const isStorage = storageTypes.has(block.type)
    const hasOut = hasOutgoing.has(block.id)

    if (!hasOut && !isStorage && block.type !== 'client') {
      findings.push(makeFinding(
        `val-blackhole-${block.id}`,
        SEVERITY.WARNING,
        FINDING_TYPES.TRAFFIC_BLACK_HOLE,
        `Block "${block.label || block.id}" may be a traffic black hole \u2014 receives but cannot store or forward traffic.`,
        { blockId: block.id, recommendation: 'Add a downstream connection or change to a storage component.' }
      ))
    }
  }
  return findings
}

function checkRedundantPaths(blocks, edges) {
  const findings = []
  if (!blocks || !edges || edges.length < 4) return findings

  const adjacency = buildAdjacencyList(edges)
  const blockIds = blocks.map(b => b.id)

  for (let i = 0; i < blockIds.length; i++) {
    for (let j = i + 1; j < blockIds.length; j++) {
      const paths = findPaths(blockIds[i], blockIds[j], adjacency, 3)
      if (paths.length > 1) {
        findings.push(makeFinding(
          `val-redundant-${blockIds[i]}-${blockIds[j]}`,
          SEVERITY.WARNING,
          FINDING_TYPES.REDUNDANT_PATH,
          `Redundant paths found between ${blockIds[i]} and ${blockIds[j]} (${paths.length} paths).`,
          { affectedBlockIds: [blockIds[i], blockIds[j]], recommendation: 'Verify redundancy is intentional. Unintentional redundancy can cause consistency issues.' }
        ))
      }
    }
  }
  return findings
}

function checkUnusedServices(blocks, edges) {
  const findings = []
  if (!blocks || !edges) return findings

  const reachableFromClient = findReachableNodes(blocks, edges, 'forward')

  for (const block of blocks) {
    if (!reachableFromClient.has(block.id) && block.type !== 'client') {
      findings.push(makeFinding(
        `val-unused-${block.id}`,
        SEVERITY.WARNING,
        FINDING_TYPES.UNUSED_SERVICE,
        `Block "${block.label || block.id}" is unreachable from any client/entry point.`,
        { blockId: block.id, recommendation: 'Connect this block to an entry point or remove it.' }
      ))
    }
  }
  return findings
}

function checkExcessiveFanOut(blocks, edges) {
  const findings = []
  if (!blocks || !edges) return findings

  const outDegree = new Map()
  for (const edge of edges) {
    outDegree.set(edge.sourceId, (outDegree.get(edge.sourceId) || 0) + 1)
  }

  for (const [blockId, count] of outDegree) {
    if (count > EXCESSIVE_FAN_OUT_THRESHOLD) {
      const block = blocks.find(b => b.id === blockId)
      findings.push(makeFinding(
        `val-fanout-${blockId}`,
        SEVERITY.WARNING,
        FINDING_TYPES.EXCESSIVE_FAN_OUT,
        `Block "${block?.label || blockId}" has ${count} outgoing connections (threshold: ${EXCESSIVE_FAN_OUT_THRESHOLD}).`,
        { blockId, affectedBlockIds: edges.filter(e => e.sourceId === blockId).map(e => e.targetId), recommendation: 'Consider using a message bus or load balancer to reduce direct dependencies.' }
      ))
    }
  }
  return findings
}

function checkExcessiveFanIn(blocks, edges) {
  const findings = []
  if (!blocks || !edges) return findings

  const inDegree = new Map()
  for (const edge of edges) {
    inDegree.set(edge.targetId, (inDegree.get(edge.targetId) || 0) + 1)
  }

  for (const [blockId, count] of inDegree) {
    if (count > EXCESSIVE_FAN_IN_THRESHOLD) {
      const block = blocks.find(b => b.id === blockId)
      findings.push(makeFinding(
        `val-fanin-${blockId}`,
        SEVERITY.WARNING,
        FINDING_TYPES.EXCESSIVE_FAN_IN,
        `Block "${block?.label || blockId}" has ${count} incoming connections (threshold: ${EXCESSIVE_FAN_IN_THRESHOLD}).`,
        { blockId, affectedBlockIds: edges.filter(e => e.targetId === blockId).map(e => e.sourceId), recommendation: 'This block may become a bottleneck. Consider sharding or replication.' }
      ))
    }
  }
  return findings
}

function checkSinglePointsOfFailure(blocks, edges) {
  const findings = []
  if (!blocks || !edges) return findings

  const criticalTypes = new Set(['api-gateway', 'load-balancer', 'database', 'service'])
  const adjacency = buildAdjacencyList(edges)
  const reverseAdjacency = buildReverseAdjacencyList(edges)

  for (const block of blocks) {
    if (!criticalTypes.has(block.type)) continue

    if (isSinglePointOfFailure(block.id, blocks, edges, adjacency, reverseAdjacency)) {
      findings.push(makeFinding(
        `val-spof-${block.id}`,
        SEVERITY.RISK,
        FINDING_TYPES.SINGLE_POINT_OF_FAILURE,
        `Block "${block.label || block.id}" is a single point of failure. Its failure would disconnect the architecture.`,
        { blockId: block.id, recommendation: 'Add redundancy: replicas, failover, or alternative paths.' }
      ))
    }
  }
  return findings
}

function checkMissingRedundancy(blocks, edges) {
  const findings = []
  if (!blocks || !edges) return findings

  const shouldBeRedundant = new Set(['api-gateway', 'load-balancer', 'service'])

  for (const block of blocks) {
    if (!shouldBeRedundant.has(block.type)) continue

    const config = parseConfig(block.config) || {}
    const replicas = config.replicas || 1

    if (replicas < 2) {
      findings.push(makeFinding(
        `val-redundancy-${block.id}`,
        SEVERITY.RISK,
        FINDING_TYPES.MISSING_REDUNDANCY,
        `Block "${block.label || block.id}" has only ${replicas} replica(s). No failover available.`,
        { blockId: block.id, recommendation: 'Increase replicas to at least 2 for high availability.' }
      ))
    }
  }
  return findings
}

function checkTightCoupling(blocks, edges) {
  const findings = []
  if (!blocks || !edges) return findings

  const dependents = new Map()
  for (const edge of edges) {
    const set = dependents.get(edge.targetId) || new Set()
    set.add(edge.sourceId)
    dependents.set(edge.targetId, set)
  }

  for (const [blockId, sources] of dependents) {
    if (sources.size > TIGHT_COUPLING_THRESHOLD) {
      const block = blocks.find(b => b.id === blockId)
      findings.push(makeFinding(
        `val-coupling-${blockId}`,
        SEVERITY.RISK,
        FINDING_TYPES.TIGHT_COUPLING,
        `Block "${block?.label || blockId}" is tightly coupled \u2014 ${sources.size} blocks depend on it directly.`,
        { blockId, affectedBlockIds: Array.from(sources), recommendation: 'Introduce an abstraction layer (message queue, API gateway) to reduce direct dependencies.' }
      ))
    }
  }
  return findings
}

function checkCascadingDependencies(blocks, edges) {
  const findings = []
  if (!blocks || !edges) return findings

  const adjacency = buildAdjacencyList(edges)

  for (const block of blocks) {
    const maxDepth = getMaxDepth(block.id, adjacency, new Set())
    if (maxDepth > CASCADING_DEPTH_THRESHOLD) {
      findings.push(makeFinding(
        `val-cascade-${block.id}`,
        SEVERITY.RISK,
        FINDING_TYPES.CASCADING_DEPENDENCY,
        `Block "${block.label || block.id}" has a dependency chain depth of ${maxDepth}. Failures can cascade deeply.`,
        { blockId: block.id, recommendation: 'Reduce chain depth by introducing caching, async processing, or service consolidation.' }
      ))
    }
  }
  return findings
}

function checkResourceConcentration(blocks, edges) {
  const findings = []
  if (!blocks || !edges) return findings

  const resourceHeavyTypes = new Set(['database', 'ai-service', 'message-queue'])
  const heavyBlocks = blocks.filter(b => resourceHeavyTypes.has(b.type))

  if (heavyBlocks.length >= 3) {
    for (let i = 0; i < heavyBlocks.length; i++) {
      for (let j = i + 1; j < heavyBlocks.length; j++) {
        const dist = Math.sqrt(
          Math.pow((heavyBlocks[i].x || 0) - (heavyBlocks[j].x || 0), 2) +
          Math.pow((heavyBlocks[i].y || 0) - (heavyBlocks[j].y || 0), 2)
        )
        if (dist < RESOURCE_CLUSTER_DISTANCE) {
          findings.push(makeFinding(
            `val-concentration-${heavyBlocks[i].id}-${heavyBlocks[j].id}`,
            SEVERITY.RISK,
            FINDING_TYPES.RESOURCE_CONCENTRATION,
            `Resource-heavy blocks "${heavyBlocks[i].label || heavyBlocks[i].id}" and "${heavyBlocks[j].label || heavyBlocks[j].id}" are clustered. A single failure domain could affect both.`,
            { affectedBlockIds: [heavyBlocks[i].id, heavyBlocks[j].id], recommendation: 'Distribute resource-heavy components across failure domains.' }
          ))
        }
      }
    }
  }
  return findings
}

function checkMissingEntryPoints(blocks, edges) {
  const findings = []
  if (!blocks) return findings

  const entryTypes = new Set(['client', 'api-gateway', 'cdn', 'load-balancer'])
  const hasEntry = blocks.some(b => entryTypes.has(b.type))

  if (!hasEntry && blocks.length > 0) {
    findings.push(makeFinding(
      'val-no-entry',
      SEVERITY.WARNING,
      FINDING_TYPES.MISSING_ENTRY_POINT,
      'Architecture has no clear entry point (Client, API Gateway, CDN, or Load Balancer).',
      { recommendation: 'Add an entry point so traffic can enter the architecture.' }
    ))
  }
  return findings
}

function checkMissingExitPoints(blocks, edges) {
  const findings = []
  if (!blocks) return findings

  const exitTypes = new Set(['database', 'cache', 'storage', 'external-api', 'client'])
  const hasExit = blocks.some(b => exitTypes.has(b.type))

  if (!hasExit && blocks.length > 0) {
    findings.push(makeFinding(
      'val-no-exit',
      SEVERITY.WARNING,
      FINDING_TYPES.MISSING_EXIT_POINT,
      'Architecture has no clear exit point (Database, Cache, Storage, External API, or Client).',
      { recommendation: 'Add a terminal component where requests conclude.' }
    ))
  }
  return findings
}

function checkOrphanedNodes(blocks, edges) {
  const findings = []
  if (!blocks || !edges) return findings

  const connected = new Set()
  for (const edge of edges) {
    connected.add(edge.sourceId)
    connected.add(edge.targetId)
  }

  for (const block of blocks) {
    if (!connected.has(block.id)) {
      findings.push(makeFinding(
        `val-orphan-${block.id}`,
        SEVERITY.WARNING,
        FINDING_TYPES.ORPHANED_NODE,
        `Block "${block.label || block.id}" is orphaned \u2014 completely disconnected.`,
        { blockId: block.id, recommendation: 'Connect this block or remove it from the architecture.' }
      ))
    }
  }
  return findings
}

function checkUnreachableNodes(blocks, edges) {
  const findings = []
  if (!blocks || !edges) return findings

  const reachable = findReachableNodes(blocks, edges, 'forward')

  for (const block of blocks) {
    if (!reachable.has(block.id) && block.type !== 'client') {
      findings.push(makeFinding(
        `val-unreachable-${block.id}`,
        SEVERITY.WARNING,
        FINDING_TYPES.UNREACHABLE_NODE,
        `Block "${block.label || block.id}" is unreachable from any entry point.`,
        { blockId: block.id, recommendation: 'Add a path from an entry point to this block.' }
      ))
    }
  }
  return findings
}

// ============================================================================
// SCORING
// ============================================================================

function buildResult(findings, blocks, edges) {
  const criticalCount = findings.filter(f => f.severity === SEVERITY.CRITICAL).length
  const warningCount = findings.filter(f => f.severity === SEVERITY.WARNING).length
  const riskCount = findings.filter(f => f.severity === SEVERITY.RISK).length
  const infoCount = findings.filter(f => f.severity === SEVERITY.INFO).length

  const topologyScore = calculateTopologyScore(blocks, edges, findings)
  const confidenceScore = calculateConfidenceScore(blocks, edges)

  return {
    canSimulate: criticalCount === 0,
    criticalCount,
    warningCount,
    riskCount,
    infoCount,
    findings,
    topologyScore,
    confidenceScore,
  }
}

function calculateTopologyScore(blocks, edges, findings) {
  if (!blocks || blocks.length === 0) return 0

  let score = 1.0

  const criticalCount = findings.filter(f => f.severity === SEVERITY.CRITICAL).length
  score -= criticalCount * 0.25

  const warningCount = findings.filter(f => f.severity === SEVERITY.WARNING).length
  score -= warningCount * 0.05

  const riskCount = findings.filter(f => f.severity === SEVERITY.RISK).length
  score -= riskCount * 0.03

  if (edges && edges.length > 0) {
    const avgFanOut = edges.length / blocks.length
    if (avgFanOut >= 1 && avgFanOut <= 3) score += 0.1
  }

  const hasRedundancy = blocks.some(b => {
    const cfg = parseConfig(b.config) || {}
    return (cfg.replicas || 1) >= 2
  })
  if (hasRedundancy) score += 0.1

  return Math.max(0, Math.min(1, score))
}

function calculateConfidenceScore(blocks, edges) {
  if (!blocks || blocks.length === 0) return 0

  let score = 1.0

  for (const block of blocks) {
    const config = block.config || {}
    const missingFields = []

    if (block.type === 'database' && !config.engine) missingFields.push('engine')
    if (block.type === 'external-api' && !config.url) missingFields.push('url')
    if (block.type === 'service' && !config.replicas) missingFields.push('replicas')

    if (missingFields.length > 0) {
      score -= 0.05 * missingFields.length
    }
  }

  for (const edge of (edges || [])) {
    if (!edge.connectionType && !edge.data?.connectionType) {
      score -= 0.02
    }
  }

  return Math.max(0, Math.min(1, score))
}

// ============================================================================
// GRAPH UTILITIES
// ============================================================================

function buildAdjacencyList(edges) {
  const adj = new Map()
  for (const edge of edges) {
    const neighbors = adj.get(edge.sourceId) || []
    neighbors.push(edge.targetId)
    adj.set(edge.sourceId, neighbors)
  }
  return adj
}

function buildReverseAdjacencyList(edges) {
  const adj = new Map()
  for (const edge of edges) {
    const neighbors = adj.get(edge.targetId) || []
    neighbors.push(edge.sourceId)
    adj.set(edge.targetId, neighbors)
  }
  return adj
}

function findPaths(start, end, adjacency, maxDepth = 5) {
  const paths = []
  const queue = [[start]]

  while (queue.length > 0) {
    const path = queue.shift()
    const last = path[path.length - 1]

    if (last === end && path.length > 1) {
      paths.push(path)
      if (paths.length >= 2) break
      continue
    }

    if (path.length >= maxDepth) continue

    const neighbors = adjacency.get(last) || []
    for (const neighbor of neighbors) {
      if (!path.includes(neighbor)) {
        queue.push([...path, neighbor])
      }
    }
  }

  return paths
}

function findReachableNodes(blocks, edges, direction = 'forward') {
  const reachable = new Set()
  const entryTypes = new Set(['client', 'api-gateway', 'cdn'])
  const exitTypes = new Set(['database', 'cache', 'storage'])

  const adj = direction === 'forward'
    ? buildAdjacencyList(edges)
    : buildReverseAdjacencyList(edges)

  const startingPoints = direction === 'forward'
    ? blocks.filter(b => entryTypes.has(b.type)).map(b => b.id)
    : blocks.filter(b => exitTypes.has(b.type)).map(b => b.id)

  if (startingPoints.length === 0) {
    if (direction === 'forward') {
      const hasIncoming = new Set(edges.map(e => e.targetId))
      startingPoints.push(...blocks.filter(b => !hasIncoming.has(b.id)).map(b => b.id))
    } else {
      const hasOutgoing = new Set(edges.map(e => e.sourceId))
      startingPoints.push(...blocks.filter(b => !hasOutgoing.has(b.id)).map(b => b.id))
    }
  }

  for (const start of startingPoints) {
    const queue = [start]
    reachable.add(start)

    while (queue.length > 0) {
      const current = queue.shift()
      const neighbors = adj.get(current) || []
      for (const neighbor of neighbors) {
        if (!reachable.has(neighbor)) {
          reachable.add(neighbor)
          queue.push(neighbor)
        }
      }
    }
  }

  return reachable
}

function isSinglePointOfFailure(blockId, blocks, edges, adjacency, reverseAdjacency) {
  const entries = blocks.filter(b => ['client', 'api-gateway', 'cdn'].includes(b.type)).map(b => b.id)
  const exits = blocks.filter(b => ['database', 'cache', 'storage'].includes(b.type)).map(b => b.id)

  if (entries.length === 0 || exits.length === 0) return false

  for (const entry of entries) {
    for (const exit of exits) {
      if (entry === blockId || exit === blockId) continue

      const pathsWith = findPathsCount(entry, exit, adjacency, 10)
      if (pathsWith === 0) continue

      const adjWithout = new Map(adjacency)
      adjWithout.delete(blockId)
      for (const [key, neighbors] of adjWithout) {
        adjWithout.set(key, neighbors.filter(n => n !== blockId))
      }

      const pathsWithout = findPathsCount(entry, exit, adjWithout, 10)
      if (pathsWith > 0 && pathsWithout === 0) {
        return true
      }
    }
  }

  return false
}

function findPathsCount(start, end, adjacency, maxDepth = 10) {
  let count = 0
  const queue = [[start]]

  while (queue.length > 0 && count < 100) {
    const path = queue.shift()
    const last = path[path.length - 1]

    if (last === end && path.length > 1) {
      count++
      continue
    }

    if (path.length >= maxDepth) continue

    const neighbors = adjacency.get(last) || []
    for (const neighbor of neighbors) {
      if (!path.includes(neighbor)) {
        queue.push([...path, neighbor])
      }
    }
  }

  return count
}

function getMaxDepth(nodeId, adjacency, visited, depth = 0) {
  if (visited.has(nodeId)) return depth
  visited.add(nodeId)

  const neighbors = adjacency.get(nodeId) || []
  let maxChildDepth = depth

  for (const neighbor of neighbors) {
    const childDepth = getMaxDepth(neighbor, adjacency, new Set(visited), depth + 1)
    maxChildDepth = Math.max(maxChildDepth, childDepth)
  }

  return maxChildDepth
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  SEVERITY,
  FINDING_TYPES,
  EXCESSIVE_FAN_OUT_THRESHOLD,
  EXCESSIVE_FAN_IN_THRESHOLD,
  TIGHT_COUPLING_THRESHOLD,
  CASCADING_DEPTH_THRESHOLD,
  RESOURCE_CLUSTER_DISTANCE,
}