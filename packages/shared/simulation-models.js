/**
 * Simulation Behavioral Models
 * 
 * Defines the physics of the simulation — how blocks and connections
 * behave under load, how they fail, how they scale, and how they consume resources.
 * 
 * Every number in the simulation traces back to these models.
 * Every model is parameterized and explainable.
 */

import { DeterministicRNG } from './deterministic.js'

// ============================================================================
// BLOCK TYPE DEFINITIONS (Simulation-Ready)
// ============================================================================

export const SIMULATION_BLOCK_TYPES = {
  'api-gateway': {
    id: 'api-gateway',
    label: 'API Gateway',
    category: 'gateway',
    defaultConfig: {
      rateLimit: 10000,
      authType: 'jwt',
      timeout: 30000,
      port: 80,
      circuitBreaker: true,
      caching: false,
    },
    behavioralModel: {
      capacity: {
        maxThroughput: 10000,
        maxConcurrent: 5000,
        maxQueueDepth: 10000,
      },
      latency: {
        baseLatencyMs: 2,
        latencyStdDevMs: 0.5,
        serializationMs: 0.5,
        deserializationMs: 0.5,
        queueLatencyMs: 0,
      },
      errorCharacteristics: {
        baseErrorRate: 0.0001,
        errorRateUnderLoad: 0.05,
        errorDistribution: 'exponential',
        errorTypes: ['rate_limit_exceeded', 'timeout', 'auth_failure', 'circuit_open'],
      },
      availability: {
        slaTarget: 0.9999,
        mttrMinutes: 2,
        mtbfHours: 8760,
      },
      resourceConsumption: {
        cpuPerRequest: 0.5,
        memoryPerConnection: 1024,
        threadPoolSize: 200,
        connectionPoolSize: 500,
      },
      cost: {
        hourlyComputeCost: 0.05,
        perRequestCost: 0.000001,
        perGbNetworkCost: 0.09,
      },
      scalingBehavior: {
        type: 'horizontal',
        scaleUpThreshold: 0.7,
        scaleDownThreshold: 0.3,
        scaleUpCooldownSeconds: 60,
        scaleDownCooldownSeconds: 300,
        maxReplicas: 10,
        minReplicas: 2,
        scaleUpIncrement: 2,
      },
      failureCharacteristics: {
        failureModes: [
          {
            id: 'gateway_overload',
            name: 'Gateway Overload',
            description: 'Gateway drops requests due to capacity exhaustion',
            probability: 0.6,
            latencyMultiplier: 10,
            errorRate: 0.5,
            throughputMultiplier: 0.1,
            affectedDownstreamBlocks: 0,
          },
          {
            id: 'gateway_circuit_failure',
            name: 'Circuit Breaker Open',
            description: 'Circuit breaker opens due to downstream failures',
            probability: 0.3,
            latencyMultiplier: 1,
            errorRate: 1.0,
            throughputMultiplier: 0,
            affectedDownstreamBlocks: 0,
          },
          {
            id: 'gateway_config_corruption',
            name: 'Configuration Corruption',
            description: 'Routing rules corrupted, requests misrouted',
            probability: 0.1,
            latencyMultiplier: 5,
            errorRate: 0.3,
            throughputMultiplier: 0.5,
            affectedDownstreamBlocks: 3,
          },
        ],
        failureProbabilityPerHour: 0.0001,
        recoveryProbabilityPerMinute: 0.5,
      },
    },
  },

  'service': {
    id: 'service',
    label: 'Service',
    category: 'service',
    defaultConfig: {
      port: 3000,
      replicas: 3,
      cpu: '500m',
      memory: '1Gi',
    },
    behavioralModel: {
      capacity: {
        maxThroughput: 2000,
        maxConcurrent: 500,
        maxQueueDepth: 2000,
      },
      latency: {
        baseLatencyMs: 15,
        latencyStdDevMs: 3,
        serializationMs: 1,
        deserializationMs: 1,
        queueLatencyMs: 2,
      },
      errorCharacteristics: {
        baseErrorRate: 0.001,
        errorRateUnderLoad: 0.1,
        errorDistribution: 'exponential',
        errorTypes: ['timeout', 'internal_error', 'dependency_failure', 'oom'],
      },
      availability: {
        slaTarget: 0.999,
        mttrMinutes: 5,
        mtbfHours: 720,
      },
      resourceConsumption: {
        cpuPerRequest: 2,
        memoryPerConnection: 5120,
        threadPoolSize: 100,
        connectionPoolSize: 50,
      },
      cost: {
        hourlyComputeCost: 0.03,
        perRequestCost: 0.000005,
        perGbNetworkCost: 0.09,
      },
      scalingBehavior: {
        type: 'horizontal',
        scaleUpThreshold: 0.75,
        scaleDownThreshold: 0.25,
        scaleUpCooldownSeconds: 120,
        scaleDownCooldownSeconds: 300,
        maxReplicas: 20,
        minReplicas: 2,
        scaleUpIncrement: 2,
      },
      failureCharacteristics: {
        failureModes: [
          {
            id: 'service_crash',
            name: 'Service Crash',
            description: 'Service process crashes, all requests fail',
            probability: 0.5,
            latencyMultiplier: 1,
            errorRate: 1.0,
            throughputMultiplier: 0,
            affectedDownstreamBlocks: 0,
          },
          {
            id: 'service_slowdown',
            name: 'Performance Degradation',
            description: 'Memory leak or CPU starvation causes slowdown',
            probability: 0.3,
            latencyMultiplier: 5,
            errorRate: 0.1,
            throughputMultiplier: 0.3,
            affectedDownstreamBlocks: 0,
          },
          {
            id: 'service_oom',
            name: 'Out of Memory',
            description: 'Service runs out of memory, starts killing requests',
            probability: 0.2,
            latencyMultiplier: 3,
            errorRate: 0.4,
            throughputMultiplier: 0.5,
            affectedDownstreamBlocks: 0,
          },
        ],
        failureProbabilityPerHour: 0.001,
        recoveryProbabilityPerMinute: 0.2,
      },
    },
  },

  'database': {
    id: 'database',
    label: 'Database',
    category: 'database',
    defaultConfig: {
      engine: 'postgres',
      database: 'app',
      user: 'user',
      password: 'password',
      port: 5432,
    },
    behavioralModel: {
      capacity: {
        maxThroughput: 500,
        maxConcurrent: 100,
        maxQueueDepth: 500,
        maxConnections: 100,
      },
      latency: {
        baseLatencyMs: 5,
        latencyStdDevMs: 2,
        serializationMs: 0.5,
        deserializationMs: 0.5,
        queueLatencyMs: 5,
        dbOperationMs: 10,
      },
      errorCharacteristics: {
        baseErrorRate: 0.0005,
        errorRateUnderLoad: 0.15,
        errorDistribution: 'burst',
        errorTypes: ['connection_exhausted', 'lock_timeout', 'deadlock', 'storage_full', 'replication_lag'],
      },
      availability: {
        slaTarget: 0.9995,
        mttrMinutes: 10,
        mtbfHours: 2160,
      },
      resourceConsumption: {
        cpuPerRequest: 5,
        memoryPerConnection: 10240,
        storagePerRequest: 1024,
        threadPoolSize: 50,
        connectionPoolSize: 100,
      },
      cost: {
        hourlyComputeCost: 0.15,
        perRequestCost: 0.00001,
        storageCostPerGbMonth: 0.10,
      },
      scalingBehavior: {
        type: 'vertical',
        scaleUpThreshold: 0.8,
        scaleDownThreshold: 0.3,
        scaleUpCooldownSeconds: 300,
        scaleDownCooldownSeconds: 600,
        maxReplicas: 1,
        minReplicas: 1,
        scaleUpIncrement: 0,
      },
      failureCharacteristics: {
        failureModes: [
          {
            id: 'db_connection_exhaustion',
            name: 'Connection Pool Exhaustion',
            description: 'All DB connections in use, new requests rejected',
            probability: 0.4,
            latencyMultiplier: 2,
            errorRate: 0.3,
            throughputMultiplier: 0.1,
            affectedDownstreamBlocks: 0,
          },
          {
            id: 'db_replication_lag',
            name: 'Replication Lag',
            description: 'Read replicas lag behind primary, stale data served',
            probability: 0.3,
            latencyMultiplier: 1.5,
            errorRate: 0.05,
            throughputMultiplier: 0.8,
            affectedDownstreamBlocks: 0,
          },
          {
            id: 'db_lock_contention',
            name: 'Lock Contention',
            description: 'High lock contention causes query pile-up',
            probability: 0.2,
            latencyMultiplier: 10,
            errorRate: 0.2,
            throughputMultiplier: 0.3,
            affectedDownstreamBlocks: 0,
          },
          {
            id: 'db_storage_saturation',
            name: 'Storage Saturation',
            description: 'Disk full, writes fail',
            probability: 0.1,
            latencyMultiplier: 1,
            errorRate: 0.8,
            throughputMultiplier: 0.1,
            affectedDownstreamBlocks: 0,
          },
        ],
        failureProbabilityPerHour: 0.0005,
        recoveryProbabilityPerMinute: 0.1,
      },
    },
  },

  'cache': {
    id: 'cache',
    label: 'Cache',
    category: 'cache',
    defaultConfig: {
      engine: 'redis',
      maxMemory: '256mb',
      eviction: 'allkeys-lru',
      port: 6379,
    },
    behavioralModel: {
      capacity: {
        maxThroughput: 50000,
        maxConcurrent: 10000,
        maxQueueDepth: 100000,
      },
      latency: {
        baseLatencyMs: 1,
        latencyStdDevMs: 0.2,
        serializationMs: 0.2,
        deserializationMs: 0.2,
        queueLatencyMs: 0,
        cacheHitLatencyMs: 0.5,
        cacheMissLatencyMs: 15,
        cacheHitRate: 0.85,
      },
      errorCharacteristics: {
        baseErrorRate: 0.0001,
        errorRateUnderLoad: 0.02,
        errorDistribution: 'uniform',
        errorTypes: ['cache_miss', 'eviction', 'memory_full', 'connection_timeout'],
      },
      availability: {
        slaTarget: 0.9999,
        mttrMinutes: 1,
        mtbfHours: 8760,
      },
      resourceConsumption: {
        cpuPerRequest: 0.1,
        memoryPerConnection: 256,
        threadPoolSize: 50,
        connectionPoolSize: 1000,
      },
      cost: {
        hourlyComputeCost: 0.02,
        perRequestCost: 0.0000005,
        perGbNetworkCost: 0.09,
      },
      scalingBehavior: {
        type: 'horizontal',
        scaleUpThreshold: 0.8,
        scaleDownThreshold: 0.2,
        scaleUpCooldownSeconds: 60,
        scaleDownCooldownSeconds: 300,
        maxReplicas: 6,
        minReplicas: 2,
        scaleUpIncrement: 1,
      },
      failureCharacteristics: {
        failureModes: [
          {
            id: 'cache_eviction',
            name: 'Mass Eviction',
            description: 'Cache evicts most keys, hit rate drops to near zero',
            probability: 0.5,
            latencyMultiplier: 8,
            errorRate: 0.0,
            throughputMultiplier: 0.9,
            affectedDownstreamBlocks: 0,
          },
          {
            id: 'cache_failure',
            name: 'Cache Node Failure',
            description: 'Cache node goes down, requests fall through to DB',
            probability: 0.3,
            latencyMultiplier: 10,
            errorRate: 0.0,
            throughputMultiplier: 0.7,
            affectedDownstreamBlocks: 1,
          },
          {
            id: 'cache_memory_full',
            name: 'Memory Exhaustion',
            description: 'Cache cannot store new keys, evicts aggressively',
            probability: 0.2,
            latencyMultiplier: 3,
            errorRate: 0.01,
            throughputMultiplier: 0.8,
            affectedDownstreamBlocks: 0,
          },
        ],
        failureProbabilityPerHour: 0.0002,
        recoveryProbabilityPerMinute: 0.8,
      },
    },
  },

  'message-queue': {
    id: 'message-queue',
    label: 'Message Queue',
    category: 'queue',
    defaultConfig: {
      engine: 'kafka',
      partitions: 3,
      replication: 2,
      port: 9092,
    },
    behavioralModel: {
      capacity: {
        maxThroughput: 10000,
        maxConcurrent: 5000,
        maxQueueDepth: 100000,
        maxPartitions: 100,
      },
      latency: {
        baseLatencyMs: 3,
        latencyStdDevMs: 1,
        serializationMs: 0.5,
        deserializationMs: 0.5,
        queueLatencyMs: 10,
      },
      errorCharacteristics: {
        baseErrorRate: 0.0002,
        errorRateUnderLoad: 0.05,
        errorDistribution: 'burst',
        errorTypes: ['queue_full', 'consumer_lag', 'message_loss', 'partition_unavailable'],
      },
      availability: {
        slaTarget: 0.999,
        mttrMinutes: 3,
        mtbfHours: 4320,
      },
      resourceConsumption: {
        cpuPerRequest: 1,
        memoryPerConnection: 1024,
        storagePerRequest: 512,
        threadPoolSize: 100,
        connectionPoolSize: 500,
      },
      cost: {
        hourlyComputeCost: 0.08,
        perRequestCost: 0.000002,
        perGbNetworkCost: 0.09,
        storageCostPerGbMonth: 0.10,
      },
      scalingBehavior: {
        type: 'horizontal',
        scaleUpThreshold: 0.7,
        scaleDownThreshold: 0.3,
        scaleUpCooldownSeconds: 180,
        scaleDownCooldownSeconds: 600,
        maxReplicas: 10,
        minReplicas: 3,
        scaleUpIncrement: 2,
      },
      failureCharacteristics: {
        failureModes: [
          {
            id: 'queue_overflow',
            name: 'Queue Overflow',
            description: 'Queue depth exceeds max, messages dropped',
            probability: 0.4,
            latencyMultiplier: 2,
            errorRate: 0.2,
            throughputMultiplier: 0.5,
            affectedDownstreamBlocks: 0,
          },
          {
            id: 'consumer_lag',
            name: 'Consumer Lag',
            description: 'Consumers cannot keep up, backlog grows',
            probability: 0.3,
            latencyMultiplier: 5,
            errorRate: 0.0,
            throughputMultiplier: 0.8,
            affectedDownstreamBlocks: 0,
          },
          {
            id: 'message_loss',
            name: 'Message Loss',
            description: 'Messages lost due to broker failure or misconfiguration',
            probability: 0.2,
            latencyMultiplier: 1,
            errorRate: 0.1,
            throughputMultiplier: 0.9,
            affectedDownstreamBlocks: 0,
          },
          {
            id: 'partition_unavailable',
            name: 'Partition Unavailable',
            description: 'Partition leader unavailable, writes fail',
            probability: 0.1,
            latencyMultiplier: 1,
            errorRate: 0.5,
            throughputMultiplier: 0.3,
            affectedDownstreamBlocks: 0,
          },
        ],
        failureProbabilityPerHour: 0.0003,
        recoveryProbabilityPerMinute: 0.3,
      },
    },
  },

  'load-balancer': {
    id: 'load-balancer',
    label: 'Load Balancer',
    category: 'network',
    defaultConfig: {
      algorithm: 'round-robin',
      healthCheck: true,
      port: 80,
    },
    behavioralModel: {
      capacity: {
        maxThroughput: 50000,
        maxConcurrent: 10000,
        maxQueueDepth: 50000,
      },
      latency: {
        baseLatencyMs: 1,
        latencyStdDevMs: 0.2,
        serializationMs: 0.1,
        deserializationMs: 0.1,
        queueLatencyMs: 0,
      },
      errorCharacteristics: {
        baseErrorRate: 0.00005,
        errorRateUnderLoad: 0.01,
        errorDistribution: 'uniform',
        errorTypes: ['unhealthy_target', 'algorithm_failure', 'connection_limit'],
      },
      availability: {
        slaTarget: 0.99999,
        mttrMinutes: 1,
        mtbfHours: 17520,
      },
      resourceConsumption: {
        cpuPerRequest: 0.2,
        memoryPerConnection: 128,
        threadPoolSize: 500,
        connectionPoolSize: 10000,
      },
      cost: {
        hourlyComputeCost: 0.025,
        perRequestCost: 0.0000005,
        perGbNetworkCost: 0.09,
      },
      scalingBehavior: {
        type: 'auto',
        scaleUpThreshold: 0.8,
        scaleDownThreshold: 0.2,
        scaleUpCooldownSeconds: 30,
        scaleDownCooldownSeconds: 300,
        maxReplicas: 5,
        minReplicas: 2,
        scaleUpIncrement: 1,
      },
      failureCharacteristics: {
        failureModes: [
          {
            id: 'lb_unhealthy_targets',
            name: 'All Targets Unhealthy',
            description: 'Health checks fail for all targets, LB returns errors',
            probability: 0.5,
            latencyMultiplier: 1,
            errorRate: 1.0,
            throughputMultiplier: 0,
            affectedDownstreamBlocks: 0,
          },
          {
            id: 'lb_algorithm_failure',
            name: 'Algorithm Failure',
            description: 'Load balancing algorithm misroutes traffic',
            probability: 0.3,
            latencyMultiplier: 2,
            errorRate: 0.1,
            throughputMultiplier: 0.8,
            affectedDownstreamBlocks: 0,
          },
          {
            id: 'lb_connection_limit',
            name: 'Connection Limit',
            description: 'LB reaches max connections, new requests rejected',
            probability: 0.2,
            latencyMultiplier: 3,
            errorRate: 0.2,
            throughputMultiplier: 0.5,
            affectedDownstreamBlocks: 0,
          },
        ],
        failureProbabilityPerHour: 0.00005,
        recoveryProbabilityPerMinute: 0.9,
      },
    },
  },

  'cdn': {
    id: 'cdn',
    label: 'CDN',
    category: 'network',
    defaultConfig: {
      provider: 'cloudfront',
      caching: '1h',
      ssl: true,
    },
    behavioralModel: {
      capacity: {
        maxThroughput: 100000,
        maxConcurrent: 50000,
        maxQueueDepth: 100000,
      },
      latency: {
        baseLatencyMs: 20,
        latencyStdDevMs: 10,
        serializationMs: 0,
        deserializationMs: 0,
        queueLatencyMs: 0,
        cacheHitLatencyMs: 20,
        cacheMissLatencyMs: 200,
        cacheHitRate: 0.95,
      },
      errorCharacteristics: {
        baseErrorRate: 0.00001,
        errorRateUnderLoad: 0.005,
        errorDistribution: 'uniform',
        errorTypes: ['cache_miss', 'origin_timeout', 'ssl_error'],
      },
      availability: {
        slaTarget: 0.99999,
        mttrMinutes: 1,
        mtbfHours: 87600,
      },
      resourceConsumption: {
        cpuPerRequest: 0.05,
        memoryPerConnection: 64,
        threadPoolSize: 1000,
        connectionPoolSize: 50000,
      },
      cost: {
        hourlyComputeCost: 0.01,
        perRequestCost: 0.0000001,
        perGbNetworkCost: 0.085,
      },
      scalingBehavior: {
        type: 'auto',
        scaleUpThreshold: 0.9,
        scaleDownThreshold: 0.1,
        scaleUpCooldownSeconds: 10,
        scaleDownCooldownSeconds: 600,
        maxReplicas: 50,
        minReplicas: 5,
        scaleUpIncrement: 5,
      },
      failureCharacteristics: {
        failureModes: [
          {
            id: 'cdn_origin_timeout',
            name: 'Origin Timeout',
            description: 'CDN cannot reach origin, serves stale or errors',
            probability: 0.6,
            latencyMultiplier: 5,
            errorRate: 0.1,
            throughputMultiplier: 0.9,
            affectedDownstreamBlocks: 0,
          },
          {
            id: 'cdn_cache_invalidation',
            name: 'Cache Invalidation Storm',
            description: 'Mass cache invalidation causes origin overload',
            probability: 0.3,
            latencyMultiplier: 3,
            errorRate: 0.05,
            throughputMultiplier: 0.7,
            affectedDownstreamBlocks: 1,
          },
          {
            id: 'cdn_ssl_error',
            name: 'SSL Certificate Error',
            description: 'SSL cert issue blocks HTTPS traffic',
            probability: 0.1,
            latencyMultiplier: 1,
            errorRate: 0.5,
            throughputMultiplier: 0.5,
            affectedDownstreamBlocks: 0,
          },
        ],
        failureProbabilityPerHour: 0.00001,
        recoveryProbabilityPerMinute: 0.95,
      },
    },
  },

  'client': {
    id: 'client',
    label: 'Client',
    category: 'client',
    defaultConfig: {
      framework: 'react',
      ssr: false,
      caching: true,
    },
    behavioralModel: {
      capacity: {
        maxThroughput:  999999, // Client is the source, not a bottleneck
        maxConcurrent: 100,
        maxQueueDepth: 10000,
      },
      latency: {
        baseLatencyMs: 0,
        latencyStdDevMs: 0,
        serializationMs: 0,
        deserializationMs: 0,
        queueLatencyMs: 0,
      },
      errorCharacteristics: {
        baseErrorRate: 0,
        errorRateUnderLoad: 0,
        errorDistribution: 'uniform',
        errorTypes: [],
      },
      availability: {
        slaTarget: 1.0,
        mttrMinutes: 0,
        mtbfHours: 999999,
      },
      resourceConsumption: {
        cpuPerRequest: 0,
        memoryPerConnection: 0,
        threadPoolSize: 0,
        connectionPoolSize: 0,
      },
      cost: {
        hourlyComputeCost: 0,
        perRequestCost: 0,
        perGbNetworkCost: 0,
      },
      scalingBehavior: {
        type: 'none',
        scaleUpThreshold: 1.0,
        scaleDownThreshold: 0.0,
        scaleUpCooldownSeconds: 0,
        scaleDownCooldownSeconds: 0,
        maxReplicas: 1,
        minReplicas: 1,
        scaleUpIncrement: 0,
      },
      failureCharacteristics: {
        failureModes: [],
        failureProbabilityPerHour: 0,
        recoveryProbabilityPerMinute: 1.0,
      },
    },
  },

  'external-api': {
    id: 'external-api',
    label: 'External API',
    category: 'external',
    defaultConfig: {
      url: '',
      auth: 'api-key',
      rateLimit: 100,
    },
    behavioralModel: {
      capacity: {
        maxThroughput: 100,
        maxConcurrent: 50,
        maxQueueDepth: 200,
      },
      latency: {
        baseLatencyMs: 100,
        latencyStdDevMs: 50,
        serializationMs: 2,
        deserializationMs: 2,
        queueLatencyMs: 20,
      },
      errorCharacteristics: {
        baseErrorRate: 0.005,
        errorRateUnderLoad: 0.2,
        errorDistribution: 'exponential',
        errorTypes: ['timeout', 'rate_limit', 'auth_failure', 'service_unavailable'],
      },
      availability: {
        slaTarget: 0.99,
        mttrMinutes: 30,
        mtbfHours: 720,
      },
      resourceConsumption: {
        cpuPerRequest: 1,
        memoryPerConnection: 1024,
        threadPoolSize: 20,
        connectionPoolSize: 50,
      },
      cost: {
        hourlyComputeCost: 0,
        perRequestCost: 0.001,
        perGbNetworkCost: 0,
      },
      scalingBehavior: {
        type: 'none',
        scaleUpThreshold: 1.0,
        scaleDownThreshold: 0.0,
        scaleUpCooldownSeconds: 0,
        scaleDownCooldownSeconds: 0,
        maxReplicas: 1,
        minReplicas: 1,
        scaleUpIncrement: 0,
      },
      failureCharacteristics: {
        failureModes: [
          {
            id: 'external_timeout',
            name: 'External Timeout',
            description: 'External API does not respond within timeout',
            probability: 0.4,
            latencyMultiplier: 1,
            errorRate: 1.0,
            throughputMultiplier: 0,
            affectedDownstreamBlocks: 0,
          },
          {
            id: 'external_rate_limit',
            name: 'Rate Limit Exceeded',
            description: 'External API returns 429, requests throttled',
            probability: 0.3,
            latencyMultiplier: 5,
            errorRate: 0.3,
            throughputMultiplier: 0.2,
            affectedDownstreamBlocks: 0,
          },
          {
            id: 'external_outage',
            name: 'External Service Outage',
            description: 'External API completely unavailable',
            probability: 0.2,
            latencyMultiplier: 1,
            errorRate: 1.0,
            throughputMultiplier: 0,
            affectedDownstreamBlocks: 0,
          },
          {
            id: 'external_auth_failure',
            name: 'Authentication Failure',
            description: 'API key expired or invalid',
            probability: 0.1,
            latencyMultiplier: 1,
            errorRate: 1.0,
            throughputMultiplier: 0,
            affectedDownstreamBlocks: 0,
          },
        ],
        failureProbabilityPerHour: 0.01,
        recoveryProbabilityPerMinute: 0.05,
      },
    },
  },

  'storage': {
    id: 'storage',
    label: 'Storage',
    category: 'storage',
    defaultConfig: {
      provider: 's3',
      encryption: true,
      region: 'us-east-1',
    },
    behavioralModel: {
      capacity: {
        maxThroughput: 5000,
        maxConcurrent: 1000,
        maxQueueDepth: 10000,
      },
      latency: {
        baseLatencyMs: 50,
        latencyStdDevMs: 20,
        serializationMs: 1,
        deserializationMs: 1,
        queueLatencyMs: 10,
      },
      errorCharacteristics: {
        baseErrorRate: 0.0001,
        errorRateUnderLoad: 0.05,
        errorDistribution: 'uniform',
        errorTypes: ['not_found', 'permission_denied', 'storage_full', 'network_error'],
      },
      availability: {
        slaTarget: 0.9999,
        mttrMinutes: 5,
        mtbfHours: 8760,
      },
      resourceConsumption: {
        cpuPerRequest: 1,
        memoryPerConnection: 512,
        storagePerRequest: 10240,
        threadPoolSize: 100,
        connectionPoolSize: 1000,
      },
      cost: {
        hourlyComputeCost: 0.01,
        perRequestCost: 0.000005,
        perGbNetworkCost: 0.09,
        storageCostPerGbMonth: 0.023,
      },
      scalingBehavior: {
        type: 'auto',
        scaleUpThreshold: 0.9,
        scaleDownThreshold: 0.1,
        scaleUpCooldownSeconds: 60,
        scaleDownCooldownSeconds: 600,
        maxReplicas: 20,
        minReplicas: 3,
        scaleUpIncrement: 3,
      },
      failureCharacteristics: {
        failureModes: [
          {
            id: 'storage_full',
            name: 'Storage Full',
            description: 'Storage quota exceeded, writes fail',
            probability: 0.4,
            latencyMultiplier: 1,
            errorRate: 0.8,
            throughputMultiplier: 0.1,
            affectedDownstreamBlocks: 0,
          },
          {
            id: 'storage_network_error',
            name: 'Network Partition',
            description: 'Cannot reach storage service',
            probability: 0.3,
            latencyMultiplier: 1,
            errorRate: 1.0,
            throughputMultiplier: 0,
            affectedDownstreamBlocks: 0,
          },
          {
            id: 'storage_permission_denied',
            name: 'Permission Denied',
            description: 'IAM policy blocks access',
            probability: 0.2,
            latencyMultiplier: 1,
            errorRate: 1.0,
            throughputMultiplier: 0,
            affectedDownstreamBlocks: 0,
          },
          {
            id: 'storage_encryption_failure',
            name: 'Encryption Failure',
            description: 'Encryption/decryption fails',
            probability: 0.1,
            latencyMultiplier: 2,
            errorRate: 0.3,
            throughputMultiplier: 0.5,
            affectedDownstreamBlocks: 0,
          },
        ],
        failureProbabilityPerHour: 0.0001,
        recoveryProbabilityPerMinute: 0.5,
      },
    },
  },

  'function': {
    id: 'function',
    label: 'Function',
    category: 'compute',
    defaultConfig: {
      runtime: 'nodejs18',
      memory: '512MB',
      timeout: 30000,
    },
    behavioralModel: {
      capacity: {
        maxThroughput: 1000,
        maxConcurrent: 100,
        maxQueueDepth: 1000,
      },
      latency: {
        baseLatencyMs: 50,
        latencyStdDevMs: 30,
        serializationMs: 1,
        deserializationMs: 1,
        queueLatencyMs: 10,
      },
      errorCharacteristics: {
        baseErrorRate: 0.001,
        errorRateUnderLoad: 0.1,
        errorDistribution: 'exponential',
        errorTypes: ['timeout', 'oom', 'cold_start', 'runtime_error'],
      },
      availability: {
        slaTarget: 0.999,
        mttrMinutes: 1,
        mtbfHours: 4320,
      },
      resourceConsumption: {
        cpuPerRequest: 10,
        memoryPerConnection: 512000,
        threadPoolSize: 1,
        connectionPoolSize: 1,
      },
      cost: {
        hourlyComputeCost: 0,
        perRequestCost: 0.0002,
        perGbNetworkCost: 0.09,
      },
      scalingBehavior: {
        type: 'auto',
        scaleUpThreshold: 0.8,
        scaleDownThreshold: 0.1,
        scaleUpCooldownSeconds: 0,
        scaleDownCooldownSeconds: 600,
        maxReplicas: 1000,
        minReplicas: 0,
        scaleUpIncrement: 10,
      },
      failureCharacteristics: {
        failureModes: [
          {
            id: 'function_cold_start',
            name: 'Cold Start',
            description: 'Function not warm, high latency on first requests',
            probability: 0.4,
            latencyMultiplier: 10,
            errorRate: 0.0,
            throughputMultiplier: 0.9,
            affectedDownstreamBlocks: 0,
          },
          {
            id: 'function_timeout',
            name: 'Function Timeout',
            description: 'Function exceeds timeout limit',
            probability: 0.3,
            latencyMultiplier: 1,
            errorRate: 1.0,
            throughputMultiplier: 0,
            affectedDownstreamBlocks: 0,
          },
          {
            id: 'function_oom',
            name: 'Out of Memory',
            description: 'Function exceeds memory limit',
            probability: 0.2,
            latencyMultiplier: 1,
            errorRate: 1.0,
            throughputMultiplier: 0,
            affectedDownstreamBlocks: 0,
          },
          {
            id: 'function_runtime_error',
            name: 'Runtime Error',
            description: 'Unhandled exception in function code',
            probability: 0.1,
            latencyMultiplier: 1,
            errorRate: 1.0,
            throughputMultiplier: 0,
            affectedDownstreamBlocks: 0,
          },
        ],
        failureProbabilityPerHour: 0.001,
        recoveryProbabilityPerMinute: 0.9,
      },
    },
  },

  'ai-service': {
    id: 'ai-service',
    label: 'AI Service',
    category: 'ai',
    defaultConfig: {
      provider: 'openai',
      model: 'gpt-4',
      maxTokens: 4096,
    },
    behavioralModel: {
      capacity: {
        maxThroughput: 100,
        maxConcurrent: 50,
        maxQueueDepth: 500,
      },
      latency: {
        baseLatencyMs: 500,
        latencyStdDevMs: 300,
        serializationMs: 5,
        deserializationMs: 5,
        queueLatencyMs: 50,
      },
      errorCharacteristics: {
        baseErrorRate: 0.01,
        errorRateUnderLoad: 0.3,
        errorDistribution: 'exponential',
        errorTypes: ['timeout', 'rate_limit', 'context_length', 'content_filter', 'model_overload'],
      },
      availability: {
        slaTarget: 0.99,
        mttrMinutes: 5,
        mtbfHours: 720,
      },
      resourceConsumption: {
        cpuPerRequest: 100,
        memoryPerConnection: 10240,
        threadPoolSize: 10,
        connectionPoolSize: 50,
      },
      cost: {
        hourlyComputeCost: 0,
        perRequestCost: 0.03,
        perGbNetworkCost: 0,
      },
      scalingBehavior: {
        type: 'none',
        scaleUpThreshold: 1.0,
        scaleDownThreshold: 0.0,
        scaleUpCooldownSeconds: 0,
        scaleDownCooldownSeconds: 0,
        maxReplicas: 1,
        minReplicas: 1,
        scaleUpIncrement: 0,
      },
      failureCharacteristics: {
        failureModes: [
          {
            id: 'ai_rate_limit',
            name: 'Rate Limit',
            description: 'AI provider rate limit exceeded',
            probability: 0.4,
            latencyMultiplier: 5,
            errorRate: 0.5,
            throughputMultiplier: 0.1,
            affectedDownstreamBlocks: 0,
          },
          {
            id: 'ai_model_overload',
            name: 'Model Overload',
            description: 'AI provider overloaded, high latency',
            probability: 0.3,
            latencyMultiplier: 3,
            errorRate: 0.1,
            throughputMultiplier: 0.5,
            affectedDownstreamBlocks: 0,
          },
          {
            id: 'ai_timeout',
            name: 'AI Timeout',
            description: 'AI response exceeds timeout',
            probability: 0.2,
            latencyMultiplier: 1,
            errorRate: 1.0,
            throughputMultiplier: 0,
            affectedDownstreamBlocks: 0,
          },
          {
            id: 'ai_content_filter',
            name: 'Content Filter',
            description: 'Request blocked by content filter',
            probability: 0.1,
            latencyMultiplier: 1,
            errorRate: 1.0,
            throughputMultiplier: 0,
            affectedDownstreamBlocks: 0,
          },
        ],
        failureProbabilityPerHour: 0.01,
        recoveryProbabilityPerMinute: 0.2,
      },
    },
  },
}

// ============================================================================
// CONNECTION TYPE DEFINITIONS (Simulation-Ready)
// ============================================================================

export const SIMULATION_CONNECTION_TYPES = {
  http: {
    id: 'http',
    label: 'HTTP',
    color: '#3b82f6',
    behavioralModel: {
      transport: { type: 'tcp', handshakeMs: 30, keepAlive: true, keepAliveTimeoutMs: 30000 },
      overhead: { serializationMs: 0.5, deserializationMs: 0.5, encryptionMs: 0, decryptionMs: 0, compressionRatio: 1.0, compressionMs: 0, decompressionMs: 0 },
      network: { baseLatencyMs: 10, jitterMs: 2, packetLossRate: 0.0001, bandwidthMbps: 1000, mtuBytes: 1500 },
      reliability: { maxRetries: 0, retryBackoffMs: 0, retryBackoffMultiplier: 1, timeoutMs: 30000, circuitBreakerEnabled: false },
      throughput: { maxRps: 10000, maxConcurrent: 1000, maxPayloadBytes: 1048576 },
    },
  },

  https: {
    id: 'https',
    label: 'HTTPS',
    color: '#10b981',
    behavioralModel: {
      transport: { type: 'tls', handshakeMs: 100, keepAlive: true, keepAliveTimeoutMs: 30000 },
      overhead: { serializationMs: 0.5, deserializationMs: 0.5, encryptionMs: 2, decryptionMs: 2, compressionRatio: 0.9, compressionMs: 1, decompressionMs: 1 },
      network: { baseLatencyMs: 12, jitterMs: 2, packetLossRate: 0.0001, bandwidthMbps: 1000, mtuBytes: 1500 },
      reliability: { maxRetries: 0, retryBackoffMs: 0, retryBackoffMultiplier: 1, timeoutMs: 30000, circuitBreakerEnabled: false },
      throughput: { maxRps: 8000, maxConcurrent: 1000, maxPayloadBytes: 1048576 },
    },
  },

  rest: {
    id: 'rest',
    label: 'REST',
    color: '#6366f1',
    behavioralModel: {
      transport: { type: 'tls', handshakeMs: 100, keepAlive: true, keepAliveTimeoutMs: 30000 },
      overhead: { serializationMs: 1, deserializationMs: 1, encryptionMs: 2, decryptionMs: 2, compressionRatio: 0.85, compressionMs: 2, decompressionMs: 2 },
      network: { baseLatencyMs: 12, jitterMs: 2, packetLossRate: 0.0001, bandwidthMbps: 1000, mtuBytes: 1500 },
      reliability: { maxRetries: 3, retryBackoffMs: 100, retryBackoffMultiplier: 2, timeoutMs: 30000, circuitBreakerEnabled: true, circuitBreakerThreshold: 0.5, circuitBreakerRecoveryMs: 30000, circuitBreakerHalfOpenRequests: 5 },
      throughput: { maxRps: 5000, maxConcurrent: 500, maxPayloadBytes: 10485760 },
    },
  },

  graphql: {
    id: 'graphql',
    label: 'GraphQL',
    color: '#ec4899',
    behavioralModel: {
      transport: { type: 'tls', handshakeMs: 100, keepAlive: true, keepAliveTimeoutMs: 30000 },
      overhead: { serializationMs: 2, deserializationMs: 2, encryptionMs: 2, decryptionMs: 2, compressionRatio: 0.8, compressionMs: 3, decompressionMs: 3 },
      network: { baseLatencyMs: 12, jitterMs: 2, packetLossRate: 0.0001, bandwidthMbps: 1000, mtuBytes: 1500 },
      reliability: { maxRetries: 2, retryBackoffMs: 100, retryBackoffMultiplier: 2, timeoutMs: 30000, circuitBreakerEnabled: true, circuitBreakerThreshold: 0.5, circuitBreakerRecoveryMs: 30000, circuitBreakerHalfOpenRequests: 5 },
      throughput: { maxRps: 3000, maxConcurrent: 300, maxPayloadBytes: 52428800 },
    },
  },

  websocket: {
    id: 'websocket',
    label: 'WebSocket',
    color: '#f59e0b',
    behavioralModel: {
      transport: { type: 'tcp', handshakeMs: 50, keepAlive: true, keepAliveTimeoutMs: 30000 },
      overhead: { serializationMs: 0.2, deserializationMs: 0.2, encryptionMs: 1, decryptionMs: 1, compressionRatio: 1.0, compressionMs: 0, decompressionMs: 0 },
      network: { baseLatencyMs: 10, jitterMs: 1, packetLossRate: 0.0001, bandwidthMbps: 100, mtuBytes: 1500 },
      reliability: { maxRetries: 0, retryBackoffMs: 0, retryBackoffMultiplier: 1, timeoutMs: 0, circuitBreakerEnabled: false },
      throughput: { maxRps: 999999, maxConcurrent: 10000, maxPayloadBytes: 65536 },
    },
  },

  grpc: {
    id: 'grpc',
    label: 'gRPC',
    color: '#8b5cf6',
    behavioralModel: {
      transport: { type: 'quic', handshakeMs: 50, keepAlive: true, keepAliveTimeoutMs: 30000 },
      overhead: { serializationMs: 0.3, deserializationMs: 0.3, encryptionMs: 1, decryptionMs: 1, compressionRatio: 0.7, compressionMs: 1, decompressionMs: 1 },
      network: { baseLatencyMs: 8, jitterMs: 1, packetLossRate: 0.0001, bandwidthMbps: 1000, mtuBytes: 1500 },
      reliability: { maxRetries: 3, retryBackoffMs: 50, retryBackoffMultiplier: 2, timeoutMs: 10000, circuitBreakerEnabled: true, circuitBreakerThreshold: 0.5, circuitBreakerRecoveryMs: 30000, circuitBreakerHalfOpenRequests: 5 },
      throughput: { maxRps: 10000, maxConcurrent: 1000, maxPayloadBytes: 4194304 },
    },
  },

  kafka: {
    id: 'kafka',
    label: 'Kafka',
    color: '#ef4444',
    behavioralModel: {
      transport: { type: 'tcp', handshakeMs: 20, keepAlive: true, keepAliveTimeoutMs: 60000 },
      overhead: { serializationMs: 0.5, deserializationMs: 0.5, encryptionMs: 0, decryptionMs: 0, compressionRatio: 0.6, compressionMs: 2, decompressionMs: 2 },
      network: { baseLatencyMs: 5, jitterMs: 1, packetLossRate: 0.00001, bandwidthMbps: 1000, mtuBytes: 1048576 },
      reliability: { maxRetries: 3, retryBackoffMs: 100, retryBackoffMultiplier: 2, timeoutMs: 30000, circuitBreakerEnabled: false },
      throughput: { maxRps: 100000, maxConcurrent: 10000, maxPayloadBytes: 1048576 },
    },
  },

  rabbitmq: {
    id: 'rabbitmq',
    label: 'RabbitMQ',
    color: '#f97316',
    behavioralModel: {
      transport: { type: 'tcp', handshakeMs: 20, keepAlive: true, keepAliveTimeoutMs: 60000 },
      overhead: { serializationMs: 1, deserializationMs: 1, encryptionMs: 0, decryptionMs: 0, compressionRatio: 0.9, compressionMs: 1, decompressionMs: 1 },
      network: { baseLatencyMs: 5, jitterMs: 1, packetLossRate: 0.00001, bandwidthMbps: 1000, mtuBytes: 131072 },
      reliability: { maxRetries: 3, retryBackoffMs: 100, retryBackoffMultiplier: 2, timeoutMs: 30000, circuitBreakerEnabled: false },
      throughput: { maxRps: 50000, maxConcurrent: 5000, maxPayloadBytes: 524288 },
    },
  },

  amqp: {
    id: 'amqp',
    label: 'AMQP',
    color: '#14b8a6',
    behavioralModel: {
      transport: { type: 'tcp', handshakeMs: 30, keepAlive: true, keepAliveTimeoutMs: 60000 },
      overhead: { serializationMs: 1, deserializationMs: 1, encryptionMs: 1, decryptionMs: 1, compressionRatio: 0.9, compressionMs: 1, decompressionMs: 1 },
      network: { baseLatencyMs: 6, jitterMs: 1, packetLossRate: 0.00001, bandwidthMbps: 1000, mtuBytes: 131072 },
      reliability: { maxRetries: 3, retryBackoffMs: 100, retryBackoffMultiplier: 2, timeoutMs: 30000, circuitBreakerEnabled: false },
      throughput: { maxRps: 30000, maxConcurrent: 3000, maxPayloadBytes: 524288 },
    },
  },

  mqtt: {
    id: 'mqtt',
    label: 'MQTT',
    color: '#06b6d4',
    behavioralModel: {
      transport: { type: 'tcp', handshakeMs: 20, keepAlive: true, keepAliveTimeoutMs: 60000 },
      overhead: { serializationMs: 0.2, deserializationMs: 0.2, encryptionMs: 0, decryptionMs: 0, compressionRatio: 1.0, compressionMs: 0, decompressionMs: 0 },
      network: { baseLatencyMs: 15, jitterMs: 5, packetLossRate: 0.001, bandwidthMbps: 10, mtuBytes: 65536 },
      reliability: { maxRetries: 0, retryBackoffMs: 0, retryBackoffMultiplier: 1, timeoutMs: 30000, circuitBreakerEnabled: false },
      throughput: { maxRps: 10000, maxConcurrent: 1000, maxPayloadBytes: 268435456 },
    },
  },

  tcp: {
    id: 'tcp',
    label: 'TCP',
    color: '#64748b',
    behavioralModel: {
      transport: { type: 'tcp', handshakeMs: 30, keepAlive: true, keepAliveTimeoutMs: 30000 },
      overhead: { serializationMs: 0, deserializationMs: 0, encryptionMs: 0, decryptionMs: 0, compressionRatio: 1.0, compressionMs: 0, decompressionMs: 0 },
      network: { baseLatencyMs: 10, jitterMs: 2, packetLossRate: 0.0001, bandwidthMbps: 1000, mtuBytes: 1500 },
      reliability: { maxRetries: 0, retryBackoffMs: 0, retryBackoffMultiplier: 1, timeoutMs: 0, circuitBreakerEnabled: false },
      throughput: { maxRps: 100000, maxConcurrent: 10000, maxPayloadBytes: 999999999 },
    },
  },

  udp: {
    id: 'udp',
    label: 'UDP',
    color: '#84cc16',
    behavioralModel: {
      transport: { type: 'udp', handshakeMs: 0, keepAlive: false, keepAliveTimeoutMs: 0 },
      overhead: { serializationMs: 0, deserializationMs: 0, encryptionMs: 0, decryptionMs: 0, compressionRatio: 1.0, compressionMs: 0, decompressionMs: 0 },
      network: { baseLatencyMs: 8, jitterMs: 3, packetLossRate: 0.001, bandwidthMbps: 1000, mtuBytes: 1500 },
      reliability: { maxRetries: 0, retryBackoffMs: 0, retryBackoffMultiplier: 1, timeoutMs: 0, circuitBreakerEnabled: false },
      throughput: { maxRps: 100000, maxConcurrent: 10000, maxPayloadBytes: 65536 },
    },
  },

  sftp: {
    id: 'sftp',
    label: 'SFTP',
    color: '#a855f7',
    behavioralModel: {
      transport: { type: 'tls', handshakeMs: 200, keepAlive: true, keepAliveTimeoutMs: 60000 },
      overhead: { serializationMs: 2, deserializationMs: 2, encryptionMs: 5, decryptionMs: 5, compressionRatio: 0.8, compressionMs: 10, decompressionMs: 10 },
      network: { baseLatencyMs: 50, jitterMs: 10, packetLossRate: 0.0001, bandwidthMbps: 100, mtuBytes: 1500 },
      reliability: { maxRetries: 3, retryBackoffMs: 1000, retryBackoffMultiplier: 2, timeoutMs: 60000, circuitBreakerEnabled: false },
      throughput: { maxRps: 100, maxConcurrent: 10, maxPayloadBytes: 1073741824 },
    },
  },

  'event-stream': {
    id: 'event-stream',
    label: 'Event Stream',
    color: '#d946ef',
    behavioralModel: {
      transport: { type: 'tcp', handshakeMs: 20, keepAlive: true, keepAliveTimeoutMs: 60000 },
      overhead: { serializationMs: 0.5, deserializationMs: 0.5, encryptionMs: 0, decryptionMs: 0, compressionRatio: 0.7, compressionMs: 2, decompressionMs: 2 },
      network: { baseLatencyMs: 5, jitterMs: 1, packetLossRate: 0.00001, bandwidthMbps: 1000, mtuBytes: 1048576 },
      reliability: { maxRetries: 3, retryBackoffMs: 100, retryBackoffMultiplier: 2, timeoutMs: 30000, circuitBreakerEnabled: false },
      throughput: { maxRps: 50000, maxConcurrent: 5000, maxPayloadBytes: 1048576 },
    },
  },
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get the behavioral model for a block type.
 * Returns a deep copy so mutations don't affect the original.
 */
export function getBlockBehavioralModel(type) {
  const definition = SIMULATION_BLOCK_TYPES[type]
  if (!definition) {
    // Return a generic fallback model for unknown types
    return deepClone(SIMULATION_BLOCK_TYPES['service'].behavioralModel)
  }
  return deepClone(definition.behavioralModel)
}

/**
 * Get the behavioral model for a connection type.
 */
export function getConnectionBehavioralModel(type) {
  const definition = SIMULATION_CONNECTION_TYPES[type]
  if (!definition) {
    // Default to HTTP for unknown types
    return deepClone(SIMULATION_CONNECTION_TYPES['http'].behavioralModel)
  }
  return deepClone(definition.behavioralModel)
}

/**
 * Merge user config with default behavioral model.
 * User values override defaults where provided.
 */
export function mergeBlockBehavioralModel(type, userConfig = {}) {
  const defaults = getBlockBehavioralModel(type)
  return deepMerge(defaults, userConfig)
}

/**
 * Merge user config with default connection behavioral model.
 */
export function mergeConnectionBehavioralModel(type, userConfig = {}) {
  const defaults = getConnectionBehavioralModel(type)
  return deepMerge(defaults, userConfig)
}

/**
 * List all supported block types for simulation.
 */
export function getSupportedBlockTypes() {
  return Object.keys(SIMULATION_BLOCK_TYPES)
}

/**
 * List all supported connection types for simulation.
 */
export function getSupportedConnectionTypes() {
  return Object.keys(SIMULATION_CONNECTION_TYPES)
}

/**
 * Validate that a block type is supported.
 */
export function isBlockTypeSupported(type) {
  return type in SIMULATION_BLOCK_TYPES
}

/**
 * Validate that a connection type is supported.
 */
export function isConnectionTypeSupported(type) {
  return type in SIMULATION_CONNECTION_TYPES
}

// ============================================================================
// UTILITIES
// ============================================================================

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj))
}

function deepMerge(target, source) {
  const result = deepClone(target)
  for (const key in source) {
    if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(result[key] || {}, source[key])
    } else {
      result[key] = source[key]
    }
  }
  return result
}