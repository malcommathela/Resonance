import React, { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Pencil, Play, FileText, Settings, GitBranch,
  Clock, Blocks, Activity, ExternalLink, Calendar, Trash2,
  Loader2, Shield, BarChart3, Zap, DollarSign,
  ChevronRight, LayoutGrid, GitGraph, ScrollText, Save,
} from 'lucide-react'
import { useDesignStore } from '@/stores/designStore'
import { useToast } from '@/components/ui/Toast'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { DesignDetailSkeleton, ReportListSkeleton, AuditLogSkeleton } from '@/components/ui/skeletons'

/* ------------------------------------------------------------------ */
// Helpers
/* ------------------------------------------------------------------ */

const formatRelativeTime = (date) => {
  const now = new Date()
  const diff = Math.floor((now - new Date(date)) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return new Date(date).toLocaleDateString()
}

const ScoreRing = ({ value, size = 120, strokeWidth = 8 }) => {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (value / 100) * circumference
  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={strokeWidth} className="text-resonance-border" />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke="url(#scoreGrad)" strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
        <defs>
          <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#DCFC5C" />
            <stop offset="100%" stopColor="#0062D6" />
          </linearGradient>
        </defs>
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[28px] font-bold tabular-nums text-resonance-text-primary">
        {value}
      </span>
    </div>
  )
}

const ScoreBar = ({ value, gradient = 'from-[#DCFC5C] to-[#22c55e]' }) => (
  <div className="h-1.5 bg-resonance-bg-tertiary rounded-full overflow-hidden">
    <div
      className={`h-full rounded-full bg-gradient-to-r ${gradient}`}
      style={{ width: `${value}%`, transition: 'width 600ms cubic-bezier(0.4, 0, 0.2, 1)' }}
    />
  </div>
)

const StatusBadge = ({ status }) => {
  const config = {
    draft:     { bg: 'bg-resonance-bg-tertiary', text: 'text-amber-700 dark:text-amber-400', dot: 'bg-amber-500', label: 'Draft' },
    review:    { bg: 'bg-amber-500/10', text: 'text-amber-500', dot: 'bg-amber-500', label: 'In Review' },
    production:{ bg: 'bg-emerald-500/10', text: 'text-emerald-500', dot: 'bg-emerald-500', label: 'Production' },
    archived:  { bg: 'bg-resonance-bg-tertiary', text: 'text-resonance-text-muted', dot: 'bg-resonance-text-muted', label: 'Archived' },
  }
  const c = config[status] || config.draft
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-medium ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  )
}

const AuditDot = ({ action }) => {
  if (action?.includes('fail')) return <div className="w-2 h-2 rounded-full bg-red-500" />
  if (action?.includes('warn')) return <div className="w-2 h-2 rounded-full bg-amber-500" />
  return <div className="w-2 h-2 rounded-full bg-resonance-accent" />
}

const TopologyPreview = ({ nodes, edges }) => {
  if (!nodes || nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[240px] text-resonance-text-secondary">
        <LayoutGrid size={32} className="mb-2 opacity-50" />
        <p>No topology data available</p>
      </div>
    )
  }

  const xs = nodes.map(n => n.position?.x ?? n.x ?? 0)
  const ys = nodes.map(n => n.position?.y ?? n.y ?? 0)
  const minX = Math.min(...xs), maxX = Math.max(...xs)
  const minY = Math.min(...ys), maxY = Math.max(...ys)
  const rangeX = maxX - minX || 1
  const rangeY = maxY - minY || 1

  const W = 560, H = 200
  const padX = 60, padY = 30

  const norm = (n) => ({
    x: padX + ((n.position?.x ?? n.x ?? 0) - minX) / rangeX * (W - padX * 2),
    y: padY + ((n.position?.y ?? n.y ?? 0) - minY) / rangeY * (H - padY * 2)
  })

  return (
    <div className="relative w-full max-w-[600px] h-[200px] mx-auto">
      {edges?.map((edge, i) => {
        const s = nodes.find(n => n.id === (edge.source ?? edge.sourceId))
        const t = nodes.find(n => n.id === (edge.target ?? edge.targetId))
        if (!s || !t) return null
        const a = norm(s), b = norm(t)
        const dx = b.x - a.x, dy = b.y - a.y
        const len = Math.sqrt(dx * dx + dy * dy)
        const ang = Math.atan2(dy, dx) * (180 / Math.PI)
        const isActive = ['http', 'grpc'].includes((edge.data?.connectionType ?? edge.connectionType ?? '').toLowerCase())
        return (
          <div
            key={i}
            className={`absolute h-[2px] origin-left ${isActive ? 'bg-resonance-accent' : 'bg-resonance-border'}`}
            style={{ left: a.x + 32, top: a.y + 14, width: len, transform: `rotate(${ang}deg)` }}
          />
        )
      })}
      {nodes.map((node, i) => {
        const pos = norm(node)
        const type = (node.data?.type ?? node.type ?? '').toLowerCase()
        const isPrimary = ['gateway', 'loadbalancer', 'api', 'ingress'].includes(type)
        return (
          <div
            key={node.id ?? i}
            className={`absolute w-20 h-9 rounded-lg flex items-center justify-center text-[11px] font-medium border shadow-sm cursor-default select-none ${
              isPrimary
                ? 'bg-resonance-accent/10 border-resonance-accent text-resonance-accent'
                : 'bg-resonance-bg-secondary border-resonance-border text-resonance-text-primary'
            }`}
            style={{ left: pos.x, top: pos.y }}
          >
            {node.data?.label ?? node.label ?? 'Node'}
          </div>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ */
// Main Component
/* ------------------------------------------------------------------ */

const TABS = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'reports', label: 'Reports', icon: ScrollText, countKey: 'reports' },
  { id: 'topology', label: 'Topology', icon: GitGraph },
  { id: 'audit', label: 'Audit Log', icon: Clock, countKey: 'auditLogs' },
  { id: 'settings', label: 'Settings', icon: Settings },
]

export const DesignDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { addToast } = useToast()

  const currentDesign = useDesignStore(state => state.currentDesign)
  const isLoading = useDesignStore(state => state.isLoading)
  const loadDesign = useDesignStore(state => state.loadDesign)
  const updateDesign = useDesignStore(state => state.updateDesign)
  const deleteDesign = useDesignStore(state => state.deleteDesign)

  const overview = useDesignStore(state => state.overview)
  const overviewLoading = useDesignStore(state => state.overviewLoading)
  const reports = useDesignStore(state => state.reports)
  const reportsLoading = useDesignStore(state => state.reportsLoading)
  const auditLogs = useDesignStore(state => state.auditLogs)
  const auditLogsLoading = useDesignStore(state => state.auditLogsLoading)
  const loadOverview = useDesignStore(state => state.loadOverview)
  const loadReports = useDesignStore(state => state.loadReports)
  const loadAuditLogs = useDesignStore(state => state.loadAuditLogs)

  const [activeTab, setActiveTab] = useState('overview')
  const [isSimulating, setIsSimulating] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [isSavingSettings, setIsSavingSettings] = useState(false)

  // Settings form state
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editRepoUrl, setEditRepoUrl] = useState('')
  const [editRepoBranch, setEditRepoBranch] = useState('main')
  const [editStatus, setEditStatus] = useState('draft')
  const [defaultRps, setDefaultRps] = useState(100)
  const [defaultDuration, setDefaultDuration] = useState(300)
  const [defaultMonteCarlo, setDefaultMonteCarlo] = useState(1)
  const [autoGenerateReport, setAutoGenerateReport] = useState(true)

  useEffect(() => {
    if (id) {
      loadDesign(id).catch(() => navigate('/dashboard'))
      loadOverview(id)
      loadReports(id)
      loadAuditLogs(id)
    }
  }, [id, loadDesign, loadOverview, loadReports, loadAuditLogs, navigate])

  // Sync settings form when design loads
  useEffect(() => {
    if (currentDesign) {
      setEditName(currentDesign.name || '')
      setEditDescription(currentDesign.description || '')
      setEditRepoUrl(currentDesign.repoUrl || '')
      setEditRepoBranch(currentDesign.repoBranch || 'main')
      setEditStatus(currentDesign.status || 'draft')
    }
  }, [currentDesign?.id])

  const design = currentDesign
  const counts = overview?.counts || { simulations: 0, auditLogs: 0, reports: 0 }

  const statusMap = useMemo(() => ({
    draft: 'draft', review: 'review', active: 'production', archived: 'archived'
  }), [])

  const reverseStatusMap = useMemo(() => ({
    draft: 'draft', review: 'review', production: 'active', archived: 'archived'
  }), [])

  const handleRunSimulation = async () => {
    if (!design || isSimulating) return
    setIsSimulating(true)
    try {
      const { api } = await import('@/services/api')
      await api.runSimulation(design.id, {
        rps: defaultRps,
        duration: defaultDuration,
        monteCarloPasses: defaultMonteCarlo,
        trafficPattern: 'spike',
        scenario: 'Black Friday Traffic Spike',
        generateReport: autoGenerateReport
      })
      addToast('Simulation started', 'success')
      setTimeout(() => loadOverview(id), 2000)
    } catch (err) {
      addToast(err.message || 'Failed to start simulation', 'error')
    } finally {
      setIsSimulating(false)
    }
  }

  const handleSaveSettings = async () => {
    if (!design) return
    setIsSavingSettings(true)
    try {
      await updateDesign(design.id, {
        name: editName.trim(),
        description: editDescription.trim(),
        repoUrl: editRepoUrl.trim() || null,
        repoBranch: editRepoBranch.trim() || 'main',
        status: reverseStatusMap[editStatus] || 'draft'
      })
      addToast('Settings saved', 'success')
    } catch (err) {
      addToast(err.message || 'Failed to save settings', 'error')
    } finally {
      setIsSavingSettings(false)
    }
  }

  const handleDelete = async () => {
    if (!design) return
    try {
      await deleteDesign(design.id)
      setShowDeleteModal(false)
      addToast(`Deleted "${design.name}"`, 'warning')
      navigate('/dashboard')
    } catch (err) {
      addToast('Failed to delete design', 'error')
    }
  }

  const scores = useMemo(() => {
    const r = overview?.latestReport
    if (!r) return {
      overall: 0, architecture: 0, reliability: 0, performance: 0, cost: 0
    }
    return {
      overall: r.overallScore || 0,
      architecture: r.architectureScore || 0,
      reliability: r.reliabilityScore || 0,
      performance: r.performanceScore || 0,
      cost: r.costScore || 0
    }
  }, [overview])

  const costProjection = useMemo(() => {
    const sim = overview?.latestSimulation
    if (!sim) return null
    return {
      simulated: sim.totalSimulatedCost || 0,
      monthly: sim.projectedMonthlyCost || 0,
      annual: sim.projectedAnnualCost || 0
    }
  }, [overview])

  const latestReport = overview?.latestReport
  const latestSim = overview?.latestSimulation

  // === SKELETON LOADING STATE ===
  if (!design) {
  return (
    <div className="min-h-screen bg-resonance-bg-primary">
      <DesignDetailSkeleton />
    </div>
  )
}

  return (
    <div className="min-h-screen bg-resonance-bg-primary">
      <div className="max-w-[1200px] mx-auto px-6 lg:px-12 py-8">

        {/* ---------- Header ---------- */}
        <header className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6 mb-8 animate-[fadeIn_400ms_ease-out_forwards]">
          <div className="min-w-0">
            <nav className="flex items-center gap-2 text-[13px] text-resonance-text-secondary mb-2">
              <button onClick={() => navigate('/dashboard')} className="hover:text-resonance-text-primary transition-colors">
                Dashboard
              </button>
              <ChevronRight size={14} className="opacity-50" />
              <button onClick={() => navigate('/dashboard')} className="hover:text-resonance-text-primary transition-colors">
                Designs
              </button>
              <ChevronRight size={14} className="opacity-50" />
              <span className="text-resonance-text-primary font-medium truncate">{design.name}</span>
            </nav>
            <h1 className="text-[30px] font-semibold leading-9 tracking-tight text-resonance-text-primary mb-2">
              {design.name}
            </h1>
            <div className="flex flex-wrap items-center gap-4 text-sm text-resonance-text-secondary">
              <StatusBadge status={statusMap[design.status] || 'draft'} />
              <span className="flex items-center gap-1.5">
                <Clock size={14} />
                Updated {formatRelativeTime(design.updatedAt)}
              </span>
              <span className="flex items-center gap-1.5">
                <GitBranch size={14} />
                {latestReport?.version || '—'}
              </span>
              <span>Team: {overview?.design?.teamName || 'Personal'}</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-shrink-0">
            <Button
              variant="secondary"
              onClick={() => navigate(`/design/${design.id}`)}
              className="gap-2"
            >
              <Pencil size={16} />
              Edit Design
            </Button>
            <Button
              onClick={handleRunSimulation}
              disabled={isSimulating}
              className="gap-2"
            >
              {isSimulating ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
              Run Simulation
            </Button>
          </div>
        </header>

        {/* ---------- Tabs ---------- */}
        <nav className="flex gap-1 border-b border-resonance-border mb-6 sticky top-0 bg-resonance-bg-primary z-10 pt-2">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const count = tab.countKey ? counts[tab.countKey] : null
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all duration-150 -mb-px ${
                  isActive
                    ? 'border-resonance-text-primary text-resonance-text-primary'
                    : 'border-transparent text-resonance-text-secondary hover:text-resonance-text-primary'
                }`}
              >
                <Icon size={16} />
                {tab.label}
                {count !== null && count !== undefined && (
                  <span className={`ml-1 text-xs ${isActive ? 'opacity-80' : 'opacity-50'}`}>
                    ({count})
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        {/* ---------- Overview Tab ---------- */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 animate-[fadeIn_400ms_ease-out_forwards]">

            {/* Sidebar */}
            <aside className="space-y-4">
              {/* Design Info */}
              <div className="bg-resonance-bg-secondary border border-resonance-border rounded-xl p-5">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-resonance-text-secondary mb-4">
                  Design Info
                </h3>
                <div className="space-y-3">
                  {[
                    { label: 'Status', value: <StatusBadge status={statusMap[design.status] || 'draft'} /> },
                    { label: 'Blocks', value: `${overview?.design?.blocks ?? design.blocks ?? 0} nodes` },
                    { label: 'Edges', value: `${overview?.design?.edges ?? 0} connections` },
                    { label: 'Repo', value: design.repoUrl ? (
                      <a href={design.repoUrl} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline text-sm truncate block">
                        {design.repoUrl.replace('https://github.com/', '')}
                      </a>
                    ) : 'Not connected' },
                    { label: 'Branch', value: design.repoBranch || 'main' },
                    { label: 'Created', value: new Date(design.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) },
                  ].map((row) => (
                    <div key={row.label} className="flex items-center justify-between text-sm border-b border-resonance-border/50 pb-2 last:border-0 last:pb-0">
                      <span className="text-resonance-text-secondary">{row.label}</span>
                      <span className="font-medium text-resonance-text-primary">{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Team */}
              <div className="bg-resonance-bg-secondary border border-resonance-border rounded-xl p-5">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-resonance-text-secondary mb-4">
                  Team
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-resonance-text-secondary">Members</span>
                    <div className="flex items-center">
                      {(overview?.design?.team || []).map((m, i) => (
                        <div
                          key={i}
                          className="w-6 h-6 rounded-full border-2 border-resonance-bg-secondary flex items-center justify-center text-[9px] font-bold -ml-2 first:ml-0"
                          style={{
                            backgroundColor: i === 0 ? '#DCFC5C' : i === 1 ? '#6B7280' : '#9CA3AF',
                            color: i === 0 ? '#000' : '#fff'
                          }}
                        >
                          {m.initials}
                        </div>
                      ))}
                      {overview?.design?.team?.length > 3 && (
                        <span className="ml-1 text-xs text-resonance-text-secondary">
                          +{overview.design.team.length - 3}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm border-b border-resonance-border/50 pb-2">
                    <span className="text-resonance-text-secondary">Owner</span>
                    <span className="font-medium text-resonance-text-primary">You</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-resonance-text-secondary">Max Members</span>
                    <span className="font-medium text-resonance-text-primary">{overview?.design?.maxMembers || 5}</span>
                  </div>
                </div>
              </div>

              {/* Overall Score */}
              <div className="bg-resonance-bg-secondary border border-resonance-border rounded-xl p-5">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-resonance-text-secondary mb-4">
                  Overall Score
                </h3>
                <ScoreRing value={scores.overall} />
                <p className="text-center text-xs text-resonance-text-secondary mt-3">
                  Based on latest simulation
                </p>
              </div>
            </aside>

            {/* Main Content */}
            <div className="min-w-0 space-y-6">
              {/* Score Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {[
                  { title: 'Architecture', value: scores.architecture, icon: BarChart3, gradient: 'from-[#DCFC5C] to-[#a3e635]' },
                  { title: 'Reliability', value: scores.reliability, icon: Shield, gradient: 'from-[#DCFC5C] to-[#22c55e]' },
                  { title: 'Performance', value: scores.performance, icon: Activity, gradient: 'from-[#DCFC5C] to-[#3b82f6]' },
                  { title: 'Cost', value: scores.cost, icon: DollarSign, gradient: 'from-[#DCFC5C] to-[#f59e0b]' },
                ].map((card) => {
                  const Icon = card.icon
                  return (
                    <div
                      key={card.title}
                      className="bg-resonance-bg-secondary border border-resonance-border rounded-xl p-5 hover:border-resonance-text-secondary hover:-translate-y-0.5 transition-all duration-150"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[13px] font-medium uppercase tracking-wide text-resonance-text-secondary">
                          {card.title}
                        </span>
                        <Icon size={16} className="text-resonance-text-secondary" />
                      </div>
                      <div className="text-2xl font-bold tabular-nums text-resonance-text-primary mb-3">
                        {card.value}
                      </div>
                      <ScoreBar value={card.value} gradient={card.gradient} />
                    </div>
                  )
                })}
              </div>

              {/* Latest Simulation Report */}
              <div className="bg-resonance-bg-secondary border border-resonance-border rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-resonance-border">
                  <span className="text-base font-semibold text-resonance-text-primary">Latest Simulation Report</span>
                  <span className="text-xs font-medium text-resonance-text-secondary bg-resonance-bg-tertiary px-2.5 py-1 rounded-full">
                    {latestReport?.version || '—'}
                  </span>
                </div>
                <div className="p-6">
                  {latestReport ? (
                    <>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-5">
                        {[
                          { label: 'Scenario', value: latestSim?.scenario || '—' },
                          { label: 'Traffic Pattern', value: latestSim?.trafficPattern === 'spike' ? 'Spike → Steady → Ramp Down' : (latestSim?.trafficPattern || '—') },
                          { label: 'Duration', value: latestSim?.duration ? `${Math.floor(latestSim.duration / 60)}m ${latestSim.duration % 60}s` : '—' },
                          { label: 'Confidence', value: `${Math.round((latestSim?.confidenceLevel || 0) * 100)}%` },
                        ].map((item) => (
                          <div key={item.label}>
                            <div className="text-xs uppercase tracking-wider text-resonance-text-secondary mb-1">{item.label}</div>
                            <div className="text-sm font-semibold text-resonance-text-primary">{item.value}</div>
                          </div>
                        ))}
                      </div>
                      <div className="bg-resonance-bg-tertiary rounded-xl p-4 text-sm leading-relaxed text-resonance-text-secondary mb-4">
                        <p className="mb-3">
                          <strong className="text-resonance-text-primary">Executive Summary:</strong>{' '}
                          {typeof latestReport.executiveSummary === 'string'
                            ? latestReport.executiveSummary
                            : latestReport.executiveSummary?.text || 'No summary available.'}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {(Array.isArray(latestReport.actionPlan) ? latestReport.actionPlan : []).slice(0, 3).map((action, i) => (
                            <span
                              key={i}
                              className="px-3 py-1 rounded-md text-xs font-medium bg-resonance-accent/15 text-resonance-accent"
                            >
                              {typeof action === 'string' ? action : action?.title || action}
                            </span>
                          ))}
                          {(!latestReport.actionPlan || latestReport.actionPlan.length === 0) && (
                            <span className="px-3 py-1 rounded-md text-xs font-medium bg-resonance-bg-tertiary text-resonance-text-secondary">
                              No action items
                            </span>
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-10 text-resonance-text-secondary">
                      <FileText size={32} className="mx-auto mb-3 opacity-50" />
                      <p>No simulation reports yet. Run your first simulation to see results.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Cost Projection */}
              <div className="bg-resonance-bg-secondary border border-resonance-border rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-resonance-border">
                  <span className="text-base font-semibold text-resonance-text-primary">Cost Projection</span>
                  <Button variant="secondary" size="sm" className="text-xs">
                    View Details
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6">
                  {costProjection ? (
                    <>
                      <div className="text-center p-5 bg-resonance-bg-tertiary rounded-xl border border-resonance-border">
                        <div className="text-2xl font-bold tabular-nums text-resonance-text-primary mb-1">
                          ${costProjection.simulated.toFixed(2)}
                        </div>
                        <div className="text-sm text-resonance-text-secondary">Simulated Cost</div>
                      </div>
                      <div className="text-center p-5 bg-resonance-bg-tertiary rounded-xl border border-resonance-border">
                        <div className="text-2xl font-bold tabular-nums text-resonance-text-primary mb-1">
                          ${costProjection.monthly.toLocaleString()}
                        </div>
                        <div className="text-sm text-resonance-text-secondary">Projected Monthly</div>
                      </div>
                      <div className="text-center p-5 bg-resonance-bg-tertiary rounded-xl border border-resonance-border">
                        <div className="text-2xl font-bold tabular-nums text-resonance-text-primary mb-1">
                          ${costProjection.annual.toLocaleString()}
                        </div>
                        <div className="text-sm text-resonance-text-secondary">Projected Annual</div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-center p-5 bg-resonance-bg-tertiary rounded-xl border border-resonance-border text-resonance-text-secondary">
                        <DollarSign size={20} className="mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No cost data</p>
                      </div>
                      <div className="text-center p-5 bg-resonance-bg-tertiary rounded-xl border border-resonance-border text-resonance-text-secondary">
                        <DollarSign size={20} className="mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No cost data</p>
                      </div>
                      <div className="text-center p-5 bg-resonance-bg-tertiary rounded-xl border border-resonance-border text-resonance-text-secondary">
                        <DollarSign size={20} className="mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No cost data</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ---------- Reports Tab ---------- */}
        {activeTab === 'reports' && (
          <div className="animate-[fadeIn_400ms_ease-out_forwards]">
            {reportsLoading ? (
              <ReportListSkeleton />
            ) : (
              <div className="bg-resonance-bg-secondary border border-resonance-border rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-resonance-border">
                  <span className="text-base font-semibold text-resonance-text-primary">Simulation Reports</span>
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" className="text-xs">Filter</Button>
                    <Button variant="secondary" size="sm" className="text-xs">Export</Button>
                  </div>
                </div>
                <div className="divide-y divide-resonance-border">
                  {reports.length === 0 ? (
                    <div className="text-center py-16 text-resonance-text-secondary">
                      <FileText size={32} className="mx-auto mb-3 opacity-50" />
                      <p>No reports yet. Run a simulation to generate reports.</p>
                    </div>
                  ) : (
                    reports.map((report) => (
                      <div
                        key={report.id}
                        className="grid grid-cols-[48px_1fr_auto_auto] items-center gap-4 px-6 py-4 hover:bg-resonance-bg-hover transition-colors cursor-pointer group"
                      >
                        <div className="w-10 h-10 rounded-xl bg-resonance-accent/10 flex items-center justify-center text-resonance-accent">
                          <FileText size={18} />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-semibold text-resonance-text-primary truncate">
                            {report.scenario || 'Untitled Simulation'}
                          </h4>
                          <p className="text-xs text-resonance-text-secondary">
                            {new Date(report.generatedAt).toLocaleDateString()} • {report.duration ? `${Math.floor(report.duration / 60)}m ${report.duration % 60}s` : '0s'} • Monte Carlo: {report.monteCarloPasses || 1} passes
                          </p>
                        </div>
                        <div className="flex gap-4">
                          {[
                            { val: report.overallScore, lbl: 'Overall' },
                            { val: report.architectureScore, lbl: 'Arch' },
                            { val: report.reliabilityScore, lbl: 'Rel' },
                            { val: report.performanceScore, lbl: 'Perf' },
                          ].map((s) => (
                            <div key={s.lbl} className="text-center">
                              <div className={`text-[15px] font-bold tabular-nums ${(s.val || 0) < 60 ? 'text-red-500' : 'text-resonance-text-primary'}`}>
                                {s.val || 0}
                              </div>
                              <div className="text-[11px] text-resonance-text-secondary uppercase tracking-wider">{s.lbl}</div>
                            </div>
                          ))}
                        </div>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="secondary" size="sm" className="text-xs">View</Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ---------- Topology Tab ---------- */}
        {activeTab === 'topology' && (
          <div className="bg-resonance-bg-secondary border border-resonance-border rounded-xl overflow-hidden animate-[fadeIn_400ms_ease-out_forwards]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-resonance-border">
              <span className="text-base font-semibold text-resonance-text-primary">Architecture Topology</span>
              <Button variant="secondary" size="sm" className="text-xs" onClick={() => navigate(`/design/${design.id}`)}>
                Open in Editor
              </Button>
            </div>
            <div className="p-6 bg-resonance-bg-primary/50 flex items-center justify-center min-h-[280px]">
              <TopologyPreview nodes={overview?.design?.nodes} edges={overview?.design?.edgesList} />
            </div>
            <div className="px-6 py-3 border-t border-resonance-border flex gap-6 text-xs text-resonance-text-secondary">
              <span className="flex items-center gap-2">
                <span className="w-3 h-[3px] rounded-full bg-resonance-accent" /> High Traffic
              </span>
              <span className="flex items-center gap-2">
                <span className="w-3 h-[3px] rounded-full bg-resonance-border" /> Standard
              </span>
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500" /> Bottleneck Risk
              </span>
            </div>
          </div>
        )}

        {/* ---------- Audit Log Tab ---------- */}
        {activeTab === 'audit' && (
          <div className="animate-[fadeIn_400ms_ease-out_forwards]">
            {auditLogsLoading ? (
              <AuditLogSkeleton />
            ) : (
              <div className="bg-resonance-bg-secondary border border-resonance-border rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-resonance-border">
                  <span className="text-base font-semibold text-resonance-text-primary">Audit Log</span>
                  <Button variant="secondary" size="sm" className="text-xs">Export CSV</Button>
                </div>
                <div className="divide-y divide-resonance-border">
                  {auditLogs.length === 0 ? (
                    <div className="text-center py-16 text-resonance-text-secondary">
                      <Clock size={32} className="mx-auto mb-3 opacity-50" />
                      <p>No audit logs yet.</p>
                    </div>
                  ) : (
                    auditLogs.map((log) => (
                      <div key={log.id} className="grid grid-cols-[40px_1fr_auto] items-center gap-4 px-6 py-3.5">
                        <div className="flex justify-center">
                          <AuditDot action={log.action} />
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-resonance-text-primary">
                            {log.action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            {log.simulationScenario && ` — ${log.simulationScenario}`}
                          </h4>
                          <p className="text-xs text-resonance-text-secondary">
                            User: {log.userName} • {typeof log.details === 'string' ? log.details : JSON.stringify(log.details)}
                          </p>
                        </div>
                        <div className="text-xs text-resonance-text-secondary tabular-nums">
                          {formatRelativeTime(log.createdAt)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ---------- Settings Tab ---------- */}
        {activeTab === 'settings' && (
          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 animate-[fadeIn_400ms_ease-out_forwards]">
            {/* Danger Zone Sidebar */}
            <aside>
              <div className="bg-resonance-bg-secondary border border-resonance-border rounded-xl p-5">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-red-500 mb-4">
                  Danger Zone
                </h3>
                <p className="text-xs text-resonance-text-secondary leading-relaxed mb-4">
                  Destructive actions cannot be undone. All simulation reports and audit logs will be permanently deleted.
                </p>
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 text-red-500 text-sm font-medium hover:bg-red-500/20 transition-colors"
                >
                  <Trash2 size={16} />
                  Delete Design
                </button>
              </div>
            </aside>

            {/* Main Settings */}
            <div className="space-y-6">
              {/* General Settings */}
              <div className="bg-resonance-bg-secondary border border-resonance-border rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-resonance-border">
                  <span className="text-base font-semibold text-resonance-text-primary">General Settings</span>
                </div>
                <div className="p-6 space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-resonance-text-primary mb-2">Design Name</label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full px-3 py-2.5 bg-resonance-bg-tertiary border border-resonance-border rounded-xl text-sm text-resonance-text-primary placeholder:text-resonance-text-muted outline-none focus:border-resonance-accent transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-resonance-text-primary mb-2">Description</label>
                    <textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2.5 bg-resonance-bg-tertiary border border-resonance-border rounded-xl text-sm text-resonance-text-primary placeholder:text-resonance-text-muted outline-none focus:border-resonance-accent transition-colors resize-y"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-resonance-text-primary mb-2">Repository URL</label>
                    <input
                      type="text"
                      value={editRepoUrl}
                      onChange={(e) => setEditRepoUrl(e.target.value)}
                      className="w-full px-3 py-2.5 bg-resonance-bg-tertiary border border-resonance-border rounded-xl text-sm text-resonance-text-primary placeholder:text-resonance-text-muted outline-none focus:border-resonance-accent transition-colors"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-resonance-text-primary mb-2">Default Branch</label>
                      <input
                        type="text"
                        value={editRepoBranch}
                        onChange={(e) => setEditRepoBranch(e.target.value)}
                        className="w-full px-3 py-2.5 bg-resonance-bg-tertiary border border-resonance-border rounded-xl text-sm text-resonance-text-primary placeholder:text-resonance-text-muted outline-none focus:border-resonance-accent transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-resonance-text-primary mb-2">Status</label>
                      <select
                        value={editStatus}
                        onChange={(e) => setEditStatus(e.target.value)}
                        className="w-full px-3 py-2.5 bg-resonance-bg-tertiary border border-resonance-border rounded-xl text-sm text-resonance-text-primary outline-none focus:border-resonance-accent transition-colors"
                      >
                        <option value="draft">Draft</option>
                        <option value="review">Review</option>
                        <option value="production">Production</option>
                        <option value="archived">Archived</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Simulation Defaults */}
              <div className="bg-resonance-bg-secondary border border-resonance-border rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-resonance-border">
                  <span className="text-base font-semibold text-resonance-text-primary">Simulation Defaults</span>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-resonance-text-primary mb-2">Default RPS</label>
                      <input
                        type="number"
                        value={defaultRps}
                        onChange={(e) => setDefaultRps(Number(e.target.value))}
                        className="w-full px-3 py-2.5 bg-resonance-bg-tertiary border border-resonance-border rounded-xl text-sm text-resonance-text-primary outline-none focus:border-resonance-accent transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-resonance-text-primary mb-2">Default Duration (s)</label>
                      <input
                        type="number"
                        value={defaultDuration}
                        onChange={(e) => setDefaultDuration(Number(e.target.value))}
                        className="w-full px-3 py-2.5 bg-resonance-bg-tertiary border border-resonance-border rounded-xl text-sm text-resonance-text-primary outline-none focus:border-resonance-accent transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-resonance-text-primary mb-2">Monte Carlo Passes</label>
                      <input
                        type="number"
                        value={defaultMonteCarlo}
                        onChange={(e) => setDefaultMonteCarlo(Number(e.target.value))}
                        className="w-full px-3 py-2.5 bg-resonance-bg-tertiary border border-resonance-border rounded-xl text-sm text-resonance-text-primary outline-none focus:border-resonance-accent transition-colors"
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-3 text-sm text-resonance-text-primary cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoGenerateReport}
                      onChange={(e) => setAutoGenerateReport(e.target.checked)}
                      className="w-4 h-4 rounded border-resonance-border bg-resonance-bg-tertiary text-resonance-accent focus:ring-resonance-accent"
                    />
                    Auto-generate report after simulation
                  </label>
                </div>
              </div>

              {/* Save Button */}
              <div className="flex justify-end">
                <Button
                  onClick={handleSaveSettings}
                  disabled={isSavingSettings}
                  className="gap-2"
                >
                  {isSavingSettings ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  Save Settings
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ---------- Delete Modal ---------- */}
        <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Delete Design" size="sm">
          <div className="space-y-4">
            <p className="text-resonance-text-secondary">
              Are you sure you want to delete <strong className="text-resonance-text-primary">{design.name}</strong>?
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setShowDeleteModal(false)}>Cancel</Button>
              <Button variant="danger" onClick={handleDelete}>Delete</Button>
            </div>
          </div>
        </Modal>

      </div>
    </div>
  )
}