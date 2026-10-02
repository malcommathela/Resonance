import { useCallback, useEffect, useRef, useState } from 'react'
import { useCanvasStore } from '@/stores/canvasStore'
import { useDesignStore } from '@/stores/designStore'
import { api } from '@/services/api'
import { fetchSimulationReport } from '@/services/simulation'
import { preValidateArchitecture } from '@/lib/validation'
import { createSimulationInput } from '@/features/canvas/simulation/simulationInputAdapter'

// Simulation bridge (Phase 9/10). The canvas ends at createSimulationInput:
// preflight runs on the adapter output (groups/runtime excluded), then the
// existing engine pipeline (API + SSE + poll + report) runs untouched.
// Moved from CanvasEditor; behavior identical.
export function useCanvasSimulationBridge({ designId, onValidationBlocked, onRequireSaveAs, pushLog } = {}) {
  const simulationRunning = useCanvasStore((s) => s.simulationRunning)

  const eventSourceRef = useRef(null)
  const simulationIntervalRef = useRef(null)
  // Prevent double-processing the same simulation (SSE + poll can both fire).
  const simulationHandledRef = useRef(new Set())

  const [simulationId, setSimulationId] = useState(null)
  const [showReportModal, setShowReportModal] = useState(false)
  const [currentReport, setCurrentReport] = useState(null)
  const [reportLoading, setReportLoading] = useState(false)

  const handleSimulationComplete = useCallback(async (simId, status, globalMetrics) => {
    // GUARD: SSE + poll can both fire for the same sim
    if (simulationHandledRef.current.has(simId)) return
    simulationHandledRef.current.add(simId)

    // OPEN MODAL IMMEDIATELY — skeleton will show while we poll
    setShowReportModal(true)
    setReportLoading(true)
    setCurrentReport(null)

    let report = null
    let attempts = 0
    const maxAttempts = 12 // ~2 min total with backoff

    while (!report && attempts < maxAttempts) {
      try {
        // Try report first
        report = await fetchSimulationReport(simId)
        if (report?.error) report = null
      } catch (err) {
        // 404 while worker is still writing — check status
        try {
          const statusRes = await api.getSimulationStatus(simId)
          if (statusRes.status === 'failed') {
            throw new Error('Simulation failed')
          }
          // If still running, keep waiting
        } catch (statusErr) {
          // ignore
        }
      }

      if (!report && attempts < maxAttempts - 1) {
        const delay = 2000 * Math.pow(1.5, attempts) // 2s, 3s, 4.5s, 6.7s...
        await new Promise(r => setTimeout(r, delay))
      }
      attempts++
    }

    if (report) {
      setCurrentReport(report)
      useDesignStore.getState().loadReport(simId)
      // Mark complete WITHOUT re-triggering auto-open (we already opened it)
      useCanvasStore.getState().setSimulationComplete(simId, false)
      pushLog?.({ type: 'success', message: 'Simulation report loaded' })
    } else {
      // Fallback to minimal report
      const st = useCanvasStore.getState()
      const minimalReport = buildMinimalReport(simId, status, globalMetrics, st.nodes, st.edges, designId)
      setCurrentReport(minimalReport)
      useCanvasStore.getState().setSimulationComplete(simId, false)
      pushLog?.({ type: 'warning', message: 'Report unavailable — showing preliminary results' })
    }

    setReportLoading(false)
  }, [designId, pushLog])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) eventSourceRef.current.abort()
      if (simulationIntervalRef.current) clearInterval(simulationIntervalRef.current)
    }
  }, [])

  const handleRunSimulation = useCallback(async (config = {}) => {
    const st = useCanvasStore.getState()
    const setSimulationBlockMetrics = st.setSimulationBlockMetrics
    const setSimulationEdgeMetrics = st.setSimulationEdgeMetrics
    const setSimulationAlerts = st.setSimulationAlerts
    const setSimulationMetrics = st.setSimulationMetrics
    const startSimulation = st.startSimulation
    const stopSimulation = st.stopSimulation

    // Pre-flight on the simulation input (groups/runtime already excluded).
    const input = createSimulationInput({ nodes: st.nodes, edges: st.edges })
    const preflight = preValidateArchitecture(input.nodes, input.edges, null)
    if (!preflight.canSimulate) {
      onValidationBlocked?.(preflight)
      pushLog?.({ type: 'error', message: 'Simulation blocked: fix critical errors first' })
      return
    }

    // If we have cached server validation, check it too
    const cached = useCanvasStore.getState().validationResult
    if (cached && !cached.canSimulate) {
      onValidationBlocked?.()
      pushLog?.({ type: 'error', message: 'Simulation blocked: fix critical errors first' })
      return
    }

    // Always clean up old intervals first
    if (simulationIntervalRef.current) {
      clearInterval(simulationIntervalRef.current)
      simulationIntervalRef.current = null
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.abort()
      eventSourceRef.current = null
    }

    if (useCanvasStore.getState().simulationRunning) {
      if (simulationId) {
        try { await api.stopSimulation(simulationId) } catch (e) { /* ignore */ }
      }
      stopSimulation()
      useCanvasStore.getState().setSimulationProgress(0)
      setSimulationId(null)
      return
    }

    if (!designId || designId === 'new') {
      pushLog?.({ type: 'warning', message: 'Save design before running simulation' })
      onRequireSaveAs?.()
      return
    }

    startSimulation()
    useCanvasStore.getState().setSimulationConfig(config)
    pushLog?.({ type: 'info', message: 'Starting simulation...' })
    useCanvasStore.getState().setSimulationProgress(0)

    try {
      const result = await api.runSimulation(designId, {
        trafficPattern: config.trafficPattern || 'steady',
        rps: config.rps || 100,
        duration: config.duration || 300,
        scenario: config.scenario || 'none',
        monteCarloPasses: config.monteCarloPasses || 1,
        confidenceLevel: config.confidenceLevel || 0.95,
        growthScenario: config.growthScenario || null,
        trafficParams: config.trafficParams || {},
        deterministicSeed: config.deterministicSeed,
        targetBlockId: config.targetBlockId,
        targetEdgeId: config.targetEdgeId,
      })

      const simId = result.simulationId
      setSimulationId(simId)
      pushLog?.({ type: 'success', message: `Simulation ${simId} started` })

      // SSE stream — switched to fetch-event-source for Clerk Bearer token auth
      const { fetchEventSource } = await import('@microsoft/fetch-event-source')
      const token = await api.getAuthToken()
      const ctrl = new AbortController()
      eventSourceRef.current = ctrl

      fetchEventSource(
        `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/simulations/${simId}/stream`,
        {
          method: 'GET',
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            Accept: 'text/event-stream',
          },
          credentials: 'include',
          signal: ctrl.signal,
          openWhenHidden: true,
          onmessage: (event) => {
            const data = JSON.parse(event.data)

            // Ignore heartbeats
            if (data.heartbeat) return

            if (data.error) {
              console.error('SSE error:', data.error)
              return
            }

            useCanvasStore.getState().setSimulationProgress(data.progress || 0)

            // Live block metrics (runtime map only — never written into node data).
            const blockMetricsMap = {}
            if (data.metrics && Object.keys(data.metrics).length > 0) {
              Object.entries(data.metrics).forEach(([blockId, metrics]) => {
                blockMetricsMap[blockId] = {
                  rps: metrics.throughputRps || 0,
                  latency: Math.round(metrics.avgLatencyMs || 0),
                  errors: metrics.failedRequests || 0,
                  p95Latency: Math.round(metrics.p95LatencyMs || 0),
                  p99Latency: Math.round(metrics.p99LatencyMs || 0),
                  utilization: metrics.utilization || 0,
                  queueDepth: metrics.queueDepth || 0,
                  currentReplicas: metrics.currentReplicas || 1,
                  cpuPercent: metrics.resources?.cpuPercent || 0,
                  memoryPercent: metrics.resources?.memoryPercent || 0,
                  threadPoolUtilization: metrics.resources?.threadPoolUtilization || 0,
                  circuitOpen: metrics.circuitOpen || false,
                  retryCount: metrics.retryCount || 0,
                }
              })
              setSimulationBlockMetrics(blockMetricsMap)
            }

            // Live edge metrics (runtime map only — same rule as blocks).
            const edgeMetricsMap = {}
            if (data.edges && Object.keys(data.edges).length > 0) {
              Object.entries(data.edges).forEach(([edgeId, edgeMetrics]) => {
                edgeMetricsMap[edgeId] = {
                  circuitOpen: edgeMetrics.circuitOpen || false,
                  errorRate: edgeMetrics.errorRate || 0,
                  retryCount: edgeMetrics.retryCount || 0,
                  latencyMs: edgeMetrics.latencyMs || 0,
                }
              })
              setSimulationEdgeMetrics(edgeMetricsMap)
            }

            // Live global metrics (expanded).
            let globalMetricsSnapshot = null
            if (data.global && Object.keys(data.global).length > 0) {
              globalMetricsSnapshot = toUiGlobalMetrics(data.global, config.duration || 300)
              setSimulationMetrics(globalMetricsSnapshot)
            }

            // Alerts (server or derived).
            const alerts = []
            if (data.alerts && Array.isArray(data.alerts)) {
              alerts.push(...data.alerts)
            } else {
              // Derive from edge metrics
              Object.entries(edgeMetricsMap).forEach(([edgeId, em]) => {
                if (em.circuitOpen) {
                  alerts.push({ type: 'circuit_open', edgeId, message: `Circuit breaker open on ${edgeId}` })
                }
                if (em.retryCount > 10) {
                  alerts.push({ type: 'retry_storm', edgeId, message: `Retry storm detected on ${edgeId}` })
                }
              })
              // Derive from block metrics
              Object.entries(blockMetricsMap).forEach(([blockId, bm]) => {
                if (bm.utilization > 0.95) {
                  alerts.push({ type: 'saturation', blockId, message: `Block ${blockId} is saturated` })
                }
              })
            }
            if (alerts.length > 0) {
              setSimulationAlerts(alerts)
            }

            // Traffic spike warnings.
            if (data.currentRps && data.currentRps > (config.rps || 100) * 10) {
              pushLog?.({
                type: 'warning',
                message: `Traffic spike: ${Math.round(data.currentRps)} RPS`,
              })
            }

            // Completion detection.
            if (data.status === 'completed' || data.status === 'stopped' || data.status === 'failed') {
              ctrl.abort()
              eventSourceRef.current = null
              stopSimulation()
              useCanvasStore.getState().setSimulationProgress(100)
              setSimulationId(null)

              pushLog?.({
                type: data.status === 'failed' ? 'error' : 'success',
                message: data.status === 'failed'
                  ? `Simulation failed: ${data.errorMessage || 'Unknown error'}`
                  : `Simulation completed`,
              })

              if (data.status === 'failed') {
                useCanvasStore.getState().setSimulationFailed(data.errorMessage || 'Unknown error')
              }
              if (data.status === 'completed' || data.status === 'stopped') {
                handleSimulationComplete(simId, data.status, globalMetricsSnapshot || data.global)
              }
            }
          },
          onerror: (err) => {
            // Stop retrying on auth errors
            if (err?.status === 401) {
              console.error('[SSE] 401 Unauthorized — stopping stream')
              ctrl.abort()
              eventSourceRef.current = null
              return
            }
            // Let fetch-event-source retry with backoff for transient errors
            throw err
          },
        }
      )

      // Poll for completion (fallback if SSE drops)
      simulationIntervalRef.current = setInterval(async () => {
        try {
          const status = await api.getSimulationStatus(simId)
          if (status.status === 'completed' || status.status === 'stopped' || status.status === 'failed') {
            clearInterval(simulationIntervalRef.current)
            simulationIntervalRef.current = null
            if (eventSourceRef.current) { eventSourceRef.current.abort(); eventSourceRef.current = null }
            stopSimulation()
            useCanvasStore.getState().setSimulationProgress(100)
            setSimulationId(null)

            // Map DB fields (P2 names) to UI fields
            let globalMetricsSnapshot = null
            if (status.globalMetrics) {
              globalMetricsSnapshot = toUiGlobalMetrics(status.globalMetrics, status.globalMetrics.duration || (config.duration || 300))
              setSimulationMetrics(globalMetricsSnapshot)
            }

            pushLog?.({
              type: status.status === 'failed' ? 'error' : 'success',
              message: status.status === 'failed'
                ? `Simulation failed: ${status.errorMessage || 'Unknown error'}`
                : `Simulation completed`,
            })

            if (status.status === 'failed') {
              useCanvasStore.getState().setSimulationFailed(status.errorMessage || 'Unknown error')
            }
            if (status.status === 'completed' || status.status === 'stopped') {
              handleSimulationComplete(simId, status.status, globalMetricsSnapshot || status.globalMetrics)
            }
          }
        } catch (err) {
          console.error('Status poll error:', err)
          if (err.status === 401 || err.status === 403) {
            clearInterval(simulationIntervalRef.current)
            simulationIntervalRef.current = null
            if (eventSourceRef.current) { eventSourceRef.current.abort(); eventSourceRef.current = null }
            stopSimulation()
            useCanvasStore.getState().setSimulationProgress(0)
            setSimulationId(null)
            pushLog?.({ type: 'error', message: 'Session expired. Please sign in again.' })
          }
        }
      }, 2000)

    } catch (err) {
      stopSimulation()
      useCanvasStore.getState().setSimulationProgress(0)
      pushLog?.({ type: 'error', message: `Simulation failed: ${err.message}` })
    }
  }, [designId, simulationId, onValidationBlocked, onRequireSaveAs, pushLog, handleSimulationComplete])

  return {
    simulationRunning,
    simulationId,
    showReportModal,
    setShowReportModal,
    currentReport,
    reportLoading,
    handleRunSimulation,
  }
}

// Shared global-metrics mapping (was duplicated between SSE + poll paths).
function toUiGlobalMetrics(global, duration) {
  const totalRequests = global.totalRequests || 0
  const failedRequests = global.failedRequests || 0
  const droppedRequests = global.droppedRequests || 0
  const totalErrors = failedRequests + droppedRequests
  return {
    totalRequests,
    avgLatency: Math.round(global.avgLatencyMs || 0),
    p99Latency: Math.round(global.p99LatencyMs || 0),
    errorRate: totalRequests > 0
      ? ((totalErrors / totalRequests) * 100).toFixed(2)
      : '0.00',
    throughput: Math.round(global.throughputRps || 0),
    availability: totalRequests > 0
      ? (((totalRequests - totalErrors) / totalRequests) * 100).toFixed(2)
      : '100.00',
    duration,
    percentiles: {
      p50: global.p50LatencyMs || global.avgLatencyMs || 0,
      p75: global.p75LatencyMs || 0,
      p90: global.p90LatencyMs || 0,
      p95: global.p95LatencyMs || 0,
      p99: global.p99LatencyMs || 0,
      p999: global.p999LatencyMs || 0,
    },
    costEstimate: {
      hourlyCost: global.totalSimulatedCost && global.duration
        ? (global.totalSimulatedCost / (global.duration / 3600))
        : 0,
      projectedMonthly: global.projectedMonthlyCost || 0,
    },
  }
}

// Minimal report fallback (verbatim from CanvasEditor).
function buildMinimalReport(simId, status, globalMetrics, currentNodes, currentEdges, designId) {
  const totalRequests = globalMetrics?.totalRequests || 0
  const failedRequests = globalMetrics?.failedRequests || 0
  const droppedRequests = globalMetrics?.droppedRequests || 0
  const totalErrors = failedRequests + droppedRequests
  const errorRate = totalRequests > 0 ? totalErrors / totalRequests : 0
  const availability = totalRequests > 0 ? ((totalRequests - totalErrors) / totalRequests) * 100 : 100
  const avgLatency = globalMetrics?.avgLatencyMs || 0
  const p99Latency = globalMetrics?.p99LatencyMs || 0

  return {
    id: `report-${simId}`,
    simulationId: simId,
    designId: designId || 'new',
    version: '1.0',
    overallScore: Math.round(
      Math.max(0, 100
        - (errorRate > 0.1 ? 40 : errorRate > 0.05 ? 25 : errorRate > 0.01 ? 15 : errorRate > 0.001 ? 5 : 0)
        - (avgLatency > 500 ? 30 : avgLatency > 200 ? 20 : avgLatency > 100 ? 10 : avgLatency > 50 ? 5 : 0)
        - (availability < 95 ? 30 : availability < 99 ? 20 : availability < 99.9 ? 10 : availability < 99.99 ? 5 : 0)
      )
    ),
    architectureScore: 70,
    dataCompletenessScore: 70,
    reliabilityScore: Math.round(Math.max(0, availability)),
    performanceScore: Math.round(Math.max(0, 100 - (avgLatency > 500 ? 30 : avgLatency > 200 ? 20 : avgLatency > 100 ? 10 : avgLatency > 50 ? 5 : 0))),
    costScore: 60,
    securityScore: 60,
    confidenceScore: 80,
    executiveSummary: {
      summary: `Simulation ${simId} completed with ${totalRequests.toLocaleString()} requests. Average latency: ${Math.round(avgLatency)}ms. Availability: ${availability.toFixed(2)}%.`,
      keyFinding: errorRate > 0.01
        ? `Elevated error rate detected (${(errorRate * 100).toFixed(2)}%). Investigate failure scenarios.`
        : avgLatency > 200
          ? `High average latency (${Math.round(avgLatency)}ms). Consider scaling or optimization.`
          : 'Simulation completed within acceptable parameters.',
      keyRecommendation: errorRate > 0.01
        ? 'Review error-prone blocks and consider redundancy.'
        : avgLatency > 200
          ? 'Scale horizontally or optimize hot paths.'
          : 'Continue monitoring and consider running Monte Carlo analysis.',
      overallScore: null,
      dataCompletenessScore: null,
      reliabilityScore: null,
      performanceScore: null,
      costScore: null,
      securityScore: null,
      confidenceScore: null,
      assumptionCount: 0,
      criticalAssumptionCount: 0,
      scorePenaltyFromAssumptions: 0,
    },
    topologyAnalysis: {
      nodeCount: currentNodes.length,
      edgeCount: currentEdges.length,
      avgFanOut: 0,
      maxFanOut: 0,
      avgFanIn: 0,
      maxFanIn: 0,
      cyclomaticComplexity: 0,
      connectedComponents: 1,
      totalBlocks: currentNodes.length,
      totalEdges: currentEdges.length,
      criticalErrors: [],
      warnings: [],
      risks: [],
      graphStructureSummary: `${currentNodes.length} nodes, ${currentEdges.length} edges in current design.`,
    },
    performanceAnalysis: {
      globalMetrics: {
        totalRequests,
        throughputRps: globalMetrics?.throughputRps || 0,
        avgLatencyMs: avgLatency,
        p99LatencyMs: p99Latency,
        errorRate: errorRate,
        availability,
        droppedRequests,
        failedRequests,
        totalSimulatedCost: globalMetrics?.totalSimulatedCost || 0,
        projectedMonthlyCost: globalMetrics?.projectedMonthlyCost || 0,
        projectedAnnualCost: globalMetrics?.projectedAnnualCost || 0,
      },
      topLatencyBlocks: [],
      topErrorBlocks: [],
      topUtilizationBlocks: [],
      topCostBlocks: [],
      endToEndLatency: {
        avg: avgLatency,
        p95: globalMetrics?.p95LatencyMs || 0,
        p99: p99Latency,
        percentiles: {
          p50: globalMetrics?.p50LatencyMs || avgLatency,
          p75: globalMetrics?.p75LatencyMs || 0,
          p90: globalMetrics?.p90LatencyMs || 0,
          p95: globalMetrics?.p95LatencyMs || 0,
          p99: p99Latency,
          p999: globalMetrics?.p999LatencyMs || 0,
        }
      },
      latencyBottleneck: null,
      throughputBottleneck: null,
      costBottleneck: null,
    },
    // FLAT — not wrapped in { analysis, recommendations }
    reliabilityAnalysis: {
      reliabilityScore: Math.round(Math.max(0, availability)),
      availability,
      mttrMinutes: 0,
      mtbfHours: 0,
      failureProbabilityPerDay: 0,
      singlePointsOfFailure: [],
      failureChains: [],
      blastRadiuses: [],
      recommendations: [],
      resilienceScore: null,
      explainability: null,
      blockAvailabilities: [],
    },
    // FLAT
    scalabilityAnalysis: {
      scalabilityScore: 60,
      saturationPoints: [],
      growthProjections: [],
      bottlenecks: [],
      supportsHorizontalScaling: true,
      supportsVerticalScaling: true,
      supportsAutoScaling: true,
      recommendations: [],
      explainability: null,
      capacityLimits: [],
      slaCompliance: [],
      errorDistribution: {},
    },
    // FLAT
    costAnalysis: {
      currentMonthlyCost: globalMetrics?.projectedMonthlyCost || 0,
      currentAnnualCost: (globalMetrics?.projectedMonthlyCost || 0) * 12,
      totalCost: globalMetrics?.totalSimulatedCost || 0,
      breakdown: { edges: [], blocks: [] },
      drivers: [],
      growthProjections: [],
      recommendations: [],
      confidence: null,
      assumptions: { notes: [] },
      explainability: null,
      currency: 'USD',
    },
    // FLAT
    securityAnalysis: {
      securityScore: 60,
      findings: [],
      criticalCount: 0,
      highCount: 0,
      mediumCount: 0,
      lowCount: 0,
      bySeverity: { critical: [], high: [], medium: [], low: [] },
      recommendations: [],
      explainability: null,
    },
    // ARRAY — not { results: [] }
    failureScenarios: [],
    // Correct shape for AI tab
    aiInsights: {
      fallback: true,
      insights: [],
      generatedAt: new Date().toISOString(),
      modelVersion: 'unknown',
      evidencePacket: null,
      bottleneckAnalysis: null,
      rootCauseAnalysis: null,
      optimizationRecommendations: null,
      riskAssessment: null,
      costOptimization: null,
    },
    actionPlan: {
      critical: [],
      high: [],
      medium: [],
      low: [],
      summary: errorRate > 0.01 || avgLatency > 200
        ? 'Action items generated from simulation results.'
        : 'No critical action items at this time.',
    },
    metadata: {
      engineVersion: '2.0',
      reportVersion: '1.0.0',
      assumptions: {},
      confidenceScore: 80,
      aiGenerated: null,
      aiModelVersion: null,
      aiFallback: true,
      aiEvidenceValidated: false,
      assumptionCount: 0,
      criticalAssumptionCount: 0,
      scorePenaltyFromAssumptions: 0,
    },
    generatedAt: new Date().toISOString(),
  }
}
