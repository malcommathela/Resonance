// Block type definitions for Phase 1
export const BLOCK_TYPES = [
  { id: 'api-gateway', label: 'API Gateway', icon: 'Globe', category: 'network', color: '#8b5cf6' },
  { id: 'service', label: 'Service', icon: 'Server', category: 'compute', color: '#3b82f6' },
  { id: 'database', label: 'Database', icon: 'Database', category: 'data', color: '#10b981' },
  { id: 'cache', label: 'Cache', icon: 'Zap', category: 'data', color: '#f59e0b' },
  { id: 'message-queue', label: 'Message Queue', icon: 'MessageSquare', category: 'messaging', color: '#ef4444' },
  { id: 'load-balancer', label: 'Load Balancer', icon: 'Scale', category: 'network', color: '#06b6d4' },
  { id: 'cdn', label: 'CDN', icon: 'Cloud', category: 'network', color: '#ec4899' },
  { id: 'client', label: 'Client', icon: 'Monitor', category: 'frontend', color: '#6366f1' },
  { id: 'external-api', label: 'External API', icon: 'ExternalLink', category: 'integration', color: '#84cc16' },
  { id: 'storage', label: 'Storage', icon: 'HardDrive', category: 'data', color: '#14b8a6' },
];

export const CONNECTION_TYPES = [
  { id: 'http', label: 'HTTP/REST', color: '#3b82f6' },
  { id: 'grpc', label: 'gRPC', color: '#10b981' },
  { id: 'websocket', label: 'WebSocket', color: '#8b5cf6' },
  { id: 'event', label: 'Event', color: '#f59e0b' },
  { id: 'db', label: 'Database', color: '#ef4444' },
];

export const TRAFFIC_PATTERNS = [
  { id: 'steady', label: 'Steady', description: 'Constant request rate' },
];

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
};

export const DOCKER_COMPOSE_TEMPLATE = (blocks, connections) => {
  const services = {};
  blocks.forEach(block => {
    const config = block.data.config || {};
    switch (block.type) {
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
        };
        break;
      case 'service':
        services[block.id] = {
          image: `${block.data.label.toLowerCase().replace(/\s+/g, '-')}:latest`,
          environment: {
            PORT: config.port || 3000,
            NODE_ENV: 'production',
          },
          depends_on: connections
            .filter(c => c.source === block.id)
            .map(c => c.target),
        };
        break;
      case 'database':
        services[block.id] = {
          image: config.engine === 'mysql' ? 'mysql:8' : 'postgres:15',
          environment: {
            POSTGRES_DB: config.database || 'app',
            POSTGRES_USER: config.user || 'user',
            POSTGRES_PASSWORD: config.password || 'password',
          },
          volumes: [`${block.id}-data:/var/lib/postgresql/data`],
        };
        break;
      case 'cache':
        services[block.id] = {
          image: 'redis:7-alpine',
          command: config.maxMemory ? `--maxmemory ${config.maxMemory}` : '',
        };
        break;
      case 'message-queue':
        services[block.id] = {
          image: config.engine === 'rabbitmq' ? 'rabbitmq:3-management' : 'confluentinc/cp-kafka:latest',
        };
        break;
      default:
        services[block.id] = {
          image: `${block.type}:latest`,
        };
    }
  });

  const volumes = Object.keys(services)
    .filter(id => services[id].volumes)
    .map(id => id + '-data');

  return {
    version: '3.8',
    services,
    networks: { 'app-network': { driver: 'bridge' } },
    volumes: volumes.reduce((acc, v) => ({ ...acc, [v]: {} }), {}),
  };
};


export const CONNECTION_TYPE_META = {
  http: { label: 'HTTP/REST', color: '#3b82f6', icon: 'Globe' },
  grpc: { label: 'gRPC', color: '#10b981', icon: 'ArrowRightLeft' },
  websocket: { label: 'WebSocket', color: '#8b5cf6', icon: 'Wifi' },
  event: { label: 'Event', color: '#f59e0b', icon: ' Zap' },
  db: { label: 'Database', color: '#ef4444', icon: 'Database' },
}
