// Property definition registry (Phase 5).
// Every inspector field comes from here — never from enumerating node.config.
// Ownership is explicit: `deployment` lives in config, `behavior` lives in
// behavioralModel, `presentation` lives on the node itself. Unknown/legacy
// config keys are NOT definitions; the resolver reports them separately so the
// panel renders them as Advanced and never deletes them.
// Dependency-free: covered by property.check.js (run: node property.check.js).

// path: walk from the node root. ['label'] = node.data.label,
// ['config','engine'] = node.data.config.engine,
// ['behavioralModel','capacity','maxThroughput'] = node.data.config.behavioralModel...
export const PROPERTY_DEFINITIONS = [
  // Presentation
  { id: 'label', label: 'Name', category: 'presentation', path: ['label'], type: 'string' },
  { id: 'blockType', label: 'Block Type', category: 'presentation', path: ['type'], type: 'string' },
  { id: 'icon', label: 'Icon', category: 'presentation', path: ['icon'], type: 'string' },
  { id: 'color', label: 'Color', category: 'presentation', path: ['color'], type: 'string' },
  { id: 'category', label: 'Category', category: 'presentation', path: ['category'], type: 'string' },

  // Deployment (config.*)
  { id: 'engine', label: 'Engine', category: 'deployment', path: ['config', 'engine'], type: 'string', visible: (n) => n?.data?.type === 'database' },
  { id: 'replicas', label: 'Replicas', category: 'deployment', path: ['config', 'replicas'], type: 'number' },
  { id: 'port', label: 'Port', category: 'deployment', path: ['config', 'port'], type: 'number' },
  { id: 'cpu', label: 'CPU', category: 'deployment', path: ['config', 'cpu'], type: 'string' },
  { id: 'memory', label: 'Memory', category: 'deployment', path: ['config', 'memory'], type: 'string' },

  // Behavior — capacity
  { id: 'maxThroughput', label: 'Max Throughput (RPS)', category: 'behavior', path: ['behavioralModel', 'capacity', 'maxThroughput'], type: 'number' },
  { id: 'maxConcurrent', label: 'Max Concurrent', category: 'behavior', path: ['behavioralModel', 'capacity', 'maxConcurrent'], type: 'number' },
  { id: 'maxQueueDepth', label: 'Max Queue Depth', category: 'behavior', path: ['behavioralModel', 'capacity', 'maxQueueDepth'], type: 'number' },
  { id: 'maxConnections', label: 'Max Connections', category: 'behavior', path: ['behavioralModel', 'capacity', 'maxConnections'], type: 'number' },
  // Behavior — latency
  { id: 'baseLatencyMs', label: 'Base Latency (ms)', category: 'behavior', path: ['behavioralModel', 'latency', 'baseLatencyMs'], type: 'number' },
  { id: 'latencyStdDevMs', label: 'Std Dev (ms)', category: 'behavior', path: ['behavioralModel', 'latency', 'latencyStdDevMs'], type: 'number' },
  { id: 'queueLatencyMs', label: 'Queue Latency (ms)', category: 'behavior', path: ['behavioralModel', 'latency', 'queueLatencyMs'], type: 'number' },
  { id: 'cacheHitLatencyMs', label: 'Cache Hit Latency (ms)', category: 'behavior', path: ['behavioralModel', 'latency', 'cacheHitLatencyMs'], type: 'number' },
  { id: 'cacheMissLatencyMs', label: 'Cache Miss Latency (ms)', category: 'behavior', path: ['behavioralModel', 'latency', 'cacheMissLatencyMs'], type: 'number' },
  { id: 'cacheHitRate', label: 'Cache Hit Rate', category: 'behavior', path: ['behavioralModel', 'latency', 'cacheHitRate'], type: 'number' },
  // Behavior — reliability
  { id: 'baseErrorRate', label: 'Base Error Rate', category: 'behavior', path: ['behavioralModel', 'errorCharacteristics', 'baseErrorRate'], type: 'number' },
  { id: 'errorRateUnderLoad', label: 'Error Rate Under Load', category: 'behavior', path: ['behavioralModel', 'errorCharacteristics', 'errorRateUnderLoad'], type: 'number' },
  { id: 'errorDistribution', label: 'Error Distribution', category: 'behavior', path: ['behavioralModel', 'errorCharacteristics', 'errorDistribution'], type: 'string' },
  { id: 'slaTarget', label: 'SLA Target', category: 'behavior', path: ['behavioralModel', 'availability', 'slaTarget'], type: 'number' },
  { id: 'mttrMinutes', label: 'MTTR (minutes)', category: 'behavior', path: ['behavioralModel', 'availability', 'mttrMinutes'], type: 'number' },
  { id: 'mtbfHours', label: 'MTBF (hours)', category: 'behavior', path: ['behavioralModel', 'availability', 'mtbfHours'], type: 'number' },
  // Behavior — resources
  { id: 'cpuPerRequest', label: 'CPU per Request (ms)', category: 'behavior', path: ['behavioralModel', 'resourceConsumption', 'cpuPerRequest'], type: 'number' },
  { id: 'memoryPerConnection', label: 'Memory per Connection (bytes)', category: 'behavior', path: ['behavioralModel', 'resourceConsumption', 'memoryPerConnection'], type: 'number' },
  { id: 'threadPoolSize', label: 'Thread Pool Size', category: 'behavior', path: ['behavioralModel', 'resourceConsumption', 'threadPoolSize'], type: 'number' },
  { id: 'connectionPoolSize', label: 'Connection Pool Size', category: 'behavior', path: ['behavioralModel', 'resourceConsumption', 'connectionPoolSize'], type: 'number' },
  // Behavior — scaling (note: distinct from deployment `replicas`)
  { id: 'scalingType', label: 'Scaling Type', category: 'behavior', path: ['behavioralModel', 'scalingBehavior', 'type'], type: 'string' },
  { id: 'scaleUpThreshold', label: 'Scale Up Threshold', category: 'behavior', path: ['behavioralModel', 'scalingBehavior', 'scaleUpThreshold'], type: 'number' },
  { id: 'scaleDownThreshold', label: 'Scale Down Threshold', category: 'behavior', path: ['behavioralModel', 'scalingBehavior', 'scaleDownThreshold'], type: 'number' },
  { id: 'minReplicas', label: 'Min Replicas', category: 'behavior', path: ['behavioralModel', 'scalingBehavior', 'minReplicas'], type: 'number' },
  { id: 'maxReplicas', label: 'Max Replicas', category: 'behavior', path: ['behavioralModel', 'scalingBehavior', 'maxReplicas'], type: 'number' },
  // Behavior — cost
  { id: 'hourlyComputeCost', label: 'Hourly Compute Cost ($)', category: 'behavior', path: ['behavioralModel', 'costProfile', 'hourlyComputeCost'], type: 'number' },
  { id: 'perRequestCost', label: 'Per Request Cost ($)', category: 'behavior', path: ['behavioralModel', 'costProfile', 'perRequestCost'], type: 'number' },
  { id: 'perGbNetworkCost', label: 'Per GB Network Cost ($)', category: 'behavior', path: ['behavioralModel', 'costProfile', 'perGbNetworkCost'], type: 'number' },
]

const byId = new Map(PROPERTY_DEFINITIONS.map((d) => [d.id, d]))

export function getPropertyDefinition(id) {
  return byId.get(id) || null
}

export function definitionsForCategory(category) {
  return PROPERTY_DEFINITIONS.filter((d) => d.category === category)
}

export function visibleDefinitions(node) {
  return PROPERTY_DEFINITIONS.filter((d) => (typeof d.visible === 'function' ? d.visible(node) : true))
}
