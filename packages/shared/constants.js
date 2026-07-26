// ============================================================================
// SHARED CONSTANTS — UI + Behavioral Models (Merged for Production)
// ============================================================================

// Import behavioral models from simulation-models.js (same package)
// We re-export them here so consumers only need one import
export {
  SIMULATION_BLOCK_TYPES,
  SIMULATION_CONNECTION_TYPES,
  getBlockBehavioralModel,
  getConnectionBehavioralModel,
  mergeBlockBehavioralModel,
  mergeConnectionBehavioralModel,
  getSupportedBlockTypes,
  getSupportedConnectionTypes,
  isBlockTypeSupported,
  isConnectionTypeSupported,
} from './simulation-models.js'

// ============================================================================
// UI-OPTIMIZED BLOCK TYPE DEFINITIONS (derived from behavioral models)
// ============================================================================

export const BLOCK_TYPES = [
  {
    id: 'api-gateway',
    label: 'API Gateway',
    icon: 'Globe',
    category: 'network',
    color: '#8b5cf6',
    description: 'Entry point for all API traffic, handles routing, auth, rate limiting',
  },
  {
    id: 'service',
    label: 'Service',
    icon: 'Server',
    category: 'compute',
    color: '#3b82f6',
    description: 'Business logic service, processes requests',
  },
  {
    id: 'database',
    label: 'Database',
    icon: 'Database',
    category: 'data',
    color: '#10b981',
    description: 'Persistent data store (SQL/NoSQL)',
  },
  {
    id: 'cache',
    label: 'Cache',
    icon: 'Zap',
    category: 'data',
    color: '#f59e0b',
    description: 'In-memory cache for fast data access',
  },
  {
    id: 'message-queue',
    label: 'Message Queue',
    icon: 'MessageSquare',
    category: 'messaging',
    color: '#ef4444',
    description: 'Async message broker for decoupled services',
  },
  {
    id: 'load-balancer',
    label: 'Load Balancer',
    icon: 'Scale',
    category: 'network',
    color: '#06b6d4',
    description: 'Distributes traffic across multiple targets',
  },
  {
    id: 'cdn',
    label: 'CDN',
    icon: 'Cloud',
    category: 'network',
    color: '#ec4899',
    description: 'Content delivery network for edge caching',
  },
  {
    id: 'client',
    label: 'Client',
    icon: 'Monitor',
    category: 'frontend',
    color: '#6366f1',
    description: 'Frontend client application',
  },
  {
    id: 'external-api',
    label: 'External API',
    icon: 'ExternalLink',
    category: 'integration',
    color: '#84cc16',
    description: 'Third-party API integration',
  },
  {
    id: 'storage',
    label: 'Storage',
    icon: 'HardDrive',
    category: 'data',
    color: '#14b8a6',
    description: 'Object/file storage (S3, GCS, etc.)',
  },
  {
    id: 'function',
    label: 'Function',
    icon: 'Code',
    category: 'compute',
    color: '#f97316',
    description: 'Serverless function (FaaS)',
  },
  {
    id: 'ai-service',
    label: 'AI Service',
    icon: 'Brain',
    category: 'ai',
    color: '#a855f7',
    description: 'AI/ML inference service',
  },
]

export const categories = [
  { id: 'network', label: 'Network', color: '#8b5cf6' },
  { id: 'compute', label: 'Compute', color: '#3b82f6' },
  { id: 'data', label: 'Data', color: '#10b981' },
  { id: 'messaging', label: 'Messaging', color: '#ef4444' },
  { id: 'frontend', label: 'Frontend', color: '#6366f1' },
  { id: 'integration', label: 'Integration', color: '#84cc16' },
  { id: 'ai', label: 'AI', color: '#a855f7' },
  { id: 'storage', label: 'Storage', color: '#14b8a6' },
]

// ============================================================================
// CONNECTION TYPES — UI + Behavioral
// ============================================================================

export const CONNECTION_TYPES = [
  { id: 'http', label: 'HTTP/REST', color: '#3b82f6', icon: 'Globe' },
  { id: 'https', label: 'HTTPS', color: '#10b981', icon: 'Lock' },
  { id: 'rest', label: 'REST API', color: '#6366f1', icon: 'ArrowRightLeft' },
  { id: 'graphql', label: 'GraphQL', color: '#ec4899', icon: 'GitGraph' },
  { id: 'websocket', label: 'WebSocket', color: '#8b5cf6', icon: 'Wifi' },
  { id: 'grpc', label: 'gRPC', color: '#f59e0b', icon: 'ArrowRightLeft' },
  { id: 'kafka', label: 'Kafka', color: '#ef4444', icon: 'MessageSquare' },
  { id: 'rabbitmq', label: 'RabbitMQ', color: '#f97316', icon: 'MessageSquare' },
  { id: 'amqp', label: 'AMQP', color: '#14b8a6', icon: 'MessageSquare' },
  { id: 'mqtt', label: 'MQTT', color: '#06b6d4', icon: 'Radio' },
  { id: 'tcp', label: 'TCP', color: '#64748b', icon: 'Cable' },
  { id: 'udp', label: 'UDP', color: '#84cc16', icon: 'Cable' },
  { id: 'sftp', label: 'SFTP', color: '#a855f7', icon: 'FileTransfer' },
  { id: 'event-stream', label: 'Event Stream', color: '#d946ef', icon: 'Zap' },
]

export const CONNECTION_TYPE_META = {
  http: { label: 'HTTP/REST', color: '#3b82f6', icon: 'Globe', description: 'Standard HTTP/1.1 REST API' },
  https: { label: 'HTTPS', color: '#10b981', icon: 'Lock', description: 'TLS-encrypted HTTP' },
  rest: { label: 'REST API', color: '#6366f1', icon: 'ArrowRightLeft', description: 'RESTful API with retries and circuit breaker' },
  graphql: { label: 'GraphQL', color: '#ec4899', icon: 'GitGraph', description: 'GraphQL query API' },
  websocket: { label: 'WebSocket', color: '#8b5cf6', icon: 'Wifi', description: 'Persistent bidirectional connection' },
  grpc: { label: 'gRPC', color: '#f59e0b', icon: 'ArrowRightLeft', description: 'High-performance RPC over HTTP/2' },
  kafka: { label: 'Kafka', color: '#ef4444', icon: 'MessageSquare', description: 'Distributed event streaming' },
  rabbitmq: { label: 'RabbitMQ', color: '#f97316', icon: 'MessageSquare', description: 'Message broker with queues' },
  amqp: { label: 'AMQP', color: '#14b8a6', icon: 'MessageSquare', description: 'Advanced Message Queuing Protocol' },
  mqtt: { label: 'MQTT', color: '#06b6d4', icon: 'Radio', description: 'Lightweight IoT messaging' },
  tcp: { label: 'TCP', color: '#64748b', icon: 'Cable', description: 'Raw TCP socket' },
  udp: { label: 'UDP', color: '#84cc16', icon: 'Cable', description: 'Connectionless UDP' },
  sftp: { label: 'SFTP', color: '#a855f7', icon: 'FileTransfer', description: 'Secure file transfer' },
  'event-stream': { label: 'Event Stream', color: '#d946ef', icon: 'Zap', description: 'Event-driven streaming' },
}

// ============================================================================
// TRAFFIC PATTERNS (Production-Grade)
// ============================================================================

export const TRAFFIC_PATTERNS = [
  {
    id: 'constant',
    label: 'Constant',
    description: 'Steady request rate throughout the simulation',
    params: {},
  },
  {
    id: 'bursty',
    label: 'Bursty',
    description: 'Periodic traffic bursts with configurable factor and duration',
    params: {
      burstFactor: { type: 'number', default: 5, min: 1.1, max: 100, label: 'Burst Factor' },
      burstDuration: { type: 'number', default: 10, min: 1, max: 300, label: 'Burst Duration (s)' },
      burstInterval: { type: 'number', default: 60, min: 10, max: 1800, label: 'Burst Interval (s)' },
    },
  },
  {
    id: 'spiky',
    label: 'Spiky',
    description: 'Random traffic spikes with probability and intensity',
    params: {
      spikeFactor: { type: 'number', default: 10, min: 1.1, max: 100, label: 'Spike Factor' },
      spikeProbability: { type: 'number', default: 0.05, min: 0.001, max: 1, label: 'Spike Probability' },
      spikeDuration: { type: 'number', default: 5, min: 1, max: 60, label: 'Spike Duration (s)' },
    },
  },
  {
    id: 'seasonal',
    label: 'Seasonal',
    description: 'Sinusoidal traffic pattern with period and amplitude',
    params: {
      seasonalPeriod: { type: 'number', default: 300, min: 60, max: 1800, label: 'Period (s)' },
      seasonalAmplitude: { type: 'number', default: 0.5, min: 0.01, max: 2, label: 'Amplitude' },
      phaseShift: { type: 'number', default: 0, min: 0, max: 360, label: 'Phase Shift (deg)' },
    },
  },
  {
    id: 'randomized',
    label: 'Randomized',
    description: 'Seeded pseudo-random traffic with smoothing control',
    params: {
      minMultiplier: { type: 'number', default: 0.1, min: 0, max: 1, label: 'Min Multiplier' },
      maxMultiplier: { type: 'number', default: 3, min: 1, max: 50, label: 'Max Multiplier' },
      smoothness: { type: 'number', default: 0.5, min: 0, max: 1, label: 'Smoothness Factor' },
    },
  },
  {
    id: 'custom',
    label: 'Custom',
    description: 'User-defined traffic curve with control points',
    params: {
      curve: { type: 'array', default: [], label: 'Control Points' },
    },
  },
]

// ============================================================================
// FAILURE SCENARIOS (Production-Grade)
// ============================================================================

export const SCENARIOS = [
  { id: 'none', label: 'None', description: 'Normal operation — no failures injected', targetable: false },
  { id: 'db_slowdown', label: 'DB Slowdown', description: 'Database response time increases 70%', targetable: true, defaultTarget: 'database' },
  { id: 'cache_eviction', label: 'Cache Eviction', description: 'Cache hit rate drops to near zero', targetable: true, defaultTarget: 'cache' },
  { id: 'region_outage', label: 'Region Outage', description: 'Complete region failure — all blocks in region affected', targetable: false },
  { id: 'ddos', label: 'DDoS Attack', description: 'Overwhelming traffic from multiple sources', targetable: false },
  { id: 'network_partition', label: 'Network Partition', description: 'Split-brain network partition between services', targetable: true, defaultTarget: 'service' },
  { id: 'service_crash', label: 'Service Crash', description: 'Target service process crashes', targetable: true, defaultTarget: 'service' },
  { id: 'memory_leak', label: 'Memory Leak', description: 'Gradual memory exhaustion causing slowdown', targetable: true, defaultTarget: 'service' },
  { id: 'resource_exhaustion', label: 'Resource Exhaustion', description: 'CPU/memory fully saturated', targetable: true, defaultTarget: 'service' },
  { id: 'external_timeout', label: 'External Timeout', description: 'External API becomes unresponsive', targetable: true, defaultTarget: 'external-api' },
  { id: 'external_rate_limit', label: 'External Rate Limit', description: 'External API starts returning 429', targetable: true, defaultTarget: 'external-api' },
  { id: 'queue_overflow', label: 'Queue Overflow', description: 'Message queue fills up and starts dropping', targetable: true, defaultTarget: 'message-queue' },
  { id: 'storage_saturation', label: 'Storage Saturation', description: 'Storage quota exceeded', targetable: true, defaultTarget: 'storage' },
]

// ============================================================================
// GROWTH SCENARIOS
// ============================================================================

export const GROWTH_SCENARIOS = [
  { id: '2x', label: '2x Growth', multiplier: 2, rampCurve: 'linear', rampDuration: 60 },
  { id: '5x', label: '5x Growth', multiplier: 5, rampCurve: 'exponential', rampDuration: 120 },
  { id: '10x', label: '10x Growth', multiplier: 10, rampCurve: 'exponential', rampDuration: 180 },
]

// ============================================================================
// THEMES
// ============================================================================

export const THEMES = {
  dark: {
    '--bg-primary': '#0a0a0f',
    '--bg-secondary': '#111118',
    '--bg-tertiary': '#1a1a24',
    '--bg-elevated': '#22222e',
    '--bg-hover': '#2a2a38',
    '--text-primary': '#f1f1f4',
    '--text-secondary': '#a1a1aa',
    '--text-muted': '#71717a',
    '--border-color': '#27272f',
    '--accent': '#8b5cf6',
    '--accent-hover': '#7c3aed',
    '--success': '#10b981',
    '--warning': '#f59e0b',
    '--error': '#ef4444',
    '--canvas-bg': '#0c0c14',
    '--canvas-grid': '#1a1a28',
    '--sidebar-bg': '#111118',
    '--panel-bg': '#16161f',
  },
  light: {
    '--bg-primary': '#ffffff',
    '--bg-secondary': '#f8f8fb',
    '--bg-tertiary': '#f0f0f5',
    '--bg-elevated': '#ffffff',
    '--bg-hover': '#e8e8ef',
    '--text-primary': '#18181b',
    '--text-secondary': '#52525b',
    '--text-muted': '#a1a1aa',
    '--border-color': '#e4e4e7',
    '--accent': '#7c3aed',
    '--accent-hover': '#6d28d9',
    '--success': '#059669',
    '--warning': '#d97706',
    '--error': '#dc2626',
    '--canvas-bg': '#fafafa',
    '--canvas-grid': '#e8e8ef',
    '--sidebar-bg': '#f8f8fb',
    '--panel-bg': '#ffffff',
  }
}

// ============================================================================
// DOCKER COMPOSE TEMPLATE
// ============================================================================

export const DOCKER_COMPOSE_TEMPLATE = (blocks, connections) => {
  const services = {}
  blocks.forEach(block => {
    const config = block.data?.config || block.config || {}
    const blockType = block.data?.type || block.type
    switch (blockType) {
      case 'api-gateway':
        services[block.id] = {
          image: 'nginx:alpine',
          ports: [`${config.port || 80}:80`],
          environment: {
            RATE_LIMIT: config.rateLimit || 1000,
            AUTH_TYPE: config.authType || 'jwt',
            TIMEOUT_MS: config.timeout || 30000,
          },
          depends_on: connections
            .filter(c => c.source === block.id)
            .map(c => c.target),
        }
        break
      case 'service':
        services[block.id] = {
          image: `${(block.data?.label || block.label || 'service').toLowerCase().replace(/\s+/g, '-')}:latest`,
          environment: {
            PORT: config.port || 3000,
            NODE_ENV: 'production',
          },
          depends_on: connections
            .filter(c => c.source === block.id)
            .map(c => c.target),
        }
        break
      case 'database':
        services[block.id] = {
          image: config.engine === 'mysql' ? 'mysql:8' : 'postgres:15',
          environment: {
            POSTGRES_DB: config.database || 'app',
            POSTGRES_USER: config.user || 'user',
            POSTGRES_PASSWORD: config.password || 'password',
          },
          volumes: [`${block.id}-data:/var/lib/postgresql/data`],
        }
        break
      case 'cache':
        services[block.id] = {
          image: 'redis:7-alpine',
          command: config.maxMemory ? `--maxmemory ${config.maxMemory}` : '',
        }
        break
      case 'message-queue':
        services[block.id] = {
          image: config.engine === 'rabbitmq' ? 'rabbitmq:3-management' : 'confluentinc/cp-kafka:latest',
        }
        break
      default:
        services[block.id] = {
          image: `${blockType}:latest`,
        }
    }
  })

  const volumes = Object.keys(services)
    .filter(id => services[id].volumes)
    .map(id => id + '-data')

  return {
    version: '3.8',
    services,
    networks: { 'app-network': { driver: 'bridge' } },
    volumes: volumes.reduce((acc, v) => ({ ...acc, [v]: {} }), {}),
  }
}