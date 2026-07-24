import React, { useState, useMemo } from 'react'
import {
  Loader2,
  Activity,
  AlertTriangle,
  Zap,
  ShieldCheck,
  BarChart3,
  Minimize2,
  Maximize2,
  DollarSign,
  AlertOctagon,
  RefreshCw,
  XCircle,
} from 'lucide-react'
import { useCanvasStore } from '@/stores/canvasStore'
import { formatMetric, calculateHealthScore, calculatePerformanceGrade } from '@/utils/metricsCalculator'

// ----------------------------------------------------------------------------
// UTILITIES
// ----------------------------------------------------------------------------

function getUtilizationColor(util) {
  if (util >= 0.95) return 'bg-red-500'
  if (util >= 0.8) return 'bg-amber-500'
  if (util >= 0.6) return 'bg-yellow-400'
  return 'bg-green-500'
}

function getUtilizationTextColor(util) {
  if (util >= 0.95) return 'text-red-400'
  if (util >= 0.8) return 'text-amber-400'
  if (util >= 0.6) return 'text-yellow-400'
  return 'text-green-400'
}

// ----------------------------------------------------------------------------
// COMPONENT
// ----------------------------------------------------------------------------

export const SimulationOverlay = ({ progress }) => {
  const [collapsed, setCollapsed] = useState(false)
  const {
    simulationMetrics,
    simulationBlockMetrics,
    simulationEdgeMetrics,
    simulationAlerts,
    nodes,
    edges,
  } = useCanvasStore()

  // -- Top-bar scalars (existing contract) --
  const totalRequests = simulationMetrics?.totalRequests || 0
  const throughput = simulationMetrics?.throughput || 0
  const errorRate = parseFloat(simulationMetrics?.errorRate || 0)
  const avgLatency = simulationMetrics?.avgLatency || 0
  const p99Latency = simulationMetrics?.p99Latency || 0
  const availability = parseFloat(simulationMetrics?.availability || 100)

  // -- Percentiles (expanded contract) --
  const percentiles = simulationMetrics?.percentiles || {}
  const p50 = percentiles.p50 || avgLatency
  const p75 = percentiles.p75 || avgLatency
  const p90 = percentiles.p90 || avgLatency
  const p95 = percentiles.p95 || p99Latency * 0.8 || avgLatency
  const p99 = percentiles.p99 || p99Latency
  const p999 = percentiles.p999 || p99Latency * 1.2

  // -- Cost (expanded contract) --
  const hourlyCost = simulationMetrics?.costEstimate?.hourlyCost || 0
  const projectedMonthly = simulationMetrics?.costEstimate?.projectedMonthly || 0

  // -- Derived health indicators --
  const healthScore = useMemo(() => calculateHealthScore({
    avgLatencyMs: avgLatency,
    errorRate: errorRate / 100,
    availability,
    totalRequests,
    droppedRequests: 0,
  }), [avgLatency, errorRate, availability, totalRequests])

  const perfGrade = useMemo(() => calculatePerformanceGrade({
    avgLatencyMs: avgLatency,
    errorRate: errorRate / 100,
    availability,
    totalRequests,
    droppedRequests: 0,
  }), [avgLatency, errorRate, availability, totalRequests])

  // -- Block utilization grid (top 8 by utilization) --
  const blockUtilizations = useMemo(() => {
    const entries = Object.entries(simulationBlockMetrics || {})
    if (entries.length === 0) return []
    return entries
      .map(([blockId, metrics]) => {
        const node = nodes.find(n => n.id === blockId)
        return {
          blockId,
          name: node?.data?.label || blockId,
          color: node?.data?.color || '#8b5cf6',
          utilization: metrics.utilization || 0,
          cpuPercent: metrics.cpuPercent || 0,
          memoryPercent: metrics.memoryPercent || 0,
          threadPoolUtilization: metrics.threadPoolUtilization || 0,
          queueDepth: metrics.queueDepth || 0,
          currentReplicas: metrics.currentReplicas || 1,
        }
      })
      .sort((a, b) => b.utilization - a.utilization)
      .slice(0, 8)
  }, [simulationBlockMetrics, nodes])

  const activeAlerts = simulationAlerts || []

  // Don't render until we have either metrics or progress
  if (!simulationMetrics && progress === 0) return null

  return (
    <div className="absolute top-10 left-1/2 -translate-x-1/2 z-40 pointer-events-auto w-full max-w-4xl px-4">
      <div className="rounded-xl bg-resonance-bg-elevated/95 backdrop-blur-md border border-resonance-border shadow-2xl overflow-hidden">
        {/* ================================================================
            TOP BAR — compact metrics (always visible)
        ================================================================ */}
        <div className="flex items-center gap-3 px-4 py-2.5">
          <div className="flex items-center gap-2 shrink-0">
            <Loader2 size={16} className="animate-spin text-resonance-accent" />
            <span className="text-sm font-semibold text-resonance-text-primary">Simulation Running</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="w-24 h-1.5 bg-resonance-bg-tertiary rounded-full overflow-hidden">
              <div
                className="h-full bg-resonance-accent rounded-full transition-all duration-500"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
            <span className="text-xs font-mono font-medium text-resonance-text-secondary w-8">
              {Math.round(progress)}%
            </span>
          </div>

          <div className="flex items-center gap-3 border-l border-resonance-border pl-3 overflow-x-auto">
            <MetricPill icon={<BarChart3 size={12} className="text-blue-400" />} value={totalRequests.toLocaleString()} label="Total Requests" />
            <MetricPill icon={<Zap size={12} className="text-green-400" />} value={`${Math.round(throughput)} RPS`} label="Throughput" />
            <MetricPill icon={<AlertTriangle size={12} className={errorRate > 1 ? 'text-red-400' : 'text-green-400'} />} value={`${errorRate.toFixed(2)}%`} label="Error Rate" />
            <MetricPill icon={<Activity size={12} className="text-blue-400" />} value={`${Math.round(avgLatency)}ms`} label="Avg Latency" />
            <MetricPill icon={<Activity size={12} className="text-purple-400" />} value={`${Math.round(p99Latency)}ms`} label="P99 Latency" />
            <MetricPill icon={<ShieldCheck size={12} className={availability < 99 ? 'text-red-400' : 'text-green-400'} />} value={`${availability.toFixed(2)}%`} label="Availability" />
          </div>

          <div className="ml-auto flex items-center gap-2 shrink-0">
            <div
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-semibold"
              style={{ color: perfGrade.color, backgroundColor: `${perfGrade.color}15` }}
              title={`Health Score: ${healthScore}/100`}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: perfGrade.color }} />
              {perfGrade.grade}
            </div>
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="p-1 rounded-md hover:bg-resonance-bg-hover text-resonance-text-secondary hover:text-resonance-text-primary transition-colors"
              title={collapsed ? 'Expand dashboard' : 'Collapse dashboard'}
            >
              {collapsed ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
            </button>
          </div>
        </div>

        {/* ================================================================
            EXPANDED DASHBOARD
        ================================================================ */}
        {!collapsed && (
          <div className="border-t border-resonance-border px-4 py-3 space-y-3 animate-fade-in">
            {/* -- Percentile Ribbon -- */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-resonance-text-muted">Latency Percentiles</span>
                <span className="text-[10px] text-resonance-text-muted">ms</span>
              </div>
              <div className="grid grid-cols-6 gap-2">
                <PercentileBar label="P50" value={p50} max={p999 || p99 * 1.2 || 100} />
                <PercentileBar label="P75" value={p75} max={p999 || p99 * 1.2 || 100} />
                <PercentileBar label="P90" value={p90} max={p999 || p99 * 1.2 || 100} />
                <PercentileBar label="P95" value={p95} max={p999 || p99 * 1.2 || 100} />
                <PercentileBar label="P99" value={p99} max={p999 || p99 * 1.2 || 100} />
                <PercentileBar label="P99.9" value={p999} max={p999 || p99 * 1.2 || 100} />
              </div>
            </div>

            {/* -- Block Utilization Grid -- */}
            {blockUtilizations.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-resonance-text-muted">Block Utilization</span>
                  <span className="text-[10px] text-resonance-text-muted">{blockUtilizations.length} active</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {blockUtilizations.map((block) => (
                    <div key={block.blockId} className="flex items-center gap-2 rounded-lg bg-resonance-bg-secondary/50 border border-resonance-border px-2.5 py-1.5">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: block.color }} />
                      <span className="text-[11px] font-medium text-resonance-text-primary truncate w-16 sm:w-20" title={block.name}>
                        {block.name}
                      </span>
                      <div className="flex-1 h-1.5 bg-resonance-bg-tertiary rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${getUtilizationColor(block.utilization)}`}
                          style={{ width: `${Math.min(block.utilization * 100, 100)}%` }}
                        />
                      </div>
                      <span className={`text-[10px] font-mono font-medium w-7 text-right ${getUtilizationTextColor(block.utilization)}`}>
                        {Math.round(block.utilization * 100)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* -- Bottom Row: Cost + Alerts -- */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-resonance-bg-secondary/50 border border-resonance-border">
                <DollarSign size={12} className="text-emerald-400" />
                <span className="text-[11px] text-resonance-text-secondary">
                  <span className="font-mono font-medium text-resonance-text-primary">{formatMetric(hourlyCost, 'cost')}</span>/hr
                </span>
                {projectedMonthly > 0 && (
                  <span className="text-[10px] text-resonance-text-muted">
                    (~{formatMetric(projectedMonthly, 'cost')}/mo)
                  </span>
                )}
              </div>

              <div className="flex-1 flex items-center gap-2 overflow-x-auto min-w-0">
                {activeAlerts.length === 0 && (
                  <span className="text-[11px] text-resonance-text-muted italic">No active alerts</span>
                )}
                {activeAlerts.map((alert, i) => (
                  <AlertBadge
                    key={`${alert.type}-${alert.edgeId || alert.blockId || i}-${i}`}
                    alert={alert}
                    edges={edges}
                    nodes={nodes}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ----------------------------------------------------------------------------
// SUB-COMPONENTS
// ----------------------------------------------------------------------------

function MetricPill({ icon, value, label }) {
  return (
    <div className="flex items-center gap-1 shrink-0" title={label}>
      {icon}
      <span className="text-[11px] font-mono text-resonance-text-secondary">{value}</span>
    </div>
  )
}

function PercentileBar({ label, value, max }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px]">
        <span className="font-medium text-resonance-text-secondary">{label}</span>
        <span className="font-mono text-resonance-text-muted">{Math.round(value)}</span>
      </div>
      <div className="h-1 bg-resonance-bg-tertiary rounded-full overflow-hidden">
        <div
          className="h-full bg-resonance-accent rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function AlertBadge({ alert, edges, nodes }) {
  const config = {
    circuit_open: { icon: <XCircle size={10} />, color: 'text-red-400 bg-red-400/10 border-red-400/20', label: 'Circuit Open' },
    retry_storm: { icon: <RefreshCw size={10} className="animate-spin" />, color: 'text-amber-400 bg-amber-400/10 border-amber-400/20', label: 'Retry Storm' },
    saturation: { icon: <AlertOctagon size={10} />, color: 'text-orange-400 bg-orange-400/10 border-orange-400/20', label: 'Saturation' },
  }
  const c = config[alert.type] || {
    icon: <AlertTriangle size={10} />,
    color: 'text-red-400 bg-red-400/10 border-red-400/20',
    label: 'Alert',
  }

  let name = ''
  if (alert.edgeId) {
    const edge = edges.find(e => e.id === alert.edgeId)
    const source = nodes.find(n => n.id === edge?.source)
    const target = nodes.find(n => n.id === edge?.target)
    name = source && target
      ? `${source.data?.label || edge.source} → ${target.data?.label || edge.target}`
      : alert.edgeId
  } else if (alert.blockId) {
    const node = nodes.find(n => n.id === alert.blockId)
    name = node?.data?.label || alert.blockId
  }

  return (
    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md border text-[10px] font-medium whitespace-nowrap ${c.color}`}>
      {c.icon}
      <span>{c.label}{name ? `: ${name}` : ''}</span>
    </div>
  )
}