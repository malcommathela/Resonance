import React, { useMemo, useState, useCallback } from 'react'
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath } from '@xyflow/react'
import { useCanvasStore } from '@/stores/canvasStore'
import { CONNECTION_TYPE_META } from '@shared/constants'
import { ChevronDown } from 'lucide-react'

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
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
  selected,
}) => {
  const { updateEdgeData, getAllConnectionTypes, simulationRunning } = useCanvasStore()
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
          stroke: data?.customColor || meta.color,
          strokeWidth: selected ? 3 : 2,
          strokeDasharray: connectionType === 'event' ? '5,5' : 'none',
          opacity: 0.6,
          transition: 'all 0.2s ease',
        }}
      />

      {simulationRunning && (
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
              backgroundColor: bgColor,
              borderColor: meta.color,
              color: meta.color,
            }}
            title="Click to change connection type"
          >
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
    </>
  )
}