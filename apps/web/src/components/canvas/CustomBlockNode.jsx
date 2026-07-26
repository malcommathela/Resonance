import React, { useEffect, useRef, useState, useMemo } from 'react'
import { Handle, Position } from '@xyflow/react'
import { useCanvasStore } from '@/stores/canvasStore'
import { blockIconMap } from '@/lib/iconMap'
import { Activity, AlertTriangle, Pencil } from 'lucide-react'

/* Tokenized semantic color map for simulation metrics */
const METRIC_COLORS = {
  latency: {
    high: 'rgb(var(--error-rgb))',
    medium: 'rgb(var(--warning-rgb))',
    low: 'rgb(var(--success-rgb))',
  },
  load: {
    high: 'rgb(var(--error-rgb))',
    medium: 'rgb(var(--warning-rgb))',
    low: 'rgb(var(--success-rgb))',
  },
}

/* Tokenized validation color map */
const VALIDATION_COLORS = {
  critical: 'rgb(var(--error-rgb))',
  warning: 'rgb(var(--warning-rgb))',
  info: 'rgb(var(--text-muted-rgb))',
  risk: 'rgb(var(--warning-rgb))',
}

export const CustomBlockNode = ({ data, selected: rfSelected, id }) => {
  const IconComponent = blockIconMap[data.icon] || blockIconMap['Server']
  const color = data.color || '#8b5cf6'
  const nodeRef = useRef(null)
  const [pulseState, setPulseState] = useState('idle')
  const [isEditingLabel, setIsEditingLabel] = useState(false)
  const [editLabel, setEditLabel] = useState(data.label || '')
  const labelInputRef = useRef(null)

  const {
    updateNode,
    simulationRunning,
    selectedNodeId,
    validationHighlight,
  } = useCanvasStore()

  const isSelected = useMemo(() => {
    if (selectedNodeId !== null) return selectedNodeId === id
    return rfSelected || false
  }, [selectedNodeId, id, rfSelected])

  const isValidationHighlighted = useMemo(() => {
    if (!validationHighlight) return false
    return validationHighlight.elementType === 'node' && validationHighlight.elementId === id
  }, [validationHighlight, id])

  const validationSeverity = validationHighlight?.severity || 'warning'
  const validationColor = VALIDATION_COLORS[validationSeverity] || VALIDATION_COLORS.warning

  useEffect(() => {
    if (!isEditingLabel) {
      setEditLabel(data.label || '')
    }
  }, [data.label, isEditingLabel])

  useEffect(() => {
    if (isEditingLabel && labelInputRef.current) {
      labelInputRef.current.focus()
      labelInputRef.current.select()
    }
  }, [isEditingLabel])

  useEffect(() => {
    if (!simulationRunning || !data.metrics) {
      setPulseState('idle')
      return
    }
    const { errors, latency, rps } = data.metrics
    if (errors > 20) setPulseState('error')
    else if (latency > 200) setPulseState('warning')
    else if (rps > 0) setPulseState('processing')
    else setPulseState('idle')
  }, [simulationRunning, data.metrics])

  const getPulseStyles = () => {
    switch (pulseState) {
      case 'processing':
        return {
          boxShadow: `0 0 0 0 ${color}40, 0 0 20px ${color}30`,
          animation: 'node-pulse-processing 1.5s ease-in-out infinite',
        }
      case 'warning':
        return {
          boxShadow: `0 0 0 0 rgb(var(--warning-rgb) / 0.25), 0 0 20px rgb(var(--warning-rgb) / 0.18)`,
          animation: 'node-pulse-warning 1s ease-in-out infinite',
        }
      case 'error':
        return {
          boxShadow: `0 0 0 0 rgb(var(--error-rgb) / 0.25), 0 0 20px rgb(var(--error-rgb) / 0.18)`,
          animation: 'node-pulse-error 0.7s ease-in-out infinite',
        }
      default:
        return {}
    }
  }

  const getStatusIcon = () => {
    switch (pulseState) {
      case 'processing':
        return <Activity size={12} className="text-resonance-success animate-pulse" />
      case 'warning':
        return <AlertTriangle size={12} className="text-resonance-warning" />
      case 'error':
        return <AlertTriangle size={12} className="text-resonance-error" />
      default:
        return null
    }
  }

  const startEditing = (e) => {
    e.stopPropagation()
    setEditLabel(data.label || '')
    setIsEditingLabel(true)
  }

  const commitLabel = () => {
    const trimmed = editLabel.trim()
    if (trimmed && trimmed !== (data.label || '')) {
      updateNode(id, { label: trimmed })
    }
    setIsEditingLabel(false)
  }

  const handleLabelKeyDown = (e) => {
    e.stopPropagation()
    if (e.key === 'Enter') {
      commitLabel()
    } else if (e.key === 'Escape') {
      setEditLabel(data.label || '')
      setIsEditingLabel(false)
    }
  }

  const containerClasses = useMemo(() => {
    const classes = ['relative', 'group', 'min-w-[180px]', 'transition-all', 'duration-300']
    if (isSelected) {
      classes.push('ring-2', 'ring-resonance-accent', 'ring-offset-2', 'ring-offset-resonance-canvas-bg')
    }
    if (isValidationHighlighted) {
      classes.push('animate-pulse')
    }
    return classes.join(' ')
  }, [isSelected, isValidationHighlighted])

  const validationRingStyle = useMemo(() => {
    if (!isValidationHighlighted) return {}
    return {
      boxShadow: `0 0 0 2px ${validationColor}, 0 0 12px ${validationColor}60, 0 0 24px ${validationColor}30`,
      borderRadius: '0.75rem',
    }
  }, [isValidationHighlighted, validationColor])

  const mergedNodeStyle = useMemo(() => {
    const pulse = getPulseStyles()
    return {
      ...pulse,
      ...validationRingStyle,
    }
  }, [pulseState, isValidationHighlighted, validationColor])

  /* Tokenized metric bar colors */
  const getLatencyBarColor = (latency) => {
    if (latency > 200) return METRIC_COLORS.latency.high
    if (latency > 100) return METRIC_COLORS.latency.medium
    return METRIC_COLORS.latency.low
  }

  const getLoadBarColor = (utilization) => {
    if (utilization > 0.85) return METRIC_COLORS.load.high
    if (utilization > 0.7) return METRIC_COLORS.load.medium
    return METRIC_COLORS.load.low
  }

  return (
    <div
      ref={nodeRef}
      className={containerClasses}
      data-canvas-element="true"
      data-node-id={id}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-resonance-accent !border-2 !border-resonance-canvas-bg !rounded-full"
      />

      <div
        className="bg-resonance-bg-elevated border border-resonance-border rounded-xl p-3 shadow-lg hover:shadow-xl transition-all duration-200"
        style={{
          borderLeft: `3px solid ${color}`,
          ...mergedNodeStyle,
        }}
      >
        <div className="flex items-center gap-2 mb-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${color}15` }}
          >
            <IconComponent size={16} style={{ color }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              {isEditingLabel ? (
                <input
                  ref={labelInputRef}
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  onBlur={commitLabel}
                  onKeyDown={handleLabelKeyDown}
                  onClick={(e) => e.stopPropagation()}
                  className="nodrag text-sm font-semibold text-resonance-text-primary bg-resonance-bg-tertiary border border-resonance-accent rounded px-1 py-0.5 w-full focus:outline-none focus:ring-2 focus:ring-resonance-accent/30"
                  data-canvas-input="true"
                />
              ) : (
                <>
                  <p
                    className="text-sm font-semibold text-resonance-text-primary truncate cursor-text hover:bg-resonance-bg-tertiary rounded px-1 -mx-1 transition-colors"
                    onDoubleClick={startEditing}
                    title="Double-click to edit name"
                  >
                    {data.label}
                  </p>
                  <Pencil
                    size={10}
                    className="text-resonance-text-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0 cursor-pointer"
                    onClick={startEditing}
                  />
                </>
              )}
              {getStatusIcon()}
            </div>
            <p className="text-xs text-resonance-text-muted capitalize">
              {data.type.replace(/-/g, ' ')}
            </p>
          </div>
        </div>

        {simulationRunning && data.metrics && (
          <div className="mt-2 pt-2 border-t border-resonance-border space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-resonance-text-muted uppercase tracking-wider">RPS</span>
              <span className="text-xs font-mono font-medium text-resonance-text-primary">
                {data.metrics.rps?.toLocaleString() || 0}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] text-resonance-text-muted uppercase tracking-wider w-10">Latency</span>
              <div className="flex-1 h-1.5 bg-resonance-bg-tertiary rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min((data.metrics.latency || 0) / 5, 100)}%`,
                    backgroundColor: getLatencyBarColor(data.metrics.latency || 0),
                  }}
                />
              </div>
              <span className="text-[10px] font-mono text-resonance-text-secondary w-10 text-right">
                {data.metrics.latency || 0}ms
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[10px] text-resonance-text-muted uppercase tracking-wider">Errors</span>
              <span className={`text-xs font-mono font-medium ${
                (data.metrics.errors || 0) > 10 ? 'text-resonance-error' : 'text-resonance-success'
              }`}>
                {data.metrics.errors || 0}
              </span>
            </div>

            {data.metrics.utilization !== undefined && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-resonance-text-muted uppercase tracking-wider w-10">Load</span>
                <div className="flex-1 h-1 bg-resonance-bg-tertiary rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${(data.metrics.utilization || 0) * 100}%`,
                      backgroundColor: getLoadBarColor(data.metrics.utilization || 0),
                    }}
                  />
                </div>
                <span className="text-[10px] font-mono text-resonance-text-secondary w-10 text-right">
                  {((data.metrics.utilization || 0) * 100).toFixed(0)}%
                </span>
              </div>
            )}
          </div>
        )}

        {data.config && !simulationRunning && (
          <div className="mt-2 flex flex-wrap gap-1">
            {data.config.replicas && (
              <span className="px-1.5 py-0.5 rounded bg-resonance-bg-tertiary text-[10px] text-resonance-text-muted">
                {data.config.replicas}×
              </span>
            )}
            {data.config.port && (
              <span className="px-1.5 py-0.5 rounded bg-resonance-bg-tertiary text-[10px] text-resonance-text-muted">
                :{data.config.port}
              </span>
            )}
            {data.config.engine && (
              <span className="px-1.5 py-0.5 rounded bg-resonance-bg-tertiary text-[10px] text-resonance-text-muted capitalize">
                {data.config.engine}
              </span>
            )}
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-resonance-accent !border-2 !border-resonance-canvas-bg !rounded-full"
      />

      <style>{`
        @keyframes node-pulse-processing {
          0%, 100% { box-shadow: 0 0 0 0 ${color}40, 0 0 20px ${color}20; }
          50% { box-shadow: 0 0 0 8px ${color}00, 0 0 30px ${color}40; }
        }
        @keyframes node-pulse-warning {
          0%, 100% { box-shadow: 0 0 0 0 rgb(var(--warning-rgb) / 0.25), 0 0 20px rgb(var(--warning-rgb) / 0.18); }
          50% { box-shadow: 0 0 0 8px rgb(var(--warning-rgb) / 0), 0 0 30px rgb(var(--warning-rgb) / 0.25); }
        }
        @keyframes node-pulse-error {
          0%, 100% { box-shadow: 0 0 0 0 rgb(var(--error-rgb) / 0.25), 0 0 20px rgb(var(--error-rgb) / 0.18); }
          50% { box-shadow: 0 0 0 10px rgb(var(--error-rgb) / 0), 0 0 40px rgb(var(--error-rgb) / 0.3); }
        }
      `}</style>
    </div>
  )
}