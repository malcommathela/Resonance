import React from 'react'
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath } from '@xyflow/react'
import { useCanvasStore } from '@/stores/canvasStore'

const TYPE_META = {
  http: { label: 'HTTP', color: '#3b82f6', bg: '#3b82f615' },
  grpc: { label: 'gRPC', color: '#10b981', bg: '#10b98115' },
  websocket: { label: 'WS', color: '#8b5cf6', bg: '#8b5cf615' },
  event: { label: 'Event', color: '#f59e0b', bg: '#f59e0b15' },
  db: { label: 'DB', color: '#ef4444', bg: '#ef444415' },
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
  const { updateEdge } = useCanvasStore()
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition,
  })

  const connectionType = data?.connectionType || 'http'
  const meta = TYPE_META[connectionType] || TYPE_META['http']

  const cycleType = () => {
    const types = Object.keys(TYPE_META)
    const idx = types.indexOf(connectionType)
    const next = types[(idx + 1) % types.length]
    updateEdge(id, { data: { connectionType: next } })
  }

  return (
    <>
      <BaseEdge
        path={edgePath}
        style={{
          stroke: meta.color,
          strokeWidth: selected ? 3 : 2,
          strokeDasharray: connectionType === 'event' ? '5,5' : 'none',
        }}
      />
      <EdgeLabelRenderer>
        <button
          onClick={cycleType}
          className="nodrag nopan px-2 py-0.5 rounded-full border text-[10px] font-semibold transition-all hover:scale-110 active:scale-95"
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            backgroundColor: meta.bg,
            borderColor: meta.color,
            color: meta.color,
          }}
          title="Click to cycle connection type"
        >
          {meta.label}
        </button>
      </EdgeLabelRenderer>
    </>
  )
}