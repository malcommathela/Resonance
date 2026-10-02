import React, { useMemo } from 'react'
import { useNodes, useEdges, useViewport } from '@xyflow/react'
import { AlertTriangle } from 'lucide-react'
import { computeNodeRiskStyles, SEVERITY_CONFIG } from '@/lib/validation'

/**
 * TopologyRiskOverlay — compact validation markers floating above affected
 * nodes/edges. Positions are converted from flow coordinates to screen
 * coordinates via the live React Flow viewport (Phase 12), so markers stay
 * attached through zoom / pan / fit-view / node movement. Full finding
 * details live in the Validation panel; the canvas shows only severity +
 * count (Phase 13). Finding semantics in lib/validation.js are untouched.
 */
export const TopologyRiskOverlay = ({ findings, highlightedBlockId }) => {
  const nodes = useNodes()
  const edges = useEdges()
  const viewport = useViewport()

  const nodeMap = useMemo(() => {
    const map = {}
    for (const node of nodes) {
      // ponytail: measured dims when available, fallback estimates otherwise
      map[node.id] = {
        x: node.position.x,
        y: node.position.y,
        w: node.measured?.width ?? node.width ?? 200,
        h: node.measured?.height ?? node.height ?? 60,
      }
    }
    return map
  }, [nodes])

  // Group findings per node / per edge (count + worst severity)
  const { nodeMarks, edgeMarks } = useMemo(() => {
    const nodeMarks = {}
    const edgeMarks = {}
    for (const f of findings || []) {
      const elementId = f.elementId || f.blockId || f.edgeId
      const elementType = f.elementType || (f.blockId ? 'node' : f.edgeId ? 'edge' : null)
      const ids = f.affectedBlockIds || (elementId && elementType === 'node' ? [elementId] : [])
      for (const id of ids) {
        const m = nodeMarks[id] || { count: 0, worst: 999 }
        m.count += 1
        m.worst = Math.min(m.worst, SEVERITY_CONFIG[f.severity]?.priority ?? 999)
        nodeMarks[id] = m
      }
      if (elementId && elementType === 'edge') {
        const m = edgeMarks[elementId] || { count: 0, worst: 999 }
        m.count += 1
        m.worst = Math.min(m.worst, SEVERITY_CONFIG[f.severity]?.priority ?? 999)
        edgeMarks[elementId] = m
      }
    }
    return { nodeMarks, edgeMarks }
  }, [findings])

  const toScreen = (fx, fy) => ({
    x: fx * viewport.zoom + viewport.x,
    y: fy * viewport.zoom + viewport.y,
  })
  const severityColor = (worst) =>
    Object.values(SEVERITY_CONFIG).find((c) => c.priority === worst)?.color || '#f59e0b'

  const highlight = highlightedBlockId ? nodeMap[highlightedBlockId] : null
  const highlightScreen = highlight ? toScreen(highlight.x, highlight.y) : null

  // Edge midpoint in flow coords from source/target geometry
  const edgeMidpoint = (edge) => {
    const s = nodeMap[edge.source || edge.sourceId]
    const t = nodeMap[edge.target || edge.targetId]
    if (!s || !t) return null
    return {
      x: (s.x + s.w / 2 + t.x + t.w / 2) / 2,
      y: (s.y + s.h / 2 + t.y + t.h / 2) / 2,
    }
  }

  if (!findings || findings.length === 0) return null

  return (
    <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
      {highlightScreen && (
        <div
          style={{
            position: 'absolute',
            left: highlightScreen.x - 4,
            top: highlightScreen.y - 4,
            width: highlight.w * viewport.zoom + 8,
            height: highlight.h * viewport.zoom + 8,
            borderRadius: 8,
            border: '3px solid #8b5cf6',
            boxShadow: '0 0 20px rgba(139, 92, 246, 0.5), 0 0 40px rgba(139, 92, 246, 0.2)',
            pointerEvents: 'none',
          }}
        />
      )}

      {Object.entries(nodeMarks).map(([nodeId, mark]) => {
        const n = nodeMap[nodeId]
        if (!n) return null
        const p = toScreen(n.x + n.w / 2, n.y)
        const color = severityColor(mark.worst)
        return (
          <button
            key={nodeId}
            aria-label={`${mark.count} validation finding${mark.count > 1 ? 's' : ''} on node`}
            onClick={(e) => {
              e.stopPropagation()
              window.dispatchEvent(new CustomEvent('resonance:highlight-block', {
                detail: { blockId: nodeId },
              }))
            }}
            className="absolute flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold shadow-lg"
            style={{
              left: p.x,
              top: p.y - 24,
              transform: 'translateX(-50%)',
              backgroundColor: `${color}26`,
              color,
              border: `1px solid ${color}40`,
              pointerEvents: 'auto',
              cursor: 'pointer',
            }}
          >
            <AlertTriangle size={10} aria-hidden="true" />
            {mark.count}
          </button>
        )
      })}

      {Object.entries(edgeMarks).map(([edgeId, mark]) => {
        const edge = edges.find((e) => e.id === edgeId)
        if (!edge) return null
        const mid = edgeMidpoint(edge)
        if (!mid) return null
        const p = toScreen(mid.x, mid.y)
        const color = severityColor(mark.worst)
        return (
          <button
            key={edgeId}
            aria-label={`${mark.count} validation finding${mark.count > 1 ? 's' : ''} on connection`}
            onClick={(e) => {
              e.stopPropagation()
              window.dispatchEvent(new CustomEvent('resonance:highlight-block', {
                detail: { blockId: null, edgeId },
              }))
            }}
            className="absolute flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold shadow-lg"
            style={{
              left: p.x,
              top: p.y - 14,
              transform: 'translateX(-50%)',
              backgroundColor: `${color}26`,
              color,
              border: `1px solid ${color}40`,
              pointerEvents: 'auto',
              cursor: 'pointer',
            }}
          >
            <AlertTriangle size={10} aria-hidden="true" />
            {mark.count}
          </button>
        )
      })}
    </div>
  )
}

/**
 * NodeRiskStyles — Returns inline styles to apply to a ReactFlow node.
 */
export function getNodeRiskStyle(nodeId, findings) {
  if (!findings || findings.length === 0) return {}
  const { styles } = computeNodeRiskStyles(findings)
  return styles[nodeId] || {}
}

/**
 * EdgeRiskStyles — Returns inline styles to apply to edges
 * based on validation findings (e.g., highlighting edges in cycles).
 */
export function getEdgeRiskStyle(edgeId, findings) {
  if (!findings || findings.length === 0) return {}

  // Find cycle findings that involve this edge
  const cycleFindings = findings.filter(f =>
    f.type === 'cycle' && f.edgeId === edgeId
  )

  if (cycleFindings.length > 0) {
    return {
      stroke: '#f59e0b',
      strokeWidth: 3,
      strokeDasharray: '5,5',
      animation: 'dash 1s linear infinite',
    }
  }

  return {}
}
