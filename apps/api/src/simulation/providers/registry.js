/**
 * Provider Registry
 * 
 * Normalized cloud provider pricing and resource models.
 * No vendor names in engine logic — only normalized resource types.
 * 
 * Pricing snapshots are loaded from DB/cache before simulation.
 * All lookups are O(1) via pre-built maps.
 */

// ============================================================================
// NORMALIZED RESOURCE TYPES
// ============================================================================

export const RESOURCE_TYPES = Object.freeze({
  COMPUTE: 'compute',
  CONTAINER: 'container',
  SERVERLESS: 'serverless',
  GPU: 'gpu',
  OBJECT_STORAGE: 'object_storage',
  BLOCK_STORAGE: 'block_storage',
  FILE_STORAGE: 'file_storage',
  DATABASE_POSTGRESQL: 'database_postgresql',
  DATABASE_MYSQL: 'database_mysql',
  DATABASE_MONGODB: 'database_mongodb',
  CACHE_REDIS: 'cache_redis',
  MESSAGE_QUEUE_KAFKA: 'message_queue_kafka',
  MESSAGE_QUEUE_RABBITMQ: 'message_queue_rabbitmq',
  LOAD_BALANCER: 'load_balancer',
  API_GATEWAY: 'api_gateway',
  DNS: 'dns',
  CDN: 'cdn',
  BANDWIDTH: 'bandwidth',
  NAT_GATEWAY: 'nat_gateway',
  VPN: 'vpn',
  EMAIL: 'email',
  LOGGING: 'logging',
  MONITORING: 'monitoring',
  TRACING: 'tracing',
  SECRETS: 'secrets',
  IDENTITY: 'identity',
  AI_INFERENCE: 'ai_inference',
  VECTOR_DATABASE: 'vector_database',
  SEARCH: 'search',
  FUNCTIONS: 'functions',
  NETWORKING: 'networking',
  KUBERNETES: 'kubernetes',
})

export const PRICING_DIMENSIONS = Object.freeze({
  PER_HOUR: 'per_hour',
  PER_GB_HOUR: 'per_gb_hour',
  PER_REQUEST: 'per_request',
  PER_GB_TRANSFERRED: 'per_gb_transferred',
  PER_GB_STORED: 'per_gb_stored',
  PER_VCPU_HOUR: 'per_vcpu_hour',
  PER_GB_RAM_HOUR: 'per_gb_ram_hour',
  PER_CONNECTION_HOUR: 'per_connection_hour',
  PER_MESSAGE: 'per_message',
  PER_TOKEN: 'per_token',
  PER_QUERY: 'per_query',
})

// ============================================================================
// PROVIDER SNAPSHOT CLASS
// ============================================================================

export class ProviderSnapshot {
  constructor(rawSnapshot = {}) {
    this.version = rawSnapshot.version || '1.0.0'
    this.fetchedAt = rawSnapshot.fetchedAt || new Date().toISOString()
    this.providers = rawSnapshot.providers || {}
    this._buildIndex()
  }

  _buildIndex() {
    this._resourceIndex = new Map()
    this._providerIndex = new Map()

    for (const [providerId, providerData] of Object.entries(this.providers)) {
      this._providerIndex.set(providerId, providerData)
      for (const [resourceType, pricing] of Object.entries(providerData.resources || {})) {
        const key = `${providerId}:${resourceType}`
        this._resourceIndex.set(key, pricing)
      }
    }
  }

  /**
   * Get pricing for a specific resource from a specific provider.
   * Falls back to generic defaults if provider-specific not found.
   */
  getPricing(providerId, resourceType, region = 'us-east-1') {
    const key = `${providerId}:${resourceType}`
    const pricing = this._resourceIndex.get(key)
    if (!pricing) return null

    // Region-specific override
    if (pricing.regions && pricing.regions[region]) {
      return { ...pricing, ...pricing.regions[region] }
    }
    return pricing
  }

  /**
   * Get all providers that offer a given resource type.
   */
  getProvidersForResource(resourceType) {
    const results = []
    for (const [providerId, providerData] of this._providerIndex) {
      if (providerData.resources?.[resourceType]) {
        results.push({ providerId, ...providerData.resources[resourceType] })
      }
    }
    return results
  }

  /**
   * Get cheapest provider for a resource (naive — no region weighting).
   */
  getCheapest(resourceType, dimension = PRICING_DIMENSIONS.PER_HOUR) {
    const candidates = this.getProvidersForResource(resourceType)
    if (candidates.length === 0) return null

    return candidates
      .filter(c => c.pricing?.[dimension] !== undefined)
      .sort((a, b) => a.pricing[dimension] - b.pricing[dimension])[0] || null
  }

  /**
   * Calculate cost for a resource usage pattern.
   */
  calculateCost(providerId, resourceType, usage, region = 'us-east-1') {
    const pricing = this.getPricing(providerId, resourceType, region)
    if (!pricing) return { cost: 0, currency: 'USD', confidence: 0, notes: ['No pricing data available'] }

    let total = 0
    const breakdown = []
    const notes = []

    for (const [dimension, rate] of Object.entries(pricing.pricing || {})) {
      const amount = usage[dimension] || 0
      if (amount > 0) {
        const cost = amount * rate
        total += cost
        breakdown.push({ dimension, rate, amount, cost })
      }
    }

    // Minimum charge
    if (pricing.minimumCharge && total < pricing.minimumCharge) {
      total = pricing.minimumCharge
      notes.push(`Minimum charge applied: ${pricing.minimumCharge} ${pricing.currency || 'USD'}`)
    }

    return {
      cost: total,
      currency: pricing.currency || 'USD',
      confidence: pricing.confidence || 0.8,
      breakdown,
      notes,
    }
  }

  toJSON() {
    return {
      version: this.version,
      fetchedAt: this.fetchedAt,
      providers: this.providers,
    }
  }
}

// ============================================================================
// DEFAULT SNAPSHOT BUILDER (for when no DB data exists)
// ============================================================================

export function buildDefaultSnapshot() {
  return new ProviderSnapshot({
    version: '1.0.0-default',
    fetchedAt: new Date().toISOString(),
    providers: {
      generic: {
        name: 'Generic Cloud',
        resources: {
          [RESOURCE_TYPES.COMPUTE]: {
            pricing: {
              [PRICING_DIMENSIONS.PER_VCPU_HOUR]: 0.05,
              [PRICING_DIMENSIONS.PER_GB_RAM_HOUR]: 0.01,
            },
            currency: 'USD',
            confidence: 0.6,
            notes: ['Generic fallback pricing — configure provider for accuracy'],
          },
          [RESOURCE_TYPES.DATABASE_POSTGRESQL]: {
            pricing: {
              [PRICING_DIMENSIONS.PER_HOUR]: 0.15,
              [PRICING_DIMENSIONS.PER_GB_STORAGE_HOUR]: 0.00014,
            },
            currency: 'USD',
            confidence: 0.6,
          },
          [RESOURCE_TYPES.CACHE_REDIS]: {
            pricing: {
              [PRICING_DIMENSIONS.PER_HOUR]: 0.02,
              [PRICING_DIMENSIONS.PER_GB_RAM_HOUR]: 0.0125,
            },
            currency: 'USD',
            confidence: 0.6,
          },
          [RESOURCE_TYPES.OBJECT_STORAGE]: {
            pricing: {
              [PRICING_DIMENSIONS.PER_GB_STORED]: 0.023,
              [PRICING_DIMENSIONS.PER_GB_TRANSFERRED]: 0.09,
            },
            currency: 'USD',
            confidence: 0.7,
          },
          [RESOURCE_TYPES.BANDWIDTH]: {
            pricing: {
              [PRICING_DIMENSIONS.PER_GB_TRANSFERRED]: 0.09,
            },
            currency: 'USD',
            confidence: 0.8,
          },
          [RESOURCE_TYPES.CDN]: {
            pricing: {
              [PRICING_DIMENSIONS.PER_GB_TRANSFERRED]: 0.085,
              [PRICING_DIMENSIONS.PER_REQUEST]: 0.0000001,
            },
            currency: 'USD',
            confidence: 0.7,
          },
          [RESOURCE_TYPES.LOAD_BALANCER]: {
            pricing: {
              [PRICING_DIMENSIONS.PER_HOUR]: 0.025,
              [PRICING_DIMENSIONS.PER_GB_TRANSFERRED]: 0.008,
            },
            currency: 'USD',
            confidence: 0.7,
          },
          [RESOURCE_TYPES.API_GATEWAY]: {
            pricing: {
              [PRICING_DIMENSIONS.PER_REQUEST]: 0.000003,
              [PRICING_DIMENSIONS.PER_GB_TRANSFERRED]: 0.09,
            },
            currency: 'USD',
            confidence: 0.7,
          },
          [RESOURCE_TYPES.FUNCTIONS]: {
            pricing: {
              [PRICING_DIMENSIONS.PER_REQUEST]: 0.0000002,
              [PRICING_DIMENSIONS.PER_GB_RAM_HOUR]: 0.0000166667, // per 100ms per GB
            },
            currency: 'USD',
            confidence: 0.7,
          },
          [RESOURCE_TYPES.AI_INFERENCE]: {
            pricing: {
              [PRICING_DIMENSIONS.PER_REQUEST]: 0.03,
              [PRICING_DIMENSIONS.PER_TOKEN]: 0.00001,
            },
            currency: 'USD',
            confidence: 0.5,
            notes: ['AI pricing varies widely by model — user override recommended'],
          },
          [RESOURCE_TYPES.MESSAGE_QUEUE_KAFKA]: {
            pricing: {
              [PRICING_DIMENSIONS.PER_HOUR]: 0.08,
              [PRICING_DIMENSIONS.PER_GB_STORAGE_HOUR]: 0.00014,
            },
            currency: 'USD',
            confidence: 0.6,
          },
        },
      },
    },
  })
}

// ============================================================================
// BLOCK TYPE → RESOURCE TYPE MAPPING
// ============================================================================

export const BLOCK_TYPE_RESOURCE_MAP = Object.freeze({
  'api-gateway': RESOURCE_TYPES.API_GATEWAY,
  'service': RESOURCE_TYPES.COMPUTE,
  'database': RESOURCE_TYPES.DATABASE_POSTGRESQL,
  'cache': RESOURCE_TYPES.CACHE_REDIS,
  'message-queue': RESOURCE_TYPES.MESSAGE_QUEUE_KAFKA,
  'load-balancer': RESOURCE_TYPES.LOAD_BALANCER,
  'cdn': RESOURCE_TYPES.CDN,
  'client': null,
  'external-api': null,
  'storage': RESOURCE_TYPES.OBJECT_STORAGE,
  'function': RESOURCE_TYPES.FUNCTIONS,
  'ai-service': RESOURCE_TYPES.AI_INFERENCE,
})

export const CONNECTION_TYPE_RESOURCE_MAP = Object.freeze({
  'http': RESOURCE_TYPES.BANDWIDTH,
  'https': RESOURCE_TYPES.BANDWIDTH,
  'rest': RESOURCE_TYPES.BANDWIDTH,
  'graphql': RESOURCE_TYPES.BANDWIDTH,
  'websocket': RESOURCE_TYPES.BANDWIDTH,
  'grpc': RESOURCE_TYPES.BANDWIDTH,
  'kafka': RESOURCE_TYPES.BANDWIDTH,
  'rabbitmq': RESOURCE_TYPES.BANDWIDTH,
  'amqp': RESOURCE_TYPES.BANDWIDTH,
  'mqtt': RESOURCE_TYPES.BANDWIDTH,
  'tcp': RESOURCE_TYPES.BANDWIDTH,
  'udp': RESOURCE_TYPES.BANDWIDTH,
  'sftp': RESOURCE_TYPES.BANDWIDTH,
  'event-stream': RESOURCE_TYPES.BANDWIDTH,
})