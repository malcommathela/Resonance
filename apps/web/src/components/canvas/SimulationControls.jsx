import { api } from '@/services/api'
import React, { useState, useEffect, useRef } from 'react'
import {
  Play,
  Pause,
  Settings2,
  TrendingUp,
  Activity,
  Zap,
  AlertTriangle,
  Database,
  CloudOff,
  ShieldAlert,
  BarChart,
  Shuffle,
  Pencil,
  AlertOctagon,
  CheckCircle2,
  BarChart3,
  X,
} from 'lucide-react'
import { useCanvasStore } from '@/stores/canvasStore'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import {
  TRAFFIC_PATTERNS,
  SCENARIOS,
  GROWTH_SCENARIOS,
} from '@shared/constants'
import { getValidationSummary, SEVERITY } from '@/lib/validation'


const SETTINGS_KEY = 'resonance-simulation-settings'

const CurveSparkline = ({ curve, duration }) => {
  if (!curve || curve.length < 2) return null
  const maxRps = Math.max(...curve.map(p => p.rps), 100)
  const w = 220, h = 56, pad = 4
  const toX = (t) => pad + (t / duration) * (w - 2 * pad)
  const toY = (r) => h - pad - (r / maxRps) * (h - 2 * pad)
  const points = curve.map(p => `${toX(p.time)},${toY(p.rps)}`).join(' ')

  return (
    <svg width={w} height={h} className="mt-2 rounded-md border border-resonance-border bg-resonance-bg-secondary">
      <polyline fill="none" stroke="rgb(var(--accent-rgb))" strokeWidth="2" points={points} />
      {curve.map((p, i) => (
        <circle key={i} cx={toX(p.time)} cy={toY(p.rps)} r="3" fill="#8b5cf6" />
      ))}
    </svg>
  )
}

export const SimulationControls = ({ onRun, isRunning, progress, metrics, simulationId }) => {
  const [showSettings, setShowSettings] = useState(false)
  const [trafficPattern, setTrafficPattern] = useState('constant')
  const [scenario, setScenario] = useState('none')
  const [rps, setRps] = useState(100)
  const [duration, setDuration] = useState(300)
  const [monteCarloPasses, setMonteCarloPasses] = useState(1)
  const [confidenceLevel, setConfidenceLevel] = useState(0.95)
  const [growthScenario, setGrowthScenario] = useState(null)
  const [trafficParams, setTrafficParams] = useState({})

  // === BATCH 5C: NEW STATE ===
  const [deterministicSeed, setDeterministicSeed] = useState('')
  const [seedError, setSeedError] = useState('')
  const [customCurve, setCustomCurve] = useState([
    { time: 0, rps: 100 },
    { time: 300, rps: 100 },
  ])
  const [curveError, setCurveError] = useState('')
  const [targetBlockId, setTargetBlockId] = useState('')
  const [targetEdgeId, setTargetEdgeId] = useState('')
  // === END BATCH 5C ===

  const [liveMetrics, setLiveMetrics] = useState(null)
  const eventSourceRef = useRef(null)
  const settingsLoadedRef = useRef(false)

  // === P1: VALIDATION INTEGRATION ===
  const { validationResult, showValidationPanel, setShowValidationPanel, nodes, edges } = useCanvasStore()
  // === END P1 ===

  // === BATCH 5C: LOCALSTORAGE PERSISTENCE ===
  useEffect(() => {
    const saved = localStorage.getItem(SETTINGS_KEY)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (parsed.trafficPattern) setTrafficPattern(parsed.trafficPattern)
        if (parsed.scenario) setScenario(parsed.scenario)
        if (parsed.rps !== undefined) setRps(parsed.rps)
        if (parsed.duration !== undefined) setDuration(parsed.duration)
        if (parsed.monteCarloPasses !== undefined) setMonteCarloPasses(parsed.monteCarloPasses)
        if (parsed.confidenceLevel !== undefined) setConfidenceLevel(parsed.confidenceLevel)
        if (parsed.growthScenario !== undefined) setGrowthScenario(parsed.growthScenario)
        if (parsed.trafficParams) setTrafficParams(parsed.trafficParams)
        if (parsed.deterministicSeed !== undefined) setDeterministicSeed(parsed.deterministicSeed)
        if (parsed.customCurve) setCustomCurve(parsed.customCurve)
        if (parsed.targetBlockId !== undefined) setTargetBlockId(parsed.targetBlockId)
        if (parsed.targetEdgeId !== undefined) setTargetEdgeId(parsed.targetEdgeId)
      } catch (e) { /* ignore corrupt storage */ }
    }
    settingsLoadedRef.current = true
  }, [])

  useEffect(() => {
    if (!settingsLoadedRef.current) return
    const settings = {
      trafficPattern, scenario, rps, duration, monteCarloPasses,
      confidenceLevel, growthScenario, trafficParams,
      deterministicSeed, customCurve, targetBlockId, targetEdgeId,
    }
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  }, [trafficPattern, scenario, rps, duration, monteCarloPasses, confidenceLevel, growthScenario, trafficParams, deterministicSeed, customCurve, targetBlockId, targetEdgeId])
  // === END BATCH 5C ===

  // === BATCH 5C: KEEP LAST CURVE POINT SYNCED WITH DURATION ===
  useEffect(() => {
    setCustomCurve(prev => {
      if (prev.length < 2) return [{ time: 0, rps: 100 }, { time: duration, rps: 100 }]
      return [...prev.slice(0, -1), { ...prev[prev.length - 1], time: duration }]
    })
  }, [duration])
  // === END BATCH 5C ===

  // Stream live metrics via SSE (fetch-based, supports Clerk headers)
  useEffect(() => {
    if (isRunning && simulationId) {
      const ctrl = new AbortController()

      const connect = async () => {
        const { fetchEventSource } = await import('@microsoft/fetch-event-source')
        const token = await api.getAuthToken()

        await fetchEventSource(
          `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/simulations/${simulationId}/stream`,
          {
            method: 'GET',
            headers: {
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            credentials: 'include',
            signal: ctrl.signal,
            openWhenHidden: true,
            onmessage: (msg) => {
              try {
                const data = JSON.parse(msg.data)
                setLiveMetrics(data)
              } catch (e) {
                // ignore malformed payloads
              }
            },
            onerror: (err) => {
              // Stop retrying on auth errors
              if (err?.status === 401) {
                console.error('[SSE] 401 Unauthorized — stopping stream')
                ctrl.abort()
                return
              }
            },
          }
        )
      }

      connect()

      return () => {
        ctrl.abort()
        setLiveMetrics(null)
      }
    } else {
      setLiveMetrics(null)
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
    }
  }, [isRunning, simulationId])

  // === BATCH 5C: VALIDATION HELPERS ===
  const validateSeed = (seed) => {
    if (!seed) return ''
    if (!/^[a-zA-Z0-9-]{8,32}$/.test(seed)) return 'Seed must be 8–32 alphanumeric characters or dashes'
    return ''
  }

  const validateCurve = (curve) => {
    if (!curve || curve.length < 2) return 'Curve must have at least 2 points'
    for (let i = 0; i < curve.length; i++) {
      const point = curve[i]
      if (point.time < 0 || point.time > duration) return `Point ${i + 1}: time must be 0–${duration}s`
      if (point.rps < 1 || point.rps > 100000) return `Point ${i + 1}: RPS must be 1–100,000`
      if (i > 0 && point.time <= curve[i - 1].time) return `Point ${i + 1}: time must be greater than previous`
    }
    return ''
  }
  // === END BATCH 5C ===

  // === BATCH 5C: CURVE EDITORS ===
  const updateCurvePoint = (index, field, value) => {
    setCustomCurve(prev => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
    setCurveError('')
  }

  const addCurvePoint = () => {
    setCustomCurve(prev => {
      if (prev.length < 2) return prev
      let maxGap = 0
      let insertIndex = 1
      for (let i = 0; i < prev.length - 1; i++) {
        const gap = prev[i + 1].time - prev[i].time
        if (gap > maxGap) {
          maxGap = gap
          insertIndex = i + 1
        }
      }
      const before = prev[insertIndex - 1]
      const after = prev[insertIndex]
      const next = [...prev]
      next.splice(insertIndex, 0, {
        time: Math.round((before.time + after.time) / 2),
        rps: Math.round((before.rps + after.rps) / 2),
      })
      return next
    })
    setCurveError('')
  }

  const removeCurvePoint = (index) => {
    setCustomCurve(prev => {
      if (prev.length <= 2) return prev
      return prev.filter((_, i) => i !== index)
    })
    setCurveError('')
  }
  // === END BATCH 5C ===

  const handleRun = () => {
    // === P1: BLOCK RUN IF CRITICAL ERRORS ===
    if (validationResult && !validationResult.canSimulate) {
      setShowValidationPanel(true)
      return
    }
    // === END P1 ===

    // === BATCH 5C: VALIDATE NEW FIELDS ===
    const seedErr = validateSeed(deterministicSeed)
    if (seedErr) {
      setSeedError(seedErr)
      setShowSettings(true)
      return
    }
    if (trafficPattern === 'custom') {
      const curveErr = validateCurve(customCurve)
      if (curveErr) {
        setCurveError(curveErr)
        setShowSettings(true)
        return
      }
    }
    // === END BATCH 5C ===

    onRun({
      trafficPattern,
      scenario,
      rps,
      duration,
      monteCarloPasses,
      confidenceLevel,
      growthScenario,
      trafficParams: {
        ...trafficParams,
        customCurve: trafficPattern === 'custom' ? customCurve : undefined,
      },
      deterministicSeed: deterministicSeed || undefined,
      targetBlockId: scenario !== 'none' ? targetBlockId || undefined : undefined,
      targetEdgeId: scenario !== 'none' ? targetEdgeId || undefined : undefined,
    })
  }

  const getPatternIcon = (patternId) => {
    switch (patternId) {
      case 'constant': return TrendingUp
      case 'bursty': return Zap
      case 'spiky': return Activity
      case 'seasonal': return BarChart
      case 'randomized': return Shuffle
      case 'custom': return Pencil
      default: return TrendingUp
    }
  }

  const getScenarioIcon = (scenarioId) => {
    switch (scenarioId) {
      case 'none': return TrendingUp
      case 'db_slowdown': return Database
      case 'cache_eviction': return Zap
      case 'region_outage': return CloudOff
      case 'ddos': return ShieldAlert
      default: return AlertTriangle
    }
  }

  const currentPattern = TRAFFIC_PATTERNS.find(p => p.id === trafficPattern) || TRAFFIC_PATTERNS[0]
  const currentScenario = SCENARIOS.find(s => s.id === scenario) || SCENARIOS[0]

  // === P1: VALIDATION STATUS FOR RUN BUTTON ===
  const getRunButtonState = () => {
    if (isRunning) return { variant: 'danger', icon: Pause, text: 'Stop', disabled: false }
    if (validationResult && !validationResult.canSimulate) {
      return { variant: 'danger', icon: AlertOctagon, text: 'Fix Errors', disabled: false }
    }
    return { variant: 'primary', icon: Play, text: 'Run', disabled: false }
  }

  const runButtonState = getRunButtonState()
  // === END P1 ===

  return (
    <>
      <div className="flex items-center gap-2">
        {/* === P1: VALIDATION STATUS BADGE === */}
        {validationResult && (
          <button
            onClick={() => setShowValidationPanel(!showValidationPanel)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs font-medium transition-all ${
              validationResult.criticalCount > 0
                ? 'bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20'
                : validationResult.warningCount > 0 || validationResult.riskCount > 0
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
                : 'bg-green-500/10 text-green-400 border-green-500/30 hover:bg-green-500/20'
            }`}
            title={getValidationSummary(validationResult)}
          >
            {validationResult.criticalCount > 0 ? (
              <AlertOctagon size={12} />
            ) : validationResult.warningCount > 0 || validationResult.riskCount > 0 ? (
              <AlertTriangle size={12} />
            ) : (
              <CheckCircle2 size={12} />
            )}
            <span>
              {validationResult.criticalCount > 0
                ? `${validationResult.criticalCount} Critical`
                : validationResult.warningCount > 0 || validationResult.riskCount > 0
                ? `${validationResult.warningCount + validationResult.riskCount} Issues`
                : 'Valid'}
            </span>
          </button>
        )}
        {/* === END P1 === */}

        <Button
          variant={runButtonState.variant}
          size="sm"
          icon={runButtonState.icon}
          onClick={handleRun}
        >
          {runButtonState.text}
        </Button>

        <button
          onClick={() => setShowSettings(true)}
          className="p-2 rounded-lg hover:bg-resonance-bg-hover text-resonance-text-secondary hover:text-resonance-text-primary transition-colors"
          title="Simulation Settings"
        >
          <Settings2 size={16} />
        </button>

        {/* Live metrics mini-badge when running */}
        {isRunning && liveMetrics && (
          <div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-resonance-bg-tertiary border border-resonance-border">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-mono text-resonance-text-secondary">
              {liveMetrics.progress?.toFixed(0)}%
            </span>
          </div>
        )}
      </div>

      {/* Live Metrics Panel */}
      {isRunning && liveMetrics && (
        <div className="absolute top-14 right-4 z-20 w-72 bg-resonance-bg-elevated border border-resonance-border rounded-xl shadow-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-resonance-text-secondary uppercase tracking-wider">Live Metrics</span>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs text-green-500">{liveMetrics.progress?.toFixed(0)}%</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="bg-resonance-bg-tertiary rounded-lg p-2">
              <p className="text-xs text-resonance-text-muted">RPS</p>
              <p className="text-sm font-semibold text-resonance-text-primary">{liveMetrics.currentRps?.toFixed(0)}</p>
            </div>
            <div className="bg-resonance-bg-tertiary rounded-lg p-2">
              <p className="text-xs text-resonance-text-muted">Latency</p>
              <p className="text-sm font-semibold text-resonance-text-primary">{liveMetrics.global?.avgLatency?.toFixed(1)}ms</p>
            </div>
            <div className="bg-resonance-bg-tertiary rounded-lg p-2">
              <p className="text-xs text-resonance-text-muted">Errors</p>
              <p className="text-sm font-semibold text-red-400">{liveMetrics.global?.totalErrors || 0}</p>
            </div>
            <div className="bg-resonance-bg-tertiary rounded-lg p-2">
              <p className="text-xs text-resonance-text-muted">Dropped</p>
              <p className="text-sm font-semibold text-amber-400">{liveMetrics.global?.totalDropped || 0}</p>
            </div>
          </div>

          {/* Per-block utilization */}
          <div className="space-y-1 max-h-[120px] overflow-y-auto">
            {liveMetrics.metrics && Object.entries(liveMetrics.metrics).slice(0, 5).map(([blockId, blockMetrics]) => {
              const utilization = typeof blockMetrics.utilization === 'number' ? blockMetrics.utilization : 0
              const utilizationPercent = Math.min(utilization * 100, 100)
              return (
                <div key={blockId} className="flex items-center gap-2 text-xs">
                  <div className="w-16 truncate text-resonance-text-muted">{blockId.slice(0, 8)}</div>
                  <div className="flex-1 h-1.5 bg-resonance-bg-tertiary rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        utilization > 0.9 ? 'bg-red-500' :
                        utilization > 0.7 ? 'bg-amber-500' :
                        'bg-green-500'
                      }`}
                      style={{ width: `${utilizationPercent}%` }}
                    />
                  </div>
                  <span className="w-8 text-right text-resonance-text-secondary">{utilizationPercent.toFixed(0)}%</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <Modal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        title="Simulation Settings"
        size="lg"
      >
        <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
          {/* === P1: VALIDATION WARNING IN SETTINGS === */}
          {validationResult && !validationResult.canSimulate && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-start gap-2">
              <AlertOctagon size={16} className="text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-400">Simulation Blocked</p>
                <p className="text-xs text-red-300 mt-0.5">
                  {validationResult.criticalCount} critical error{validationResult.criticalCount !== 1 ? 's' : ''} must be fixed before running simulation.
                </p>
              </div>
            </div>
          )}
          {validationResult && validationResult.canSimulate && (validationResult.warningCount > 0 || validationResult.riskCount > 0) && (
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-start gap-2">
              <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-400">Issues Detected</p>
                <p className="text-xs text-amber-300 mt-0.5">
                  {validationResult.warningCount} warning{validationResult.warningCount !== 1 ? 's' : ''} and {validationResult.riskCount} risk{validationResult.riskCount !== 1 ? 's' : ''} found. Simulation can run but results may be affected.
                </p>
              </div>
            </div>
          )}
          {/* === END P1 === */}

          {/* Traffic Pattern */}
          <div>
            <label className="block text-sm font-medium text-resonance-text-secondary mb-3">
              Traffic Pattern
            </label>
            <div className="grid grid-cols-2 gap-3">
              {TRAFFIC_PATTERNS.map(pattern => {
                const Icon = getPatternIcon(pattern.id)
                const isActive = trafficPattern === pattern.id
                return (
                  <button
                    key={pattern.id}
                    onClick={() => {
                      setTrafficPattern(pattern.id)
                      setTrafficParams({})
                      setCurveError('')
                    }}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      isActive
                        ? 'border-resonance-accent bg-resonance-accent/5'
                        : 'border-resonance-border hover:border-resonance-accent/30'
                    }`}
                  >
                    <Icon size={20} className={`mb-2 ${isActive ? 'text-resonance-accent' : 'text-resonance-text-muted'}`} />
                    <p className={`text-sm font-medium ${isActive ? 'text-resonance-accent' : 'text-resonance-text-primary'}`}>
                      {pattern.label}
                    </p>
                    <p className="text-xs text-resonance-text-muted mt-1">{pattern.description}</p>
                  </button>
                )
              })}
            </div>

            {/* Pattern-specific params */}
            {currentPattern.params && Object.keys(currentPattern.params).length > 0 && (
              <div className="mt-3 p-3 bg-resonance-bg-tertiary rounded-lg border border-resonance-border space-y-3">
                <p className="text-xs font-medium text-resonance-text-secondary uppercase tracking-wider">Pattern Parameters</p>
                {Object.entries(currentPattern.params).map(([key, spec]) => (
                  <div key={key}>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs text-resonance-text-muted">{spec.label || key}</label>
                      <span className="text-xs font-mono text-resonance-accent">{trafficParams[key] ?? spec.default}</span>
                    </div>
                    <input
                      type="range"
                      min={spec.min}
                      max={spec.max}
                      step={spec.type === 'number' ? (spec.max - spec.min > 10 ? 1 : 0.01) : 1}
                      value={trafficParams[key] ?? spec.default}
                      onChange={(e) => setTrafficParams(prev => ({ ...prev, [key]: parseFloat(e.target.value) }))}
                      className="w-full h-1.5 bg-resonance-bg-secondary rounded-lg appearance-none cursor-pointer accent-resonance-accent"
                    />
                    <div className="flex justify-between text-[10px] text-resonance-text-muted mt-0.5">
                      <span>{spec.min}</span>
                      <span>{spec.max}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* === BATCH 5C: CUSTOM TRAFFIC CURVE EDITOR === */}
            {trafficPattern === 'custom' && (
              <div className="mt-3 p-3 bg-resonance-bg-tertiary rounded-lg border border-resonance-border space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-resonance-text-secondary uppercase tracking-wider">Custom Traffic Curve</p>
                  {curveError && <span className="text-xs text-red-400">{curveError}</span>}
                </div>

                <CurveSparkline curve={customCurve} duration={duration} />

                <div className="space-y-1">
                  {customCurve.map((point, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="flex-1 grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-resonance-text-muted block">Time (s)</label>
                          <input
                            type="number"
                            min={0}
                            max={duration}
                            value={point.time}
                            onChange={(e) => updateCurvePoint(i, 'time', parseInt(e.target.value) || 0)}
                            className="w-full bg-resonance-bg-secondary border border-resonance-border rounded px-2 py-1 text-xs text-resonance-text-primary focus:outline-none focus:border-resonance-accent"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-resonance-text-muted block">RPS</label>
                          <input
                            type="number"
                            min={1}
                            max={100000}
                            value={point.rps}
                            onChange={(e) => updateCurvePoint(i, 'rps', parseInt(e.target.value) || 0)}
                            className="w-full bg-resonance-bg-secondary border border-resonance-border rounded px-2 py-1 text-xs text-resonance-text-primary focus:outline-none focus:border-resonance-accent"
                          />
                        </div>
                      </div>
                      <button
                        onClick={() => removeCurvePoint(i)}
                        disabled={customCurve.length <= 2}
                        className="p-1 rounded text-resonance-text-muted hover:text-red-400 disabled:opacity-30 transition-colors"
                        title="Remove point"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  onClick={addCurvePoint}
                  className="w-full py-1.5 rounded-lg border border-dashed border-resonance-border text-xs text-resonance-text-muted hover:text-resonance-accent hover:border-resonance-accent/50 transition-all"
                >
                  + Add Point
                </button>

                <p className="text-[10px] text-resonance-text-muted">
                  Times must increase monotonically from 0 to {duration}s. The curve is piecewise-linear.
                </p>
              </div>
            )}
            {/* === END BATCH 5C === */}
          </div>

          {/* Failure Scenario */}
          <div>
            <label className="block text-sm font-medium text-resonance-text-secondary mb-3">
              Failure Scenario
            </label>
            <div className="grid grid-cols-3 gap-2">
              {SCENARIOS.map(sc => {
                const Icon = getScenarioIcon(sc.id)
                const isActive = scenario === sc.id
                return (
                  <button
                    key={sc.id}
                    onClick={() => {
                      setScenario(sc.id)
                      if (sc.id === 'none') {
                        setTargetBlockId('')
                        setTargetEdgeId('')
                      }
                    }}
                    className={`p-2.5 rounded-xl border text-center transition-all ${
                      isActive
                        ? sc.id === 'none' ? 'border-resonance-accent bg-resonance-accent/5' : 'border-red-500/50 bg-red-500/5'
                        : 'border-resonance-border hover:border-resonance-accent/20'
                    }`}
                  >
                    <Icon size={16} className={`mx-auto mb-1.5 ${isActive ? sc.id === 'none' ? 'text-resonance-accent' : 'text-red-400' : 'text-resonance-text-muted'}`} />
                    <p className={`text-xs font-medium ${isActive ? sc.id === 'none' ? 'text-resonance-accent' : 'text-red-400' : 'text-resonance-text-primary'}`}>
                      {sc.label}
                    </p>
                    {sc.targetable && (
                      <span className="text-[10px] text-resonance-text-muted block mt-0.5">Targetable</span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* === BATCH 5C: TARGETED FAILURE INJECTION === */}
            {scenario !== 'none' && (
              <div className="mt-3 p-3 bg-resonance-bg-tertiary rounded-lg border border-resonance-border space-y-3">
                <p className="text-xs font-medium text-resonance-text-secondary uppercase tracking-wider">Targeted Failure Injection</p>

                <div>
                  <label className="text-xs text-resonance-text-muted mb-1 block">Target Block</label>
                  <select
                    value={targetBlockId}
                    onChange={(e) => {
                      setTargetBlockId(e.target.value)
                      if (e.target.value) setTargetEdgeId('') // clear edge if block selected
                    }}
                    className="w-full bg-resonance-bg-secondary border border-resonance-border rounded-lg px-3 py-2 text-sm text-resonance-text-primary focus:outline-none focus:border-resonance-accent"
                  >
                    <option value="">Random / System-wide</option>
                    {nodes.map(n => (
                      <option key={n.id} value={n.id}>
                        {n.data?.label || n.id} ({n.data?.type || 'block'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-resonance-text-muted mb-1 block">Target Edge (optional)</label>
                  <select
                    value={targetEdgeId}
                    onChange={(e) => {
                      setTargetEdgeId(e.target.value)
                      if (e.target.value) setTargetBlockId('') // clear block if edge selected
                    }}
                    className="w-full bg-resonance-bg-secondary border border-resonance-border rounded-lg px-3 py-2 text-sm text-resonance-text-primary focus:outline-none focus:border-resonance-accent"
                  >
                    <option value="">None</option>
                    {edges.map(e => (
                      <option key={e.id} value={e.id}>
                        {e.source} → {e.target}
                      </option>
                    ))}
                  </select>
                </div>

                <p className="text-[10px] text-resonance-text-muted">
                  Select a specific block or edge to target. If both are empty, the failure is distributed across all matching components.
                </p>
              </div>
            )}
            {/* === END BATCH 5C === */}
          </div>

          {/* Growth Scenario */}
          <div>
            <label className="block text-sm font-medium text-resonance-text-secondary mb-3">
              Growth Scenario (Optional)
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setGrowthScenario(null)}
                className={`px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                  growthScenario === null
                    ? 'border-resonance-accent bg-resonance-accent/5 text-resonance-accent'
                    : 'border-resonance-border text-resonance-text-secondary hover:border-resonance-accent/30'
                }`}
              >
                None
              </button>
              {GROWTH_SCENARIOS.map(gs => (
                <button
                  key={gs.id}
                  onClick={() => setGrowthScenario(gs.id)}
                  className={`px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                    growthScenario === gs.id
                      ? 'border-resonance-accent bg-resonance-accent/5 text-resonance-accent'
                      : 'border-resonance-border text-resonance-text-secondary hover:border-resonance-accent/30'
                  }`}
                >
                  {gs.label}
                </button>
              ))}
            </div>
          </div>

          {/* RPS Slider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-resonance-text-secondary">Requests Per Second</label>
              <span className="text-sm font-mono text-resonance-accent">{rps} RPS</span>
            </div>
            <input
              type="range"
              min="10"
              max="10000"
              step="10"
              value={rps}
              onChange={(e) => setRps(parseInt(e.target.value))}
              className="w-full h-2 bg-resonance-bg-tertiary rounded-lg appearance-none cursor-pointer accent-resonance-accent"
            />
            <div className="flex justify-between text-xs text-resonance-text-muted mt-1">
              <span>10</span>
              <span>5,000</span>
              <span>10,000</span>
            </div>
          </div>

          {/* Duration */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-resonance-text-secondary">Duration</label>
              <span className="text-sm font-mono text-resonance-accent">{duration}s</span>
            </div>
            <input
              type="range"
              min="30"
              max="1800"
              step="30"
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value))}
              className="w-full h-2 bg-resonance-bg-tertiary rounded-lg appearance-none cursor-pointer accent-resonance-accent"
            />
            <div className="flex justify-between text-xs text-resonance-text-muted mt-1">
              <span>30s</span>
              <span>15m</span>
              <span>30m</span>
            </div>
          </div>

          {/* Monte Carlo Passes */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-resonance-text-secondary">Monte Carlo Passes</label>
              <span className="text-sm font-mono text-resonance-accent">{monteCarloPasses}</span>
            </div>
            <input
              type="range"
              min="1"
              max="100"
              step="1"
              value={monteCarloPasses}
              onChange={(e) => setMonteCarloPasses(parseInt(e.target.value))}
              className="w-full h-2 bg-resonance-bg-tertiary rounded-lg appearance-none cursor-pointer accent-resonance-accent"
            />
            <p className="text-xs text-resonance-text-muted mt-1">More passes = higher statistical confidence but slower</p>
          </div>

          {/* Confidence Level */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-resonance-text-secondary">Confidence Level</label>
              <span className="text-sm font-mono text-resonance-accent">{(confidenceLevel * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min="0.80"
              max="0.999"
              step="0.001"
              value={confidenceLevel}
              onChange={(e) => setConfidenceLevel(parseFloat(e.target.value))}
              className="w-full h-2 bg-resonance-bg-tertiary rounded-lg appearance-none cursor-pointer accent-resonance-accent"
            />
          </div>

          {/* === BATCH 5C: DETERMINISTIC SEED INPUT === */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-resonance-text-secondary">Deterministic Seed</label>
              <span className="text-xs font-mono text-resonance-accent">{deterministicSeed ? 'Custom' : 'Random'}</span>
            </div>
            <input
              type="text"
              placeholder="e.g., my-seed-123"
              value={deterministicSeed}
              onChange={(e) => {
                const val = e.target.value
                setDeterministicSeed(val)
                setSeedError(validateSeed(val))
              }}
              className={`w-full bg-resonance-bg-secondary border rounded-lg px-3 py-2 text-sm text-resonance-text-primary placeholder-resonance-text-muted focus:outline-none focus:border-resonance-accent ${
                seedError ? 'border-red-500' : deterministicSeed && !seedError ? 'border-green-500/50' : 'border-resonance-border'
              }`}
            />
            {seedError && <p className="text-xs text-red-400 mt-1">{seedError}</p>}
            <p className="text-xs text-resonance-text-muted mt-1">
              8–32 characters, alphanumeric and dashes only. Same seed = reproducible results.
            </p>
          </div>
          {/* === END BATCH 5C === */}

          <div className="flex justify-end gap-3 pt-2 border-t border-resonance-border">
            <Button variant="ghost" onClick={() => setShowSettings(false)}>
              Cancel
            </Button>
            <Button onClick={() => setShowSettings(false)}>
              Apply Settings
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}