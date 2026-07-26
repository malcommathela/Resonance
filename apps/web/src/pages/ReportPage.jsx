import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  FileText,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  Clock,
  ChevronRight,
  Search,
  Filter,
  Download,
  Share2,
  ArrowLeft,
  Layers,
  Zap,
  Shield,
  DollarSign,
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
} from 'lucide-react'
import { useDesignStore } from '@/stores/designStore'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { ReportListSkeleton } from '@/components/ui/skeletons'

/* ───────────────────────────────────────────────
   NovaFlow Report Page
   Design tokens: primary #DCFC5C, neutral #000000
   Typography: Inter, 30px/600 headlines, 14px/400 body
   Spacing: 10px base, 12px gaps, 48px section padding
   Motion: 150ms ease, cubic-bezier(0.4, 0, 0.2, 1)
   ─────────────────────────────────────────────── */

// ─── Helpers ───────────────────────────────────

const formatDate = (iso) => {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

const formatTime = (iso) => {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

const getScoreColor = (score) => {
  if (score >= 80) return 'text-green-500'
  if (score >= 60) return 'text-amber-500'
  return 'text-red-500'
}

const getScoreBadgeVariant = (score) => {
  if (score >= 80) return 'success'
  if (score >= 60) return 'warning'
  return 'error'
}

const getTrendIcon = (trend) => {
  if (trend === 'up') return TrendingUp
  if (trend === 'down') return TrendingDown
  return Minus
}

const getTrendColor = (trend) => {
  if (trend === 'up') return 'text-green-500'
  if (trend === 'down') return 'text-red-500'
  return 'text-resonance-text-muted'
}

// ─── Gradient Border Shell (NovaFlow premium depth) ──

const GradientShell = ({ children, className = '' }) => (
  <div
    className={`p-[1px] rounded-xl ${className}`}
    style={{
      background:
        'linear-gradient(rgb(220, 252, 92) 0%, rgb(0, 98, 214) 55%, rgb(0, 0, 0) 90%)',
    }}
  >
    <div className="bg-resonance-bg-secondary rounded-[11px] overflow-hidden">
      {children}
    </div>
  </div>
)

// ─── Metric Card ───────────────────────────────

const MetricCard = ({ label, value, subtext, icon: Icon, trend, trendValue }) => {
  const TrendIcon = getTrendIcon(trend)
  return (
    <div className="bg-resonance-bg-secondary border border-resonance-border rounded-xl p-5 transition-all duration-150 hover:border-resonance-accent/30">
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs font-medium text-resonance-text-muted uppercase tracking-wider">
          {label}
        </span>
        {Icon && (
          <div className="w-8 h-8 rounded-lg bg-resonance-accent/10 flex items-center justify-center">
            <Icon size={16} className="text-resonance-accent" />
          </div>
        )}
      </div>
      <div className="text-2xl font-semibold text-resonance-text-primary tracking-tight">
        {value}
      </div>
      <div className="flex items-center gap-2 mt-1">
        {trend && (
          <span className={`flex items-center gap-0.5 text-xs font-medium ${getTrendColor(trend)}`}>
            <TrendIcon size={14} />
            {trendValue}
          </span>
        )}
        {subtext && (
          <span className="text-xs text-resonance-text-muted">{subtext}</span>
        )}
      </div>
    </div>
  )
}

// ─── Report List Item ──────────────────────────

const ReportListItem = ({ report, isSelected, onClick }) => {
  const score = report.overallScore ?? report.score ?? 0
  const designName = report.designName || report.design?.name || 'Untitled Design'
  const designAccent = report.design?.accentColor || '#6366f1'

  return (
    <button
      onClick={onClick}
      className={`w-full text-left grid grid-cols-[48px_1fr_auto_auto] items-center gap-4 px-6 py-4 border-b border-resonance-border last:border-0 transition-all duration-150 ${
        isSelected
          ? 'bg-resonance-accent/5'
          : 'hover:bg-resonance-bg-hover'
      }`}
    >
      {/* Score circle */}
      <div className="relative w-10 h-10 shrink-0">
        <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
          <circle
            cx="18"
            cy="18"
            r="15"
            fill="none"
            stroke="rgb(var(--border-color-rgb))"
            strokeWidth="3"
          />
          <circle
            cx="18"
            cy="18"
            r="15"
            fill="none"
            stroke={score >= 80 ? '#22c55e' : score >= 60 ? '#eab308' : '#ef4444'}
            strokeWidth="3"
            strokeDasharray={`${score * 0.94} 94`}
            strokeLinecap="round"
          />
        </svg>
        <span className={`absolute inset-0 flex items-center justify-center text-[10px] font-bold ${getScoreColor(score)}`}>
          {score}
        </span>
      </div>

      {/* Info */}
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <h3 className="font-semibold text-sm text-resonance-text-primary truncate">
            {report.name || `Report #${report.id?.slice(0, 8)}`}
          </h3>
          <Badge variant={getScoreBadgeVariant(score)}>
            {score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : 'Needs Work'}
          </Badge>
        </div>
        <p className="text-xs text-resonance-text-secondary truncate">
          {designName}
          {report.simulationType && (
            <span className="mx-1.5 text-resonance-text-muted">·</span>
          )}
          {report.simulationType}
        </p>
      </div>

      {/* Metrics preview — FIXED: read top-level score fields */}
      <div className="hidden sm:flex items-center gap-4 text-center">
        <div>
          <div className="text-xs font-semibold text-resonance-text-primary">
            {report.reliabilityScore ?? '—'}
          </div>
          <div className="text-[10px] text-resonance-text-muted uppercase tracking-wider">
            Reliability
          </div>
        </div>
        <div>
          <div className="text-xs font-semibold text-resonance-text-primary">
            {report.costScore ?? '—'}
          </div>
          <div className="text-[10px] text-resonance-text-muted uppercase tracking-wider">
            Cost
          </div>
        </div>
        <div>
          <div className="text-xs font-semibold text-resonance-text-primary">
            {report.securityScore ?? '—'}
          </div>
          <div className="text-[10px] text-resonance-text-muted uppercase tracking-wider">
            Security
          </div>
        </div>
        <div>
          <div className="text-xs font-semibold text-resonance-text-primary">
            {report.performanceScore ?? '—'}
          </div>
          <div className="text-[10px] text-resonance-text-muted uppercase tracking-wider">
            Perf
          </div>
        </div>
      </div>

      {/* Date */}
      <div className="text-xs text-resonance-text-muted shrink-0 text-right">
        <div className="flex items-center gap-1">
          <Calendar size={12} />
          {formatDate(report.createdAt)}
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          <Clock size={12} />
          {formatTime(report.createdAt)}
        </div>
      </div>
    </button>
  )
}

// ─── Report Detail Panel ───────────────────────

const ReportDetailPanel = ({ report, onBack }) => {
  if (!report) return null

  const score = report.overallScore ?? report.score ?? 0
  const designName = report.designName || report.design?.name || 'Untitled Design'

  // ── FIXED: Read scores from top-level report fields ──
  const metricItems = [
    { label: 'Reliability',     value: report.reliabilityScore,    icon: Shield,      max: 100 },
    { label: 'Cost Efficiency', value: report.costScore,           icon: DollarSign,  max: 100 },
    { label: 'Security',        value: report.securityScore,       icon: Activity,    max: 100 },
    { label: 'Performance',     value: report.performanceScore,    icon: Zap,         max: 100 },
    { label: 'Scalability',     value: report.scalabilityScore,    icon: TrendingUp,  max: 100 },
    { label: 'Explainability',  value: report.confidenceScore ?? report.architectureScore, icon: BarChart3, max: 100 },
  ]

  // Build recommendations from actionPlan
  const recommendations = report.actionPlan
    ? [
        ...(report.actionPlan.critical || []),
        ...(report.actionPlan.high || []),
        ...(report.actionPlan.medium || []),
        ...(report.actionPlan.low || []),
      ]
    : []

  // Build findings from aiInsights + structured analyses
  const findings = []
  if (report.aiInsights?.insights) {
    findings.push(...report.aiInsights.insights.map((i, idx) => ({
      id: i.id || `ai-${idx}`,
      title: i.title,
      description: i.description,
      severity: i.severity || 'info',
      details: i.recommendation,
      component: i.blockId,
    })))
  }
  if (report.reliabilityAnalysis?.singlePointsOfFailure?.length) {
    findings.push(...report.reliabilityAnalysis.singlePointsOfFailure.map((s, idx) => ({
      id: `spof-${idx}`,
      title: `Single point of failure: ${typeof s === 'string' ? s : s.blockId}`,
      severity: 'critical',
      details: typeof s === 'string' ? null : s.reason,
      component: typeof s === 'string' ? s : s.blockId,
    })))
  }
  if (report.scalabilityAnalysis?.bottlenecks?.length) {
    findings.push(...report.scalabilityAnalysis.bottlenecks
      .filter(b => b.severity === 'critical' || b.severity === 'high')
      .map((b, idx) => ({
        id: `bottleneck-${idx}`,
        title: `Bottleneck: ${b.label || b.blockId}`,
        severity: b.severity === 'critical' ? 'critical' : 'warning',
        details: b.message,
        component: b.blockId,
      })))
  }
  if (report.securityAnalysis?.bySeverity?.critical?.length) {
    findings.push(...report.securityAnalysis.bySeverity.critical.map((f, idx) => ({
      id: `sec-${idx}`,
      title: f.message,
      severity: 'critical',
      details: f.recommendation,
      component: f.blockId,
    })))
  }
  if (report.securityAnalysis?.bySeverity?.high?.length) {
    findings.push(...report.securityAnalysis.bySeverity.high.map((f, idx) => ({
      id: `sec-h-${idx}`,
      title: f.message,
      severity: 'warning',
      details: f.recommendation,
      component: f.blockId,
    })))
  }

  const getSeverityIcon = (severity) => {
    if (severity === 'critical' || severity === 'error') return XCircle
    if (severity === 'warning' || severity === 'warn') return AlertTriangle
    if (severity === 'info') return Info
    return CheckCircle2
  }

  const getSeverityColor = (severity) => {
    if (severity === 'critical' || severity === 'error') return 'text-red-500 bg-red-500/10 border-red-500/20'
    if (severity === 'warning' || severity === 'warn') return 'text-amber-500 bg-amber-500/10 border-amber-500/20'
    if (severity === 'info') return 'text-blue-500 bg-blue-500/10 border-blue-500/20'
    return 'text-green-500 bg-green-500/10 border-green-500/20'
  }

  return (
    <div className="h-full flex flex-col animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-resonance-border">
        <button
          onClick={onBack}
          className="p-2 rounded-lg hover:bg-resonance-bg-hover transition-all duration-150 text-resonance-text-secondary"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-resonance-text-primary truncate">
            {report.name || `Report #${report.id?.slice(0, 8)}`}
          </h2>
          <p className="text-xs text-resonance-text-secondary">{designName}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="ghost" size="sm" icon={Share2}>
            Share
          </Button>
          <Button variant="secondary" size="sm" icon={Download}>
            Export
          </Button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Overall Score — Gradient Shell */}
        <GradientShell>
          <div className="p-6">
            <div className="flex items-center gap-6">
              <div className="relative w-20 h-20 shrink-0">
                <svg className="w-20 h-20 -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="15" fill="none" stroke="rgb(var(--border-color-rgb))" strokeWidth="2.5" />
                  <circle
                    cx="18"
                    cy="18"
                    r="15"
                    fill="none"
                    stroke={score >= 80 ? '#22c55e' : score >= 60 ? '#eab308' : '#ef4444'}
                    strokeWidth="2.5"
                    strokeDasharray={`${score * 0.94} 94`}
                    strokeLinecap="round"
                  />
                </svg>
                <span className={`absolute inset-0 flex items-center justify-center text-xl font-bold ${getScoreColor(score)}`}>
                  {score}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-xl font-semibold text-resonance-text-primary">
                    Overall Score
                  </h3>
                  <Badge variant={getScoreBadgeVariant(score)}>
                    {score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : 'Needs Work'}
                  </Badge>
                </div>
                <p className="text-sm text-resonance-text-secondary">
                  {report.summary || 
                   `This simulation evaluated ${designName} across ${metricItems.length} key dimensions. ` +
                   (score >= 80 
                     ? 'The design shows strong architectural fundamentals with minimal risk exposure.'
                     : score >= 60
                     ? 'The design meets baseline requirements but has areas for improvement.'
                     : 'The design has significant issues that should be addressed before deployment.')}
                </p>
                <div className="flex items-center gap-4 mt-2 text-xs text-resonance-text-muted">
                  <span className="flex items-center gap-1">
                    <Calendar size={12} />
                    {formatDate(report.createdAt)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock size={12} />
                    {formatTime(report.createdAt)}
                  </span>
                  {report.duration && (
                    <span className="flex items-center gap-1">
                      <Zap size={12} />
                      {report.duration}s
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </GradientShell>

        {/* Metrics Grid — FIXED: null-aware rendering */}
        <div>
          <h3 className="text-sm font-semibold text-resonance-text-primary mb-3 uppercase tracking-wider">
            Key Metrics
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {metricItems.map((m) => (
              <MetricCard
                key={m.label}
                label={m.label}
                value={m.value != null ? `${m.value}%` : '—'}
                icon={m.icon}
                trend={m.value == null ? undefined : m.value >= 80 ? 'up' : m.value >= 60 ? undefined : 'down'}
                trendValue={m.value == null ? undefined : m.value >= 80 ? '+5%' : m.value < 60 ? '-8%' : undefined}
                subtext={m.value == null ? 'No data' : m.value >= 80 ? 'Above target' : m.value >= 60 ? 'Within range' : 'Below target'}
              />
            ))}
          </div>
        </div>

        {/* Findings */}
        {findings.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-resonance-text-primary mb-3 uppercase tracking-wider">
              Findings
            </h3>
            <div className="bg-resonance-bg-secondary border border-resonance-border rounded-xl overflow-hidden">
              {findings.map((finding) => {
                const SeverityIcon = getSeverityIcon(finding.severity)
                return (
                  <div
                    key={finding.id}
                    className="flex items-start gap-3 px-5 py-4 border-b border-resonance-border last:border-0"
                  >
                    <div className={`mt-0.5 p-1.5 rounded-lg ${getSeverityColor(finding.severity)}`}>
                      <SeverityIcon size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-medium text-sm text-resonance-text-primary">
                          {finding.title || finding.message || finding.description}
                        </span>
                        <Badge variant={
                          finding.severity === 'critical' || finding.severity === 'error' ? 'error' :
                          finding.severity === 'warning' ? 'warning' : 'default'
                        }>
                          {finding.severity}
                        </Badge>
                      </div>
                      {finding.details && (
                        <p className="text-xs text-resonance-text-secondary mt-1">
                          {finding.details}
                        </p>
                      )}
                      {finding.component && (
                        <p className="text-xs text-resonance-text-muted mt-1">
                          Component: {finding.component}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Recommendations */}
        {recommendations.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-resonance-text-primary mb-3 uppercase tracking-wider">
              Recommendations
            </h3>
            <div className="space-y-3">
              {recommendations.map((rec, i) => (
                <div
                  key={rec.id || i}
                  className="bg-resonance-bg-secondary border border-resonance-border rounded-xl p-5 flex items-start gap-3 transition-all duration-150 hover:border-resonance-accent/30"
                >
                  <div className="w-6 h-6 rounded-full bg-resonance-accent flex items-center justify-center text-[10px] font-bold text-resonance-neutral shrink-0 mt-0.5">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm text-resonance-text-primary mb-1">
                      {rec.title || rec.suggestion || rec}
                    </h4>
                    {rec.description && (
                      <p className="text-xs text-resonance-text-secondary leading-relaxed">
                        {rec.description}
                      </p>
                    )}
                    {rec.rationale && (
                      <p className="text-xs text-resonance-text-muted mt-1 italic">
                        {rec.rationale}
                      </p>
                    )}
                    {rec.estimatedImpact != null && (
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="accent">Impact: +{rec.estimatedImpact} pts</Badge>
                        {rec.estimatedEffort != null && (
                          <Badge variant="draft">Effort: {rec.estimatedEffort}h</Badge>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Raw Data Toggle */}
        {report.rawData && (
          <details className="group">
            <summary className="flex items-center gap-2 text-sm font-medium text-resonance-text-secondary cursor-pointer hover:text-resonance-text-primary transition-colors duration-150 select-none">
              <ChevronRight size={16} className="transition-transform duration-150 group-open:rotate-90" />
              Raw Simulation Data
            </summary>
            <pre className="mt-3 p-4 bg-resonance-bg-tertiary rounded-xl text-xs text-resonance-text-secondary overflow-auto max-h-96 border border-resonance-border">
              {JSON.stringify(report.rawData, null, 2)}
            </pre>
          </details>
        )}
      </div>
    </div>
  )
}

// ─── Main Report Page ────────────────────────────

export const ReportPage = () => {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = useState('all')

  const {
    reports,
    reportsLoading,
    reportsError,
    selectedReportId,
    currentReport,
    loadReports,
    selectReport,
    loadReport,
    designs,
    loadDesigns,
  } = useDesignStore()

  const selectedReport =
    currentReport ||
    reports.find((r) => r.id === selectedReportId || r.simulationId === selectedReportId)

  // Load all reports on mount
  useEffect(() => {
    if (designs.length === 0) {
      loadDesigns().then((designs) => {
        designs?.forEach((d) => loadReports(d.id))
      })
    } else {
      designs.forEach((d) => loadReports(d.id))
    }
  }, [])

  // Handle URL param for pre-selected report
  useEffect(() => {
  const reportId = searchParams.get('id')
  if (reportId) {
    selectReport(reportId)
    // The full report fetch needs simulationId. Try to find it in the list first.
    const report = reports.find((r) => r.id === reportId || r.simulationId === reportId)
    const simId = report?.simulationId || reportId
    loadReport(simId)
  }
}, [searchParams, reports])   // ← add reports to deps

  const handleSelectReport = useCallback(
  (report) => {
    const reportId = report.id || report.simulationId
    const simId = report.simulationId || report.id
    selectReport(reportId)
    loadReport(simId)        // ← API expects simulationId, not report id
    setSearchParams({ id: reportId })
  },
  [selectReport, loadReport, setSearchParams]
  )

  const handleBack = useCallback(() => {
    selectReport(null)
    setSearchParams({})
  }, [selectReport, setSearchParams])

  // Filter & search
  const filteredReports = reports.filter((r) => {
    const score = r.overallScore ?? r.score ?? 0
    const matchesSearch =
      !searchQuery ||
      (r.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.designName || r.design?.name || '').toLowerCase().includes(searchQuery.toLowerCase())

    const matchesFilter =
      filter === 'all' ||
      (filter === 'excellent' && score >= 80) ||
      (filter === 'good' && score >= 60 && score < 80) ||
      (filter === 'needs-work' && score < 60)

    return matchesSearch && matchesFilter
  })

  // Sort by date desc
  const sortedReports = [...filteredReports].sort(
    (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
  )

  return (
    <div className="h-full flex bg-resonance-bg-primary">
      {/* ─── List Panel ─── */}
      <div
        className={`flex flex-col border-r border-resonance-border bg-resonance-bg-secondary transition-all duration-300 ${
          selectedReport ? 'w-[420px] hidden lg:flex' : 'flex-1'
        }`}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-resonance-border">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-[30px] font-semibold text-resonance-text-primary tracking-tight leading-9">
                Reports
              </h1>
              <p className="text-sm text-resonance-text-secondary mt-1">
                Simulation results and analysis
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-resonance-accent flex items-center justify-center">
              <FileText size={20} className="text-resonance-neutral" />
            </div>
          </div>

          {/* Search & Filter */}
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-resonance-text-muted"
              />
              <input
                type="text"
                placeholder="Search reports..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-resonance-bg-primary border border-resonance-border rounded-xl text-sm text-resonance-text-primary placeholder-resonance-text-muted focus:outline-none focus:ring-2 focus:ring-resonance-accent/50 focus:border-resonance-accent transition-all duration-150"
              />
            </div>
            <div className="relative">
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="appearance-none pl-3 pr-8 py-2 bg-resonance-bg-primary border border-resonance-border rounded-xl text-sm text-resonance-text-primary focus:outline-none focus:ring-2 focus:ring-resonance-accent/50 focus:border-resonance-accent transition-all duration-150 cursor-pointer"
              >
                <option value="all">All</option>
                <option value="excellent">Excellent</option>
                <option value="good">Good</option>
                <option value="needs-work">Needs Work</option>
              </select>
              <Filter
                size={14}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-resonance-text-muted pointer-events-none"
              />
            </div>
          </div>
        </div>

        {/* Report List */}
        <div className="flex-1 overflow-auto">
          {reportsLoading && reports.length === 0 ? (
            <div className="p-4">
              <ReportListSkeleton />
            </div>
          ) : reportsError ? (
            <div className="flex flex-col items-center justify-center h-64 px-6">
              <AlertTriangle size={32} className="text-red-500 mb-3" />
              <p className="text-sm font-medium text-resonance-text-primary">Failed to load reports</p>
              <p className="text-xs text-resonance-text-secondary mt-1">{reportsError}</p>
              <Button
                variant="secondary"
                size="sm"
                className="mt-4"
                onClick={() => designs.forEach((d) => loadReports(d.id))}
              >
                Retry
              </Button>
            </div>
          ) : sortedReports.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 px-6">
              <FileText size={32} className="text-resonance-text-muted mb-3" />
              <p className="text-sm font-medium text-resonance-text-primary">No reports yet</p>
              <p className="text-xs text-resonance-text-secondary mt-1 text-center">
                Run a simulation from the canvas to generate your first report.
              </p>
              <Button
                variant="primary"
                size="sm"
                className="mt-4"
                onClick={() => navigate('/dashboard')}
              >
                Go to Dashboard
              </Button>
            </div>
          ) : (
            <div className="bg-resonance-bg-secondary border border-resonance-border rounded-xl overflow-hidden m-4">
              {sortedReports.map((report) => (
                <ReportListItem
                  key={report.id || report.simulationId}
                  report={report}
                  isSelected={
                    (report.id || report.simulationId) === selectedReportId
                  }
                  onClick={() => handleSelectReport(report)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer stats */}
        <div className="px-6 py-3 border-t border-resonance-border flex items-center justify-between text-xs text-resonance-text-muted">
          <span>
            {sortedReports.length} report{sortedReports.length !== 1 ? 's' : ''}
          </span>
          <span>
            {reports.filter((r) => (r.overallScore ?? r.score ?? 0) >= 80).length} excellent
          </span>
        </div>
      </div>

      {/* ─── Detail Panel ─── */}
      {selectedReport && (
        <div className="flex-1 bg-resonance-bg-primary min-w-0">
          <ReportDetailPanel report={selectedReport} onBack={handleBack} />
        </div>
      )}
    </div>
  )
}