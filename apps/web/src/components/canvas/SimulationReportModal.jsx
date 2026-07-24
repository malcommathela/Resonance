/**
 * SimulationReportModal.jsx
 *
 * Batch 5 — UI/UX Polish (E1–E4)
 *   E1: Clipboard size guard before navigator.clipboard.writeText
 *   E2: Keyboard nav useEffect deps fix (activeTab via ref, not dep)
 *   E3: useMemo deps fix (report?.overallScore instead of report object)
 *   E4: Print styles — only print active tab
 *
 * Prior batches preserved:
 *   Batch 3 — Missing Data Handling (null scores, cost engine shapes, etc.)
 *   Batch 4 — Code Quality (getGradeFromScore import, unused import cleanup,
 *             PercentileChart null filter)
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Modal, Button } from "@/components";
import {
  LayoutDashboard, Network, Zap, Shield, TrendingUp,
  DollarSign, Lock, AlertTriangle, Brain, ClipboardList,
  Code, ChevronRight, ChevronDown, CheckCircle2, AlertCircle,
  Info, Clock, Server, Globe, Cpu, Activity,
  ArrowUpRight, ArrowDownRight, Minus, Copy, Check,
  XCircle, ShieldAlert
} from 'lucide-react'
import {
  preparePercentiles,
  SEVERITY_COLORS
} from '@/utils/simulationRenderer'
import {
  formatMetric,
  calculateHealthScore,
  calculatePerformanceGrade,
  calculateBottleneckSeverity,
  getGradeFromScore,
} from '@/utils/metricsCalculator'
import { SEVERITY_CONFIG } from '@/lib/validation'

// ============================================================================
// CONSTANTS
// ============================================================================

const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'topology', label: 'Topology', icon: Network },
  { id: 'performance', label: 'Performance', icon: Zap },
  { id: 'reliability', label: 'Reliability', icon: Shield },
  { id: 'scalability', label: 'Scalability', icon: TrendingUp },
  { id: 'cost', label: 'Cost', icon: DollarSign },
  { id: 'security', label: 'Security', icon: Lock },
  { id: 'failure', label: 'Failure Scenarios', icon: AlertTriangle },
  { id: 'ai', label: 'AI Insights', icon: Brain },
  { id: 'action', label: 'Action Plan', icon: ClipboardList },
  { id: 'raw', label: 'Raw Data', icon: Code },
]

const SCORE_CATEGORIES = [
  { key: 'dataCompleteness', label: 'Data Completeness' },
  { key: 'reliability', label: 'Reliability' },
  { key: 'performance', label: 'Performance' },
  { key: 'cost', label: 'Cost' },
  { key: 'security', label: 'Security' },
  { key: 'confidence', label: 'Confidence' },
]

// ============================================================================
// HELPERS
// ============================================================================

function renderRecommendationText(rec) {
  if (rec === null || rec === undefined) return null
  if (typeof rec === 'string') return rec
  return rec.description || rec.title || rec.message || null
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

const ScoreRing = ({ value, label, size = 72, color, strokeWidth = 6 }) => {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const hasValue = value !== null && value !== undefined && !isNaN(value)
  const clamped = hasValue ? Math.min(Math.max(value, 0), 100) : 0
  const offset = circumference * (1 - clamped / 100)

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgb(var(--bg-hover-rgb))"
            strokeWidth={strokeWidth}
          />
          {hasValue && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              className="transition-all duration-300"
            />
          )}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-lg font-bold ${hasValue ? 'text-resonance-text-primary' : 'text-resonance-text-muted'}`}>
            {hasValue ? clamped : '—'}
          </span>
        </div>
      </div>
      {label && (
        <span className="text-xs text-resonance-text-secondary uppercase tracking-wider">{label}</span>
      )}
    </div>
  )
}

const EmptyState = ({ message }) => (
  <div className="flex flex-col items-center justify-center py-12 text-resonance-text-muted">
    <Info size={32} className="mb-3 opacity-50" />
    <p className="text-sm">{message || 'No data available'}</p>
  </div>
)

const MetricCard = ({ label, value, unit, icon: Icon, trend }) => (
  <div className="bg-resonance-bg-secondary border border-resonance-border rounded-xl p-4">
    <div className="flex items-center justify-between mb-2">
      <span className="text-xs text-resonance-text-secondary uppercase tracking-wider">{label}</span>
      {Icon && <Icon size={14} className="text-resonance-text-muted" />}
    </div>
    <div className="text-2xl font-bold text-resonance-text-primary">
      {value !== undefined && value !== null && !isNaN(value) ? formatMetric(value, unit) : '—'}
    </div>
    {trend !== undefined && (
      <div className={`flex items-center gap-1 mt-1 text-xs ${
        trend > 0 ? 'text-resonance-error' : trend < 0 ? 'text-resonance-success' : 'text-resonance-text-muted'
      }`}>
        {trend > 0 ? <ArrowUpRight size={12} /> : trend < 0 ? <ArrowDownRight size={12} /> : <Minus size={12} />}
        {Math.abs(trend).toFixed(1)}%
      </div>
    )}
  </div>
)

const SectionCard = ({ title, icon: Icon, children, className = '' }) => (
  <div className={`bg-resonance-bg-secondary border border-resonance-border rounded-xl overflow-hidden ${className}`}>
    <div className="flex items-center gap-2 px-4 py-3 border-b border-resonance-border bg-resonance-bg-tertiary/50">
      {Icon && <Icon size={16} className="text-resonance-accent" />}
      <h3 className="text-sm font-semibold text-resonance-text-primary">{title}</h3>
    </div>
    <div className="p-4">{children}</div>
  </div>
)

const FindingBadge = ({ severity }) => {
  const config = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.info
  const Icon = severity === 'critical' ? XCircle : severity === 'warning' ? AlertCircle : severity === 'risk' ? ShieldAlert : Info
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${config.bgColor} ${config.textColor} ${config.borderColor}`}>
      <Icon size={12} />
      {config.label}
    </span>
  )
}

const PercentileChart = ({ percentiles }) => {
  const valid = (percentiles || []).filter(p => p.value != null && p.value > 0)
  if (valid.length === 0) return <EmptyState message="No percentile data" />

  const maxValue = Math.max(...valid.map(p => p.value || 0), 1)

  return (
    <div className="space-y-2">
      {valid.map((p) => {
        const pct = Math.min((p.value / maxValue) * 100, 100)
        const barColor = p.percentile === 'P99' || p.percentile === 'P99.9'
          ? 'rgb(var(--error-rgb))'
          : p.percentile === 'P95'
            ? 'rgb(var(--warning-rgb))'
            : 'rgb(var(--accent-rgb))'
        return (
          <div key={p.percentile} className="flex items-center gap-3">
            <span className="w-14 text-xs text-resonance-text-secondary text-right font-mono">{p.percentile}</span>
            <div className="flex-1 h-7 bg-resonance-bg-tertiary rounded-lg overflow-hidden relative">
              <div
                className="h-full rounded-lg transition-all duration-700 ease-out flex items-center justify-end pr-2"
                style={{ width: `${pct}%`, backgroundColor: barColor }}
              >
                <span className="text-[10px] font-medium text-white whitespace-nowrap">
                  {formatMetric(p.value, 'ms')}
                </span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

const BottleneckTable = ({ items, metricKey, label }) => {
  if (!items || items.length === 0) return <EmptyState message={`No ${label} data`} />

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-resonance-border">
            <th className="text-left py-2 px-3 text-xs text-resonance-text-secondary font-medium uppercase">Block</th>
            <th className="text-right py-2 px-3 text-xs text-resonance-text-secondary font-medium uppercase">{label}</th>
            <th className="text-right py-2 px-3 text-xs text-resonance-text-secondary font-medium uppercase">Severity</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => {
            const block = item.blockId || item.id || 'Unknown'
            const metrics = item.metrics || item
            const value = metrics[metricKey] || 0
            const severity = calculateBottleneckSeverity(metrics)
            const color = severity ? (SEVERITY_COLORS[severity.severity]?.bg || '#6b7280') : '#6b7280'
            const unit = metricKey.includes('Latency') ? 'ms' : metricKey.includes('Rate') || metricKey === 'utilization' ? 'percent' : 'count'

            return (
              <tr key={block + i} className="border-b border-resonance-border/50 hover:bg-resonance-bg-hover/50">
                <td className="py-2 px-3 text-resonance-text-primary font-medium">{block}</td>
                <td className="py-2 px-3 text-right text-resonance-text-secondary font-mono">
                  {formatMetric(value, unit)}
                </td>
                <td className="py-2 px-3 text-right">
                  <span
                    className="inline-block w-2 h-2 rounded-full mr-2"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-xs text-resonance-text-secondary capitalize">{severity?.severity || 'low'}</span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

const JsonTree = ({ data, level = 0 }) => {
  const [isOpen, setIsOpen] = useState(level < 2)

  if (data === null) return <span className="text-resonance-text-muted">null</span>
  if (data === undefined) return <span className="text-resonance-text-muted">undefined</span>

  const type = typeof data
  if (type !== 'object') {
    let colorClass = 'text-amber-400'
    if (type === 'string') colorClass = 'text-green-400'
    if (type === 'boolean') colorClass = 'text-purple-400'
    return <span className={colorClass}>{JSON.stringify(data)}</span>
  }

  const isArray = Array.isArray(data)
  const keys = Object.keys(data)
  if (keys.length === 0) {
    return <span className="text-resonance-text-muted">{isArray ? '[]' : '{}'}</span>
  }

  return (
    <div>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 text-resonance-text-secondary hover:text-resonance-text-primary transition-colors"
      >
        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span className="text-resonance-text-muted">{isArray ? `[${keys.length}]` : `{${keys.length}}`}</span>
      </button>
      {isOpen && (
        <div className="pl-4 border-l border-resonance-border/30 mt-1 space-y-1">
          {keys.map((key) => (
            <div key={key} className="flex flex-wrap items-start gap-1">
              {!isArray && (
                <span className="text-resonance-text-secondary text-sm shrink-0">{key}:</span>
              )}
              <JsonTree data={data[key]} level={level + 1} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const SkeletonContent = () => (
  <div className="space-y-8 animate-pulse">
    {/* Score rings row */}
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex flex-col items-center gap-2">
          <div className="w-16 h-16 rounded-full bg-resonance-bg-tertiary" />
          <div className="w-16 h-3 bg-resonance-bg-tertiary rounded" />
          <div className="w-8 h-2 bg-resonance-bg-tertiary rounded" />
        </div>
      ))}
    </div>

    {/* Summary card */}
    <div className="space-y-3">
      <div className="h-4 w-32 bg-resonance-bg-tertiary rounded" />
      <div className="h-20 bg-resonance-bg-tertiary rounded-xl" />
      <div className="h-16 bg-resonance-bg-tertiary rounded-xl" />
    </div>

    {/* Metric cards */}
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-24 bg-resonance-bg-tertiary rounded-xl" />
      ))}
    </div>

    {/* Health score bar */}
    <div className="h-14 bg-resonance-bg-tertiary rounded-xl" />
  </div>
)

const SkeletonHeader = () => (
  <div className="flex flex-col lg:flex-row items-start lg:items-center gap-6 mb-8 animate-pulse">
    <div className="flex-1 space-y-3">
      <div className="h-7 w-48 bg-resonance-bg-tertiary rounded-lg" />
      <div className="h-4 w-64 bg-resonance-bg-tertiary rounded" />
    </div>
    <div className="flex items-center gap-4">
      <div className="text-right space-y-2">
        <div className="h-3 w-24 bg-resonance-bg-tertiary rounded ml-auto" />
        <div className="h-9 w-16 bg-resonance-bg-tertiary rounded-lg ml-auto" />
        <div className="h-3 w-32 bg-resonance-bg-tertiary rounded ml-auto" />
      </div>
      <div className="w-20 h-20 rounded-full bg-resonance-bg-tertiary" />
    </div>
  </div>
)

// ============================================================================
// TAB COMPONENTS
// ============================================================================

const OverviewTab = ({ report, scores }) => {
  const exec = report?.executiveSummary || {}
  const global = report?.performanceAnalysis?.globalMetrics || {}
  const healthScore = exec.performanceScore ?? calculateHealthScore(global)?.score ?? null
  const grade = exec.performanceScore != null ? getGradeFromScore(exec.performanceScore) : calculatePerformanceGrade(global)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-6">
        {SCORE_CATEGORIES.map(({ key, label }) => {
          const value = scores[key] ?? null
          const gradeInfo = getGradeFromScore(value)
          return (
            <div key={key} className="flex flex-col items-center">
              <ScoreRing value={value} color={gradeInfo.color} size={64} />
              <span className="text-xs text-resonance-text-secondary mt-2 uppercase tracking-wider">{label}</span>
              <span className="text-[10px] font-medium" style={{ color: gradeInfo.color }}>{gradeInfo.grade}</span>
            </div>
          )
        })}
      </div>

      <div className="bg-resonance-bg-secondary border border-resonance-border rounded-xl p-6">
        <h3 className="text-sm font-semibold text-resonance-text-primary mb-3 uppercase tracking-wider">Executive Summary</h3>
        {exec.summary ? (
          <p className="text-sm text-resonance-text-secondary mb-4 leading-relaxed">{exec.summary}</p>
        ) : (
          <EmptyState message="No summary available" />
        )}
        {exec.keyFinding && (
          <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 mb-3">
            <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-medium text-amber-500 uppercase mb-1">Key Finding</div>
              <p className="text-sm text-resonance-text-primary">{exec.keyFinding}</p>
            </div>
          </div>
        )}
        {exec.keyRecommendation && (
          <div className="flex items-start gap-3 p-3 rounded-lg bg-green-500/5 border border-green-500/20">
            <CheckCircle2 size={18} className="text-green-500 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-medium text-green-500 uppercase mb-1">Key Recommendation</div>
              <p className="text-sm text-resonance-text-primary">{exec.keyRecommendation}</p>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <MetricCard label="Total Requests" value={global.totalRequests} unit="count" icon={Activity} />
        <MetricCard label="Throughput" value={global.throughputRps} unit="rps" icon={Zap} />
        <MetricCard label="Avg Latency" value={global.avgLatencyMs} unit="ms" icon={Clock} />
        <MetricCard label="P99 Latency" value={global.p99LatencyMs} unit="ms" icon={Clock} />
        <MetricCard label="Error Rate" value={global.errorRate} unit="percent" icon={AlertTriangle} />
        <MetricCard label="Availability" value={global.availability} unit="percent" icon={Shield} />
      </div>

      <div className="flex items-center gap-4 bg-resonance-bg-secondary border border-resonance-border rounded-xl p-4">
        <div className="text-right shrink-0">
          <div className="text-xs text-resonance-text-secondary uppercase tracking-wider mb-1">Health Score</div>
          <div className="text-3xl font-bold" style={{ color: grade.color }}>{healthScore ?? '—'}</div>
          <div className="text-xs font-medium" style={{ color: grade.color }}>{grade.grade} — {grade.label}</div>
        </div>
        <div className="flex-1 h-3 bg-resonance-bg-tertiary rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-1000"
            style={{ width: `${healthScore ?? 0}%`, backgroundColor: grade.color }}
          />
        </div>
      </div>

      {(exec.scorePenaltyFromAssumptions || 0) > 0 && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Info size={18} className="text-amber-500 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-medium text-amber-500 uppercase mb-1">Score Adjustment</div>
              <p className="text-sm text-resonance-text-secondary">
                Overall score reduced by <strong>{exec.scorePenaltyFromAssumptions} points</strong> due to{' '}
                {exec.criticalAssumptionCount} critical and {exec.assumptionCount - exec.criticalAssumptionCount} medium assumptions.
                Complete configuration data for higher confidence.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const TopologyTab = ({ report }) => {
  const topo = report?.topologyAnalysis
  if (!topo) return <EmptyState message="No topology analysis available" />

  const stats = [
    { label: 'Nodes', value: topo.nodeCount },
    { label: 'Edges', value: topo.edgeCount },
    { label: 'Avg Fan-Out', value: topo.avgFanOut },
    { label: 'Max Fan-Out', value: topo.maxFanOut },
    { label: 'Avg Fan-In', value: topo.avgFanIn },
    { label: 'Max Fan-In', value: topo.maxFanIn },
    { label: 'Complexity', value: topo.cyclomaticComplexity },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {stats.map((s, i) => (
          <div key={i} className="bg-resonance-bg-secondary border border-resonance-border rounded-lg p-3 text-center">
            <div className="text-xs text-resonance-text-secondary mb-1">{s.label}</div>
            <div className="text-xl font-bold text-resonance-text-primary">{s.value ?? '—'}</div>
          </div>
        ))}
      </div>

      {topo.graphStructureSummary && (
        <div className="bg-resonance-bg-secondary border border-resonance-border rounded-lg p-4">
          <p className="text-sm text-resonance-text-secondary">{topo.graphStructureSummary}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {topo.criticalErrors && topo.criticalErrors.length > 0 && (
          <SectionCard title={`Critical Errors (${topo.criticalErrors.length})`} icon={XCircle}>
            <div className="space-y-2">
              {topo.criticalErrors.map((f, i) => (
                <div key={i} className="text-sm text-resonance-text-primary flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 shrink-0" />
                  {f.message}
                </div>
              ))}
            </div>
          </SectionCard>
        )}
        {topo.warnings && topo.warnings.length > 0 && (
          <SectionCard title={`Warnings (${topo.warnings.length})`} icon={AlertCircle}>
            <div className="space-y-2">
              {topo.warnings.map((f, i) => (
                <div key={i} className="text-sm text-resonance-text-primary flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                  {f.message}
                </div>
              ))}
            </div>
          </SectionCard>
        )}
        {topo.risks && topo.risks.length > 0 && (
          <SectionCard title={`Risks (${topo.risks.length})`} icon={ShieldAlert}>
            <div className="space-y-2">
              {topo.risks.map((f, i) => (
                <div key={i} className="text-sm text-resonance-text-primary flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-1.5 shrink-0" />
                  {f.message}
                </div>
              ))}
            </div>
          </SectionCard>
        )}
      </div>

      {(!topo.criticalErrors?.length && !topo.warnings?.length && !topo.risks?.length) && (
        <EmptyState message="No topology findings" />
      )}
    </div>
  )
}

const PerformanceTab = ({ report }) => {
  const perf = report?.performanceAnalysis
  if (!perf) return <EmptyState message="No performance analysis available" />

  const global = perf.globalMetrics || {}
  const health = calculateHealthScore(global)
  const percentiles = perf.endToEndLatency?.percentiles
    ? Object.entries(perf.endToEndLatency.percentiles).map(([k, v]) => ({ percentile: k.toUpperCase(), value: v }))
    : preparePercentiles(
        perf.topLatencyBlocks?.reduce((acc, b) => ({ ...acc, [b.blockId]: b.metrics }), {}),
        perf.globalMetrics
      )

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <MetricCard label="Total Requests" value={global.totalRequests} unit="count" icon={Activity} />
        <MetricCard label="Throughput" value={global.throughputRps} unit="rps" icon={Zap} />
        <MetricCard label="Avg Latency" value={global.avgLatencyMs} unit="ms" icon={Clock} />
        <MetricCard label="Error Rate" value={global.errorRate} unit="percent" icon={AlertTriangle} />
        <MetricCard label="Availability" value={global.availability} unit="percent" icon={Shield} />
        <MetricCard label="Health Score" value={health.score} unit="count" icon={CheckCircle2} />
      </div>

      <SectionCard title="Latency Percentiles" icon={Clock}>
        <PercentileChart percentiles={percentiles} />
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {perf.topLatencyBlocks && perf.topLatencyBlocks.length > 0 && (
          <SectionCard title="Top Latency Blocks" icon={Clock}>
            <BottleneckTable items={perf.topLatencyBlocks} metricKey="avgLatencyMs" label="Latency" />
          </SectionCard>
        )}
        {perf.topErrorBlocks && perf.topErrorBlocks.length > 0 && (
          <SectionCard title="Top Error Blocks" icon={AlertTriangle}>
            <BottleneckTable items={perf.topErrorBlocks} metricKey="errorRate" label="Error Rate" />
          </SectionCard>
        )}
        {perf.topUtilizationBlocks && perf.topUtilizationBlocks.length > 0 && (
          <SectionCard title="Top Utilization Blocks" icon={Cpu}>
            <BottleneckTable items={perf.topUtilizationBlocks} metricKey="utilization" label="Utilization" />
          </SectionCard>
        )}
        {perf.topCostBlocks && perf.topCostBlocks.length > 0 && (
          <SectionCard title="Top Cost Blocks" icon={DollarSign}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-resonance-border">
                    <th className="text-left py-2 px-3 text-xs text-resonance-text-secondary font-medium uppercase">Block</th>
                    <th className="text-right py-2 px-3 text-xs text-resonance-text-secondary font-medium uppercase">Monthly Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {perf.topCostBlocks.map((item, i) => (
                    <tr key={item.blockId + i} className="border-b border-resonance-border/50 hover:bg-resonance-bg-hover/50">
                      <td className="py-2 px-3 text-resonance-text-primary font-medium">{item.label || item.blockId}</td>
                      <td className="py-2 px-3 text-right text-resonance-text-secondary font-mono">
                        {formatMetric(item.metrics?.cost?.total, 'cost')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {perf.latencyBottleneck && (
          <div className="bg-resonance-bg-secondary border border-resonance-border rounded-lg p-4">
            <div className="text-xs text-resonance-text-secondary uppercase mb-1">Latency Bottleneck</div>
            <div className="text-lg font-bold text-resonance-text-primary">{perf.latencyBottleneck}</div>
          </div>
        )}
        {perf.throughputBottleneck && (
          <div className="bg-resonance-bg-secondary border border-resonance-border rounded-lg p-4">
            <div className="text-xs text-resonance-text-secondary uppercase mb-1">Throughput Bottleneck</div>
            <div className="text-lg font-bold text-resonance-text-primary">{perf.throughputBottleneck}</div>
          </div>
        )}
        {perf.costBottleneck && (
          <div className="bg-resonance-bg-secondary border border-resonance-border rounded-lg p-4">
            <div className="text-xs text-resonance-text-secondary uppercase mb-1">Cost Bottleneck</div>
            <div className="text-lg font-bold text-resonance-text-primary">{perf.costBottleneck}</div>
          </div>
        )}
      </div>
    </div>
  )
}

const ReliabilityTab = ({ report }) => {
  const reliability = report?.reliabilityAnalysis
  if (!reliability) return <EmptyState message="No reliability analysis available" />

  const spoFs = reliability.singlePointsOfFailure || []
  const chains = reliability.failureChains || []
  const blastRadiuses = reliability.blastRadiuses || []
  const hasScore = reliability.reliabilityScore !== null && reliability.reliabilityScore !== undefined

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
        <ScoreRing
          value={hasScore ? Math.round(reliability.reliabilityScore) : null}
          label="Reliability Score"
          color={getGradeFromScore(hasScore ? reliability.reliabilityScore : null).color}
        />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1 w-full">
          <MetricCard label="Availability" value={reliability.availability} unit="percent" icon={Shield} />
          <MetricCard label="MTTR" value={reliability.mttrMinutes} unit="count" icon={Clock} />
          <MetricCard label="MTBF" value={reliability.mtbfHours} unit="count" icon={Activity} />
          <MetricCard label="Daily Failure Prob" value={reliability.failureProbabilityPerDay} unit="percent" icon={AlertTriangle} />
        </div>
      </div>

      {spoFs.length > 0 && (
        <SectionCard title="Single Points of Failure" icon={AlertTriangle}>
          <div className="flex flex-wrap gap-2">
            {spoFs.map((s, i) => {
              const id = typeof s === 'string' ? s : (s.blockId || s.id || 'unknown')
              return (
                <span key={i} className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 text-sm font-medium">
                  {id}
                </span>
              )
            })}
          </div>
        </SectionCard>
      )}

      {chains.length > 0 && (
        <SectionCard title="Failure Chains" icon={Network}>
          <div className="space-y-3">
            {chains.map((chain, i) => (
              <div key={i} className="bg-resonance-bg-tertiary border border-resonance-border rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-resonance-text-muted">Probability: {formatMetric(chain.probability, 'percent')}</span>
                  <span className="text-xs text-resonance-text-muted">Max Impact: {chain.maxImpact ?? '—'} requests</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {(chain.blockIds || []).map((bid, j) => (
                    <React.Fragment key={j}>
                      <span className="px-2 py-1 rounded bg-resonance-bg-secondary text-xs text-resonance-text-primary border border-resonance-border">
                        {bid}
                      </span>
                      {j < (chain.blockIds || []).length - 1 && <ChevronRight size={14} className="text-resonance-text-muted" />}
                    </React.Fragment>
                  ))}
                </div>
                {chain.description && <p className="text-xs text-resonance-text-secondary mt-2">{chain.description}</p>}
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {blastRadiuses.length > 0 && (
        <SectionCard title="Blast Radius" icon={Globe}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {blastRadiuses.map((br, i) => (
              <div key={i} className="bg-resonance-bg-tertiary border border-resonance-border rounded-lg p-3">
                <div className="text-sm font-semibold text-resonance-text-primary mb-2">{br.blockId}</div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-resonance-text-muted">Directly Affected</span>
                    <span className="text-resonance-text-primary">{br.directlyAffectedBlocks ?? '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-resonance-text-muted">Indirectly Affected</span>
                    <span className="text-resonance-text-primary">{br.indirectlyAffectedBlocks ?? '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-resonance-text-muted">Requests Affected</span>
                    <span className="text-resonance-text-primary">{formatMetric(br.estimatedRequestsAffected, 'count')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-resonance-text-muted">Availability Drop</span>
                    <span className="text-resonance-error">{formatMetric(br.estimatedAvailabilityImpact, 'percent')}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {report?.reliabilityAnalysis?.recommendations && (
        <SectionCard title="Recommendations" icon={CheckCircle2}>
          <ul className="space-y-2">
            {report.reliabilityAnalysis.recommendations
              .map(renderRecommendationText)
              .filter(Boolean)
              .map((rec, i) => (
                <li key={i} className="text-sm text-resonance-text-secondary flex items-start gap-2">
                  <ChevronRight size={14} className="mt-0.5 text-resonance-accent shrink-0" />
                  {rec}
                </li>
              ))}
          </ul>
        </SectionCard>
      )}
    </div>
  )
}

const ScalabilityTab = ({ report }) => {
  const scalability = report?.scalabilityAnalysis
  if (!scalability) return <EmptyState message="No scalability analysis available" />

  const saturation = scalability.saturationPoints || []
  const projections = scalability.growthProjections || []
  const bottlenecks = scalability.bottlenecks || []
  const hasScore = scalability.scalabilityScore !== null && scalability.scalabilityScore !== undefined

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <ScoreRing
          value={hasScore ? Math.round(scalability.scalabilityScore) : null}
          label="Scalability Score"
          color={getGradeFromScore(hasScore ? scalability.scalabilityScore : null).color}
        />
        <div className="flex flex-wrap gap-2">
          {scalability.supportsHorizontalScaling && (
            <span className="px-2 py-1 rounded-full text-xs bg-green-500/10 text-green-400 border border-green-500/20">Horizontal</span>
          )}
          {scalability.supportsVerticalScaling && (
            <span className="px-2 py-1 rounded-full text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20">Vertical</span>
          )}
          {scalability.supportsAutoScaling && (
            <span className="px-2 py-1 rounded-full text-xs bg-purple-500/10 text-purple-400 border border-purple-500/20">Auto</span>
          )}
        </div>
      </div>

      {saturation.length > 0 && (
        <SectionCard title="Saturation Points" icon={Activity}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-resonance-border">
                  <th className="text-left py-2 px-3 text-xs text-resonance-text-secondary font-medium uppercase">Block</th>
                  <th className="text-right py-2 px-3 text-xs text-resonance-text-secondary font-medium uppercase">RPS at Saturation</th>
                  <th className="text-left py-2 px-3 text-xs text-resonance-text-secondary font-medium uppercase">Resource</th>
                  <th className="text-right py-2 px-3 text-xs text-resonance-text-secondary font-medium uppercase">Headroom</th>
                </tr>
              </thead>
              <tbody>
                {saturation.map((s, i) => (
                  <tr key={i} className="border-b border-resonance-border/50 hover:bg-resonance-bg-hover/50">
                    <td className="py-2 px-3 text-resonance-text-primary font-medium">{s.blockId}</td>
                    <td className="py-2 px-3 text-right text-resonance-text-secondary font-mono">{formatMetric(s.rpsAtSaturation, 'rps')}</td>
                    <td className="py-2 px-3 text-resonance-text-secondary">{s.resource}</td>
                    <td className="py-2 px-3 text-right">
                      <span className={`font-mono ${(s.headroomPercent || 0) < 20 ? 'text-resonance-error' : 'text-resonance-success'}`}>
                        {Math.round(s.headroomPercent || 0)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {projections.length > 0 && (
        <SectionCard title="Growth Projections" icon={TrendingUp}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {projections.map((p, i) => (
              <div key={i} className={`bg-resonance-bg-tertiary border rounded-lg p-4 ${p.isSustainable ? 'border-green-500/30' : 'border-red-500/30'}`}>
                <div className="text-xs text-resonance-text-secondary mb-2">{p.trafficMultiplier}x Traffic</div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-resonance-text-muted">Latency</span>
                    <span className="text-resonance-text-primary font-mono">{formatMetric(p.predictedLatencyMs, 'ms')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-resonance-text-muted">Error Rate</span>
                    <span className="text-resonance-text-primary font-mono">{formatMetric(p.predictedErrorRate, 'percent')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-resonance-text-muted">Availability</span>
                    <span className="text-resonance-text-primary font-mono">{formatMetric(p.predictedAvailability, 'percent')}</span>
                  </div>
                </div>
                {!p.isSustainable && (
                  <div className="mt-2 text-xs text-resonance-error font-medium">Not sustainable</div>
                )}
                {p.predictedBottlenecks && p.predictedBottlenecks.length > 0 && (
  <div className="flex flex-wrap gap-1 mt-2">
    {p.predictedBottlenecks.map((b, j) => {
      const label = typeof b === 'string' ? b : (b.label || b.blockId || b.blockType || 'Unknown')
      return (
        <span key={j} className="text-[10px] px-1.5 py-0.5 rounded bg-resonance-bg-secondary text-resonance-text-muted">
          {label}
        </span>
      )
    })}
  </div>
)}
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {bottlenecks.length > 0 && (
        <SectionCard title="Scalability Bottlenecks" icon={AlertTriangle}>
          <div className="space-y-2">
            {bottlenecks.map((b, i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                <FindingBadge severity={b.severity} />
                <span className="text-resonance-text-primary">{b.message}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {report?.scalabilityAnalysis?.recommendations && (
        <SectionCard title="Recommendations" icon={CheckCircle2}>
          <ul className="space-y-2">
            {report.scalabilityAnalysis.recommendations
              .map(renderRecommendationText)
              .filter(Boolean)
              .map((rec, i) => (
                <li key={i} className="text-sm text-resonance-text-secondary flex items-start gap-2">
                  <ChevronRight size={14} className="mt-0.5 text-resonance-accent shrink-0" />
                  {rec}
                </li>
              ))}
          </ul>
        </SectionCard>
      )}
    </div>
  )
}

const CostTab = ({ report }) => {
  const cost = report?.costAnalysis
  if (!cost) return <EmptyState message="No cost analysis available" />

  const rawBreakdown = cost.breakdown
  const blockRows = Array.isArray(rawBreakdown) ? rawBreakdown : (rawBreakdown?.blocks || [])
  const edgeRows = Array.isArray(rawBreakdown) ? [] : (rawBreakdown?.edges || [])
  const edgeTotal = edgeRows.reduce((sum, e) => sum + (e.totalCost || 0), 0)

  const drivers = cost.drivers || []
  const growthCosts = cost.growthProjections || cost.growthCosts || []
  const recommendations = cost.recommendations || []
  const confidence = cost.confidence ?? null
  const assumptionNotes = cost.assumptions?.notes || []

  const dimCost = (row, dim) => {
    if (Array.isArray(row.breakdown)) {
      const found = row.breakdown.find(d => d.dimension === dim)
      if (found) return found.cost
    }
    return row[`${dim}Cost`] ?? null
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard label="Current Monthly" value={cost.currentMonthlyCost} unit="cost" icon={DollarSign} />
        <MetricCard label="Current Annual" value={cost.currentAnnualCost} unit="cost" icon={DollarSign} />
        <MetricCard label="Hourly Rate" value={cost.currentMonthlyCost != null ? cost.currentMonthlyCost / 730 : null} unit="cost" icon={Clock} />
      </div>

      {confidence != null && (
        <div className={`flex items-start gap-3 rounded-xl p-4 border ${
          confidence < 0.5
            ? 'bg-amber-500/5 border-amber-500/20'
            : 'bg-resonance-bg-secondary border-resonance-border'
        }`}>
          <Info size={16} className={`shrink-0 mt-0.5 ${confidence < 0.5 ? 'text-amber-500' : 'text-resonance-text-muted'}`} />
          <p className="text-xs text-resonance-text-secondary">
            Cost estimate confidence: <strong>{Math.round(confidence * 100)}%</strong>
            {confidence < 0.5 && ' — pricing data is missing for some components; actual costs may be higher than shown.'}
          </p>
        </div>
      )}

      {blockRows.length > 0 && (
        <SectionCard title="Cost Breakdown" icon={Server}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-resonance-border">
                  <th className="text-left py-2 px-3 text-xs text-resonance-text-secondary font-medium uppercase">Block</th>
                  <th className="text-right py-2 px-3 text-xs text-resonance-text-secondary font-medium uppercase">Compute</th>
                  <th className="text-right py-2 px-3 text-xs text-resonance-text-secondary font-medium uppercase">Requests</th>
                  <th className="text-right py-2 px-3 text-xs text-resonance-text-secondary font-medium uppercase">Network</th>
                  <th className="text-right py-2 px-3 text-xs text-resonance-text-secondary font-medium uppercase">Storage</th>
                  <th className="text-right py-2 px-3 text-xs text-resonance-text-secondary font-medium uppercase">Total</th>
                </tr>
              </thead>
              <tbody>
                {blockRows.map((b, i) => (
                  <tr key={b.blockId || i} className="border-b border-resonance-border/50 hover:bg-resonance-bg-hover/50">
                    <td className="py-2 px-3 text-resonance-text-primary font-medium">{b.label || b.blockId}</td>
                    <td className="py-2 px-3 text-right text-resonance-text-secondary font-mono">{formatMetric(dimCost(b, 'compute'), 'cost')}</td>
                    <td className="py-2 px-3 text-right text-resonance-text-secondary font-mono">{formatMetric(dimCost(b, 'request'), 'cost')}</td>
                    <td className="py-2 px-3 text-right text-resonance-text-secondary font-mono">{formatMetric(dimCost(b, 'network'), 'cost')}</td>
                    <td className="py-2 px-3 text-right text-resonance-text-secondary font-mono">{formatMetric(dimCost(b, 'storage'), 'cost')}</td>
                    <td className="py-2 px-3 text-right text-resonance-text-primary font-mono font-medium">{formatMetric(b.totalCost, 'cost')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {edgeRows.length > 0 && (
            <p className="text-xs text-resonance-text-muted mt-3">
              Data transfer across {edgeRows.length} connection(s): {formatMetric(edgeTotal, 'cost')}/month
            </p>
          )}
        </SectionCard>
      )}

      {drivers.length > 0 && (
        <SectionCard title="Cost Drivers" icon={TrendingUp}>
          <div className="space-y-3">
            {drivers.map((d, i) => (
              <div key={d.componentId || i} className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-resonance-text-primary">{d.label || d.componentId}{d.resourceType ? ` · ${d.resourceType}` : ''}</span>
                    <span className="text-sm text-resonance-text-secondary font-mono">{formatMetric(d.cost, 'cost')} ({Math.round(d.percentageOfTotal)}%)</span>
                  </div>
                  <div className="h-2 bg-resonance-bg-tertiary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-resonance-accent rounded-full"
                      style={{ width: `${Math.min(d.percentageOfTotal, 100)}%` }}
                    />
                  </div>
                </div>
                {d.recommendation && (
                  <span className="text-xs text-resonance-text-muted max-w-[200px]">{d.recommendation}</span>
                )}
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {growthCosts.length > 0 && (
        <SectionCard title="Growth Cost Projections" icon={TrendingUp}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {growthCosts.map((g, i) => (
              <div key={i} className="bg-resonance-bg-tertiary border border-resonance-border rounded-lg p-3 text-center">
                <div className="text-xs text-resonance-text-secondary mb-1">{g.trafficMultiplier}x Traffic</div>
                <div className="text-lg font-bold text-resonance-text-primary">{formatMetric(g.projectedMonthlyCost ?? g.cost, 'cost')}</div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {recommendations.length > 0 && (
        <SectionCard title="Recommendations" icon={CheckCircle2}>
          <div className="space-y-3">
            {recommendations.map((rec, i) => {
              if (typeof rec === 'string') {
                return (
                  <div key={i} className="text-sm text-resonance-text-secondary flex items-start gap-2">
                    <ChevronRight size={14} className="mt-0.5 text-resonance-accent shrink-0" />
                    {rec}
                  </div>
                )
              }
              return (
                <div key={i} className="bg-resonance-bg-tertiary border border-resonance-border rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    {rec.priority && (
                      <span className={`px-2 py-0.5 rounded text-[10px] font-medium uppercase ${
                        rec.priority === 'high' ? 'bg-orange-500/10 text-orange-400' :
                        rec.priority === 'medium' ? 'bg-amber-500/10 text-amber-400' :
                        'bg-blue-500/10 text-blue-400'
                      }`}>
                        {rec.priority}
                      </span>
                    )}
                    <span className="text-sm font-medium text-resonance-text-primary">{rec.title}</span>
                    {rec.estimatedSavings > 0 && (
                      <span className="text-xs text-resonance-success ml-auto">~{formatMetric(rec.estimatedSavings, 'cost')}/mo</span>
                    )}
                  </div>
                  {rec.description && (
                    <p className="text-xs text-resonance-text-secondary">{rec.description}</p>
                  )}
                </div>
              )
            })}
          </div>
        </SectionCard>
      )}

      {assumptionNotes.length > 0 && (
        <SectionCard title="Cost Assumptions" icon={Info}>
          <ul className="space-y-1.5">
            {assumptionNotes.map((note, i) => (
              <li key={i} className="text-xs text-resonance-text-muted flex items-start gap-2">
                <ChevronRight size={12} className="mt-0.5 shrink-0" />
                {note}
              </li>
            ))}
          </ul>
        </SectionCard>
      )}
    </div>
  )
}

const SecurityTab = ({ report }) => {
  const security = report?.securityAnalysis
  if (!security) return <EmptyState message="No security analysis available" />

  const bySeverity = security.bySeverity || {}
  const findings = (security.findings && security.findings.length > 0)
    ? security.findings
    : ['critical', 'high', 'medium', 'low'].flatMap(sev =>
        (bySeverity[sev] || []).map(f => ({ ...f, severity: f.severity || sev }))
      )

  const counts = {
    critical: security.criticalCount ?? findings.filter(f => f.severity === 'critical').length,
    high: security.highCount ?? findings.filter(f => f.severity === 'high').length,
    medium: security.mediumCount ?? findings.filter(f => f.severity === 'medium').length,
    low: security.lowCount ?? findings.filter(f => f.severity === 'low').length,
  }
  const hasScore = security.securityScore !== null && security.securityScore !== undefined

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
        <ScoreRing
          value={hasScore ? Math.round(security.securityScore) : null}
          label="Security Score"
          color={getGradeFromScore(hasScore ? security.securityScore : null).color}
        />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1 w-full">
          {Object.entries(counts).map(([severity, count]) => (
            <div key={severity} className="bg-resonance-bg-secondary border border-resonance-border rounded-lg p-3 text-center">
              <div className="text-2xl font-bold" style={{ color: SEVERITY_COLORS[severity]?.bg || '#6b7280' }}>
                {count}
              </div>
              <div className="text-xs text-resonance-text-secondary uppercase">{severity}</div>
            </div>
          ))}
        </div>
      </div>

      {findings.length > 0 ? (
        <div className="space-y-2">
          {findings.map((f, i) => (
            <div key={f.id || i} className="bg-resonance-bg-secondary border border-resonance-border rounded-lg p-4">
              <div className="flex items-start justify-between gap-4 mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <FindingBadge severity={f.severity} />
                  <span className="text-xs text-resonance-text-muted uppercase">{f.type}</span>
                </div>
              </div>
              <p className="text-sm text-resonance-text-primary mb-1">{f.message}</p>
              {f.recommendation && (
                <p className="text-xs text-resonance-text-secondary mt-2 pt-2 border-t border-resonance-border/50">
                  <span className="font-medium">Recommendation: </span>{f.recommendation}
                </p>
              )}
              {(f.affectedDataFlows || []).length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {f.affectedDataFlows.map((flow, j) => (
                    <span key={j} className="text-[10px] px-1.5 py-0.5 rounded bg-resonance-bg-tertiary text-resonance-text-muted">{flow}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState message="No security findings" />
      )}

      {report?.securityAnalysis?.recommendations && (
        <SectionCard title="Recommendations" icon={CheckCircle2}>
          <ul className="space-y-2">
            {report.securityAnalysis.recommendations
              .map(renderRecommendationText)
              .filter(Boolean)
              .map((rec, i) => (
                <li key={i} className="text-sm text-resonance-text-secondary flex items-start gap-2">
                  <ChevronRight size={14} className="mt-0.5 text-resonance-accent shrink-0" />
                  {rec}
                </li>
              ))}
          </ul>
        </SectionCard>
      )}
    </div>
  )
}

const FailureScenariosTab = ({ report }) => {
  const raw = report?.failureScenarios
  // Handle both: array directly OR { results: [...] } from report builder
  const events = Array.isArray(raw) ? raw : (raw?.results || [])
  if (!events || events.length === 0) return <EmptyState message="No failure scenarios analyzed" />

  return (
    <div className="space-y-6">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-resonance-border">
              <th className="text-left py-2 px-3 text-xs text-resonance-text-secondary font-medium uppercase">Type</th>
              <th className="text-left py-2 px-3 text-xs text-resonance-text-secondary font-medium uppercase">Target</th>
              <th className="text-right py-2 px-3 text-xs text-resonance-text-secondary font-medium uppercase">Severity</th>
              <th className="text-right py-2 px-3 text-xs text-resonance-text-secondary font-medium uppercase">Requests Affected</th>
              <th className="text-right py-2 px-3 text-xs text-resonance-text-secondary font-medium uppercase">Duration</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e, i) => (
              <tr key={i} className="border-b border-resonance-border/50 hover:bg-resonance-bg-hover/50">
                <td className="py-2 px-3 text-resonance-text-primary font-medium">{e.type || 'Unknown'}</td>
                <td className="py-2 px-3 text-resonance-text-secondary">{e.blockId || e.edgeId || 'System-wide'}</td>
                <td className="py-2 px-3 text-right">
                  <span className={`font-mono ${(e.severity || 0) > 0.5 ? 'text-resonance-error' : 'text-resonance-text-secondary'}`}>
                    {formatMetric(e.severity || 0, 'percent')}
                  </span>
                </td>
                <td className="py-2 px-3 text-right font-mono text-resonance-text-secondary">
                  {e.requestsAffected?.toLocaleString() || '—'}
                </td>
                <td className="py-2 px-3 text-right font-mono text-resonance-text-secondary">
                  {e.endTime && e.startTime ? `${(e.endTime - e.startTime).toFixed(1)}s` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const AIInsightsTab = ({ report }) => {
  const insights = report?.aiInsights
  if (!insights) return <EmptyState message="No AI insights generated" />

  const allInsights = (insights.insights || []).map((insight) => ({
    ...insight,
    type: insight.recommendedAction ? 'recommendation' : 'finding',
  }))

  if (allInsights.length === 0) return <EmptyState message="No AI insights" />

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs text-resonance-text-muted mb-4">
        <Brain size={14} />
        <span>Model: {insights.modelVersion || 'Unknown'}</span>
        <span>·</span>
        <span>{insights.generatedAt ? new Date(insights.generatedAt).toLocaleString() : ''}</span>
      </div>

      {insights.fallback && (
        <div className="flex items-start gap-3 rounded-xl p-4 bg-amber-500/5 border border-amber-500/20">
          <Info size={16} className="text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs text-resonance-text-secondary">
            AI narrative generation was unavailable — the insights below are derived directly from engine data.
          </p>
        </div>
      )}

      {allInsights.map((insight, i) => (
        <div key={insight.id || i} className="bg-resonance-bg-secondary border border-resonance-border rounded-lg p-4">
          <div className="flex items-start justify-between gap-4 mb-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-2 py-0.5 rounded text-[10px] font-medium uppercase ${
                insight.priority === 'critical' ? 'bg-red-500/10 text-red-400' :
                insight.priority === 'high' ? 'bg-orange-500/10 text-orange-400' :
                insight.priority === 'medium' ? 'bg-amber-500/10 text-amber-400' :
                'bg-blue-500/10 text-blue-400'
              }`}>
                {insight.priority}
              </span>
              <span className="text-[10px] text-resonance-text-muted uppercase">{insight.category}</span>
              {insight.confidence != null && (
                <span className="text-[10px] text-resonance-text-muted">
                  {Math.round(insight.confidence * 100)}% confidence
                </span>
              )}
            </div>
          </div>
          <h4 className="text-sm font-semibold text-resonance-text-primary mb-1">{insight.title}</h4>
          <p className="text-sm text-resonance-text-secondary mb-2">{insight.description}</p>
          {insight.evidence && (
            <div className="text-xs text-resonance-text-muted mb-2">
              <span className="font-medium">Evidence: </span>{insight.evidence}
            </div>
          )}
          {insight.evidenceRefs && insight.evidenceRefs.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {insight.evidenceRefs.map((ref, j) => (
                <span key={j} className="text-[10px] px-1.5 py-0.5 rounded bg-resonance-bg-tertiary text-resonance-text-muted font-mono">{ref}</span>
              ))}
            </div>
          )}
          {insight.supportingEvidence && insight.supportingEvidence.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {insight.supportingEvidence.map((ev, j) => (
                <span key={j} className="text-[10px] px-1.5 py-0.5 rounded bg-resonance-bg-tertiary text-resonance-text-muted font-mono">
                  {typeof ev === 'string'
                    ? ev
                    : `${ev.path}${ev.value !== undefined ? ` = ${typeof ev.value === 'object' ? JSON.stringify(ev.value) : ev.value}` : ''}`}
                </span>
              ))}
            </div>
          )}
          {insight.recommendedAction && (
            <div className="mt-2 pt-2 border-t border-resonance-border/50 text-xs text-resonance-accent">
              <span className="font-medium">Recommended: </span>{insight.recommendedAction}
            </div>
          )}
          {insight.predictedImpact != null && typeof insight.predictedImpact === 'object' && (
            <div className="mt-1 text-xs text-resonance-success">
              Predicted impact: {insight.predictedImpact.metric}{' '}
              {insight.predictedImpact.before} → {insight.predictedImpact.after} {insight.predictedImpact.unit}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

const ActionPlanTab = ({ report }) => {
  const plan = report?.actionPlan
  if (!plan) return <EmptyState message="No action plan generated" />

  const priorities = [
    { key: 'critical', label: 'Critical', items: plan.critical || [] },
    { key: 'high', label: 'High', items: plan.high || [] },
    { key: 'medium', label: 'Medium', items: plan.medium || [] },
    { key: 'low', label: 'Low', items: plan.low || [] },
  ]

  return (
    <div className="space-y-6">
      {plan.summary && (
        <div className="bg-resonance-bg-tertiary border border-resonance-border rounded-lg p-4 text-sm text-resonance-text-secondary">
          {plan.summary}
        </div>
      )}
      {priorities.map(({ key, label, items }) =>
        items.length > 0 ? (
          <div key={key}>
            <h4 className="text-sm font-semibold text-resonance-text-primary mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: SEVERITY_COLORS[key]?.bg || '#6b7280' }} />
              {label} ({items.length})
            </h4>
            <div className="space-y-2">
              {items.map((item, i) => (
                <div key={item.id || i} className="bg-resonance-bg-secondary border border-resonance-border rounded-lg p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h5 className="text-sm font-semibold text-resonance-text-primary mb-1">{item.title}</h5>
                      <p className="text-sm text-resonance-text-secondary mb-2">{item.description}</p>
                      {item.rationale && (
                        <p className="text-xs text-resonance-text-muted italic">{item.rationale}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 text-xs text-resonance-text-muted shrink-0">
                      {item.estimatedEffort != null && <span>~{item.estimatedEffort}h</span>}
                      {item.estimatedImpact != null && (
                        <span className="text-resonance-success">+{item.estimatedImpact} pts</span>
                      )}
                    </div>
                  </div>
                  {item.supportingEvidence && item.supportingEvidence.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-resonance-border/50 flex flex-wrap gap-1">
                      {item.supportingEvidence.map((ev, j) => (
                        <span key={j} className="text-[10px] px-1.5 py-0.5 rounded bg-resonance-bg-tertiary text-resonance-text-muted">{ev}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : null
      )}
      {priorities.every(p => p.items.length === 0) && <EmptyState message="No action items" />}
    </div>
  )
}

const RawDataTab = ({ report }) => {
  if (!report) return <EmptyState message="No report data" />

  return (
    <div className="bg-resonance-bg-secondary border border-resonance-border rounded-xl p-4 overflow-x-auto">
      <div className="text-xs text-resonance-text-muted mb-4 font-mono">
        {report.id || 'unknown-report-id'}
      </div>
      <JsonTree data={report} />
    </div>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const SimulationReportModal = ({ isOpen, onClose, report, isLoading = false }) => {
  const [activeTab, setActiveTab] = useState('overview')
  const [animatedScores, setAnimatedScores] = useState({})
  const [copiedJson, setCopiedJson] = useState(false)

  // Batch 5 (E2): ref to track activeTab without re-registering keyboard listener
  const activeTabRef = useRef(activeTab)
  useEffect(() => { activeTabRef.current = activeTab }, [activeTab])

  // DEFENSE: Normalize stringified JSON fields so legacy/corrupted records render correctly.
  // This is idempotent — objects pass through unchanged, strings are parsed.
  const normalizedReport = useMemo(() => {
    if (!report) return null
    const parse = (val) => {
      if (typeof val === 'string') {
        try { return JSON.parse(val) } catch { return null }
      }
      return val
    }
    return {
      ...report,
      executiveSummary: parse(report.executiveSummary),
      topologyAnalysis: parse(report.topologyAnalysis),
      reliabilityAnalysis: parse(report.reliabilityAnalysis),
      actionPlan: parse(report.actionPlan),
      performanceAnalysis: parse(report.performanceAnalysis),
      scalabilityAnalysis: parse(report.scalabilityAnalysis),
      costAnalysis: parse(report.costAnalysis),
      securityAnalysis: parse(report.securityAnalysis),
      aiInsights: parse(report.aiInsights),
      failureScenarios: parse(report.failureScenarios),
      metadata: parse(report.metadata),
    }
  }, [report])

  // Animate scores on open
  useEffect(() => {
    if (!isOpen || !report || isLoading) return
    const targetScores = {
      overall: report.overallScore ?? null,
      dataCompleteness: report.dataCompletenessScore ?? report.architectureScore ?? null,
      reliability: report.reliabilityScore ?? null,
      performance: report.performanceScore ?? null,
      cost: report.costScore ?? null,
      security: report.securityScore ?? null,
      confidence: report.confidenceScore ?? null,
    }

    let start = null
    const duration = 1000
    const animate = (timestamp) => {
      if (!start) start = timestamp
      const progress = Math.min((timestamp - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = {}
      for (const [key, val] of Object.entries(targetScores)) {
        current[key] = val == null ? null : Math.round(val * eased)
      }
      setAnimatedScores(current)
      if (progress < 1) requestAnimationFrame(animate)
    }
    requestAnimationFrame(animate)
  }, [isOpen, report, isLoading])

  // Keyboard navigation (arrow keys)
  // Batch 5 (E2): removed activeTab from deps — uses ref instead
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e) => {
      const tabIds = TABS.map(t => t.id)
      const idx = tabIds.indexOf(activeTabRef.current)
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        setActiveTab(tabIds[(idx + 1) % tabIds.length])
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setActiveTab(tabIds[(idx - 1 + tabIds.length) % tabIds.length])
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  // Batch 5 (E1): Clipboard size guard before writeText
  const handleCopyJson = useCallback(() => {
    if (!report) return
    const jsonString = JSON.stringify(report, null, 2)
    if (jsonString.length > 5_000_000) {
      alert('Report is too large to copy. Use download instead.')
      return
    }
    navigator.clipboard.writeText(jsonString)
    setCopiedJson(true)
    setTimeout(() => setCopiedJson(false), 2000)
  }, [report])

  // Batch 5 (E3): useMemo dep is report?.overallScore, not the whole report object
  const overallGrade = useMemo(() => {
    if (!report || report.overallScore == null) return getGradeFromScore(null)
    return getGradeFromScore(report.overallScore)
  }, [report?.overallScore])

  const footer = (
    <div className="flex items-center justify-between w-full report-footer">
      <div className="flex items-center gap-3">
        {!isLoading && normalizedReport?.metadata?.engineVersion && (
          <span className="text-xs text-resonance-text-muted font-mono">
            v{normalizedReport.metadata.engineVersion}
          </span>
        )}
        {!isLoading && normalizedReport?.version && (
          <span className="text-xs text-resonance-text-muted font-mono">
            Report {normalizedReport.version}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {!isLoading && (
          <Button
            variant="ghost"
            size="sm"
            icon={copiedJson ? Check : Copy}
            onClick={handleCopyJson}
          >
            {copiedJson ? 'Copied' : 'Copy JSON'}
          </Button>
        )}
        <Button variant="secondary" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  )

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="full" footer={footer}>
      {/* Batch 5 (E4): Print styles — only active tab prints */}
      <style>{`
        @media print {
          .report-tab-nav { display: none !important; }
          .report-footer { display: none !important; }
          .report-tab-content { display: none !important; }
          .report-tab-content.active { display: block !important; }
          .report-print-header { display: block !important; }
        }
      `}</style>

      {/* Print-only header */}
      <div className="hidden report-print-header mb-8">
        <h1 className="text-2xl font-bold text-resonance-text-primary">Simulation Report</h1>
        <p className="text-sm text-resonance-text-muted">
          {report?.generatedAt ? new Date(report.generatedAt).toLocaleString() : ''}
          {normalizedReport?.metadata?.engineVersion ? ` · Engine v${normalizedReport.metadata.engineVersion}` : ''}
        </p>
      </div>

      {/* Report Header */}
      {isLoading ? (
        <SkeletonHeader />
      ) : (
        <div className="flex flex-col lg:flex-row items-start lg:items-center gap-6 mb-8">
          <div className="flex-1">
            <h2 className="text-xl font-bold text-resonance-text-primary mb-1">Simulation Report</h2>
            <div className="flex items-center gap-3 text-sm text-resonance-text-muted flex-wrap">
              <span className="flex items-center gap-1">
                <Clock size={14} />
                {report?.generatedAt ? new Date(report.generatedAt).toLocaleString() : '—'}
              </span>
              {normalizedReport?.metadata?.engineVersion && (
                <span className="font-mono">v{normalizedReport.metadata.engineVersion}</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-xs text-resonance-text-secondary uppercase tracking-wider mb-1">Overall Score</div>
              <div className="text-3xl font-bold" style={{ color: overallGrade.color }}>
                {animatedScores.overall ?? '—'}
              </div>
              <div className="text-xs font-medium text-resonance-text-secondary">
                {overallGrade.grade} — {overallGrade.label}
              </div>
            </div>
            <ScoreRing
              value={animatedScores.overall ?? null}
              size={80}
              color={overallGrade.color}
            />
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className={`border-b border-resonance-border mb-6 report-tab-nav ${isLoading ? 'opacity-40 pointer-events-none' : ''}`}>
        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-resonance-accent/10 text-resonance-accent'
                    : 'text-resonance-text-secondary hover:text-resonance-text-primary hover:bg-resonance-bg-hover'
                }`}
                aria-selected={isActive}
                role="tab"
              >
                <Icon size={16} />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Tab Content */}
      {/* Batch 5 (E4): every tab pane has report-tab-content; active ones also have .active */}
      <div className="space-y-8">
        {isLoading ? (
          <SkeletonContent />
        ) : !report ? (
          <EmptyState message="No report data available" />
        ) : (
          <>
            <div className={activeTab === 'overview' ? 'report-tab-content active' : 'report-tab-content hidden'}>
              <OverviewTab report={normalizedReport} scores={animatedScores} />
            </div>
            <div className={activeTab === 'topology' ? 'report-tab-content active' : 'report-tab-content hidden'}>
              <TopologyTab report={normalizedReport} />
            </div>
            <div className={activeTab === 'performance' ? 'report-tab-content active' : 'report-tab-content hidden'}>
              <PerformanceTab report={normalizedReport} />
            </div>
            <div className={activeTab === 'reliability' ? 'report-tab-content active' : 'report-tab-content hidden'}>
              <ReliabilityTab report={normalizedReport} />
            </div>
            <div className={activeTab === 'scalability' ? 'report-tab-content active' : 'report-tab-content hidden'}>
              <ScalabilityTab report={normalizedReport} />
            </div>
            <div className={activeTab === 'cost' ? 'report-tab-content active' : 'report-tab-content hidden'}>
              <CostTab report={normalizedReport} />
            </div>
            <div className={activeTab === 'security' ? 'report-tab-content active' : 'report-tab-content hidden'}>
              <SecurityTab report={normalizedReport} />
            </div>
            <div className={activeTab === 'failure' ? 'report-tab-content active' : 'report-tab-content hidden'}>
              <FailureScenariosTab report={normalizedReport} />
            </div>
            <div className={activeTab === 'ai' ? 'report-tab-content active' : 'report-tab-content hidden'}>
              <AIInsightsTab report={normalizedReport} />
            </div>
            <div className={activeTab === 'action' ? 'report-tab-content active' : 'report-tab-content hidden'}>
              <ActionPlanTab report={normalizedReport} />
            </div>
            <div className={activeTab === 'raw' ? 'report-tab-content active' : 'report-tab-content hidden'}>
              <RawDataTab report={report} />
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}

export default SimulationReportModal