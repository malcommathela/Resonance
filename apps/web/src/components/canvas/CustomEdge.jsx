import React, { useMemo, useState, useCallback } from 'react'
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath } from '@xyflow/react'
import { useCanvasStore } from '@/stores/canvasStore'
import { CONNECTION_TYPE_META } from '@shared/constants'
import { ChevronDown, AlertTriangle, XCircle } from 'lucide-react'

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/* Tokenized semantic colors for edge states */
const EDGE_STATE_COLORS = {
  circuitOpen: 'rgb(var(--error-rgb))',
  retryStorm: 'rgb(var(--warning-rgb))',
  highLatency: 'rgb(var(--warning-rgb))',
}

const VALIDATION_COLORS = {
  critical: 'rgb(var(--error-rgb))',
  warning: 'rgb(var(--warning-rgb))',
  info: 'rgb(var(--text-muted-rgb))',
  risk: 'rgb(var(--warning-rgb))',
}

export const CustomEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected: rfSelected,
}) => {
  const {
    updateEdgeData,
    getAllConnectionTypes,
    simulationRunning,
    selectedEdgeId,
    validationHighlight,
  } = useCanvasStore()

  const [showTypeMenu, setShowTypeMenu] = useState(false)
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition,
  })

  const allTypes = getAllConnectionTypes()
  const connectionType = data?.connectionType || 'http'
  const meta = CONNECTION_TYPE_META[connectionType] || CONNECTION_TYPE_META['http'] || {
    label: 'HTTP', color: '#3b82f6', icon: 'Globe'
  }

  const setType = useCallback((typeId) => {
    updateEdgeData(id, { connectionType: typeId })
    setShowTypeMenu(false)
  }, [id, updateEdgeData])

  const gradientId = useMemo(() => `grad-${id.replace(/[^a-zA-Z0-9]/g, '')}`, [id])
  const bgColor = hexToRgba(meta.color, 0.08)
  const particleColor = data?.customColor || meta.color

  const isSelected = useMemo(() => {
    if (selectedEdgeId !== null) return selectedEdgeId === id
    return rfSelected || false
  }, [selectedEdgeId, id, rfSelected])

  const isValidationHighlighted = useMemo(() => {
    if (!validationHighlight) return false
    return validationHighlight.elementType === 'edge' && validationHighlight.elementId === id
  }, [validationHighlight, id])

  const validationSeverity = validationHighlight?.severity || 'warning'
  const validationColor = VALIDATION_COLORS[validationSeverity] || VALIDATION_COLORS.warning

  const circuitOpen = data?.circuitOpen === true
  const retryCount = data?.retryCount || 0
  const isRetryStorm = retryCount > 10
  const edgeLatency = data?.latencyMs || 0

  let strokeColor = data?.customColor || meta.color
  let strokeWidth = isSelected ? 3 : 2
  let strokeDasharray = connectionType === 'event' ? '5,5' : 'none'
  let opacity = 0.6

  if (circuitOpen) {
    strokeColor = EDGE_STATE_COLORS.circuitOpen
    strokeWidth = isSelected ? 5 : 4
    strokeDasharray = '8,4'
    opacity = 1
  } else if (isRetryStorm) {
    strokeColor = EDGE_STATE_COLORS.retryStorm
    strokeWidth = isSelected ? 4 : 3
    opacity = 1
  } else if (edgeLatency > 500) {
    strokeColor = EDGE_STATE_COLORS.highLatency
    strokeWidth = isSelected ? 3 : 2
  }

  if (isValidationHighlighted) {
    strokeColor = validationColor
    strokeWidth = isSelected ? 4 : 3
    strokeDasharray = '6,3'
    opacity = 1
  }

  const showParticles = simulationRunning && !circuitOpen

  return (
    <>
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={particleColor} stopOpacity="0" />
          <stop offset="50%" stopColor={particleColor} stopOpacity="1" />
          <stop offset="100%" stopColor={particleColor} stopOpacity="0" />
        </linearGradient>
      </defs>

      <BaseEdge
        path={edgePath}
        style={{
          stroke: strokeColor,
          strokeWidth,
          strokeDasharray,
          opacity,
          transition: 'all 0.3s ease',
          ...(isValidationHighlighted && {
            filter: `drop-shadow(0 0 6px ${validationColor})`,
            animation: 'pulse-edge-validation 1.2s ease-in-out infinite',
          }),
          ...(isRetryStorm && !isValidationHighlighted && {
            filter: `drop-shadow(0 0 4px ${strokeColor})`,
            animation: 'pulse-edge 1.5s ease-in-out infinite',
          }),
        }}
      />

      {/* Circuit breaker badge */}
      {circuitOpen && (
        <g pointerEvents="none">
          <rect
            x={labelX - 44}
            y={labelY - 12}
            width={88}
            height={20}
            rx={10}
            fill="rgb(var(--error-rgb))"
            opacity={0.92}
          />
          <text
            x={labelX}
            y={labelY + 3}
            textAnchor="middle"
            fill="white"
            fontSize="9"
            fontWeight="600"
            fontFamily="system-ui, sans-serif"
          >
            CIRCUIT OPEN
          </text>
        </g>
      )}

      {/* Retry storm badge */}
      {!circuitOpen && isRetryStorm && (
        <g pointerEvents="none">
          <rect
            x={labelX - 40}
            y={labelY - 12}
            width={80}
            height={20}
            rx={10}
            fill="rgb(var(--warning-rgb))"
            opacity={0.92}
          />
          <text
            x={labelX}
            y={labelY + 3}
            textAnchor="middle"
            fill="white"
            fontSize="9"
            fontWeight="600"
            fontFamily="system-ui, sans-serif"
          >
            RETRY STORM
          </text>
        </g>
      )}

      {/* Validation highlight badge */}
      {isValidationHighlighted && (
        <g pointerEvents="none">
          <rect
            x={labelX - 36}
            y={labelY - 12}
            width={72}
            height={20}
            rx={10}
            fill={validationColor}
            opacity={0.92}
          />
          <text
            x={labelX}
            y={labelY + 3}
            textAnchor="middle"
            fill="white"
            fontSize="9"
            fontWeight="600"
            fontFamily="system-ui, sans-serif"
          >
            VALIDATION
          </text>
        </g>
      )}

      {showParticles && (
        <g pointerEvents="none">
          {[0, 0.6, 1.2].map((delay, i) => (
            <ellipse key={i} rx={4 - i * 0.7} ry={2 - i * 0.3} fill={`url(#${gradientId})`} opacity={0.9 - i * 0.2}>
              <animateMotion
                dur="2s"
                begin={`${delay}s`}
                repeatCount="indefinite"
                path={edgePath}
                rotate="auto"
                calcMode="spline"
                keySplines="0.42 0 0.58 1"
              />
            </ellipse>
          ))}
        </g>
      )}

      <EdgeLabelRenderer>
        <div
          className="nodrag nopan"
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            zIndex: showTypeMenu ? 100 : 10,
          }}
        >
          <button
            onClick={() => setShowTypeMenu(!showTypeMenu)}
            className="flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold transition-all hover:scale-105 active:scale-95 cursor-pointer"
            style={{
              backgroundColor: circuitOpen ? 'rgb(var(--error-rgb) / 0.08)' : isRetryStorm ? 'rgb(var(--warning-rgb) / 0.08)' : bgColor,
              borderColor: circuitOpen ? 'rgb(var(--error-rgb))' : isRetryStorm ? 'rgb(var(--warning-rgb))' : meta.color,
              color: circuitOpen ? 'rgb(var(--error-rgb))' : isRetryStorm ? 'rgb(var(--warning-rgb))' : meta.color,
            }}
            title="Click to change connection type"
          >
            {circuitOpen ? <XCircle size={10} className="mr-0.5" /> : isRetryStorm ? <AlertTriangle size={10} className="mr-0.5" /> : null}
            {data?.label || meta.label}
            <ChevronDown size={10} />
          </button>

          {showTypeMenu && (
            <div
              className="absolute top-full left-1/2 -translate-x-1/2 mt-1 bg-resonance-bg-elevated border border-resonance-border rounded-lg shadow-xl py-1 min-w-[120px]"
              onClick={(e) => e.stopPropagation()}
            >
              {allTypes.map(type => {
                const typeMeta = CONNECTION_TYPE_META[type.id] || { color: type.color, label: type.label }
                return (
                  <button
                    key={type.id}
                    onClick={() => setType(type.id)}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-[11px] transition-colors ${
                      connectionType === type.id
                        ? 'bg-resonance-accent/10 text-resonance-accent'
                        : 'text-resonance-text-secondary hover:bg-resonance-bg-hover'
                    }`}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: typeMeta.color || type.color }}
                    />
                    {typeMeta.label || type.label}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </EdgeLabelRenderer>

      {isValidationHighlighted && (
        <style>{`
          @keyframes pulse-edge-validation {
            0%, 100% { filter: drop-shadow(0 0 4px ${validationColor}); }
            50% { filter: drop-shadow(0 0 10px ${validationColor}); }
          }
        `}</style>
      )}
    </>
  )
}