import React, { useMemo } from 'react'
import { useNodes, useEdges } from '@xyflow/react'
import {
  computeNodeRiskStyles,
  RISK_VISUALIZATION_CONFIG,
  SEVERITY_CONFIG,
} from '@/lib/validation'

/**
 * TopologyRiskOverlay — Renders risk badges and visual indicators
 * directly on the ReactFlow canvas as an overlay layer.
 *
 * Highlights:
 * - SPOFs: Red pulsing border + "SPOF" badge
 * - Cycles: Orange border + "CYCLE" badge
 * - Isolated/Orphaned: Gray dashed border + faded opacity
 * - Missing redundancy: Orange dashed border + "NO HA" badge
 * - Dead ends, black holes, tight coupling, etc.
 *
 * This component reads the current nodes/edges from ReactFlow context
 * and overlays badges at node positions. It does NOT modify node data
 * directly — it renders absolute-positioned divs on top of the canvas.
 */
export const TopologyRiskOverlay = ({ findings, highlightedBlockId }) => {
  const nodes = useNodes()
  const edges = useEdges()

  const { styles, badges } = useMemo(() => {
    return computeNodeRiskStyles(findings || [])
  }, [findings])

  // Build a map of node positions for badge placement
  const nodePositionMap = useMemo(() => {
    const map = {}
    for (const node of nodes) {
      map[node.id] = node.position
    }
    return map
  }, [nodes])

  // Apply highlighted block effect
  const highlightedStyle = useMemo(() => {
    if (!highlightedBlockId) return {}
    const pos = nodePositionMap[highlightedBlockId]
    if (!pos) return {}
    return {
      position: 'absolute',
      left: pos.x - 10,
      top: pos.y - 10,
      width: 120,
      height: 80,
      borderRadius: 8,
      border: '3px solid #8b5cf6',
      boxShadow: '0 0 20px rgba(139, 92, 246, 0.5), 0 0 40px rgba(139, 92, 246, 0.2)',
      pointerEvents: 'none',
      zIndex: 200,
      animation: 'pulse-purple 1.5s infinite',
    }
  }, [highlightedBlockId, nodePositionMap])

  if (!findings || findings.length === 0) return null

  return (
    <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden">
      {/* Highlight ring for selected block */}
      {highlightedBlockId && nodePositionMap[highlightedBlockId] && (
        <div style={highlightedStyle} />
      )}

      {/* Risk badges for each affected node */}
      {Object.entries(badges).map(([nodeId, badge]) => {
        const pos = nodePositionMap[nodeId]
        if (!pos) return null

        return (
          <div
            key={nodeId}
            className="absolute flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shadow-lg"
            style={{
              left: pos.x,
              top: pos.y - 22,
              backgroundColor: badge.bg,
              color: badge.color,
              border: `1px solid ${badge.color}40`,
              zIndex: 150,
              pointerEvents: 'auto',
              cursor: 'pointer',
            }}
            onClick={(e) => {
              e.stopPropagation()
              // Scroll node into view or select it
              const node = nodes.find(n => n.id === nodeId)
              if (node) {
                // Dispatch custom event for canvas editor to handle selection
                window.dispatchEvent(new CustomEvent('resonance:highlight-block', {
                  detail: { blockId: nodeId }
                }))
              }
            }}
          >
            {badge.text}
          </div>
        )
      })}

      {/* CSS Animations */}
      <style>{`
        @keyframes pulse-red {
          0%, 100% { box-shadow: 0 0 12px rgba(239, 68, 68, 0.4), 0 0 24px rgba(239, 68, 68, 0.2); }
          50% { box-shadow: 0 0 20px rgba(239, 68, 68, 0.6), 0 0 40px rgba(239, 68, 68, 0.3); }
        }
        @keyframes pulse-purple {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  )
}

/**
 * NodeRiskStyles — Returns inline styles to apply to a ReactFlow node
 * based on validation findings. Use this in your CustomBlockNode component
 * to apply risk styling directly to nodes.
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