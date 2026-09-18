// ============================================================================
// CHAT CONTEXT — Chat spec §19-20, §40-41, §68, §70
// Builds the design-aware context for a request, keyed by context revision so
// cached context can never go stale: "Invalidate for performance. Version for
// correctness." Every context carries a fingerprint identifying exactly which
// design/simulation/report state it describes.
// ============================================================================

import { prisma } from '../../lib/db.js'
import { logger } from '../../lib/logger.js'
import { contextFingerprint, hashParts } from '../../utils/hashing.js'
import { withRetry, withTimeout } from '../../utils/retry.js'
import { ERROR_CODES } from '../../utils/errors.js'
import { getDesignContextCache, setDesignContextCache, acquireLock, releaseLock, chatKeys } from './cacheService.js'
import { SYSTEM_PERSONA, buildDesignContextPrefix, PROMPT_VERSIONS } from '../prompts.js'

// Context build budget. The build runs BEFORE the AI call; a slow-but-correct
// context beats a fast blind answer. Cold builds (cache miss) query Postgres
// over the pooler, so allow several seconds — tunable for load testing.
const CONTEXT_BUILD_TIMEOUT_MS = parseInt(process.env.CHAT_CONTEXT_TIMEOUT_MS || '6000', 10)
const HISTORY_WINDOW = 20             // recent turns sent to the model (spec §68)
const MAX_COMPONENTS = 60             // context size protection (spec §104)
const MAX_CONNECTIONS = 100

// Bounded config keys from Block.config worth sending to the model.
// Everything else (credentials, raw metadata) stays out.
const CONFIG_KEYS = [
  'engine', 'replicas', 'rateLimit', 'timeout', 'timeoutMs', 'cpu', 'memory',
  'port', 'maxConnections', 'maxPartitions', 'slaTarget', 'mttrMinutes',
  'mtbfHours', 'failureProbabilityPerHour', 'recoveryProbabilityPerMinute',
  'hourlyComputeCost', 'perRequestCost', 'perGbNetworkCost', 'storageCostPerGbMonth',
]

function pickConfig(config) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) return undefined
  const out = {}
  for (const k of CONFIG_KEYS) {
    if (config[k] !== undefined && config[k] !== null) out[k] = config[k]
  }
  return Object.keys(out).length ? out : undefined
}

// Token/latency guard: cap arrays, strings, depth. Preserves first items
// (report pipeline orders by priority) instead of summarizing.
function compact(value, depth = 0) {
  if (value == null) return value
  if (typeof value === 'string') return value.length > 600 ? value.slice(0, 600) + '…' : value
  if (Array.isArray(value)) return value.slice(0, 12).map((v) => compact(v, depth + 1))
  if (typeof value === 'object') {
    if (depth >= 4) return Array.isArray(value) ? '[…]' : '{…}'
    const out = {}
    for (const [k, v] of Object.entries(value)) out[k] = compact(v, depth + 1)
    return out
  }
  return value
}

const iso = (d) => (d instanceof Date ? d.toISOString() : (d ?? null))

/**
 * Build the DesignContext for a design at its CURRENT revision.
 * Cache lookup: revision-scoped Redis key -> DB -> populate cache.
 * Redis failures are fail-open (spec §47).
 */
export async function buildDesignContext(designId) {
  const design = await prisma.design.findUnique({
    where: { id: designId },
    select: { id: true, name: true, description: true, version: true, updatedAt: true },
  })
  if (!design) {
    const err = new Error('Design not found')
    err.status = 404
    throw err
  }

  // Lightweight identity: must change when canvas, latest simulation state,
  // latest report, or latest applied optimization changes. Uses updatedAt/
  // status — not just IDs — so pending->completed transitions invalidate.
  const [simIdRes, repIdRes, optIdRes] = await Promise.allSettled([
    prisma.simulation.findFirst({
      where: { designId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, status: true, updatedAt: true },
    }),
    prisma.simulationReport.findFirst({
      where: { designId },
      orderBy: { generatedAt: 'desc' },
      select: { id: true, simulationId: true, generatedAt: true },
    }),
    prisma.optimizationHistory.findFirst({
      where: { designId, status: 'applied' },
      orderBy: { appliedAt: 'desc' },
      select: { id: true, appliedAt: true },
    }),
  ])
  const simId = simIdRes.status === 'fulfilled' ? simIdRes.value : null
  const repId = repIdRes.status === 'fulfilled' ? repIdRes.value : null
  const optId = optIdRes.status === 'fulfilled' ? optIdRes.value : null

  const contextRevision = hashParts(
    'chat-context-v2',
    design.version,
    simId?.id, simId?.status, simId?.updatedAt?.toISOString(),
    repId?.id, repId?.generatedAt?.toISOString(),
    optId?.id, optId?.appliedAt?.toISOString()
  )

  const cached = await getDesignContextCache(designId, contextRevision)
  if (cached) return { ...cached, cacheHit: true }

  // Build — with single-flight protection against stampedes (spec §44).
  const lock = await acquireLock(chatKeys.contextLock(designId, contextRevision), 10)
  try {
    if (lock) {
      const fresh = await getDesignContextCache(designId, contextRevision)
      if (fresh) return { ...fresh, cacheHit: true }
    }

    const buildStartedAt = Date.now()
    // Per-part resilience: a slow/failing sub-query must not blind the whole
    // context — components and connections are the core, the rest enrich.
    const [blocksRes, edgesRes, simulationRes, reportRes, optimizationsRes] = await Promise.allSettled([
      prisma.block.findMany({
        where: { designId },
        select: { id: true, type: true, label: true, replicas: true, rateLimit: true, timeoutMs: true, config: true },
        take: 120,
      }),
      prisma.edge.findMany({
        where: { designId },
        select: { id: true, sourceId: true, targetId: true, connectionType: true, label: true },
        take: 200,
      }),
      simId?.id
        ? prisma.simulation.findUnique({
            where: { id: simId.id },
            select: {
              id: true, status: true, createdAt: true, updatedAt: true,
              confidenceScore: true, projectedMonthlyCost: true, currentRps: true,
              globalMetrics: true, validationResult: true,
            },
          })
        : Promise.resolve(null),
      repId?.id
        ? prisma.simulationReport.findUnique({
            where: { id: repId.id },
            select: {
              id: true, simulationId: true, designId: true, version: true, generatedAt: true,
              overallScore: true, architectureScore: true, reliabilityScore: true,
              performanceScore: true, costScore: true, securityScore: true,
              scalabilityScore: true, confidenceScore: true,
              executiveSummary: true, topologyAnalysis: true, performanceAnalysis: true,
              reliabilityAnalysis: true, scalabilityAnalysis: true, costAnalysis: true,
              securityAnalysis: true, failureScenarios: true, aiInsights: true, actionPlan: true,
            },
          })
        : Promise.resolve(null),
      prisma.optimizationHistory.findMany({
        where: { designId, status: 'applied' },
        orderBy: { appliedAt: 'desc' },
        take: 5,
        select: { id: true, ruleName: true, appliedAt: true, status: true },
      }),
    ])

    const value = (res) => (res.status === 'fulfilled' ? res.value : null)
    for (const res of [blocksRes, edgesRes, simulationRes, reportRes, optimizationsRes]) {
      if (res.status === 'rejected') {
        logger.warn({ err: res.reason?.message, designId }, 'Design context sub-query failed')
      }
    }

    const blocks = value(blocksRes) || []
    const edges = value(edgesRes) || []
    const latestSimulation = value(simulationRes)
    const latestReport = value(reportRes)
    const recentOptimizations = value(optimizationsRes) || []

    const contextHealth = {
      design: 'available',
      components: blocksRes.status === 'fulfilled' ? 'available' : 'unavailable',
      connections: edgesRes.status === 'fulfilled' ? 'available' : 'unavailable',
      simulation: simulationRes.status === 'fulfilled' ? (latestSimulation ? 'available' : 'not_generated') : 'unavailable',
      report: reportRes.status === 'fulfilled' ? (latestReport ? 'available' : 'not_generated') : 'unavailable',
      optimizations: optimizationsRes.status === 'fulfilled' ? 'available' : 'unavailable',
    }

    const designContext = {
      id: design.id,
      version: design.version,
      name: design.name,
      description: design.description || null,
      nodeCount: blocks.length,
      edgeCount: edges.length,
      components: blocks.slice(0, MAX_COMPONENTS).map((b) => ({
        id: b.id,
        type: b.type,
        label: b.label,
        ...(b.replicas != null ? { replicas: b.replicas } : {}),
        ...(b.rateLimit != null ? { rateLimitPerMinute: b.rateLimit } : {}),
        ...(b.timeoutMs != null ? { timeoutMs: b.timeoutMs } : {}),
        ...(pickConfig(b.config) ? { config: pickConfig(b.config) } : {}),
      })),
      connections: edges.slice(0, MAX_CONNECTIONS).map((e) => ({
        source: e.sourceId,
        target: e.targetId,
        type: e.connectionType,
        ...(e.label ? { label: e.label } : {}),
      })),
      latestSimulation: latestSimulation
        ? {
            simulationId: latestSimulation.id,
            status: latestSimulation.status,
            createdAt: iso(latestSimulation.createdAt),
            updatedAt: iso(latestSimulation.updatedAt),
            confidenceScore: latestSimulation.confidenceScore,
            projectedMonthlyCost: latestSimulation.projectedMonthlyCost,
            currentRps: latestSimulation.currentRps ?? null,
            globalMetrics: compact(latestSimulation.globalMetrics),
            validationResult: compact(latestSimulation.validationResult),
          }
        : null,
      latestReport: latestReport
        ? {
            reportId: latestReport.id,
            simulationId: latestReport.simulationId,
            version: latestReport.version,
            generatedAt: iso(latestReport.generatedAt),
            scores: {
              overall: latestReport.overallScore,
              architecture: latestReport.architectureScore,
              reliability: latestReport.reliabilityScore,
              performance: latestReport.performanceScore,
              cost: latestReport.costScore,
              security: latestReport.securityScore,
              scalability: latestReport.scalabilityScore,
              confidence: latestReport.confidenceScore,
            },
            executiveSummary: compact(latestReport.executiveSummary),
            topologyAnalysis: compact(latestReport.topologyAnalysis),
            performanceAnalysis: compact(latestReport.performanceAnalysis),
            reliabilityAnalysis: compact(latestReport.reliabilityAnalysis),
            scalabilityAnalysis: compact(latestReport.scalabilityAnalysis),
            costAnalysis: compact(latestReport.costAnalysis),
            securityAnalysis: compact(latestReport.securityAnalysis),
            failureScenarios: compact(latestReport.failureScenarios),
            actionPlan: compact(latestReport.actionPlan),
            aiInsights: compact(latestReport.aiInsights),
          }
        : null,
      recentOptimizations: recentOptimizations.map((o) => ({
        ruleName: o.ruleName,
        appliedAt: iso(o.appliedAt),
      })),
      contextHealth,
      contextRevision,
      fingerprint: contextFingerprint({
        designVersion: design.version,
        simulationVersion: latestSimulation?.id,
        simulationUpdatedAt: latestSimulation?.updatedAt?.toISOString?.() ?? latestSimulation?.updatedAt,
        reportVersion: latestReport?.id,
        optimizationVersion: recentOptimizations[0]?.id,
        nodeCount: blocks.length,
        edgeCount: edges.length,
      }),
      buildMs: Date.now() - buildStartedAt,
      cacheHit: false,
    }

    // Cache write is fire-and-forget — never inside the latency budget.
    setDesignContextCache(designId, contextRevision, designContext).catch(() => {})

    logger.info({
      designId,
      designVersion: design.version,
      contextRevision: contextRevision.slice(0, 12),
      componentCount: blocks.length,
      connectionCount: edges.length,
      simulationId: latestSimulation?.id ?? null,
      simulationStatus: latestSimulation?.status ?? null,
      reportId: latestReport?.id ?? null,
      reportSimulationId: latestReport?.simulationId ?? null,
      reportAvailable: !!latestReport,
      contextCacheHit: false,
      contextBuildMs: designContext.buildMs,
      contextHealth,
    }, 'Chat design context resolved')
    if (latestReport && latestSimulation && latestReport.simulationId !== latestSimulation.id) {
      logger.warn({ designId, reportSim: latestReport.simulationId, latestSim: latestSimulation.id }, 'Report belongs to an earlier simulation run')
    }
    return designContext
  } finally {
    await releaseLock(lock)
  }
}

/**
 * Build the full ChatContext for an AI request (spec §19):
 * system prompt + design context + recent history + current user message.
 */
export async function buildChatContext({ session, history, userMessage, designSystemEnabled = false }) {
  const _startedAt = Date.now()
  const base = {
    systemInstruction: SYSTEM_PERSONA,
    history,
    userMessage,
    versions: {
      designVersion: null,
      simulationVersion: null,
      simulationUpdatedAt: null,
      reportVersion: null,
      optimizationVersion: null,
      contextFingerprint: null,
    },
    contextCacheHit: false,
  }

  if (!session.designId) return base

  // One retry: a transient pool stall or a Redis deadline spike should not
  // blind the AI when a second attempt succeeds in milliseconds.
  try {
    const designContext = await withRetry(
      () =>
        withTimeout(
          buildDesignContext(session.designId),
          CONTEXT_BUILD_TIMEOUT_MS,
          ERROR_CODES.NETWORK_ERROR,
          'Building design context timed out.'
        ),
      { retries: 1, base: 200, isRetryable: () => true }
    )

    const prefix = buildDesignContextPrefix(designContext)
    const systemInstruction = designSystemEnabled
      ? `${prefix}\n\nDesign System is enabled: when generating or recommending components, prefer components from the Resonance block library (the types listed in DESIGN_DATA).`
      : prefix

    return {
      ...base,
      systemInstruction,
      designContext,
      contextCacheHit: designContext.cacheHit,
      contextHealth: designContext.contextHealth,
      versions: {
        designId: designContext.id,
        designVersion: designContext.version,
        simulationVersion: designContext.latestSimulation?.simulationId ?? null,
        simulationUpdatedAt: designContext.latestSimulation?.updatedAt ?? null,
        reportVersion: designContext.latestReport?.reportId ?? null,
        optimizationVersion: designContext.recentOptimizations?.[0]?.appliedAt ?? null,
        contextFingerprint: designContext.fingerprint,
      },
    }
  } catch (err) {
    // A broken design context must not take down the chat (spec §7/§116) —
    // degrade, but keep the reply SHORT and honest instead of a generic essay.
    logger.warn(
      { err: err.message, designId: session.designId, afterMs: Date.now() - _startedAt },
      'Design context build failed — degrading'
    )
    return {
      ...base,
      systemInstruction: `${SYSTEM_PERSONA}

Note: the linked design (ID: ${session.designId}) could not be loaded right now, so you cannot see its components or simulation data.
- Open with ONE short sentence stating you can't see the current design state.
- If the question can be answered with general architecture knowledge, answer it briefly and concretely.
- If the question is specific to this design (scores, components, bottlenecks), say what you would need and suggest retrying in a moment.
- Do NOT produce long generic checklists or invent details about this design.`,
    }
  }
}

/**
 * Load a bounded, ordered history window (spec §67-68).
 * Only completed user/assistant turns; oldest first for the model.
 */
export async function loadRecentHistory(sessionId, limit = HISTORY_WINDOW) {
  const messages = await prisma.chatMessage.findMany({
    where: { sessionId, role: { in: ['user', 'assistant'] }, status: 'completed', type: 'text' },
    orderBy: { sequence: 'desc' },
    take: limit,
    select: { role: true, content: true },
  })
  return messages.reverse().map((m) => ({ role: m.role, content: m.content }))
}

/**
 * Response-cache hash (spec §42). Model, prompt versions and every context
 * version are hash inputs — a change in any of them logically invalidates
 * cached responses.
 */
export function responseCacheHash({ model, userMessage, session, versions, designSystemEnabled }) {
  return hashParts(
    'resp-v1',
    model,
    PROMPT_VERSIONS.systemPersona,
    PROMPT_VERSIONS.designAnalysis,
    userMessage,
    session.designId ?? '',
    versions.designVersion ?? '',
    versions.simulationVersion ?? '',
    versions.simulationUpdatedAt ?? '',
    versions.reportVersion ?? '',
    versions.contextFingerprint ?? '',
    designSystemEnabled ? 'ds:1' : 'ds:0'
  )
}

export { chatKeys }
