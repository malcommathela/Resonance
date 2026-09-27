import { useCallback, useEffect, useRef } from 'react'
import { applyEdgeChanges, applyNodeChanges, useEdgesState, useNodesState } from '@xyflow/react'
import { useCanvasStore } from '@/stores/canvasStore'

// Single canvas document boundary (Phase 2).
// React Flow owns interaction state; the Zustand store owns the document.
// Flow → store: explicit commit on RF change events (user edits).
// Store → flow: bulk ops (load/undo/redo/add/remove) arrive as new array refs.
// Replaces the 4 sync effects + isSyncing guard refs in CanvasEditor; behavior identical.
export function useCanvasDocument({ onDirty } = {}) {
  const storeNodes = useCanvasStore((s) => s.nodes)
  const storeEdges = useCanvasStore((s) => s.edges)

  const [nodes, setNodes, onNodesChange] = useNodesState(storeNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(storeEdges)

  const live = useRef({ nodes, edges })
  live.current = { nodes, edges }
  const committed = useRef({ nodes: storeNodes, edges: storeEdges })

  useEffect(() => {
    if (storeNodes !== committed.current.nodes) {
      committed.current.nodes = storeNodes
      setNodes(storeNodes)
    }
  }, [storeNodes, setNodes])

  useEffect(() => {
    if (storeEdges !== committed.current.edges) {
      committed.current.edges = storeEdges
      setEdges(storeEdges)
    }
  }, [storeEdges, setEdges])

  const handleNodesChange = useCallback((changes) => {
    onNodesChange(changes)
    const next = applyNodeChanges(changes, live.current.nodes)
    live.current.nodes = next
    committed.current.nodes = next
    useCanvasStore.getState().setNodes(next)
    onDirty?.()
  }, [onNodesChange, onDirty])

  const handleEdgesChange = useCallback((changes) => {
    onEdgesChange(changes)
    const next = applyEdgeChanges(changes, live.current.edges)
    live.current.edges = next
    committed.current.edges = next
    useCanvasStore.getState().setEdges(next)
    onDirty?.()
  }, [onEdgesChange, onDirty])

  return { nodes, edges, setNodes, setEdges, handleNodesChange, handleEdgesChange }
}
