/**
 * Simulation Worker Processor — P6 Property-Aware + Batch 5C
 * 
 * Runs the full simulation engine inside a BullMQ worker process.
 * Publishes real-time progress via Redis Pub/Sub for SSE bridging.
 * 
 * P6 Changes:
 *   - Wires all 30 behavioral model properties into simBlocks/simEdges
 *   - Cost simulation now returns real values (not 0)
 *   - Circuit breaker uses simulated-time sliding window
 *   - Deterministic: same seed → identical outputs
 * 
 * Batch 5C Changes:
 *   - Supports custom traffic curves via generateCustomArrivalEvents
 *   - Supports targeted failure injection (targetBlockId, targetEdgeId)
 */

import { Job } from 'bullmq'
import { prisma } from '../../lib/db.js'
import { redisConnection } from '../../lib/redis.js'
import { validateSimulationInput } from '../validation.js'
import { runP3Analysis, buildReportData } from '../pipeline/report-builder.js'
import { DeterministicRNG, createSimulationSeed } from '@resonance/shared/deterministic'
import {
  getBlockBehavioralModel,
  getConnectionBehavioralModel,
  mergeBlockBehavioralModel,
  mergeConnectionBehavioralModel,
} from '@resonance/shared/simulation-models'
import {
  generateTrafficCurve,
  generateArrivalEvents,
  applyGrowthScenario,
} from '@resonance/shared/traffic-models'
import {
  runSimulationPass,
  aggregateMonteCarloResults,
  generateCustomArrivalEvents,
} from '@resonance/shared/simulation-engine'
import { handleRuntimeEdgeCases, detectSimulationDeadlocks } from '../utils/edge-case-handler.js'
import { chunkBlocks, estimateMemoryUsage, streamProcessBlocks } from '../utils/streaming.js'
import { logAuditEvent } from '../utils/audit.js'

const GROWTH_SCENARIOS = {
  '2x': { multiplier: 2, rampCurve: 'linear', rampDuration: 60 },
  '5x': { multiplier: 5, rampCurve: 'exponential', rampDuration: 120 },
  '10x': { multiplier: 10, rampCurve: 'exponential', rampDuration: 180 },
}

const LARGE_ARCHITECTURE_THRESHOLD = 500
const DB_UPDATE_THROTTLE_MS = 2000
const REDIS_PUBLISH_THROTTLE_MS = 100

// ============================================================================
// MAIN PROCESSOR ENTRY POINT
// ============================================================================

export async function runSimulationProcessor(job) {
  const { simId, design, config, userId } = job.data
  const {
    seed,
    duration = 300,
    rps = 100,
    trafficPattern = 'steady',
    scenario = 'none',
    monteCarloPasses = 1,
    confidenceLevel = 0.95,
    growthScenario = null,
    generateReport = true,
    validation,
    startedAt,
    assumptions,
    clientInfo,
  } = config

  let stopped = false
  let lastDbUpdate = 0
  let lastRedisPublish = 0

  // === BATCH 4: PRE-FLIGHT VALIDATION ===
  const blocks = design.blocks || []
  const edges = design.edges || []
  const validationResult = validateSimulationInput(config, blocks, edges)
  if (!validationResult.canSimulate) {
    await prisma.simulation.update({
      where: { id: simId },
      data: {
        status: 'rejected',
        progress: 100,
        validationResult: validationResult,
      }
    })
    await publishProgress({
      status: 'rejected',
      validation: validationResult,
      progress: 100,
    })
    return { validation: validationResult, status: 'rejected' }
  }
  // === END BATCH 4 ===

  const stopCheckInterval = setInterval(async () => {
    try {
      const stopSignal = await redisConnection.get(`sim:${simId}:stop`)
      if (stopSignal === '1') {
        stopped = true
        clearInterval(stopCheckInterval)
      }
    } catch (e) {
      // Redis hiccup — ignore and retry next tick
    }
  }, 1000)

  const checkStopped = () => stopped

  async function publishProgress(data) {
    const now = Date.now()
    if (now - lastRedisPublish < REDIS_PUBLISH_THROTTLE_MS) return
    lastRedisPublish = now

    try {
      await redisConnection.publish(`sim:${simId}:progress`, JSON.stringify({
        ...data,
        _publishedAt: now,
      }))
    } catch (e) {
      // Non-critical: SSE clients will poll as fallback
    }
  }

  async function updateDbProgress(progress, extra = {}) {
    const now = Date.now()
    if (now - lastDbUpdate < DB_UPDATE_THROTTLE_MS && progress < 100) return
    lastDbUpdate = now

    await prisma.simulation.update({
      where: { id: simId },
      data: { progress, ...extra },
    })
  }

  async function updateJobProgress(data) {
    await job.updateProgress(data)
  }

  try {
    console.log(`[PROCESSOR] Starting simulation ${simId} | passes=${monteCarloPasses} | blocks=${design.blocks?.length || 0}`)

    await logAuditEvent({
      userId,
      designId: design.id,
      simulationId: simId,
      action: 'simulation_started',
      details: {
        trafficPattern,
        rps,
        duration,
        scenario,
        monteCarloPasses,
        growthScenario,
        blockCount: design.blocks?.length || 0,
        edgeCount: design.edges?.length || 0,
      },
      clientInfo,
    })

    await prisma.simulation.update({
      where: { id: simId },
      data: { status: 'running', progress: 0 }
    })

    const rng = new DeterministicRNG(seed)
    const results = []

    const isLargeArchitecture = blocks.length > LARGE_ARCHITECTURE_THRESHOLD
    const memoryEstimate = estimateMemoryUsage(blocks, edges, monteCarloPasses, duration)
    console.log(`[PROCESSOR] Memory estimate: ${memoryEstimate}MB | Large: ${isLargeArchitecture}`)

    if (memoryEstimate > 1024) {
      console.warn(`[PROCESSOR] High memory estimate (${memoryEstimate}MB). Enabling chunked processing.`)
    }

    const runtimeChecks = handleRuntimeEdgeCases(blocks, edges, validation)
    if (runtimeChecks.warnings.length > 0) {
      console.log(`[PROCESSOR] Runtime warnings:`, runtimeChecks.warnings.map(w => w.message))
    }
    if (runtimeChecks.shouldAbort) {
      throw new Error(`Runtime edge case abort: ${runtimeChecks.abortReason}`)
    }

    // ==========================================================================
    // P6: Build simulation-ready blocks with ALL behavioral model properties
    // ==========================================================================
    const simBlocks = blocks.map(block => {
      const rawConfig = block.config || {}
      const hasBehavioralModel = rawConfig.behavioralModel !== undefined
      const mergedBehavioral = hasBehavioralModel
        ? mergeBlockBehavioralModel(block.type, rawConfig.behavioralModel)
        : getBlockBehavioralModel(block.type)

      const uiOverrides = {}
      const replicas = rawConfig.replicas !== undefined ? rawConfig.replicas : 1
      if (replicas > 1 || !hasBehavioralModel) {
        uiOverrides.capacity = {
          maxThroughput: (mergedBehavioral.capacity?.maxThroughput || 1000) * replicas,
          maxConcurrent: (mergedBehavioral.capacity?.maxConcurrent || 100) * replicas,
        }
      }

      // P6: wire cpu from config into resourceConsumption
      if (rawConfig.cpu) {
        const cpuVal = parseCpu(rawConfig.cpu)
        if (cpuVal) {
          const baseCpu = mergedBehavioral.resourceConsumption?.cpuPerRequest || 1
          uiOverrides.resourceConsumption = {
            ...uiOverrides.resourceConsumption,
            cpuPerRequest: Math.max(0.1, baseCpu / Math.max(cpuVal, 0.01)),
          }
        }
      }

      // P6: wire memory from config into resourceConsumption
      if (rawConfig.memory) {
        const memVal = parseMemory(rawConfig.memory)
        if (memVal) {
          uiOverrides.resourceConsumption = {
            ...uiOverrides.resourceConsumption,
            memoryPerConnection: memVal,
          }
        }
      }

      // P6: wire rateLimit and timeout from config
      if (rawConfig.rateLimit !== undefined) uiOverrides.rateLimit = rawConfig.rateLimit
      if (rawConfig.timeout !== undefined) uiOverrides.timeout = rawConfig.timeout

      if (rawConfig.port !== undefined) uiOverrides.port = rawConfig.port
      if (rawConfig.engine !== undefined) uiOverrides.engine = rawConfig.engine

      // P6: wire cost model from config
      if (rawConfig.hourlyComputeCost !== undefined) {
        uiOverrides.cost = {
          ...uiOverrides.cost,
          hourlyComputeCost: rawConfig.hourlyComputeCost,
        }
      }
      if (rawConfig.perRequestCost !== undefined) {
        uiOverrides.cost = {
          ...uiOverrides.cost,
          perRequestCost: rawConfig.perRequestCost,
        }
      }
      if (rawConfig.perGbNetworkCost !== undefined) {
        uiOverrides.cost = {
          ...uiOverrides.cost,
          perGbNetworkCost: rawConfig.perGbNetworkCost,
        }
      }
      if (rawConfig.storageCostPerGbMonth !== undefined) {
        uiOverrides.cost = {
          ...uiOverrides.cost,
          storageCostPerGbMonth: rawConfig.storageCostPerGbMonth,
        }
      }

      // P6: wire reliability model
      if (rawConfig.mttrMinutes !== undefined) {
        uiOverrides.reliability = {
          ...uiOverrides.reliability,
          mttrMinutes: rawConfig.mttrMinutes,
        }
      }
      if (rawConfig.mtbfHours !== undefined) {
        uiOverrides.reliability = {
          ...uiOverrides.reliability,
          mtbfHours: rawConfig.mtbfHours,
        }
      }
      if (rawConfig.failureProbabilityPerHour !== undefined) {
        uiOverrides.reliability = {
          ...uiOverrides.reliability,
          failureProbabilityPerHour: rawConfig.failureProbabilityPerHour,
        }
      }
      if (rawConfig.recoveryProbabilityPerMinute !== undefined) {
        uiOverrides.reliability = {
          ...uiOverrides.reliability,
          recoveryProbabilityPerMinute: rawConfig.recoveryProbabilityPerMinute,
        }
      }

      // P6: wire error characteristics
      if (rawConfig.errorDistribution !== undefined) {
        uiOverrides.errorCharacteristics = {
          ...uiOverrides.errorCharacteristics,
          errorDistribution: rawConfig.errorDistribution,
        }
      }
      if (rawConfig.errorTypes !== undefined) {
        uiOverrides.errorCharacteristics = {
          ...uiOverrides.errorCharacteristics,
          errorTypes: rawConfig.errorTypes,
        }
      }

      // P6: wire SLA target
      if (rawConfig.slaTarget !== undefined) {
        uiOverrides.availability = {
          ...uiOverrides.availability,
          slaTarget: rawConfig.slaTarget,
        }
      }

      // P6: wire failure modes
      if (rawConfig.failureModes !== undefined) {
        uiOverrides.failureModes = rawConfig.failureModes
      }

      // P6: wire capacity limits
      if (rawConfig.maxConnections !== undefined) {
        uiOverrides.capacity = {
          ...uiOverrides.capacity,
          maxConnections: rawConfig.maxConnections,
        }
      }
      if (rawConfig.maxPartitions !== undefined) {
        uiOverrides.capacity = {
          ...uiOverrides.capacity,
          maxPartitions: rawConfig.maxPartitions,
        }
      }

      // P6: wire storage per request
      if (rawConfig.storagePerRequest !== undefined) {
        uiOverrides.resourceConsumption = {
          ...uiOverrides.resourceConsumption,
          storagePerRequest: rawConfig.storagePerRequest,
        }
      }

      return {
        id: block.id,
        type: block.type,
        label: block.label,
        x: block.x,
        y: block.y,
        config: rawConfig,
        behavioralModel: deepMerge(mergedBehavioral, uiOverrides),
      }
    })

    // ==========================================================================
    // P6: Build simulation-ready edges with ALL behavioral model properties
    // Reads primarily from edge.config; falls back to top-level denormalized
    // fields for backward compatibility until canvasStore persists to config.
    // ==========================================================================
    const simEdges = edges.map(edge => {
      const rawConfig = edge.config || {}
      const edgeType = edge.connectionType || 'http'
      const mergedBehavioral = mergeConnectionBehavioralModel(edgeType, rawConfig.behavioralModel || {})

      const uiOverrides = {}

      // P6: wire network properties from config (fallback to top-level denormalized fields)
      const bandwidthMbps = rawConfig.bandwidthMbps ?? edge.bandwidthMbps
      if (bandwidthMbps != null) {
        uiOverrides.network = { ...uiOverrides.network, bandwidthMbps }
      }

      const mtuBytes = rawConfig.mtuBytes ?? edge.mtuBytes
      if (mtuBytes != null) {
        uiOverrides.network = { ...uiOverrides.network, mtuBytes }
      }

      // P6: wire reliability properties from config (fallback to top-level denormalized fields)
      const timeoutMs = rawConfig.timeout ?? rawConfig.timeoutMs ?? edge.timeoutMs
      if (timeoutMs != null) {
        uiOverrides.reliability = { ...uiOverrides.reliability, timeoutMs }
      }

      const circuitBreakerHalfOpenRequests = rawConfig.circuitBreakerHalfOpenRequests ?? edge.circuitBreakerHalfOpenRequests
      if (circuitBreakerHalfOpenRequests != null) {
        uiOverrides.reliability = { ...uiOverrides.reliability, circuitBreakerHalfOpenRequests }
      }

      // P6: wire throughput properties from config (fallback to top-level denormalized fields)
      const maxRps = rawConfig.maxRps ?? edge.maxRps
      if (maxRps != null) {
        uiOverrides.throughput = { ...uiOverrides.throughput, maxRps }
      }

      const maxConcurrent = rawConfig.maxConcurrent ?? edge.maxConcurrent
      if (maxConcurrent != null) {
        uiOverrides.throughput = { ...uiOverrides.throughput, maxConcurrent }
      }

      const maxPayloadBytes = rawConfig.maxPayloadBytes ?? edge.maxPayloadBytes
      if (maxPayloadBytes != null) {
        uiOverrides.throughput = { ...uiOverrides.throughput, maxPayloadBytes }
      }

      return {
        id: edge.id,
        sourceId: edge.sourceId,
        targetId: edge.targetId,
        connectionType: edgeType,
        config: rawConfig,
        behavioralModel: deepMerge(mergedBehavioral, uiOverrides),
      }
    })

    // REMOVED: blockChunks was computed but never consumed. Re-enable chunked
    // processing only after wiring it through to runSimulationPass.
    // const blockChunks = isLargeArchitecture ? chunkBlocks(simBlocks, 100) : [simBlocks]

    
    // Run Monte Carlo passes
    for (let pass = 0; pass < monteCarloPasses; pass++) {
      if (checkStopped()) break
      rng.reset()

      // === BATCH 5C: CUSTOM CURVE OR STANDARD TRAFFIC ===
      let arrivalEvents
      if (config.trafficParams?.customCurve) {
        arrivalEvents = generateCustomArrivalEvents(config.trafficParams.customCurve, duration, rng)
      } else {
        const trafficCurve = generateTrafficCurve(trafficPattern, rps, duration, config.trafficParams || {}, rng)
        const finalCurve = growthScenario
          ? applyGrowthScenario(trafficCurve, GROWTH_SCENARIOS[growthScenario] || { multiplier: 1 })
          : trafficCurve
        arrivalEvents = generateArrivalEvents(finalCurve, rng)
      }
      // === END BATCH 5C ===

      const passStartTime = Date.now()
      const passIndex = pass

      // === BATCH 5C: PASS TARGET OPTIONS TO ENGINE ===
      const passResult = await runSimulationPass(
        simBlocks,
        simEdges,
        arrivalEvents,
        scenario,
        rng,
        duration,
        async (liveSnapshot) => {
          const passProgress = liveSnapshot.progress / 100
          const overallProgress = Math.min(
            ((passIndex + passProgress) / monteCarloPasses) * 100,
            100
          )

          const progressData = {
            ...liveSnapshot,
            progress: overallProgress,
            status: 'running',
            pass: passIndex + 1,
            totalPasses: monteCarloPasses,
            wallClockElapsedMs: Date.now() - passStartTime,
          }

          await Promise.all([
            publishProgress(progressData),
            updateJobProgress(progressData),
            updateDbProgress(overallProgress),
          ])
        },
        checkStopped,
        { targetBlockId: config.targetBlockId, targetEdgeId: config.targetEdgeId }
      )
      // === END BATCH 5C ===

      const deadlockCheck = detectSimulationDeadlocks(passResult, simBlocks)
      if (deadlockCheck.deadlocks.length > 0) {
        console.warn(`[PROCESSOR] Deadlocks detected in pass ${pass + 1}:`, deadlockCheck.deadlocks)
      }
      if (deadlockCheck.starvation.length > 0) {
        console.warn(`[PROCESSOR] Queue starvation detected:`, deadlockCheck.starvation)
      }

      results.push(passResult)

      const progress = Math.min(((pass + 1) / monteCarloPasses) * 100, 100)
      const partialAggregated = aggregateMonteCarloResults(results, confidenceLevel)

      const passCompleteData = {
        progress,
        status: pass === monteCarloPasses - 1 ? 'completed' : 'running',
        metrics: partialAggregated.blockMetrics?.blocks || {},
        global: partialAggregated.globalMetrics || {},
        currentRps: partialAggregated.avgRps || 0,
        confidenceScore: partialAggregated.confidenceIntervals ? 0.85 : validation.confidenceScore,
        pass: pass + 1,
        totalPasses: monteCarloPasses,
        wallClockElapsedMs: Date.now() - passStartTime,
      }

      await Promise.all([
        publishProgress(passCompleteData),
        updateJobProgress(passCompleteData),
        updateDbProgress(progress),
      ])
    }

    if (checkStopped()) {
      clearInterval(stopCheckInterval)
      await prisma.simulation.update({
        where: { id: simId },
        data: { status: 'stopped', progress: 100 }
      })
      await logAuditEvent({
        userId,
        designId: design.id,
        simulationId: simId,
        action: 'simulation_stopped',
        details: { reason: 'user_requested', passesCompleted: results.length },
        clientInfo,
      })
      return { status: 'stopped', simId }
    }

    // Aggregate results across passes
    const aggregated = aggregateMonteCarloResults(results, confidenceLevel)

    // SANITY CHECK: reject empty/broken simulations
    const sanity = {
      hasBlocks: Object.keys(aggregated.blockMetrics?.blocks || {}).length > 0,
      hasLatency: (aggregated.globalMetrics?.avgLatencyMs || 0) > 0,
      hasThroughput: (aggregated.globalMetrics?.throughputRps || 0) > 0,
      hasCost: (aggregated.globalMetrics?.totalSimulatedCost || 0) > 0,
      totalRequests: aggregated.globalMetrics?.totalRequests || 0,
    }
    if (!sanity.hasBlocks || (!sanity.hasLatency && sanity.totalRequests > 0)) {
      throw new Error(
        `[PROCESSOR] CRITICAL: Simulation engine returned empty metrics despite traffic. ` +
        `blocks=${Object.keys(aggregated.blockMetrics?.blocks || {}).length}, ` +
        `latency=${aggregated.globalMetrics?.avgLatencyMs}, ` +
        `throughput=${aggregated.globalMetrics?.throughputRps}, ` +
        `cost=${aggregated.globalMetrics?.totalSimulatedCost}, ` +
        `totalRequests=${sanity.totalRequests}`
      )
    }

    const actualDurationMs = Date.now() - new Date(startedAt).getTime()

    // P6: cost simulation now returns real values via engine
    console.log(`[PROCESSOR] Simulated cost: $${aggregated.globalMetrics?.totalSimulatedCost || 0} | Monthly: $${aggregated.globalMetrics?.projectedMonthlyCost || 0}`)

    // P3 Analysis Pipeline
    const p3Results = runP3Analysis(aggregated, design, validation, {
      simulationId: simId,
      userId,
      actualDurationMs,
      assumptions: assumptions || {},
      simConfig: {
        monteCarloPasses,
        duration,
        rps,
        trafficPattern,
        scenario,
        confidenceLevel,
      },
    })

    // Update simulation record with P3 + P6 results
    await prisma.simulation.update({
      where: { id: simId },
      data: {
        status: 'completed',
        progress: 100,
        metrics: aggregated.blockMetrics,
        globalMetrics: aggregated.globalMetrics,
        currentRps: aggregated.avgRps,
        actualDurationMs,
        reliabilityAnalysis: p3Results.reliabilityAnalysis,
        scalabilityAnalysis: p3Results.scalabilityAnalysis,
        costAnalysis: p3Results.costAnalysis,
        securityAnalysis: p3Results.securityAnalysis,
        confidenceScore: p3Results.confidenceScore,
        metricExplanations: p3Results.explainability,
        // P6: persist cost fields to DB
        totalSimulatedCost: aggregated.globalMetrics?.totalSimulatedCost || 0,
        projectedMonthlyCost: aggregated.globalMetrics?.projectedMonthlyCost || 0,
        projectedAnnualCost: aggregated.globalMetrics?.projectedAnnualCost || 0,
      }
    })

    // Final progress push
    const finalData = {
      progress: 100,
      status: 'completed',
      metrics: aggregated.blockMetrics?.blocks || {},
      global: aggregated.globalMetrics || {},
      currentRps: aggregated.avgRps || 0,
      confidenceScore: p3Results.confidenceScore,
    }
    await publishProgress(finalData)
    await updateJobProgress(finalData)

    // ==========================================================================
    // REPORT GENERATION — wrapped with defensive defaults so report bugs
    // never mark a successful simulation as failed.
    // ==========================================================================
    if (generateReport) {
      try {
        const simulationRecord = await prisma.simulation.findUnique({ where: { id: simId } })
        const reportData = await buildReportData(simulationRecord, p3Results, aggregated, design)

        // Defensive: Prisma schema has non-nullable Json/Int fields.
        // Normalize failureScenarios to an array so frontend .map() always works.
        const rawFailureScenarios = reportData?.failureScenarios
        const normalizedFailureScenarios = Array.isArray(rawFailureScenarios)
          ? rawFailureScenarios
          : (rawFailureScenarios?.results || [])

        const safeReportData = {
          version: reportData?.version ?? '1.0.0',
          overallScore: typeof reportData?.overallScore === 'number' ? Math.round(reportData.overallScore) : 0,
          architectureScore: typeof reportData?.architectureScore === 'number' ? Math.round(reportData.architectureScore) : null,
          reliabilityScore: typeof reportData?.reliabilityScore === 'number' ? Math.round(reportData.reliabilityScore) : null,
          performanceScore: typeof reportData?.performanceScore === 'number' ? Math.round(reportData.performanceScore) : null,
          costScore: typeof reportData?.costScore === 'number' ? Math.round(reportData.costScore) : null,
          securityScore: typeof reportData?.securityScore === 'number' ? Math.round(reportData.securityScore) : null,
          confidenceScore: typeof reportData?.confidenceScore === 'number' ? Math.round(reportData.confidenceScore) : null,
          executiveSummary: reportData?.executiveSummary ?? {},
          topologyAnalysis: reportData?.topologyAnalysis ?? {},
          performanceAnalysis: reportData?.performanceAnalysis ?? {},
          reliabilityAnalysis: reportData?.reliabilityAnalysis ?? {},
          scalabilityAnalysis: reportData?.scalabilityAnalysis ?? {},
          costAnalysis: reportData?.costAnalysis ?? null,
          securityAnalysis: reportData?.securityAnalysis ?? null,
          failureScenarios: normalizedFailureScenarios,
          aiInsights: reportData?.aiInsights ?? null,
          actionPlan: reportData?.actionPlan ?? { critical: [], high: [], medium: [], low: [], summary: '' },
          metadata: reportData?.metadata ?? {},
        }

        await prisma.simulationReport.create({
          data: {
            simulationId: simId,
            designId: design.id,
            userId,
            ...safeReportData,
          }
        })

        console.log(`[PROCESSOR] Report created for simulation ${simId}`)
      } catch (reportErr) {
        // Log loudly but do NOT fail the simulation — the engine results are still valid.
        console.error(`[PROCESSOR] Report generation failed for ${simId}:`, reportErr.message)
        console.error(reportErr.stack)

        await logAuditEvent({
          userId,
          designId: design.id,
          simulationId: simId,
          action: 'simulation_report_failed',
          details: {
            error: reportErr.message,
            stack: reportErr.stack,
          },
          clientInfo,
        })
      }
    }

    await logAuditEvent({
      userId,
      designId: design.id,
      simulationId: simId,
      action: 'simulation_completed',
      details: {
        actualDurationMs,
        monteCarloPasses: results.length,
        confidenceScore: p3Results.confidenceScore,
        reportGenerated: generateReport,
        totalSimulatedCost: aggregated.globalMetrics?.totalSimulatedCost || 0,
        projectedMonthlyCost: aggregated.globalMetrics?.projectedMonthlyCost || 0,
      },
      clientInfo,
    })

    clearInterval(stopCheckInterval)
    return { status: 'completed', simId, actualDurationMs }

  } catch (err) {
    clearInterval(stopCheckInterval)
    console.error(`[PROCESSOR] Simulation ${simId} failed:`, err)

    await prisma.simulation.update({
      where: { id: simId },
      data: {
        status: 'failed',
        progress: 100,
        errorMessage: err.message,
        errorStack: err.stack,
      }
    })

    await publishProgress({
      status: 'failed',
      errorMessage: err.message,
      progress: 100,
    })

    await logAuditEvent({
      userId,
      designId: design.id,
      simulationId: simId,
      action: 'simulation_failed',
      details: {
        error: err.message,
        stack: err.stack,
      },
      clientInfo,
    })

    throw err
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function parseCpu(cpuStr) {
  if (!cpuStr) return null
  const match = cpuStr.match(/^(\d+(?:\.\d+)?)(m?)$/)
  if (!match) return null
  const val = parseFloat(match[1])
  return match[2] === 'm' ? val / 1000 : val
}

function parseMemory(memStr) {
  if (!memStr) return null
  const match = memStr.match(/^(\d+(?:\.\d+)?)([KMGT]?i?B?)$/i)
  if (!match) return null
  const val = parseFloat(match[1])
  const unit = match[2].toUpperCase()
  const multipliers = { '': 1, K: 1024, M: 1024 ** 2, G: 1024 ** 3, T: 1024 ** 4 }
  return val * (multipliers[unit.replace(/I?B?/i, '')] || 1)
}

function deepMerge(target, source) {
  const result = JSON.parse(JSON.stringify(target || {}))
  for (const key in source) {
    if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(result[key] || {}, source[key])
    } else {
      result[key] = source[key]
    }
  }
  return result
}