import { useCallback, useEffect } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useCanvasStore } from '@/stores/canvasStore'
import { canvasCommands } from '@/features/canvas/core/canvasCommands'

// Selection authority shell (Phase 6/10). All canvas selection requests flow
// through here → canvasCommands → store. Validation emphasis stays separate
// state (transient finding focus, never selection). Moved verbatim from
// CanvasEditor; behavior identical.
export function useCanvasSelection({ onShowProperties, onShowContextMenu } = {}) {
  const { setCenter } = useReactFlow()

  const selectedNodeId = useCanvasStore((s) => s.selectedNodeId)
  const selectedEdgeId = useCanvasStore((s) => s.selectedEdgeId)
  const selectedNodeIds = useCanvasStore((s) => s.selectedNodeIds)
  const selectedEdgeIds = useCanvasStore((s) => s.selectedEdgeIds)
  const validationHighlight = useCanvasStore((s) => s.validationHighlight)

  const centerOf = (n) => {
    const w = n.measured?.width ?? n.width ?? 200
    const h = n.measured?.height ?? n.height ?? 60
    return { x: n.position.x + w / 2, y: n.position.y + h / 2 }
  }

  // Validation emphasis pans only — selection stays the authority.
  useEffect(() => {
    if (!validationHighlight || !setCenter) return
    const st = useCanvasStore.getState()
    const { elementId, elementType } = validationHighlight
    if (elementType === 'node') {
      const node = st.nodes.find((n) => n.id === elementId)
      if (node) {
        const c = centerOf(node)
        setCenter(c.x, c.y, { zoom: 1.2, duration: 800 })
      }
    } else if (elementType === 'edge') {
      const edge = st.edges.find((e) => e.id === elementId)
      if (edge) {
        const a = st.nodes.find((n) => n.id === (edge.source || edge.sourceId))
        const b = st.nodes.find((n) => n.id === (edge.target || edge.targetId))
        if (a && b) {
          const ca = centerOf(a)
          const cb = centerOf(b)
          setCenter((ca.x + cb.x) / 2, (ca.y + cb.y) / 2, { zoom: 1.2, duration: 800 })
        }
      }
    }
  }, [validationHighlight, setCenter])

  // Marker click focuses the element (overlay only dispatches; selection stays the authority).
  useEffect(() => {
    const onBadge = (e) => {
      const st = useCanvasStore.getState()
      const blockId = e.detail?.blockId
      if (blockId) {
        const node = st.nodes.find((n) => n.id === blockId)
        if (!node) return
        canvasCommands.selectNode(blockId)
        const c = centerOf(node)
        setCenter(c.x, c.y, { zoom: 1.2, duration: 500 })
        return
      }
      const edgeId = e.detail?.edgeId
      if (edgeId) {
        const edge = st.edges.find((x) => x.id === edgeId)
        if (!edge) return
        const a = st.nodes.find((n) => n.id === (edge.source || edge.sourceId))
        const b = st.nodes.find((n) => n.id === (edge.target || edge.targetId))
        if (!a || !b) return
        canvasCommands.selectEdge(edgeId)
        const ca = centerOf(a)
        const cb = centerOf(b)
        setCenter((ca.x + cb.x) / 2, (ca.y + cb.y) / 2, { zoom: 1.2, duration: 500 })
      }
    }
    window.addEventListener('resonance:highlight-block', onBadge)
    return () => window.removeEventListener('resonance:highlight-block', onBadge)
  }, [setCenter])

  // Contextual inspector opener (panel is editor-local; command covers selection).
  const openPropertiesFor = useCallback((kind, id) => {
    if (kind === 'edge') canvasCommands.selectEdge(id)
    else canvasCommands.openInspector(id)
    onShowProperties?.()
  }, [onShowProperties])

  // Groups select only — the service Property Panel never opens for them.
  const onNodeClick = useCallback((_, node) => {
    canvasCommands.selectNode(node.id)
    if (node.type === 'customBlock') onShowProperties?.()
  }, [onShowProperties])
  const onEdgeClick = useCallback((_, edge) => {
    canvasCommands.selectEdge(edge.id)
    onShowProperties?.()
  }, [onShowProperties])
  const onNodeDoubleClick = useCallback((_, node) => {
    if (node.type !== 'customBlock') return // group rename is handled in the header
    openPropertiesFor('node', node.id)
  }, [openPropertiesFor])
  const onEdgeDoubleClick = useCallback((_, edge) => openPropertiesFor('edge', edge.id), [openPropertiesFor])

  const onNodeContextMenu = useCallback((e, node) => {
    e.preventDefault()
    canvasCommands.selectNode(node.id)
    onShowContextMenu?.({ x: e.clientX, y: e.clientY, kind: node.type === 'group' ? 'group' : 'node', id: node.id })
  }, [onShowContextMenu])
  const onEdgeContextMenu = useCallback((e, edge) => {
    e.preventDefault()
    canvasCommands.selectEdge(edge.id)
    onShowContextMenu?.({ x: e.clientX, y: e.clientY, kind: 'edge', id: edge.id })
  }, [onShowContextMenu])
  const onPaneContextMenu = useCallback((e) => {
    e.preventDefault()
    onShowContextMenu?.({ x: e.clientX, y: e.clientY, kind: 'pane' })
  }, [onShowContextMenu])

  const onSelectionChange = useCallback(({ nodes: selNodes, edges: selEdges }) => {
    if (selNodes.length === 1 && selEdges.length === 0) {
      canvasCommands.selectNode(selNodes[0].id)
    } else if (selNodes.length === 0 && selEdges.length === 1) {
      canvasCommands.selectEdge(selEdges[0].id)
    } else if (selNodes.length === 0 && selEdges.length === 0) {
      canvasCommands.clearSelection()
    } else {
      // Multi-select: bulk path preserves every selected edge (not just the first).
      canvasCommands.selectNodes(selNodes.map((n) => n.id))
      canvasCommands.selectEdges((selEdges || []).map((e) => e.id))
    }
  }, [])

  return {
    selectedNodeId,
    selectedEdgeId,
    selectedNodeIds,
    selectedEdgeIds,
    validationHighlight,
    openPropertiesFor,
    onNodeClick,
    onEdgeClick,
    onNodeDoubleClick,
    onEdgeDoubleClick,
    onNodeContextMenu,
    onEdgeContextMenu,
    onPaneContextMenu,
    onSelectionChange,
  }
}
