import React, { memo } from 'react'
import { BaseEdge, EdgeLabelRenderer, getBezierPath } from '@xyflow/react'
import { useCanvasStore } from '@/stores/canvasStore'
import { CONNECTION_TYPE_META } from '@shared/constants'

// Lightweight architecture edge (Phase 4).
// Thin type-tinted line; selection/validation/simulation restyle the stroke.
// No permanent pills, badges, particles or per-instance gradients — the type
// label appears only when selected/highlighted, editing moves to the
// inspector (edge context menu arrives in Phase 7).
const SEVERITY_COLOR = {
  critical: 'rgb(var(--error-rgb))',
  warning: 'rgb(var(--warning-rgb))',
  risk: 'rgb(var(--warning-rgb))',
  info: 'rgb(var(--text-muted-rgb))',
}

export const ArchitectureEdge = memo(function ArchitectureEdge({
  id,
  sourceX,
  sourceY,
  sourcePosition,
  targetX,
  targetY,
  targetPosition,
  data,
  selected: rfSelected,
}) {
  const selectedEdgeId = useCanvasStore((s) => s.selectedEdgeId)
  const validationHighlight = useCanvasStore((s) => s.validationHighlight)
  const running = useCanvasStore((s) => s.simulationRunning)
  // Runtime state lives outside the document (Phase 11); data.* is fallback
  // for values persisted by older saves.
  const edgeRuntime = useCanvasStore((s) => s.simulationEdgeMetrics[id])

  const [path, labelX, labelY] = getBezierPath({
    sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition,
  })

  const connectionType = data?.connectionType || 'http'
  const meta = CONNECTION_TYPE_META[connectionType] || CONNECTION_TYPE_META.http

  const isSelected = selectedEdgeId !== null ? selectedEdgeId === id : !!rfSelected
  const highlighted = !!validationHighlight
    && validationHighlight.elementType === 'edge'
    && validationHighlight.elementId === id

  let stroke = data?.customColor || meta.color
  let strokeWidth = 1.5
  let strokeDasharray = connectionType === 'event-stream' ? '5 5' : 'none'
  let opacity = 0.55
  let flowClass = ''
  let label = meta.label

  if (highlighted) {
    const severity = validationHighlight.severity || 'warning'
    stroke = SEVERITY_COLOR[severity] || SEVERITY_COLOR.warning
    strokeWidth = 2.5
    strokeDasharray = '6 3'
    opacity = 1
    label = `Validation · ${severity}`
  } else {
    const circuitOpen = edgeRuntime?.circuitOpen ?? data?.circuitOpen === true
    const retryStorm = (edgeRuntime?.retryCount ?? data?.retryCount ?? 0) > 10
    if (circuitOpen) {
      stroke = 'rgb(var(--error-rgb))'
      strokeDasharray = '7 4'
      opacity = 1
    } else if (retryStorm) {
      stroke = 'rgb(var(--warning-rgb))'
      opacity = 1
    }
    if (isSelected) {
      strokeWidth = 2.5
      opacity = 1
    }
    if (running && !circuitOpen) {
      strokeDasharray = '6 4'
      flowClass = 'arch-edge-flow'
    }
  }

  return (
    <>
      <BaseEdge
        path={path}
        style={{ stroke, strokeWidth, strokeDasharray, opacity }}
        className={flowClass || undefined}
      />
      {(isSelected || highlighted) && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan pointer-events-none absolute rounded-full border border-resonance-border bg-resonance-bg-elevated px-1.5 py-0.5 text-[10px] font-medium text-resonance-text-secondary shadow-sm"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)` }}
          >
            {data?.label || label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
})
