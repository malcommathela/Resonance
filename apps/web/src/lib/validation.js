/**
 * Client-side validation utilities
 *
 * Pre-flight validation + display helpers for architecture findings.
 * Mirrors server-side rules so invalid configs are caught before API call.
 */

// ============================================================================
// SEVERITY CONSTANTS (mirrors server validation.js)
// ============================================================================

export const SEVERITY = {
  CRITICAL: 'critical',
  WARNING: 'warning',
  INFO: 'info',
  RISK: 'risk',
}

// ============================================================================
// FINDING TYPE CONSTANTS (mirrors server validation.js)
// ============================================================================

export const FINDING_TYPES = {
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

// ============================================================================
// SEVERITY DISPLAY CONFIG — Tokenized for dark mode consistency
// ============================================================================

export const SEVERITY_CONFIG = {
  [SEVERITY.CRITICAL]: {
    label: 'Critical',
    /* Tokenized: use CSS variable references instead of hardcoded hex */
    color: 'rgb(var(--error-rgb))',
    bgColor: 'bg-resonance-error/10',
    borderColor: 'border-resonance-error/30',
    textColor: 'text-resonance-error',
    icon: 'AlertOctagon',
    priority: 0,
  },
  [SEVERITY.WARNING]: {
    label: 'Warning',
    color: 'rgb(var(--warning-rgb))',
    bgColor: 'bg-resonance-warning/10',
    borderColor: 'border-resonance-warning/30',
    textColor: 'text-resonance-warning',
    icon: 'AlertTriangle',
    priority: 1,
  },
  [SEVERITY.RISK]: {
    label: 'Risk',
    color: 'rgb(var(--warning-rgb))',
    bgColor: 'bg-resonance-warning/10',
    borderColor: 'border-resonance-warning/30',
    textColor: 'text-resonance-warning',
    icon: 'ShieldAlert',
    priority: 2,
  },
  [SEVERITY.INFO]: {
    label: 'Info',
    color: 'rgb(var(--text-muted-rgb))',
    bgColor: 'bg-resonance-text-muted/10',
    borderColor: 'border-resonance-text-muted/30',
    textColor: 'text-resonance-text-muted',
    icon: 'Info',
    priority: 3,
  },
}

// ============================================================================
// FINDING TYPE LABELS
// ============================================================================

export const FINDING_TYPE_LABELS = {
  [FINDING_TYPES.EMPTY_ARCHITECTURE]: 'Empty Architecture',
  [FINDING_TYPES.MISSING_NODES]: 'Missing Nodes',
  [FINDING_TYPES.BROKEN_EDGES]: 'Broken Edges',
  [FINDING_TYPES.INVALID_REFERENCES]: 'Invalid References',
  [FINDING_TYPES.INVALID_CONFIG]: 'Invalid Configuration',
  [FINDING_TYPES.NEGATIVE_CAPACITY]: 'Negative Capacity',
  [FINDING_TYPES.NEGATIVE_LATENCY]: 'Negative Latency',
  [FINDING_TYPES.IMPOSSIBLE_VALUE]: 'Impossible Value',
  [FINDING_TYPES.UNSUPPORTED_PROTOCOL]: 'Unsupported Protocol',
  [FINDING_TYPES.CONFIGURATION_CORRUPTION]: 'Corrupted Configuration',
  [FINDING_TYPES.DUPLICATE_NODE]: 'Duplicate Node',
  [FINDING_TYPES.DUPLICATE_EDGE]: 'Duplicate Edge',

  [FINDING_TYPES.INVALID_REPLICAS]: 'Invalid Replicas',
  [FINDING_TYPES.INVALID_CPU_LIMIT]: 'Invalid CPU Limit',
  [FINDING_TYPES.INVALID_MEMORY_LIMIT]: 'Invalid Memory Limit',
  [FINDING_TYPES.INVALID_RATE_LIMIT]: 'Invalid Rate Limit',
  [FINDING_TYPES.INVALID_TIMEOUT]: 'Invalid Timeout',
  [FINDING_TYPES.INVALID_BASE_LATENCY]: 'Invalid Base Latency',
  [FINDING_TYPES.INVALID_ERROR_RATE]: 'Invalid Error Rate',
  [FINDING_TYPES.INVALID_MTTR]: 'Invalid MTTR',
  [FINDING_TYPES.INVALID_MTBF]: 'Invalid MTBF',
  [FINDING_TYPES.INVALID_SCALE_THRESHOLD]: 'Invalid Scale Threshold',
  [FINDING_TYPES.INVALID_MAX_REPLICAS]: 'Invalid Max Replicas',
  [FINDING_TYPES.INVALID_AUTO_SCALING]: 'Invalid Auto Scaling',
  [FINDING_TYPES.INVALID_COST]: 'Invalid Cost',
  [FINDING_TYPES.INVALID_PROTOCOL]: 'Invalid Protocol',
  [FINDING_TYPES.INVALID_NETWORK_LATENCY]: 'Invalid Network Latency',
  [FINDING_TYPES.INVALID_RETRY_COUNT]: 'Invalid Retry Count',
  [FINDING_TYPES.INVALID_CIRCUIT_BREAKER_THRESHOLD]: 'Invalid Circuit Breaker Threshold',
  [FINDING_TYPES.INVALID_MAX_THROUGHPUT]: 'Invalid Max Throughput',
  [FINDING_TYPES.INVALID_TLS]: 'Invalid TLS',
  [FINDING_TYPES.INVALID_TRAFFIC_PATTERN]: 'Invalid Traffic Pattern',
  [FINDING_TYPES.INVALID_RPS]: 'Invalid RPS',
  [FINDING_TYPES.INVALID_DURATION]: 'Invalid Duration',
  [FINDING_TYPES.INVALID_SEED]: 'Invalid Seed',
  [FINDING_TYPES.INVALID_CAPACITY]: 'Invalid Capacity',
  [FINDING_TYPES.INVALID_CONFIG_VALUE]: 'Invalid Config Value',

  [FINDING_TYPES.ISOLATED_NODE]: 'Isolated Node',
  [FINDING_TYPES.DEAD_END]: 'Dead End',
  [FINDING_TYPES.CYCLE]: 'Circular Dependency',
  [FINDING_TYPES.TRAFFIC_BLACK_HOLE]: 'Traffic Black Hole',
  [FINDING_TYPES.REDUNDANT_PATH]: 'Redundant Path',
  [FINDING_TYPES.UNUSED_SERVICE]: 'Unused Service',
  [FINDING_TYPES.EXCESSIVE_FAN_OUT]: 'Excessive Fan-Out',
  [FINDING_TYPES.EXCESSIVE_FAN_IN]: 'Excessive Fan-In',
  [FINDING_TYPES.SINGLE_POINT_OF_FAILURE]: 'Single Point of Failure',
  [FINDING_TYPES.MISSING_REDUNDANCY]: 'Missing Redundancy',
  [FINDING_TYPES.TIGHT_COUPLING]: 'Tight Coupling',
  [FINDING_TYPES.CASCADING_DEPENDENCY]: 'Cascading Dependency',
  [FINDING_TYPES.RESOURCE_CONCENTRATION]: 'Resource Concentration',
  [FINDING_TYPES.MISSING_ENTRY_POINT]: 'Missing Entry Point',
  [FINDING_TYPES.MISSING_EXIT_POINT]: 'Missing Exit Point',
  [FINDING_TYPES.ORPHANED_NODE]: 'Orphaned Node',
  [FINDING_TYPES.UNREACHABLE_NODE]: 'Unreachable Node',
}

// ============================================================================
// TOPOLOGY RISK VISUALIZATION CONFIG
// ============================================================================

export const RISK_VISUALIZATION_CONFIG = {
  [FINDING_TYPES.SINGLE_POINT_OF_FAILURE]: {
    nodeStyle: {
      border: '2px solid #ef4444',
      boxShadow: '0 0 12px rgba(239, 68, 68, 0.4), 0 0 24px rgba(239, 68, 68, 0.2)',
      animation: 'pulse-red 2s infinite',
    },
    badge: { text: 'SPOF', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' },
    zIndex: 100,
  },
  [FINDING_TYPES.MISSING_REDUNDANCY]: {
    nodeStyle: {
      border: '2px dashed #f97316',
      boxShadow: '0 0 8px rgba(249, 115, 22, 0.3)',
    },
    badge: { text: 'NO HA', color: '#f97316', bg: 'rgba(249, 115, 22, 0.15)' },
    zIndex: 90,
  },
  [FINDING_TYPES.CYCLE]: {
    nodeStyle: {
      border: '2px solid #f59e0b',
      boxShadow: '0 0 12px rgba(245, 158, 11, 0.4)',
    },
    badge: { text: 'CYCLE', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' },
    zIndex: 95,
  },
  [FINDING_TYPES.ISOLATED_NODE]: {
    nodeStyle: { opacity: 0.5, border: '2px dashed #6b7280' },
    badge: { text: 'ISO', color: '#6b7280', bg: 'rgba(107, 114, 128, 0.15)' },
    zIndex: 80,
  },
  [FINDING_TYPES.ORPHANED_NODE]: {
    nodeStyle: { opacity: 0.4, border: '2px dashed #6b7280' },
    badge: { text: 'ORPHAN', color: '#6b7280', bg: 'rgba(107, 114, 128, 0.15)' },
    zIndex: 80,
  },
  [FINDING_TYPES.UNREACHABLE_NODE]: {
    nodeStyle: { opacity: 0.6, border: '2px dashed #8b5cf6' },
    badge: { text: 'UNREACH', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.15)' },
    zIndex: 85,
  },
  [FINDING_TYPES.DEAD_END]: {
    nodeStyle: { border: '2px solid #f59e0b' },
    badge: { text: 'DEAD END', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' },
    zIndex: 85,
  },
  [FINDING_TYPES.TRAFFIC_BLACK_HOLE]: {
    nodeStyle: {
      border: '2px solid #ec4899',
      boxShadow: '0 0 8px rgba(236, 72, 153, 0.3)',
    },
    badge: { text: 'BLACK HOLE', color: '#ec4899', bg: 'rgba(236, 72, 153, 0.15)' },
    zIndex: 85,
  },
  [FINDING_TYPES.TIGHT_COUPLING]: {
    nodeStyle: { border: '2px solid #3b82f6' },
    badge: { text: 'TIGHT', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' },
    zIndex: 85,
  },
  [FINDING_TYPES.CASCADING_DEPENDENCY]: {
    nodeStyle: { border: '2px solid #8b5cf6' },
    badge: { text: 'CASCADE', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.15)' },
    zIndex: 85,
  },
  [FINDING_TYPES.EXCESSIVE_FAN_OUT]: {
    nodeStyle: { border: '2px solid #06b6d4' },
    badge: { text: 'FAN OUT', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.15)' },
    zIndex: 85,
  },
  [FINDING_TYPES.EXCESSIVE_FAN_IN]: {
    nodeStyle: { border: '2px solid #06b6d4' },
    badge: { text: 'FAN IN', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.15)' },
    zIndex: 85,
  },
  [FINDING_TYPES.INVALID_REPLICAS]: {
    nodeStyle: { border: '2px solid #ef4444' },
    badge: { text: 'REPL', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' },
    zIndex: 85,
  },
  [FINDING_TYPES.INVALID_CPU_LIMIT]: {
    nodeStyle: { border: '2px solid #ef4444' },
    badge: { text: 'CPU', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' },
    zIndex: 85,
  },
  [FINDING_TYPES.INVALID_MEMORY_LIMIT]: {
    nodeStyle: { border: '2px solid #ef4444' },
    badge: { text: 'MEM', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' },
    zIndex: 85,
  },
  [FINDING_TYPES.INVALID_TIMEOUT]: {
    nodeStyle: { border: '2px solid #ef4444' },
    badge: { text: 'TIMEOUT', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' },
    zIndex: 85,
  },
}

// ============================================================================
// VALIDATION CONSTANTS (sync with server)
// ============================================================================

const CONNECTION_TYPES = ['http', 'https', 'grpc', 'tcp', 'udp', 'websocket', 'kafka', 'database']
const TRAFFIC_PATTERNS = ['steady', 'spike', 'ramp', 'chaos']

// ============================================================================
// VALIDATION HELPERS
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
  return { id, severity, type, message, ...opts }
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

function normalizeProtocol(rawProtocol) {
  const aliases = {
    db: 'tcp', database: 'tcp', sql: 'tcp', nosql: 'tcp',
    redis: 'tcp', mongo: 'tcp', postgres: 'tcp',
  }
  return aliases[rawProtocol] || rawProtocol || 'http'
}

// ============================================================================
// CLIENT-SIDE PRE-FLIGHT VALIDATION
// ============================================================================

/**
 * Lightweight pre-flight validation for a single block.
 * Catches property errors before API call.
 */
export function validateBlock(block) {
  const findings = []
  const config = parseConfig(block.config) || {}
  const label = block.label || block.id || 'Unnamed block'

  // replicas: integer >= 1
  if (config.replicas !== undefined) {
    if (!isInteger(config.replicas) || config.replicas < 1) {
      findings.push(makeFinding(
        `cli-replicas-${block.id}`, SEVERITY.CRITICAL, FINDING_TYPES.INVALID_REPLICAS,
        `Block "${label}" has invalid replicas: ${config.replicas}. Must be an integer >= 1.`,
        { blockId: block.id, property: 'replicas', currentValue: config.replicas }
      ))
    }
  }

  // cpuLimit: /^\d+[m]?$/
  if (config.cpuLimit !== undefined && config.cpuLimit !== null && config.cpuLimit !== '') {
    if (!/^\d+[m]?$/.test(String(config.cpuLimit))) {
      findings.push(makeFinding(
        `cli-cpu-${block.id}`, SEVERITY.CRITICAL, FINDING_TYPES.INVALID_CPU_LIMIT,
        `Block "${label}" has invalid cpuLimit: "${config.cpuLimit}".`,
        { blockId: block.id, property: 'cpuLimit', currentValue: config.cpuLimit }
      ))
    }
  }

  // memoryLimit: /^\d+(Mi|Gi|Ki)?$/
  if (config.memoryLimit !== undefined && config.memoryLimit !== null && config.memoryLimit !== '') {
    if (!/^\d+(Mi|Gi|Ki)?$/.test(String(config.memoryLimit))) {
      findings.push(makeFinding(
        `cli-mem-${block.id}`, SEVERITY.CRITICAL, FINDING_TYPES.INVALID_MEMORY_LIMIT,
        `Block "${label}" has invalid memoryLimit: "${config.memoryLimit}".`,
        { blockId: block.id, property: 'memoryLimit', currentValue: config.memoryLimit }
      ))
    }
  }

  // timeoutMs / timeout
  const timeoutMs = config.timeoutMs ?? config.timeout
  if (timeoutMs !== undefined) {
    if (!isInteger(timeoutMs) || timeoutMs < 1) {
      findings.push(makeFinding(
        `cli-timeout-${block.id}`, SEVERITY.CRITICAL, FINDING_TYPES.INVALID_TIMEOUT,
        `Block "${label}" has invalid timeout: ${timeoutMs}ms.`,
        { blockId: block.id, property: 'timeoutMs', currentValue: timeoutMs }
      ))
    }
  }

  // rateLimit
  if (config.rateLimit !== undefined) {
    if (!isInteger(config.rateLimit) || config.rateLimit < 1) {
      findings.push(makeFinding(
        `cli-rate-${block.id}`, SEVERITY.WARNING, FINDING_TYPES.INVALID_RATE_LIMIT,
        `Block "${label}" has invalid rateLimit: ${config.rateLimit}.`,
        { blockId: block.id, property: 'rateLimit', currentValue: config.rateLimit }
      ))
    }
  }

  // baseLatencyMs
  if (config.baseLatencyMs !== undefined && !isNonNegativeFloat(config.baseLatencyMs)) {
    findings.push(makeFinding(
      `cli-latency-${block.id}`, SEVERITY.WARNING, FINDING_TYPES.INVALID_BASE_LATENCY,
      `Block "${label}" has invalid baseLatencyMs: ${config.baseLatencyMs}.`,
      { blockId: block.id, property: 'baseLatencyMs', currentValue: config.baseLatencyMs }
    ))
  }

  // baseErrorRate
  if (config.baseErrorRate !== undefined && !isFloatInRange(config.baseErrorRate, 0, 1)) {
    findings.push(makeFinding(
      `cli-err-${block.id}`, SEVERITY.WARNING, FINDING_TYPES.INVALID_ERROR_RATE,
      `Block "${label}" has invalid baseErrorRate: ${config.baseErrorRate}.`,
      { blockId: block.id, property: 'baseErrorRate', currentValue: config.baseErrorRate }
    ))
  }

  // mttr
  const mttr = config.mttrSeconds ?? config.mttr
  if (mttr !== undefined && (!isInteger(mttr) || mttr < 1)) {
    findings.push(makeFinding(
      `cli-mttr-${block.id}`, SEVERITY.WARNING, FINDING_TYPES.INVALID_MTTR,
      `Block "${label}" has invalid MTTR: ${mttr}.`,
      { blockId: block.id, property: 'mttrSeconds', currentValue: mttr }
    ))
  }

  // mtbf
  const mtbf = config.mtbfSeconds ?? config.mtbf
  if (mtbf !== undefined) {
    if (!isInteger(mtbf) || mtbf < 1) {
      findings.push(makeFinding(
        `cli-mtbf-${block.id}`, SEVERITY.WARNING, FINDING_TYPES.INVALID_MTBF,
        `Block "${label}" has invalid MTBF: ${mtbf}.`,
        { blockId: block.id, property: 'mtbfSeconds', currentValue: mtbf }
      ))
    } else if (mttr !== undefined && mtbf < mttr) {
      findings.push(makeFinding(
        `cli-mtbf-lt-mttr-${block.id}`, SEVERITY.WARNING, FINDING_TYPES.INVALID_MTBF,
        `Block "${label}" has MTBF (${mtbf}s) < MTTR (${mttr}s).`,
        { blockId: block.id, property: 'mtbfSeconds', currentValue: mtbf }
      ))
    }
  }

  // scaleUpThreshold
  if (config.scaleUpThreshold !== undefined && !isFloatInRange(config.scaleUpThreshold, 0, 1)) {
    findings.push(makeFinding(
      `cli-scale-up-${block.id}`, SEVERITY.WARNING, FINDING_TYPES.INVALID_SCALE_THRESHOLD,
      `Block "${label}" has invalid scaleUpThreshold: ${config.scaleUpThreshold}.`,
      { blockId: block.id, property: 'scaleUpThreshold', currentValue: config.scaleUpThreshold }
    ))
  }

  // scaleDownThreshold
  if (config.scaleDownThreshold !== undefined) {
    if (!isFloatInRange(config.scaleDownThreshold, 0, 1)) {
      findings.push(makeFinding(
        `cli-scale-down-${block.id}`, SEVERITY.WARNING, FINDING_TYPES.INVALID_SCALE_THRESHOLD,
        `Block "${label}" has invalid scaleDownThreshold: ${config.scaleDownThreshold}.`,
        { blockId: block.id, property: 'scaleDownThreshold', currentValue: config.scaleDownThreshold }
      ))
    } else if (config.scaleUpThreshold !== undefined && config.scaleDownThreshold >= config.scaleUpThreshold) {
      findings.push(makeFinding(
        `cli-scale-order-${block.id}`, SEVERITY.WARNING, FINDING_TYPES.INVALID_SCALE_THRESHOLD,
        `Block "${label}" scaleDownThreshold >= scaleUpThreshold.`,
        { blockId: block.id, property: 'scaleDownThreshold', currentValue: config.scaleDownThreshold }
      ))
    }
  }

  // maxReplicas
  if (config.maxReplicas !== undefined) {
    if (!isInteger(config.maxReplicas) || config.maxReplicas < 1) {
      findings.push(makeFinding(
        `cli-max-rep-${block.id}`, SEVERITY.WARNING, FINDING_TYPES.INVALID_MAX_REPLICAS,
        `Block "${label}" has invalid maxReplicas: ${config.maxReplicas}.`,
        { blockId: block.id, property: 'maxReplicas', currentValue: config.maxReplicas }
      ))
    } else if (config.minReplicas !== undefined && config.maxReplicas < config.minReplicas) {
      findings.push(makeFinding(
        `cli-max-lt-min-${block.id}`, SEVERITY.WARNING, FINDING_TYPES.INVALID_MAX_REPLICAS,
        `Block "${label}" maxReplicas < minReplicas.`,
        { blockId: block.id, property: 'maxReplicas', currentValue: config.maxReplicas }
      ))
    }
  }

  // autoScaling
  if (config.autoScaling === true && (config.maxReplicas === undefined || config.minReplicas === undefined)) {
    findings.push(makeFinding(
      `cli-autoscale-${block.id}`, SEVERITY.WARNING, FINDING_TYPES.INVALID_AUTO_SCALING,
      `Block "${label}" has autoScaling enabled but missing min/maxReplicas.`,
      { blockId: block.id, property: 'autoScaling', currentValue: true }
    ))
  }

  // cost fields (info)
  ['costPerHour', 'costPerRequest', 'hourlyComputeCost', 'perRequestCost', 'perGbNetworkCost', 'storageCostPerGbMonth'].forEach(key => {
    if (config[key] !== undefined && !isNonNegativeFloat(config[key])) {
      findings.push(makeFinding(
        `cli-${key}-${block.id}`, SEVERITY.INFO, FINDING_TYPES.INVALID_COST,
        `Block "${label}" has invalid ${key}: ${config[key]}.`,
        { blockId: block.id, property: key, currentValue: config[key] }
      ))
    }
  })

  // Batch 3 behavioral properties
  if (config.maxConnections !== undefined && (!isInteger(config.maxConnections) || config.maxConnections < 1)) {
    findings.push(makeFinding(`cli-max-conn-${block.id}`, SEVERITY.WARNING, FINDING_TYPES.INVALID_CAPACITY,
      `Block "${label}" has invalid maxConnections.`, { blockId: block.id, property: 'maxConnections' }))
  }
  if (config.maxPartitions !== undefined && (!isInteger(config.maxPartitions) || config.maxPartitions < 1)) {
    findings.push(makeFinding(`cli-max-part-${block.id}`, SEVERITY.WARNING, FINDING_TYPES.INVALID_CAPACITY,
      `Block "${label}" has invalid maxPartitions.`, { blockId: block.id, property: 'maxPartitions' }))
  }
  if (config.errorDistribution !== undefined && !['uniform', 'exponential', 'burst'].includes(config.errorDistribution)) {
    findings.push(makeFinding(`cli-err-dist-${block.id}`, SEVERITY.WARNING, FINDING_TYPES.INVALID_CONFIG_VALUE,
      `Block "${label}" has invalid errorDistribution.`, { blockId: block.id, property: 'errorDistribution' }))
  }
  if (config.slaTarget !== undefined && !isFloatInRange(config.slaTarget, 0, 1)) {
    findings.push(makeFinding(`cli-sla-${block.id}`, SEVERITY.WARNING, FINDING_TYPES.INVALID_CONFIG_VALUE,
      `Block "${label}" has invalid slaTarget.`, { blockId: block.id, property: 'slaTarget' }))
  }
  if (config.storagePerRequest !== undefined && !isNonNegativeFloat(config.storagePerRequest)) {
    findings.push(makeFinding(`cli-stor-${block.id}`, SEVERITY.WARNING, FINDING_TYPES.INVALID_CONFIG_VALUE,
      `Block "${label}" has invalid storagePerRequest.`, { blockId: block.id, property: 'storagePerRequest' }))
  }
  if (config.failureProbabilityPerHour !== undefined && !isFloatInRange(config.failureProbabilityPerHour, 0, 1)) {
    findings.push(makeFinding(`cli-fail-prob-${block.id}`, SEVERITY.WARNING, FINDING_TYPES.INVALID_CONFIG_VALUE,
      `Block "${label}" has invalid failureProbabilityPerHour.`, { blockId: block.id, property: 'failureProbabilityPerHour' }))
  }
  if (config.recoveryProbabilityPerMinute !== undefined && !isFloatInRange(config.recoveryProbabilityPerMinute, 0, 1)) {
    findings.push(makeFinding(`cli-rec-prob-${block.id}`, SEVERITY.WARNING, FINDING_TYPES.INVALID_CONFIG_VALUE,
      `Block "${label}" has invalid recoveryProbabilityPerMinute.`, { blockId: block.id, property: 'recoveryProbabilityPerMinute' }))
  }

  return findings
}

/**
 * Lightweight pre-flight validation for a single edge.
 */
export function validateEdge(edge) {
  const findings = []
  const data = parseConfig(edge.data) || {}
  const config = { ...data, ...edge }
  // FIX: read both React Flow (source/target) and DB (sourceId/targetId) naming
  const src = edge.source || edge.sourceId
  const tgt = edge.target || edge.targetId
  const edgeLabel = edge.id || `${src || '?'}-${tgt || '?'}`

  // protocol
  const rawProtocol = config.protocol || config.connectionType || data.connectionType || 'http'
  const protocol = normalizeProtocol(rawProtocol)
  if (!CONNECTION_TYPES.includes(protocol)) {
    findings.push(makeFinding(
      `cli-proto-${edge.id || 'unknown'}`, SEVERITY.CRITICAL, FINDING_TYPES.UNSUPPORTED_PROTOCOL,
      `Edge ${edgeLabel} uses unsupported protocol: "${rawProtocol}"`,
      { edgeId: edge.id, property: 'protocol', currentValue: rawProtocol }
    ))
  }

  // networkLatencyMs
  if (config.networkLatencyMs !== undefined && !isNonNegativeFloat(config.networkLatencyMs)) {
    findings.push(makeFinding(`cli-net-lat-${edge.id}`, SEVERITY.WARNING, FINDING_TYPES.INVALID_NETWORK_LATENCY,
      `Edge ${edgeLabel} has invalid networkLatencyMs.`, { edgeId: edge.id, property: 'networkLatencyMs' }))
  }

  // retryCount
  if (config.retryCount !== undefined && (!isInteger(config.retryCount) || config.retryCount < 0)) {
    findings.push(makeFinding(`cli-retry-${edge.id}`, SEVERITY.WARNING, FINDING_TYPES.INVALID_RETRY_COUNT,
      `Edge ${edgeLabel} has invalid retryCount.`, { edgeId: edge.id, property: 'retryCount' }))
  }

  // circuitBreakerThreshold
  if (config.circuitBreakerThreshold !== undefined && !isFloatInRange(config.circuitBreakerThreshold, 0, 1)) {
    findings.push(makeFinding(`cli-cb-${edge.id}`, SEVERITY.WARNING, FINDING_TYPES.INVALID_CIRCUIT_BREAKER_THRESHOLD,
      `Edge ${edgeLabel} has invalid circuitBreakerThreshold.`, { edgeId: edge.id, property: 'circuitBreakerThreshold' }))
  }

  // maxThroughput / maxRps
  const throughput = config.maxThroughput ?? config.maxRps
  if (throughput !== undefined && (!isInteger(throughput) || throughput < 1)) {
    findings.push(makeFinding(`cli-tput-${edge.id}`, SEVERITY.WARNING, FINDING_TYPES.INVALID_MAX_THROUGHPUT,
      `Edge ${edgeLabel} has invalid max throughput.`, { edgeId: edge.id, property: 'maxThroughput' }))
  }

  // tlsEnabled
  if (config.tlsEnabled !== undefined && !isBoolean(config.tlsEnabled)) {
    findings.push(makeFinding(`cli-tls-${edge.id}`, SEVERITY.WARNING, FINDING_TYPES.INVALID_TLS,
      `Edge ${edgeLabel} has invalid tlsEnabled.`, { edgeId: edge.id, property: 'tlsEnabled' }))
  }

  // timeoutMs
  if (config.timeoutMs !== undefined && (!isInteger(config.timeoutMs) || config.timeoutMs < 1)) {
    findings.push(makeFinding(`cli-edge-to-${edge.id}`, SEVERITY.CRITICAL, FINDING_TYPES.INVALID_TIMEOUT,
      `Edge ${edgeLabel} has invalid timeoutMs.`, { edgeId: edge.id, property: 'timeoutMs' }))
  }

  // Batch 3 edge properties
  if (config.keepAlive !== undefined && !isBoolean(config.keepAlive)) {
    findings.push(makeFinding(`cli-ka-${edge.id}`, SEVERITY.WARNING, FINDING_TYPES.INVALID_CONFIG_VALUE,
      `Edge ${edgeLabel} keepAlive must be boolean.`, { edgeId: edge.id, property: 'keepAlive' }))
  }
  if (config.keepAliveTimeoutMs !== undefined && (!isInteger(config.keepAliveTimeoutMs) || config.keepAliveTimeoutMs < 1)) {
    findings.push(makeFinding(`cli-ka-to-${edge.id}`, SEVERITY.WARNING, FINDING_TYPES.INVALID_CONFIG_VALUE,
      `Edge ${edgeLabel} invalid keepAliveTimeoutMs.`, { edgeId: edge.id, property: 'keepAliveTimeoutMs' }))
  }
  if (config.compressionRatio !== undefined && (typeof config.compressionRatio !== 'number' || config.compressionRatio <= 0)) {
    findings.push(makeFinding(`cli-comp-ratio-${edge.id}`, SEVERITY.WARNING, FINDING_TYPES.INVALID_CONFIG_VALUE,
      `Edge ${edgeLabel} invalid compressionRatio.`, { edgeId: edge.id, property: 'compressionRatio' }))
  }
  if (config.compressionMs !== undefined && !isNonNegativeFloat(config.compressionMs)) {
    findings.push(makeFinding(`cli-comp-ms-${edge.id}`, SEVERITY.WARNING, FINDING_TYPES.INVALID_CONFIG_VALUE,
      `Edge ${edgeLabel} invalid compressionMs.`, { edgeId: edge.id, property: 'compressionMs' }))
  }
  if (config.decompressionMs !== undefined && !isNonNegativeFloat(config.decompressionMs)) {
    findings.push(makeFinding(`cli-decomp-${edge.id}`, SEVERITY.WARNING, FINDING_TYPES.INVALID_CONFIG_VALUE,
      `Edge ${edgeLabel} invalid decompressionMs.`, { edgeId: edge.id, property: 'decompressionMs' }))
  }
  if (config.bandwidthMbps !== undefined && !isNonNegativeFloat(config.bandwidthMbps)) {
    findings.push(makeFinding(`cli-bw-${edge.id}`, SEVERITY.WARNING, FINDING_TYPES.INVALID_CONFIG_VALUE,
      `Edge ${edgeLabel} invalid bandwidthMbps.`, { edgeId: edge.id, property: 'bandwidthMbps' }))
  }
  if (config.mtuBytes !== undefined && (!isInteger(config.mtuBytes) || config.mtuBytes < 1)) {
    findings.push(makeFinding(`cli-mtu-${edge.id}`, SEVERITY.WARNING, FINDING_TYPES.INVALID_CONFIG_VALUE,
      `Edge ${edgeLabel} invalid mtuBytes.`, { edgeId: edge.id, property: 'mtuBytes' }))
  }
  if (config.circuitBreakerHalfOpenRequests !== undefined && (!isInteger(config.circuitBreakerHalfOpenRequests) || config.circuitBreakerHalfOpenRequests < 1)) {
    findings.push(makeFinding(`cli-cb-half-${edge.id}`, SEVERITY.WARNING, FINDING_TYPES.INVALID_CONFIG_VALUE,
      `Edge ${edgeLabel} invalid circuitBreakerHalfOpenRequests.`, { edgeId: edge.id, property: 'circuitBreakerHalfOpenRequests' }))
  }
  if (config.maxConcurrent !== undefined && (!isInteger(config.maxConcurrent) || config.maxConcurrent < 1)) {
    findings.push(makeFinding(`cli-max-conc-${edge.id}`, SEVERITY.WARNING, FINDING_TYPES.INVALID_CAPACITY,
      `Edge ${edgeLabel} invalid maxConcurrent.`, { edgeId: edge.id, property: 'maxConcurrent' }))
  }
  if (config.maxPayloadBytes !== undefined && (!isInteger(config.maxPayloadBytes) || config.maxPayloadBytes < 1)) {
    findings.push(makeFinding(`cli-max-payload-${edge.id}`, SEVERITY.WARNING, FINDING_TYPES.INVALID_CONFIG_VALUE,
      `Edge ${edgeLabel} invalid maxPayloadBytes.`, { edgeId: edge.id, property: 'maxPayloadBytes' }))
  }
  if (config.mTLS !== undefined && !isBoolean(config.mTLS)) {
    findings.push(makeFinding(`cli-mtls-${edge.id}`, SEVERITY.WARNING, FINDING_TYPES.INVALID_CONFIG_VALUE,
      `Edge ${edgeLabel} mTLS must be boolean.`, { edgeId: edge.id, property: 'mTLS' }))
  }

  return findings
}

/**
 * Pre-flight validation for simulation config.
 */
export function validateSimulationConfig(config) {
  const findings = []

  if (config.trafficPattern !== undefined && !TRAFFIC_PATTERNS.includes(config.trafficPattern)) {
    findings.push(makeFinding('cli-traffic', SEVERITY.CRITICAL, FINDING_TYPES.INVALID_TRAFFIC_PATTERN,
      `Invalid trafficPattern: "${config.trafficPattern}".`, { property: 'trafficPattern', currentValue: config.trafficPattern }))
  }
  if (config.rps !== undefined && (!isInteger(config.rps) || config.rps < 1)) {
    findings.push(makeFinding('cli-rps', SEVERITY.CRITICAL, FINDING_TYPES.INVALID_RPS,
      `Invalid rps: ${config.rps}.`, { property: 'rps', currentValue: config.rps }))
  }
  if (config.duration !== undefined && (!isInteger(config.duration) || config.duration < 10)) {
    findings.push(makeFinding('cli-duration', SEVERITY.CRITICAL, FINDING_TYPES.INVALID_DURATION,
      `Invalid duration: ${config.duration}s.`, { property: 'duration', currentValue: config.duration }))
  }
  if (config.deterministicSeed !== undefined && config.deterministicSeed !== null && typeof config.deterministicSeed !== 'string') {
    findings.push(makeFinding('cli-seed', SEVERITY.INFO, FINDING_TYPES.INVALID_SEED,
      `Invalid deterministicSeed: must be a string.`, { property: 'deterministicSeed', currentValue: config.deterministicSeed }))
  }
  if (config.monteCarloPasses !== undefined && (!isInteger(config.monteCarloPasses) || config.monteCarloPasses < 1)) {
    findings.push(makeFinding('cli-monte', SEVERITY.WARNING, FINDING_TYPES.INVALID_CONFIG_VALUE,
      `Invalid monteCarloPasses.`, { property: 'monteCarloPasses', currentValue: config.monteCarloPasses }))
  }
  if (config.confidenceLevel !== undefined && !isFloatInRange(config.confidenceLevel, 0, 1)) {
    findings.push(makeFinding('cli-confidence', SEVERITY.WARNING, FINDING_TYPES.INVALID_CONFIG_VALUE,
      `Invalid confidenceLevel.`, { property: 'confidenceLevel', currentValue: config.confidenceLevel }))
  }

  return findings
}

/**
 * Lightweight pre-flight architecture validation.
 * Does property checks + basic topology (empty, broken edges, missing refs).
 * Deep graph analysis (cycles, SPOF) is server-side only.
 */
export function preValidateArchitecture(blocks, edges, simulationConfig) {
  const findings = []

  // Empty architecture
  if (!blocks || blocks.length === 0) {
    findings.push(makeFinding('cli-empty', SEVERITY.CRITICAL, FINDING_TYPES.EMPTY_ARCHITECTURE,
      'Architecture is empty. Add at least one component.', {}))
  }

  // Basic topology: broken edges, missing refs, duplicates
  if (blocks && edges) {
    const blockIds = new Set(blocks.map(b => b.id))

    // Missing node refs
    for (const edge of edges) {
      // FIX: normalize both React Flow and DB naming conventions
      const src = edge.source || edge.sourceId
      const tgt = edge.target || edge.targetId

      if (!src || !tgt) {
        findings.push(makeFinding(`cli-broken-${edge.id || 'unknown'}`, SEVERITY.CRITICAL, FINDING_TYPES.BROKEN_EDGES,
          `Edge ${edge.id || '(unknown)'} missing source or target.`, { edgeId: edge.id }))
      }
      if (src && !blockIds.has(src)) {
        findings.push(makeFinding(`cli-missing-src-${edge.id}`, SEVERITY.CRITICAL, FINDING_TYPES.MISSING_NODES,
          `Edge references missing source: ${src}.`, { edgeId: edge.id, affectedBlockIds: [src] }))
      }
      if (tgt && !blockIds.has(tgt)) {
        findings.push(makeFinding(`cli-missing-tgt-${edge.id}`, SEVERITY.CRITICAL, FINDING_TYPES.MISSING_NODES,
          `Edge references missing target: ${tgt}.`, { edgeId: edge.id, affectedBlockIds: [tgt] }))
      }
      if (src && tgt && src === tgt) {
        findings.push(makeFinding(`cli-self-${edge.id}`, SEVERITY.CRITICAL, FINDING_TYPES.INVALID_REFERENCES,
          `Self-referencing edge on ${src}.`, { edgeId: edge.id, blockId: src, affectedBlockIds: [src] }))
      }
    }

    // Duplicate nodes
    const seenIds = new Set()
    for (const block of blocks) {
      if (seenIds.has(block.id)) {
        findings.push(makeFinding(`cli-dup-node-${block.id}`, SEVERITY.CRITICAL, FINDING_TYPES.DUPLICATE_NODE,
          `Duplicate block ID: ${block.id}.`, { blockId: block.id, affectedBlockIds: [block.id] }))
      }
      seenIds.add(block.id)
    }

    // Duplicate edges
    const seenEdges = new Set()
    for (const edge of edges) {
      // FIX: normalize both naming conventions
      const src = edge.source || edge.sourceId
      const tgt = edge.target || edge.targetId
      const key = `${src}->${tgt}`
      if (seenEdges.has(key)) {
        findings.push(makeFinding(`cli-dup-edge-${edge.id}`, SEVERITY.WARNING, FINDING_TYPES.DUPLICATE_EDGE,
          `Duplicate edge: ${src} \u2192 ${tgt}.`, { edgeId: edge.id, affectedBlockIds: [src, tgt].filter(Boolean) }))
      }
      seenEdges.add(key)
    }

    // Isolated / orphaned
    const connected = new Set()
    for (const edge of edges) {
      // FIX: normalize both naming conventions
      connected.add(edge.source || edge.sourceId)
      connected.add(edge.target || edge.targetId)
    }
    for (const block of blocks) {
      if (!connected.has(block.id)) {
        findings.push(makeFinding(`cli-isolated-${block.id}`, SEVERITY.WARNING, FINDING_TYPES.ISOLATED_NODE,
          `Block "${block.label || block.id}" is isolated.`, { blockId: block.id }))
      }
    }
  }

  // Property validation per block/edge
  if (blocks) {
    for (const block of blocks) {
      findings.push(...validateBlock(block))
    }
  }
  if (edges) {
    for (const edge of edges) {
      findings.push(...validateEdge(edge))
    }
  }

  // Simulation config
  if (simulationConfig) {
    findings.push(...validateSimulationConfig(simulationConfig))
  }

  const criticalCount = findings.filter(f => f.severity === SEVERITY.CRITICAL).length
  const warningCount = findings.filter(f => f.severity === SEVERITY.WARNING).length
  const riskCount = findings.filter(f => f.severity === SEVERITY.RISK).length
  const infoCount = findings.filter(f => f.severity === SEVERITY.INFO).length

  return {
    canSimulate: criticalCount === 0,
    criticalCount,
    warningCount,
    riskCount,
    infoCount,
    findings,
    topologyScore: null, // computed server-side
    confidenceScore: null, // computed server-side
    isPreFlight: true,
  }
}

// ============================================================================
// VALIDATION SUMMARY HELPERS
// ============================================================================

export function groupFindingsBySeverity(findings) {
  const grouped = {
    [SEVERITY.CRITICAL]: [],
    [SEVERITY.WARNING]: [],
    [SEVERITY.RISK]: [],
    [SEVERITY.INFO]: [],
  }
  for (const finding of findings) {
    if (grouped[finding.severity]) {
      grouped[finding.severity].push(finding)
    }
  }
  return grouped
}

export function groupFindingsByBlock(findings) {
  const grouped = {}
  for (const finding of findings) {
    const blockIds = finding.affectedBlockIds || (finding.blockId ? [finding.blockId] : [])
    for (const blockId of blockIds) {
      if (!grouped[blockId]) grouped[blockId] = []
      grouped[blockId].push(finding)
    }
  }
  return grouped
}

export function getBlockHighestSeverity(findings, blockId) {
  const blockFindings = findings.filter(f =>
    (f.affectedBlockIds || []).includes(blockId) || f.blockId === blockId
  )
  if (blockFindings.length === 0) return null

  const priority = { [SEVERITY.CRITICAL]: 0, [SEVERITY.WARNING]: 1, [SEVERITY.RISK]: 2, [SEVERITY.INFO]: 3 }
  return blockFindings.reduce((highest, f) =>
    priority[f.severity] < priority[highest.severity] ? f : highest
  )
}

export function computeNodeRiskStyles(findings) {
  const styles = {}
  const badges = {}

  for (const finding of findings) {
    const config = RISK_VISUALIZATION_CONFIG[finding.type]
    if (!config) continue

    const blockIds = finding.affectedBlockIds || (finding.blockId ? [finding.blockId] : [])
    for (const blockId of blockIds) {
      const existingPriority = badges[blockId]?.priority ?? Infinity
      const newPriority = SEVERITY_CONFIG[finding.severity]?.priority ?? 999
      if (newPriority <= existingPriority) {
        styles[blockId] = config.nodeStyle
        badges[blockId] = { ...config.badge, priority: newPriority }
      }
    }
  }

  return { styles, badges }
}

export function getValidationSummary(validation) {
  if (!validation) return 'No validation data'
  const { criticalCount, warningCount, riskCount, canSimulate, isPreFlight } = validation

  if (criticalCount > 0) {
    return `${criticalCount} critical error${criticalCount > 1 ? 's' : ''} prevent simulation`
  }
  if (warningCount > 0 || riskCount > 0) {
    return `${warningCount} warning${warningCount !== 1 ? 's' : ''}, ${riskCount} risk${riskCount !== 1 ? 's' : ''} \u2014 simulation allowed`
  }
  return isPreFlight ? 'Pre-flight check passed \u2014 ready for server validation' : 'Architecture valid \u2014 ready for simulation'
}

export function getValidationStatusClass(validation) {
  if (!validation) return 'bg-gray-500/10 text-gray-400 border-gray-500/30'
  if (validation.criticalCount > 0) return 'bg-red-500/10 text-red-400 border-red-500/30'
  if (validation.warningCount > 0 || validation.riskCount > 0) {
    return 'bg-amber-500/10 text-amber-400 border-amber-500/30'
  }
  return 'bg-green-500/10 text-green-400 border-green-500/30'
}

export function getValidationStatusIcon(validation) {
  if (!validation) return 'Circle'
  if (validation.criticalCount > 0) return 'XCircle'
  if (validation.warningCount > 0 || validation.riskCount > 0) return 'AlertTriangle'
  return 'CheckCircle2'
}

export function formatTopologyScore(score) {
  if (score === undefined || score === null) return '\u2014'
  return `${Math.round(score * 100)}%`
}

export function formatConfidenceScore(score) {
  if (score === undefined || score === null) return '\u2014'
  return `${Math.round(score * 100)}%`
}

/**
 * Extract a short property label for UI badges.
 */
export function getPropertyLabel(property) {
  if (!property) return null
  const labels = {
    replicas: 'Replicas',
    cpuLimit: 'CPU',
    memoryLimit: 'Memory',
    rateLimit: 'Rate Limit',
    timeoutMs: 'Timeout',
    timeout: 'Timeout',
    baseLatencyMs: 'Latency',
    baseErrorRate: 'Error Rate',
    mttrSeconds: 'MTTR',
    mtbfSeconds: 'MTBF',
    scaleUpThreshold: 'Scale Up',
    scaleDownThreshold: 'Scale Down',
    maxReplicas: 'Max Replicas',
    minReplicas: 'Min Replicas',
    autoScaling: 'Auto Scale',
    costPerHour: 'Cost/hr',
    costPerRequest: 'Cost/req',
    protocol: 'Protocol',
    networkLatencyMs: 'Net Latency',
    retryCount: 'Retries',
    circuitBreakerThreshold: 'CB Threshold',
    maxThroughput: 'Throughput',
    tlsEnabled: 'TLS',
    trafficPattern: 'Traffic',
    rps: 'RPS',
    duration: 'Duration',
    deterministicSeed: 'Seed',
    maxConnections: 'Max Conn',
    maxPartitions: 'Partitions',
    errorDistribution: 'Error Dist',
    slaTarget: 'SLA',
    hourlyComputeCost: 'Compute $',
    perRequestCost: 'Req $',
    perGbNetworkCost: 'Net $',
    storageCostPerGbMonth: 'Storage $',
    failureProbabilityPerHour: 'Fail Prob',
    recoveryProbabilityPerMinute: 'Rec Prob',
    keepAlive: 'Keep-Alive',
    keepAliveTimeoutMs: 'KA Timeout',
    compressionRatio: 'Compression',
    bandwidthMbps: 'Bandwidth',
    mtuBytes: 'MTU',
    maxRps: 'Max RPS',
    maxConcurrent: 'Max Conc',
    maxPayloadBytes: 'Max Payload',
  }
  return labels[property] || property
}

// ============================================================================
// SINGLE PROPERTY VALIDATION (Batch 5D)
// ============================================================================

/**
 * Validate a single property value for a block.
 * Returns { valid: boolean, message?: string }.
 * Used for real-time field validation in PropertyPanel.
 */
export function validateSingleProperty(block, propertyName, value) {
  const config = block.data?.config || {}
  const behavioral = config.behavioralModel || {}
  const label = block.data?.label || block.id || 'Unnamed block'

  // Helper to read current behavioral model value (for cross-field checks)
  const b = (section, key) => behavioral[section]?.[key]

  switch (propertyName) {
    // --- Capacity ---
    case 'maxThroughput':
      if (!isInteger(value) || value < 1) return { valid: false, message: 'Must be an integer ≥ 1' }
      break
    case 'maxConcurrent':
      if (!isInteger(value) || value < 1) return { valid: false, message: 'Must be an integer ≥ 1' }
      break
    case 'maxQueueDepth':
      if (!isInteger(value) || value < 0) return { valid: false, message: 'Must be an integer ≥ 0' }
      break
    case 'maxConnections':
      if (!isInteger(value) || value < 1) return { valid: false, message: 'Must be an integer ≥ 1' }
      break

    // --- Latency ---
    case 'baseLatencyMs':
    case 'latencyStdDevMs':
    case 'queueLatencyMs':
    case 'cacheHitLatencyMs':
    case 'cacheMissLatencyMs':
      if (!isNonNegativeFloat(value)) return { valid: false, message: 'Must be ≥ 0' }
      break
    case 'cacheHitRate':
      if (!isFloatInRange(value, 0, 1)) return { valid: false, message: 'Must be between 0 and 1' }
      break

    // --- Error Characteristics ---
    case 'baseErrorRate':
    case 'errorRateUnderLoad':
      if (!isFloatInRange(value, 0, 1)) return { valid: false, message: 'Must be between 0 and 1' }
      break
    case 'errorDistribution':
      if (!['uniform', 'exponential', 'burst'].includes(value)) return { valid: false, message: 'Must be uniform, exponential, or burst' }
      break

    // --- Resources ---
    case 'cpuPerRequest':
    case 'memoryPerConnection':
      if (!isNonNegativeFloat(value)) return { valid: false, message: 'Must be ≥ 0' }
      break
    case 'threadPoolSize':
    case 'connectionPoolSize':
      if (!isInteger(value) || value < 1) return { valid: false, message: 'Must be an integer ≥ 1' }
      break

    // --- Scaling ---
    case 'scalingType':
      if (!['none', 'horizontal', 'vertical', 'auto'].includes(value)) return { valid: false, message: 'Invalid scaling type' }
      break
    case 'scaleUpThreshold':
      if (!isFloatInRange(value, 0, 1)) return { valid: false, message: 'Must be between 0 and 1' }
      break
    case 'scaleDownThreshold': {
      const up = b('scalingBehavior', 'scaleUpThreshold') ?? 0.8
      if (!isFloatInRange(value, 0, 1)) return { valid: false, message: 'Must be between 0 and 1' }
      if (value >= up) return { valid: false, message: 'Must be less than scale-up threshold' }
      break
    }
    case 'minReplicas':
      if (!isInteger(value) || value < 1) return { valid: false, message: 'Must be an integer ≥ 1' }
      break
    case 'maxReplicas': {
      const min = b('scalingBehavior', 'minReplicas') ?? 1
      if (!isInteger(value) || value < 1) return { valid: false, message: 'Must be an integer ≥ 1' }
      if (value < min) return { valid: false, message: `Must be ≥ min replicas (${min})` }
      break
    }

    // --- Cost ---
    case 'hourlyComputeCost':
    case 'perRequestCost':
    case 'perGbNetworkCost':
      if (!isNonNegativeFloat(value)) return { valid: false, message: 'Must be ≥ 0' }
      break

    // --- Availability ---
    case 'slaTarget':
      if (!isFloatInRange(value, 0, 1)) return { valid: false, message: 'Must be between 0 and 1' }
      break
    case 'mttrMinutes':
      if (!isInteger(value) || value < 0) return { valid: false, message: 'Must be an integer ≥ 0' }
      break
    case 'mtbfHours': {
      const mttr = b('availability', 'mttrMinutes') ?? 0
      if (!isInteger(value) || value < 1) return { valid: false, message: 'Must be an integer ≥ 1' }
      if (value * 60 < mttr) return { valid: false, message: 'MTBF (in minutes) must be greater than MTTR' }
      break
    }

    // --- Top-level config (legacy / custom) ---
    case 'replicas':
      if (!isInteger(value) || value < 1) return { valid: false, message: 'Must be an integer ≥ 1' }
      break
    case 'cpuLimit':
      if (value !== undefined && value !== null && value !== '' && !/^\d+[m]?$/.test(String(value))) {
        return { valid: false, message: 'Invalid format (e.g., 500 or 500m)' }
      }
      break
    case 'memoryLimit':
      if (value !== undefined && value !== null && value !== '' && !/^\d+(Mi|Gi|Ki)?$/.test(String(value))) {
        return { valid: false, message: 'Invalid format (e.g., 512Mi, 1Gi)' }
      }
      break
    case 'timeoutMs':
    case 'timeout':
      if (!isInteger(value) || value < 1) return { valid: false, message: 'Must be an integer ≥ 1' }
      break
    case 'rateLimit':
      if (!isInteger(value) || value < 1) return { valid: false, message: 'Must be an integer ≥ 1' }
      break

    default:
      if (typeof value === 'number' && Number.isNaN(value)) {
        return { valid: false, message: 'Invalid number' }
      }
      break
  }

  return { valid: true }
}

/**
 * Validate a single property value for an edge.
 */
export function validateEdgeProperty(edge, propertyName, value) {
  switch (propertyName) {
    case 'maxRetries':
      if (!isInteger(value) || value < 0 || value > 10) return { valid: false, message: 'Must be 0–10' }
      break
    case 'timeoutMs':
      if (!isInteger(value) || value < 0 || value > 300000) return { valid: false, message: 'Must be 0–300,000' }
      break
    case 'baseLatencyMs':
    case 'jitterMs':
    case 'handshakeMs':
      if (!isNonNegativeFloat(value)) return { valid: false, message: 'Must be ≥ 0' }
      break
    case 'packetLossRate':
      if (!isFloatInRange(value, 0, 1)) return { valid: false, message: 'Must be between 0 and 1' }
      break
    case 'maxRps':
      if (!isInteger(value) || value < 1) return { valid: false, message: 'Must be an integer ≥ 1' }
      break
    case 'maxConcurrent':
      if (!isInteger(value) || value < 1) return { valid: false, message: 'Must be an integer ≥ 1' }
      break
    default:
      break
  }
  return { valid: true }
}