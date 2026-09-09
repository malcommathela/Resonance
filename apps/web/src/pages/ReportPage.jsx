import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Download,
  FileText,
  Filter,
  Info,
  Search,
  Share2,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  XCircle,
  Zap,
} from 'lucide-react'
import { useDesignStore } from '@/stores/designStore'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { ReportListSkeleton } from '@/components/ui/skeletons'

/*
  NovaFlow Reports — redesign direction
  -------------------------------------
  Visual language: editorial analytics / calm technical instrument.
  Rules: one accent, semantic status colors, surface hierarchy, visible focus,
  no decorative gradients, no color-only meaning, compact but breathable density.
  Motion: 160ms ease-out for local state; transform/opacity only; reduced motion
  is handled globally by the app's motion utility/classes.
*/

const statusFor = (score = 0) => score >= 80 ? 'excellent' : score >= 60 ? 'good' : 'needs-work'
const statusLabel = (score = 0) => ({ excellent: 'Excellent', good: 'Good', 'needs-work': 'Needs work' })[statusFor(score)]
const scoreTone = (score = 0) => score >= 80 ? 'good' : score >= 60 ? 'warn' : 'bad'
const formatDate = (iso) => iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'
const formatTime = (iso) => iso ? new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '—'

const cx = (...classes) => classes.filter(Boolean).join(' ')

function ScoreRing({ score = 0, size = 'md' }) {
  const dimension = size === 'lg' ? 104 : 48
  const radius = size === 'lg' ? 39 : 17
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (Math.max(0, Math.min(100, score)) / 100) * circumference
  return (
    <div className="relative shrink-0" style={{ width: dimension, height: dimension }} aria-label={`Score ${score} out of 100`}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="rgb(var(--border-color-rgb))" strokeWidth={size === 'lg' ? 4 : 5} />
        <circle
          cx="50" cy="50" r={radius} fill="none"
          stroke={score >= 80 ? '#a9db50' : score >= 60 ? '#e6ae52' : '#e06b67'}
          strokeWidth={size === 'lg' ? 4 : 5}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-500 ease-out"
        />
      </svg>
      <span className={cx('absolute inset-0 flex items-center justify-center font-semibold tracking-tight', size === 'lg' ? 'text-2xl' : 'text-xs', scoreTone(score) === 'good' ? 'text-[#a9db50]' : scoreTone(score) === 'warn' ? 'text-[#e6ae52]' : 'text-[#e06b67]')}>
        {score}
      </span>
    </div>
  )
}

function SectionHeading({ eyebrow, title, count }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-4">
      <div>
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-resonance-text-muted">{eyebrow}</p>
        <h3 className="text-base font-semibold tracking-[-0.01em] text-resonance-text-primary">{title}</h3>
      </div>
      {count != null && <span className="rounded-full border border-resonance-border px-2 py-1 text-[11px] text-resonance-text-muted">{count}</span>}
    </div>
  )
}

function MetricCard({ label, value, icon: Icon, note }) {
  const numeric = Number.isFinite(value)
  const tone = numeric ? scoreTone(value) : 'neutral'
  return (
    <div className="group rounded-2xl border border-resonance-border bg-resonance-bg-secondary p-4 transition-[border-color,transform,background-color] duration-150 ease-out hover:-translate-y-0.5 hover:border-resonance-accent/40 hover:bg-resonance-bg-hover">
      <div className="mb-5 flex items-start justify-between gap-3">
        <span className="text-xs font-medium text-resonance-text-secondary">{label}</span>
        <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-resonance-border bg-resonance-bg-primary text-resonance-accent">
          <Icon size={14} aria-hidden="true" />
        </span>
      </div>
      <div className="flex items-end justify-between gap-3">
        <span className="text-2xl font-semibold tracking-[-0.04em] text-resonance-text-primary">{numeric ? `${value}%` : '—'}</span>
        <span className={cx('mb-1 h-1.5 w-1.5 rounded-full', tone === 'good' && 'bg-[#a9db50]', tone === 'warn' && 'bg-[#e6ae52]', tone === 'bad' && 'bg-[#e06b67]', tone === 'neutral' && 'bg-resonance-text-muted')} />
      </div>
      <p className="mt-1 text-[11px] text-resonance-text-muted">{note || (numeric ? value >= 80 ? 'Above target' : value >= 60 ? 'Within range' : 'Below target' : 'No data')}</p>
    </div>
  )
}

function ReportListItem({ report, selected, onClick }) {
  const score = report.overallScore ?? report.score ?? 0
  const name = report.name || `Report #${report.id?.slice(0, 8)}`
  const designName = report.designName || report.design?.name || 'Untitled design'
  return (
    <button type="button" onClick={onClick} className={cx('group grid w-full grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-3 border-b border-resonance-border px-4 py-4 text-left transition-[background-color,border-color] duration-150 last:border-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-resonance-accent', selected ? 'bg-resonance-accent/[0.07]' : 'hover:bg-resonance-bg-hover')}>
      <ScoreRing score={score} />
      <span className="min-w-0">
        <span className="mb-1 flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-semibold text-resonance-text-primary">{name}</span>
          <span className="hidden shrink-0 rounded-full border border-resonance-border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-resonance-text-muted sm:inline">{statusLabel(score)}</span>
        </span>
        <span className="block truncate text-xs text-resonance-text-secondary">{designName}{report.simulationType ? ` · ${report.simulationType}` : ''}</span>
      </span>
      <span className="flex items-center gap-1 text-[11px] text-resonance-text-muted"><span className="hidden text-right sm:block">{formatDate(report.createdAt)}</span><ChevronRight size={14} className="transition-transform duration-150 group-hover:translate-x-0.5" /></span>
    </button>
  )
}

function collectFindings(report) {
  const findings = []
  report.aiInsights?.insights?.forEach((item, i) => findings.push({ id: item.id || `ai-${i}`, title: item.title, details: item.recommendation || item.description, severity: item.severity || 'info', component: item.blockId }))
  report.reliabilityAnalysis?.singlePointsOfFailure?.forEach((item, i) => findings.push({ id: `spof-${i}`, title: `Single point of failure: ${typeof item === 'string' ? item : item.blockId}`, details: typeof item === 'string' ? null : item.reason, severity: 'critical', component: typeof item === 'string' ? item : item.blockId }))
  report.scalabilityAnalysis?.bottlenecks?.filter((item) => item.severity === 'critical' || item.severity === 'high').forEach((item, i) => findings.push({ id: `bottleneck-${i}`, title: `Bottleneck: ${item.label || item.blockId}`, details: item.message, severity: item.severity === 'critical' ? 'critical' : 'warning', component: item.blockId }))
  ;['critical', 'high'].forEach((level) => report.securityAnalysis?.bySeverity?.[level]?.forEach((item, i) => findings.push({ id: `security-${level}-${i}`, title: item.message, details: item.recommendation, severity: level === 'critical' ? 'critical' : 'warning', component: item.blockId })))
  return findings
}

function FindingRow({ finding }) {
  const critical = finding.severity === 'critical' || finding.severity === 'error'
  const warning = finding.severity === 'warning' || finding.severity === 'warn'
  const Icon = critical ? XCircle : warning ? AlertTriangle : finding.severity === 'info' ? Info : CheckCircle2
  return (
    <div className="flex gap-3 border-b border-resonance-border px-4 py-4 last:border-0">
      <Icon size={16} className={cx('mt-0.5 shrink-0', critical ? 'text-[#e06b67]' : warning ? 'text-[#e6ae52]' : 'text-resonance-accent')} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2"><p className="text-sm font-medium text-resonance-text-primary">{finding.title || finding.message || finding.description}</p><span className="text-[10px] uppercase tracking-wider text-resonance-text-muted">{finding.severity}</span></div>
        {finding.details && <p className="mt-1 text-xs leading-5 text-resonance-text-secondary">{finding.details}</p>}
        {finding.component && <p className="mt-2 font-mono text-[10px] text-resonance-text-muted">{finding.component}</p>}
      </div>
    </div>
  )
}

function ReportDetailPanel({ report, onBack }) {
  const score = report.overallScore ?? report.score ?? 0
  const designName = report.designName || report.design?.name || 'Untitled design'
  const metricItems = [
    ['Reliability', report.reliabilityScore, ShieldCheck],
    ['Cost efficiency', report.costScore, Activity],
    ['Security', report.securityScore, ShieldCheck],
    ['Performance', report.performanceScore, Zap],
    ['Scalability', report.scalabilityScore, TrendingUp],
    ['Explainability', report.confidenceScore ?? report.architectureScore, BarChart3],
  ]
  const findings = collectFindings(report)
  const recommendations = ['critical', 'high', 'medium', 'low'].flatMap((level) => report.actionPlan?.[level] || [])
  return (
    <div className="flex h-full min-h-0 flex-col bg-resonance-bg-primary">
      <header className="flex shrink-0 items-center gap-3 border-b border-resonance-border px-4 py-3 sm:px-8">
        <button type="button" onClick={onBack} aria-label="Back to reports" className="rounded-lg p-2 text-resonance-text-secondary transition-colors hover:bg-resonance-bg-hover hover:text-resonance-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-resonance-accent"><ArrowLeft size={17} /></button>
        <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-resonance-text-primary">{report.name || `Report #${report.id?.slice(0, 8)}`}</p><p className="truncate text-xs text-resonance-text-muted">{designName}</p></div>
        <div className="flex gap-2"><Button variant="ghost" size="sm" icon={Share2}>Share</Button><Button variant="secondary" size="sm" icon={Download}>Export</Button></div>
      </header>
      <main className="min-h-0 flex-1 overflow-auto px-4 py-6 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-5xl space-y-8">
          <section className="grid gap-6 border-b border-resonance-border pb-8 md:grid-cols-[auto_minmax(0,1fr)] md:items-center">
            <ScoreRing score={score} size="lg" />
            <div className="min-w-0"><div className="mb-2 flex flex-wrap items-center gap-3"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-resonance-text-muted">Overall result</p><span className="rounded-full border border-resonance-accent/40 bg-resonance-accent/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-resonance-accent">{statusLabel(score)}</span></div><h1 className="max-w-2xl text-2xl font-semibold tracking-[-0.04em] text-resonance-text-primary sm:text-3xl">{report.summary || `A ${statusLabel(score).toLowerCase()} architecture with ${score >= 80 ? 'strong fundamentals' : 'clear opportunities to improve'}.`}</h1><div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-resonance-text-muted"><span className="inline-flex items-center gap-1.5"><Calendar size={13} />{formatDate(report.createdAt)}</span><span className="inline-flex items-center gap-1.5"><Clock3 size={13} />{formatTime(report.createdAt)}</span>{report.duration && <span className="inline-flex items-center gap-1.5"><Zap size={13} />{report.duration}s runtime</span>}</div></div>
          </section>
          <section><SectionHeading eyebrow="Signal overview" title="Key metrics" count={metricItems.length} /><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{metricItems.map(([label, value, Icon]) => <MetricCard key={label} label={label} value={value} icon={Icon} />)}</div></section>
          {findings.length > 0 && <section><SectionHeading eyebrow="Risk register" title="Findings" count={findings.length} /><div className="overflow-hidden rounded-2xl border border-resonance-border bg-resonance-bg-secondary">{findings.map((finding) => <FindingRow key={finding.id} finding={finding} />)}</div></section>}
          {recommendations.length > 0 && <section><SectionHeading eyebrow="Next moves" title="Recommendations" count={recommendations.length} /><div className="grid gap-3 md:grid-cols-2">{recommendations.map((item, index) => <article key={item.id || index} className="rounded-2xl border border-resonance-border bg-resonance-bg-secondary p-4 transition-colors duration-150 hover:border-resonance-accent/40"><div className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-resonance-accent text-[11px] font-bold text-black">{String(index + 1).padStart(2, '0')}</span><div className="min-w-0"><h4 className="text-sm font-semibold text-resonance-text-primary">{item.title || item.suggestion || item}</h4>{item.description && <p className="mt-2 text-xs leading-5 text-resonance-text-secondary">{item.description}</p>}<div className="mt-3 flex flex-wrap gap-2">{item.estimatedImpact != null && <span className="text-[10px] font-medium uppercase tracking-wider text-resonance-accent">Impact +{item.estimatedImpact} pts</span>}{item.estimatedEffort != null && <span className="text-[10px] uppercase tracking-wider text-resonance-text-muted">Effort {item.estimatedEffort}h</span>}</div></div></div></article>)}</div></section>}
          {report.rawData && <details className="border-t border-resonance-border pt-4"><summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-medium text-resonance-text-secondary hover:text-resonance-text-primary"><ChevronRight size={15} className="transition-transform group-open:rotate-90" />Raw simulation data</summary><pre className="mt-3 max-h-96 overflow-auto rounded-xl border border-resonance-border bg-resonance-bg-secondary p-4 text-[11px] leading-5 text-resonance-text-secondary">{JSON.stringify(report.rawData, null, 2)}</pre></details>}
        </div>
      </main>
    </div>
  )
}

export const ReportPage = () => {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const { reports, reportsLoading, reportsError, selectedReportId, currentReport, loadAllReports, selectReport, loadReport, designs, loadDesigns } = useDesignStore()
  const selectedReport = currentReport || reports.find((r) => r.id === selectedReportId || r.simulationId === selectedReportId)

  useEffect(() => { (async () => { const list = designs.length ? designs : await loadDesigns(); await loadAllReports(list || []) })() }, [loadAllReports, loadDesigns])
  useEffect(() => { const id = searchParams.get('id'); if (!id) return; selectReport(id); const report = reports.find((r) => r.id === id || r.simulationId === id); loadReport(report?.simulationId || id) }, [searchParams, reports, selectReport, loadReport])
  const handleSelect = useCallback((report) => { const id = report.id || report.simulationId; selectReport(id); loadReport(report.simulationId || id); setSearchParams({ id }) }, [selectReport, loadReport, setSearchParams])
  const handleBack = useCallback(() => { selectReport(null); setSearchParams({}) }, [selectReport, setSearchParams])
  const sortedReports = useMemo(() => reports.filter((report) => { const score = report.overallScore ?? report.score ?? 0; const query = searchQuery.toLowerCase(); const matchesQuery = !query || `${report.name || ''} ${report.designName || report.design?.name || ''}`.toLowerCase().includes(query); return matchesQuery && (filter === 'all' || statusFor(score) === filter) }).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)), [reports, searchQuery, filter])
  const scores = reports.map((r) => r.overallScore ?? r.score).filter(Number.isFinite)
  const average = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null
  const excellent = scores.filter((score) => score >= 80).length

  return (
    <div className="flex h-full min-h-0 bg-resonance-bg-primary text-resonance-text-primary">
      <aside className={cx('flex min-h-0 flex-col bg-resonance-bg-secondary', selectedReport ? 'hidden w-[390px] shrink-0 border-r border-resonance-border lg:flex' : 'w-full')}>
        <header className="border-b border-resonance-border px-5 pb-4 pt-7 sm:px-7"><p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-resonance-accent">Simulation archive</p><h1 className="text-3xl font-semibold tracking-[-0.05em]">Reports</h1><p className="mt-2 text-sm text-resonance-text-secondary">A durable record of your architecture decisions.</p><div className="mt-6 grid grid-cols-3 divide-x divide-resonance-border rounded-xl border border-resonance-border bg-resonance-bg-primary"><div className="p-3"><p className="text-[10px] uppercase tracking-wider text-resonance-text-muted">Reports</p><p className="mt-1 text-lg font-semibold">{reports.length}</p></div><div className="p-3"><p className="text-[10px] uppercase tracking-wider text-resonance-text-muted">Average</p><p className="mt-1 text-lg font-semibold">{average ?? '—'}</p></div><div className="p-3"><p className="text-[10px] uppercase tracking-wider text-resonance-text-muted">Excellent</p><p className="mt-1 text-lg font-semibold">{excellent}</p></div></div><div className="mt-4 flex gap-2"><label className="relative min-w-0 flex-1"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-resonance-text-muted" /><input aria-label="Search reports" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search archive" className="w-full rounded-xl border border-resonance-border bg-resonance-bg-primary py-2.5 pl-9 pr-3 text-sm placeholder:text-resonance-text-muted focus:border-resonance-accent focus:outline-none focus:ring-2 focus:ring-resonance-accent/30" /></label><label className="relative"><Filter size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-resonance-text-muted" /><select aria-label="Filter reports" value={filter} onChange={(e) => setFilter(e.target.value)} className="h-full appearance-none rounded-xl border border-resonance-border bg-resonance-bg-primary py-2.5 pl-3 pr-8 text-sm focus:border-resonance-accent focus:outline-none"><option value="all">All</option><option value="excellent">Excellent</option><option value="good">Good</option><option value="needs-work">Needs work</option></select></label></div></header>
        <div className="min-h-0 flex-1 overflow-auto px-3 py-3">{reportsLoading && reports.length === 0 ? <ReportListSkeleton /> : reportsError ? <div className="p-6 text-center"><AlertTriangle className="mx-auto mb-3 text-[#e06b67]" size={24} /><p className="text-sm font-medium">Could not load reports</p><p className="mt-1 text-xs text-resonance-text-secondary">{reportsError}</p><Button variant="secondary" size="sm" className="mt-4" onClick={() => loadAllReports(designs)}>Retry</Button></div> : sortedReports.length ? <div className="overflow-hidden rounded-2xl border border-resonance-border">{sortedReports.map((report) => <ReportListItem key={report.id || report.simulationId} report={report} selected={(report.id || report.simulationId) === selectedReportId} onClick={() => handleSelect(report)} />)}</div> : <div className="flex h-72 flex-col items-center justify-center px-6 text-center"><FileText size={25} className="mb-4 text-resonance-accent" /><p className="text-sm font-semibold">No reports match this view</p><p className="mt-2 max-w-xs text-xs leading-5 text-resonance-text-secondary">Run a simulation to create a durable record of reliability, performance, cost, and security findings.</p><Button variant="primary" size="sm" className="mt-4" onClick={() => navigate('/dashboard')}>Go to dashboard</Button></div>}</div>
        <footer className="flex justify-between border-t border-resonance-border px-6 py-3 text-[11px] text-resonance-text-muted"><span>{sortedReports.length} result{sortedReports.length === 1 ? '' : 's'}</span><span>{excellent} excellent overall</span></footer>
      </aside>
      {selectedReport && <section className="min-w-0 flex-1"><ReportDetailPanel report={selectedReport} onBack={handleBack} /></section>}
    </div>
  )
}

export default ReportPage
