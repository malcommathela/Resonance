/**
 * Simulation Cache — P5.5 DB Query Optimization
 * 
 * Reduces DB load for read-heavy operations:
 *   - Simulation status checks (SSE polling, status endpoint)
 *   - Report lookups
 *   - Validation result caching
 * 
 * Uses Redis (ioredis) for sub-millisecond reads.
 * Falls back to Prisma on cache miss.
 */

import { redisConnection } from '../../lib/redis.js'

const DEFAULT_TTL = 60 // seconds
const REPORT_TTL = 300 // 5 minutes
const STATUS_TTL = 30  // 30 seconds

function cacheKey(type, id) {
  return `simcache:${type}:${id}`
}

/**
 * Get simulation status from cache or DB.
 */
export async function getCachedSimulationStatus(simulationId, prisma) {
  const key = cacheKey('status', simulationId)
  const cached = await redisConnection.get(key)

  if (cached) {
    return JSON.parse(cached)
  }

  const sim = await prisma.simulation.findUnique({
    where: { id: simulationId },
    select: {
      id: true,
      status: true,
      progress: true,
      metrics: true,
      globalMetrics: true,
      currentRps: true,
      validationResult: true,
      confidenceScore: true,
      errorMessage: true,
      completedAt: true,
    }
  })

  if (sim) {
    await redisConnection.setex(key, STATUS_TTL, JSON.stringify(sim))
  }

  return sim
}

/**
 * Invalidate simulation status cache.
 */
export async function invalidateSimulationStatus(simulationId) {
  await redisConnection.del(cacheKey('status', simulationId))
}

/**
 * Get cached report.
 */
export async function getCachedReport(simulationId, prisma) {
  const key = cacheKey('report', simulationId)
  const cached = await redisConnection.get(key)

  if (cached) {
    return JSON.parse(cached)
  }

  const report = await prisma.simulationReport.findFirst({
    where: { simulationId },
  })

  if (report) {
    await redisConnection.setex(key, REPORT_TTL, JSON.stringify(report))
  }

  return report
}

/**
 * Cache a report after generation.
 */
export async function cacheReport(simulationId, reportData) {
  const key = cacheKey('report', simulationId)
  await redisConnection.setex(key, REPORT_TTL, JSON.stringify(reportData))
}

/**
 * Get cached validation result for a design.
 */
export async function getCachedValidation(designId, blocks, edges, validateFn) {
  const key = cacheKey('validation', designId)
  const cached = await redisConnection.get(key)

  if (cached) {
    return JSON.parse(cached)
  }

  const result = validateFn(blocks, edges)
  // Cache validation for 5 minutes (designs don't change often during editing)
  await redisConnection.setex(key, 300, JSON.stringify(result))
  return result
}

/**
 * Invalidate validation cache for a design.
 */
export async function invalidateValidationCache(designId) {
  await redisConnection.del(cacheKey('validation', designId))
}

/**
 * Batch invalidate multiple cache keys.
 */
export async function invalidateCachePattern(pattern) {
  const keys = await redisConnection.keys(`simcache:${pattern}:*`)
  if (keys.length > 0) {
    await redisConnection.del(...keys)
  }
}

/**
 * Cache simulation list for a design (pagination support).
 */
export async function getCachedSimulationList(designId, { limit = 10, offset = 0 }, prisma) {
  const key = cacheKey('list', `${designId}:${limit}:${offset}`)
  const cached = await redisConnection.get(key)

  if (cached) {
    return JSON.parse(cached)
  }

  const list = await prisma.simulation.findMany({
    where: { designId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset,
    select: {
      id: true,
      status: true,
      progress: true,
      trafficPattern: true,
      rps: true,
      duration: true,
      scenario: true,
      createdAt: true,
      completedAt: true,
      confidenceScore: true,
    }
  })

  await redisConnection.setex(key, 60, JSON.stringify(list))
  return list
}