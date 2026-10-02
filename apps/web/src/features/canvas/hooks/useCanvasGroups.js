import { useCallback, useRef } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useCanvasStore } from '@/stores/canvasStore'
import { canvasCommands } from '@/features/canvas/core/canvasCommands'
import { findGroupDropTarget } from '@/features/canvas/groups/meta'

// Group/node gesture shell (Phase 10). RF streams drag positions into the
// store; the atomic pre-drag state is snapshotted here so group moves and
// resizes commit in ONE history entry each. Moved from CanvasEditor;
// behavior identical.
export function useCanvasGroups({ markDirty } = {}) {
  const { screenToFlowPosition } = useReactFlow()
  const addNode = useCanvasStore((s) => s.addNode)
  const updateNodePosition = useCanvasStore((s) => s.updateNodePosition)

  const onDragOver = useCallback((event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move' }, [])

  const onDrop = useCallback((event) => {
    event.preventDefault()
    const type = event.dataTransfer.getData('application/resonance-block')
    if (!type) return
    const position = screenToFlowPosition({ x: event.clientX, y: event.clientY })
    const newNode = addNode(type, position)
    markDirty?.()
    requestAnimationFrame(() => {
      setTimeout(() => {
        const el = document.querySelector(`[data-id="${newNode.id}"]`)
        if (el) {
          el.animate([
            { opacity: 0, transform: 'scale(0.5) translateY(20px)' },
            { opacity: 1, transform: 'scale(1) translateY(0)' }
          ], { duration: 500, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' })
        }
      }, 100)
    })
  }, [screenToFlowPosition, addNode, markDirty])

  // Pre-drag snapshot for groups: RF streams the group position into the store
  // during the drag, so the atomic pre-drag state must come from here.
  const groupDragRef = useRef(null)
  const onNodeDragStart = useCallback((_, node) => {
    if (node?.type !== 'group') {
      groupDragRef.current = null
      return
    }
    const st = useCanvasStore.getState()
    const g = st.nodes.find((n) => n.id === node.id)
    const members = {}
    ;(g?.data?.nodeIds || []).forEach((mid) => {
      const m = st.nodes.find((n) => n.id === mid)
      if (m) members[mid] = { ...m.position }
    })
    groupDragRef.current = { group: { ...node.position }, members }
  }, [])

  // Live drop-target highlight: store updates only on enter/leave, so a drag
  // costs two renders, not one per mousemove.
  const onNodeDrag = useCallback((_, node) => {
    if (!node || node.type !== 'customBlock') return
    const st = useCanvasStore.getState()
    st.setGroupDropTarget(findGroupDropTarget(st.nodes.filter((n) => n.type === 'group'), node))
  }, [])

  const onNodeDragStop = useCallback((_, node) => {
    const st = useCanvasStore.getState()
    if (node.type === 'group') {
      // Rigid move: group + members by identical delta, ONE history entry.
      canvasCommands.moveGroup(node.id, node.position, groupDragRef.current)
      groupDragRef.current = null
      markDirty?.()
      return
    }
    updateNodePosition(node.id, node.position)
    // Drop into group: node center inside a group rect adopts membership
    // (single-group rule + flat groups enforced in the store).
    st.setGroupDropTarget(null)
    const target = findGroupDropTarget(st.nodes.filter((n) => n.type === 'group'), node)
    if (target) canvasCommands.addGroupMember(target, node.id)
    markDirty?.()
  }, [updateNodePosition, markDirty])

  const onNodesDelete = useCallback((deletedNodes) => canvasCommands.deleteNodes(deletedNodes.map((n) => n.id)), [])
  const onEdgesDelete = useCallback((deletedEdges) => canvasCommands.deleteEdges(deletedEdges.map((e) => e.id)), [])

  return {
    onDragOver,
    onDrop,
    onNodeDragStart,
    onNodeDrag,
    onNodeDragStop,
    onNodesDelete,
    onEdgesDelete,
  }
}
