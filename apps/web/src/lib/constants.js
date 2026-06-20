export const BlockType = {
  API_GATEWAY: 'api-gateway',
  SERVICE: 'service',
  DATABASE: 'database',
  CACHE: 'cache',
  MESSAGE_QUEUE: 'message-queue',
  LOAD_BALANCER: 'load-balancer',
  CDN: 'cdn',
  CLIENT: 'client',
  EXTERNAL_API: 'external-api',
  STORAGE: 'storage',
}

export const BLOCK_TYPES = [
  {
    id: 'api-gateway',
    label: 'API Gateway',
    icon: 'Globe',
    color: '#8b5cf6',
    category: 'network',
    description: 'Entry point for all API requests',
  },
  {
    id: 'service',
    label: 'Service',
    icon: 'Server',
    color: '#3b82f6',
    category: 'compute',
    description: 'Backend microservice',
  },
  {
    id: 'database',
    label: 'Database',
    icon: 'Database',
    color: '#10b981',
    category: 'data',
    description: 'Primary data store',
  },
  {
    id: 'cache',
    label: 'Cache',
    icon: 'Zap',
    color: '#f59e0b',
    category: 'data',
    description: 'In-memory cache layer',
  },
  {
    id: 'message-queue',
    label: 'Message Queue',
    icon: 'MessageSquare',
    color: '#ef4444',
    category: 'messaging',
    description: 'Async message broker',
  },
  {
    id: 'load-balancer',
    label: 'Load Balancer',
    icon: 'Scale',
    color: '#06b6d4',
    category: 'network',
    description: 'Traffic distribution',
  },
  {
    id: 'cdn',
    label: 'CDN',
    icon: 'Cloud',
    color: '#ec4899',
    category: 'network',
    description: 'Edge content delivery',
  },
  {
    id: 'client',
    label: 'Client',
    icon: 'Monitor',
    color: '#6366f1',
    category: 'frontend',
    description: 'Frontend application',
  },
  {
    id: 'external-api',
    label: 'External API',
    icon: 'ExternalLink',
    color: '#84cc16',
    category: 'integration',
    description: 'Third-party integration',
  },
  {
    id: 'storage',
    label: 'Storage',
    icon: 'HardDrive',
    color: '#14b8a6',
    category: 'data',
    description: 'Object/file storage',
  },
]

export const categories = [
  { id: 'network', label: 'Network', color: '#8b5cf6' },
  { id: 'compute', label: 'Compute', color: '#3b82f6' },
  { id: 'data', label: 'Data', color: '#10b981' },
  { id: 'messaging', label: 'Messaging', color: '#ef4444' },
  { id: 'frontend', label: 'Frontend', color: '#6366f1' },
  { id: 'integration', label: 'Integration', color: '#84cc16' },
]

export const DOCKER_COMPOSE_TEMPLATE = (nodes, edges) => {
  const services = {}
  const volumes = {}

  const imageMap = {
    'api-gateway': 'nginx:alpine',
    'service': 'node:18-alpine',
    'database': 'postgres:15-alpine',
    'cache': 'redis:7-alpine',
    'message-queue': 'confluentinc/cp-kafka:latest',
    'load-balancer': 'nginx:alpine',
    'cdn': 'nginx:alpine',
    'client': 'nginx:alpine',
    'external-api': 'nginx:alpine',
    'storage': 'minio/minio:latest',
  }

  const portMap = {
    'api-gateway': ['80:80'],
    'service': ['3000:3000'],
    'database': ['5432:5432'],
    'cache': ['6379:6379'],
    'message-queue': ['9092:9092'],
    'load-balancer': ['8080:80'],
    'cdn': ['8081:80'],
    'client': ['8082:80'],
    'external-api': ['8083:80'],
    'storage': ['9000:9000', '9001:9001'],
  }

  nodes.forEach((node, idx) => {
    const type = node.data?.type || node.type
    const name = node.data?.label?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || `${type}-${idx}`
    const config = node.data?.config || {}

    services[name] = {
      image: imageMap[type] || 'alpine:latest',
      ports: portMap[type] || [],
      environment: {},
      volumes: [],
      depends_on: [],
    }

    if (type === 'database') {
      services[name].environment = {
        POSTGRES_DB: config.database || 'app',
        POSTGRES_USER: config.user || 'user',
        POSTGRES_PASSWORD: config.password || 'password',
      }
      services[name].volumes = [`${name}-data:/var/lib/postgresql/data`]
      volumes[`${name}-data`] = {}
    }

    if (type === 'cache') {
      services[name].command = `redis-server --maxmemory ${config.maxMemory || '256mb'} --maxmemory-policy ${config.eviction || 'allkeys-lru'}`
    }

    if (type === 'storage') {
      services[name].environment = {
        MINIO_ROOT_USER: 'minioadmin',
        MINIO_ROOT_PASSWORD: 'minioadmin',
      }
      services[name].command = 'server /data --console-address ":9001"'
      services[name].volumes = [`${name}-data:/data`]
      volumes[`${name}-data`] = {}
    }

    if (type === 'service' && config.replicas) {
      services[name].deploy = {
        replicas: config.replicas,
        resources: {
          limits: {
            cpus: config.cpu || '0.5',
            memory: config.memory || '512M',
          },
        },
      }
    }
  })

  // Add depends_on from edges
  edges.forEach(edge => {
    const sourceNode = nodes.find(n => n.id === edge.source)
    const targetNode = nodes.find(n => n.id === edge.target)
    if (sourceNode && targetNode) {
      const sourceName = sourceNode.data?.label?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || edge.source
      const targetName = targetNode.data?.label?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || edge.target
      if (services[targetName] && !services[targetName].depends_on.includes(sourceName)) {
        services[targetName].depends_on.push(sourceName)
      }
    }
  })

  return { services, volumes, networks: { 'app-network': { driver: 'bridge' } } }
}

export const CONNECTION_TYPES = [
  { id: 'http', label: 'HTTP', color: '#3b82f6', bg: '#3b82f615', particleColor: '#60a5fa' },
  { id: 'grpc', label: 'gRPC', color: '#10b981', bg: '#10b98115', particleColor: '#34d399' },
  { id: 'websocket', label: 'WebSocket', color: '#8b5cf6', bg: '#8b5cf615', particleColor: '#a78bfa' },
  { id: 'event', label: 'Event', color: '#f59e0b', bg: '#f59e0b15', particleColor: '#fbbf24' },
  { id: 'db', label: 'Database', color: '#ef4444', bg: '#ef444415', particleColor: '#f87171' },
]

export const TRAFFIC_PATTERNS = [
  { id: 'steady', label: 'Steady', description: 'Constant request rate' },
  { id: 'spike', label: 'Spike', description: '50x traffic spike at 60%' },
  { id: 'ramp', label: 'Ramp', description: 'Linear increase to 10x' },
  { id: 'chaos', label: 'Chaos', description: 'Random traffic spikes' },
]

export const SCENARIOS = [
  { id: 'none', label: 'None', description: 'Normal operation' },
  { id: 'db_slowdown', label: 'DB Slowdown', description: 'Database slows 70% at 40%' },
  { id: 'cache_eviction', label: 'Cache Eviction', description: 'Cache fails at 50%' },
  { id: 'region_outage', label: 'Region Outage', description: 'Random block fails at 30%' },
  { id: 'ddos', label: 'DDoS', description: 'Gateway overwhelmed from start' },
]