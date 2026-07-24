import React, { useState, useMemo } from 'react'
import {
  AlertOctagon,
  AlertTriangle,
  ShieldAlert,
  Info,
  ChevronDown,
  ChevronRight,
  X,
  Zap,
  Target,
  CheckCircle2,
  BarChart3,
  Activity,
  Pencil,
  ArrowRight,
  Filter,
  Server,
  Wifi,
  PanelRightClose,
  PanelRightOpen,
  ShieldCheck,
} from 'lucide-react'
import {
  SEVERITY,
  SEVERITY_CONFIG,
  FINDING_TYPE_LABELS,
  groupFindingsBySeverity,
  formatTopologyScore,
  formatConfidenceScore,
  getValidationSummary,
  getPropertyLabel,
} from '@/lib/validation'

const SEVERITY_ICONS = {
  [SEVERITY.CRITICAL]: AlertOctagon,
  [SEVERITY.WARNING]: AlertTriangle,
  [SEVERITY.RISK]: ShieldAlert,
  [SEVERITY.INFO]: Info,
}

const PROPERTY_ICON_MAP = {
  block: Target,
  edge: Wifi,
  simulation: Server,
}

/**
 * ValidationPanel — Displays architecture validation findings
 *
 * Shows critical errors, warnings, and architectural risks with:
 * - Expandable severity sections
 * - Click-to-highlight on canvas
 * - "Jump to Property" for property-level findings
 * - Topology and confidence scores
 * - Pre-flight vs server-side status
 * - Actionable recommendations
 * - Collapsible sidebar with smooth animation
 */
export const ValidationPanel = ({
  validation,
  onClose,
  onHighlightFinding,
  onClearHighlight,
  onRunValidation,
  onJumpToProperty,
  isValidating,
  collapsed = false,
  onToggleCollapse,
}) => {
  const [expandedSections, setExpandedSections] = useState({
    [SEVERITY.CRITICAL]: true,
    [SEVERITY.WARNING]: true,
    [SEVERITY.RISK]: true,
    [SEVERITY.INFO]: false,
  })
  const [activeFilter, setActiveFilter] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')

  // === COLLAPSED STATE ===
  if (collapsed) {
    const hasCritical = validation?.findings?.some(f => f.severity === SEVERITY.CRITICAL)
    const hasWarning = validation?.findings?.some(f => f.severity === SEVERITY.WARNING)
    const findingCount = validation?.findings?.length || 0

    return (
      <div
        className="shrink-0 bg-resonance-bg-panel border-l border-resonance-border flex flex-col items-center py-3 gap-2 overflow-hidden"
        style={{ width: 48, transition: 'width 300ms cubic-bezier(0.4, 0, 0.2, 1)' }}
      >
        <button
          onClick={onToggleCollapse}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-resonance-text-muted hover:text-resonance-text-primary hover:bg-resonance-bg-hover transition-colors"
          title="Expand Validation Panel"
        >
          <PanelRightOpen size={16} />
        </button>

        <div className="w-6 h-px bg-resonance-border my-1" />

        {/* Validation status indicator */}
        <button
          onClick={onToggleCollapse}
          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors group relative ${
            hasCritical
              ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20'
              : hasWarning
              ? 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20'
              : findingCount > 0
              ? 'bg-green-500/10 text-green-500 hover:bg-green-500/20'
              : 'bg-resonance-bg-hover text-resonance-text-muted hover:text-resonance-text-primary'
          }`}
          title={validation ? `${findingCount} findings` : 'No validation run yet'}
        >
          {hasCritical ? (
            <AlertOctagon size={16} />
          ) : hasWarning ? (
            <AlertTriangle size={16} />
          ) : findingCount > 0 ? (
            <CheckCircle2 size={16} />
          ) : (
            <ShieldCheck size={16} />
          )}
          {/* Tooltip */}
          <span className="absolute right-full mr-2 px-2 py-1 bg-resonance-bg-elevated border border-resonance-border rounded-lg text-xs text-resonance-text-primary whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-lg">
            {validation ? `${findingCount} finding${findingCount !== 1 ? 's' : ''}` : 'Validation'}
          </span>
        </button>

        {/* Re-run button */}
        <button
          onClick={onRunValidation}
          disabled={isValidating}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-resonance-text-muted hover:text-resonance-accent hover:bg-resonance-bg-hover transition-colors disabled:opacity-40 group relative"
          title="Re-run validation"
        >
          {isValidating ? (
            <div className="w-4 h-4 border-2 border-resonance-text-muted border-t-resonance-accent rounded-full animate-spin" />
          ) : (
            <Zap size={14} />
          )}
          <span className="absolute right-full mr-2 px-2 py-1 bg-resonance-bg-elevated border border-resonance-border rounded-lg text-xs text-resonance-text-primary whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-lg">
            {isValidating ? 'Validating...' : 'Run Validation'}
          </span>
        </button>
      </div>
    )
  }

  // === EMPTY STATE (no validation run yet) ===
  if (!validation) {
    return (
      <div
        className="shrink-0 bg-resonance-bg-panel border-l border-resonance-border flex flex-col h-full"
        style={{ width: 280, transition: 'width 300ms cubic-bezier(0.4, 0, 0.2, 1)' }}
      >
        <div className="flex items-center justify-between p-4 border-b border-resonance-border">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-resonance-accent" />
            <h3 className="text-sm font-semibold text-resonance-text-primary">Validation</h3>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={onToggleCollapse}
              className="p-1 rounded-lg hover:bg-resonance-bg-hover text-resonance-text-muted hover:text-resonance-text-primary transition-colors"
              title="Collapse Validation Panel"
            >
              <PanelRightClose size={14} />
            </button>
            <button onClick={onClose} className="text-resonance-text-muted hover:text-resonance-text-primary transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <Activity size={32} className="text-resonance-text-muted mb-3" />
          <p className="text-sm text-resonance-text-secondary mb-4">
            Validate your architecture to detect structural issues and property errors before simulation.
          </p>
          <button
            onClick={onRunValidation}
            disabled={isValidating}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-resonance-accent text-resonance-neutral text-sm font-medium hover:bg-resonance-accent-hover transition-colors disabled:opacity-50"
          >
            {isValidating ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Validating...
              </>
            ) : (
              <>
                <Zap size={16} />
                Run Validation
              </>
            )}
          </button>
        </div>
      </div>
    )
  }

  const grouped = groupFindingsBySeverity(validation.findings)
  const hasFindings = validation.findings.length > 0
  const isPreFlight = validation.isPreFlight === true

  const toggleSection = (severity) => {
    setExpandedSections(prev => ({ ...prev, [severity]: !prev[severity] }))
  }

  // Filtered findings based on search + active filter
  const filteredFindings = useMemo(() => {
    let findings = validation.findings
    if (activeFilter) {
      findings = findings.filter(f => f.severity === activeFilter)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      findings = findings.filter(f =>
        (f.message || '').toLowerCase().includes(q) ||
        (f.recommendation || '').toLowerCase().includes(q) ||
        (f.property || '').toLowerCase().includes(q) ||
        (f.type || '').toLowerCase().includes(q)
      )
    }
    return groupFindingsBySeverity(findings)
  }, [validation.findings, activeFilter, searchQuery])

  const handleFindingClick = (finding) => {
    // BATCH 3: Use canonical elementId/elementType if available, fallback to legacy blockId/edgeId
    const elementId = finding.elementId || finding.blockId || finding.edgeId
    const elementType = finding.elementType || (finding.blockId ? 'node' : finding.edgeId ? 'edge' : 'node')

    if (elementId) {
      onHighlightFinding?.({
        ...finding,
        elementId,
        elementType,
      })
    }
  }

  const handleJumpToProperty = (e, finding) => {
    e.stopPropagation()
    const elementId = finding.elementId || finding.blockId || finding.edgeId
    const elementType = finding.elementType || (finding.blockId ? 'node' : finding.edgeId ? 'edge' : 'node')
    if (elementId && finding.property) {
      onJumpToProperty?.(elementId, finding.property, elementType)
    }
  }

  const severities = [SEVERITY.CRITICAL, SEVERITY.WARNING, SEVERITY.RISK, SEVERITY.INFO]

  return (
    <div
      className="shrink-0 bg-resonance-bg-panel border-l border-resonance-border flex flex-col h-full"
      style={{ width: 280, transition: 'width 300ms cubic-bezier(0.4, 0, 0.2, 1)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-resonance-border">
        <div className="flex items-center gap-2">
          <BarChart3 size={16} className="text-resonance-accent" />
          <h3 className="text-sm font-semibold text-resonance-text-primary">Validation Results</h3>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onRunValidation}
            disabled={isValidating}
            className="p-1.5 rounded-lg hover:bg-resonance-bg-hover text-resonance-text-muted hover:text-resonance-accent transition-colors disabled:opacity-50"
            title="Re-run validation"
          >
            {isValidating ? (
              <div className="w-4 h-4 border-2 border-resonance-text-muted border-t-resonance-accent rounded-full animate-spin" />
            ) : (
              <Zap size={14} />
            )}
          </button>
          <button
            onClick={onToggleCollapse}
            className="p-1 rounded-lg hover:bg-resonance-bg-hover text-resonance-text-muted hover:text-resonance-text-primary transition-colors"
            title="Collapse Validation Panel"
          >
            <PanelRightClose size={14} />
          </button>
          <button onClick={onClose} className="text-resonance-text-muted hover:text-resonance-text-primary transition-colors">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Scores */}
      <div className="grid grid-cols-2 gap-3 p-4 border-b border-resonance-border">
        <div className="bg-resonance-bg-tertiary rounded-xl p-3">
          <p className="text-xs text-resonance-text-muted mb-1">Topology Score</p>
          <p className={`text-lg font-bold ${
            (validation.topologyScore || 0) >= 0.8 ? 'text-green-400' :
            (validation.topologyScore || 0) >= 0.5 ? 'text-amber-400' : 'text-red-400'
          }`}>
            {formatTopologyScore(validation.topologyScore)}
          </p>
        </div>
        <div className="bg-resonance-bg-tertiary rounded-xl p-3">
          <p className="text-xs text-resonance-text-muted mb-1">Confidence</p>
          <p className={`text-lg font-bold ${
            (validation.confidenceScore || 0) >= 0.8 ? 'text-green-400' :
            (validation.confidenceScore || 0) >= 0.5 ? 'text-amber-400' : 'text-red-400'
          }`}>
            {formatConfidenceScore(validation.confidenceScore)}
          </p>
        </div>
      </div>

      {/* Status Banner */}
      <div className={`px-4 py-2.5 border-b border-resonance-border flex items-center gap-2 ${
        validation.canSimulate
          ? validation.criticalCount === 0 && validation.warningCount === 0 && validation.riskCount === 0
            ? 'bg-green-500/5'
            : 'bg-amber-500/5'
          : 'bg-red-500/5'
      }`}>
        {validation.canSimulate ? (
          validation.criticalCount === 0 && validation.warningCount === 0 && validation.riskCount === 0 ? (
            <CheckCircle2 size={14} className="text-green-400 shrink-0" />
          ) : (
            <AlertTriangle size={14} className="text-amber-400 shrink-0" />
          )
        ) : (
          <AlertOctagon size={14} className="text-red-400 shrink-0" />
        )}
        <span className={`text-xs font-medium ${
          validation.canSimulate
            ? validation.criticalCount === 0 && validation.warningCount === 0 && validation.riskCount === 0
              ? 'text-green-400'
              : 'text-amber-400'
            : 'text-red-400'
        }`}>
          {getValidationSummary(validation)}
        </span>
        {isPreFlight && (
          <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
            Pre-flight
          </span>
        )}
      </div>

      {/* Severity Filter Bar */}
      {hasFindings && (
        <div className="px-4 py-2 border-b border-resonance-border flex items-center gap-2">
          <Filter size={12} className="text-resonance-text-muted shrink-0" />
          <div className="flex items-center gap-1.5 flex-wrap">
            {severities.map(sev => {
              const count = grouped[sev].length
              if (count === 0) return null
              const config = SEVERITY_CONFIG[sev]
              const isActive = activeFilter === sev
              return (
                <button
                  key={sev}
                  onClick={() => setActiveFilter(isActive ? null : sev)}
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-all ${
                    isActive
                      ? 'ring-1 ring-offset-0'
                      : 'hover:bg-resonance-bg-hover'
                  }`}
                  style={{
                    backgroundColor: isActive ? config.color + '20' : 'transparent',
                    color: config.color,
                    ringColor: isActive ? config.color : 'transparent',
                  }}
                >
                  {config.label}
                  <span className="opacity-70">{count}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Search */}
      {hasFindings && (
        <div className="px-4 py-2 border-b border-resonance-border">
          <input
            type="text"
            placeholder="Search findings..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-resonance-bg-tertiary border border-resonance-border rounded-lg px-3 py-1.5 text-xs text-resonance-text-primary placeholder:text-resonance-text-muted focus:outline-none focus:border-resonance-accent/50 transition-colors"
          />
        </div>
      )}

      {/* Findings List */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {!hasFindings ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <CheckCircle2 size={40} className="text-green-400 mb-3" />
            <p className="text-sm text-resonance-text-secondary">No issues found</p>
            <p className="text-xs text-resonance-text-muted mt-1">Your architecture looks good!</p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {severities.map(severity => {
              const findings = filteredFindings[severity]
              if (findings.length === 0) return null

              const config = SEVERITY_CONFIG[severity]
              const Icon = SEVERITY_ICONS[severity]
              const isExpanded = expandedSections[severity]

              return (
                <div key={severity} className="rounded-xl border border-resonance-border overflow-hidden">
                  {/* Section Header */}
                  <button
                    onClick={() => toggleSection(severity)}
                    className="w-full flex items-center gap-2 px-3 py-2.5 bg-resonance-bg-tertiary/50 hover:bg-resonance-bg-tertiary transition-colors"
                  >
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    <Icon size={14} style={{ color: config.color }} />
                    <span className="text-xs font-medium text-resonance-text-primary flex-1 text-left">
                      {config.label}
                    </span>
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{ backgroundColor: config.color + '20', color: config.color }}
                    >
                      {findings.length}
                    </span>
                  </button>

                  {/* Section Content */}
                  {isExpanded && (
                    <div className="divide-y divide-resonance-border/50">
                      {findings.map(finding => (
  <div
    key={finding.id}
    role="button"
    tabIndex={0}
    onClick={() => handleFindingClick(finding)}
    onKeyDown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        handleFindingClick(finding)
      }
    }}
    className="w-full text-left px-3 py-2.5 hover:bg-resonance-bg-hover transition-colors group cursor-pointer"
  >
    <div className="flex items-start gap-2">
      <Target size={12} className="text-resonance-text-muted mt-0.5 shrink-0 group-hover:text-resonance-accent transition-colors" />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-resonance-text-primary leading-relaxed">
          {finding.message}
        </p>
        {finding.recommendation && (
          <p className="text-[11px] text-resonance-text-muted mt-1 leading-relaxed">
            {finding.recommendation}
          </p>
        )}
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <span className="text-[10px] text-resonance-text-muted bg-resonance-bg-tertiary px-1.5 py-0.5 rounded-lg">
            {FINDING_TYPE_LABELS[finding.type] || finding.type}
          </span>
          {finding.property && (
            <span className="text-[10px] text-resonance-text-muted bg-resonance-bg-tertiary px-1.5 py-0.5 rounded-lg flex items-center gap-1">
              <Pencil size={8} />
              {getPropertyLabel(finding.property)}
            </span>
          )}
          {(finding.elementId || finding.blockId || finding.edgeId) && (
            <span className="text-[10px] text-resonance-accent flex items-center gap-0.5">
              <ArrowRight size={8} />
              Click to highlight
            </span>
          )}
        </div>
        {/* Jump to Property button — now legally nested inside a div */}
        {finding.property && (finding.blockId || finding.edgeId) && onJumpToProperty && (
          <button
            onClick={(e) => handleJumpToProperty(e, finding)}
            className="mt-1.5 flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg bg-resonance-accent/10 text-resonance-accent hover:bg-resonance-accent/20 transition-colors"
          >
            <Pencil size={10} />
            Jump to Property
          </button>
        )}
      </div>
    </div>
  </div>
))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-resonance-border bg-resonance-bg-tertiary/30 shrink-0">
        <div className="flex items-center justify-between text-[10px] text-resonance-text-muted">
          <span>{validation.findings.length} total finding{validation.findings.length !== 1 ? 's' : ''}</span>
          <span className={`font-medium ${validation.canSimulate ? 'text-green-400' : 'text-red-400'}`}>
            {validation.canSimulate ? 'Simulation allowed' : 'Simulation blocked'}
          </span>
        </div>
      </div>
    </div>
  )
}