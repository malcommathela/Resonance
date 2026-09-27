import { useCanvasStore } from '@/stores/canvasStore'
import { getFlowInstance } from './flowInstance'
import { isBlockNode } from './document'

// Central canvas command layer.
// Every input (mouse, keyboard, menu, toolbar, picker, node controls) calls
// these — never store actions directly — so behavior can't drift per input.
// Thin delegation only: domain logic stays in canvasStore/lib/blocks.
const s = () => useCanvasStore.getState()

// Collapse the last `pushes` history entries into one undo step, so compound
// ops (add+connect, paste) undo atomically. Skips if history shifted underneath.
function collapseHistory(beforeLen, pushes) {
  if (pushes < 2) return
  const h = s().history
  if (h.length - beforeLen !== pushes) return
  const kept = h.slice(0, beforeLen).concat(h[beforeLen])
  useCanvasStore.setState({ history: kept, historyIndex: kept.length })
}

let memoryClipboard = null // in-memory copy; navigator.clipboard sync is best-effort

export const hasClipboard = () => !!memoryClipboard

export const canvasCommands = {
  addNode: (type, position, overrides) => s().addNode(type, position, overrides),
  addConnectedNode: (type, position, sourceId, connectionType = 'http', overrides) => {
    const before = s().history.length
    const node = s().addNode(type, position, overrides)
    const edge = sourceId ? s().addEdge({ source: sourceId, target: node.id }, connectionType) : null
    collapseHistory(before, edge ? 2 : 1)
    s().selectNode(node.id)
    return { node, edge }
  },
  deleteSelection: () => s().deleteSelected(),
  duplicateSelection: () => s().selectedNodeIds.map((id) => s().duplicateNode(id)).filter(Boolean),
  duplicateNode: (id) => s().duplicateNode(id),
  renameNode: (id, label) => s().updateNode(id, { label }),
  connectNodes: (sourceId, targetId, connectionType = 'http') =>
    s().addEdge({ source: sourceId, target: targetId }, connectionType),
  deleteEdge: (id) => s().removeEdge(id),
  select: (id) => { if (id) s().selectNode(id); else s().clearSelection() },
  selectAll: () => s().setSelectedNodes([...s().nodes]),
  copySelection: async () => {
    const { nodes, edges, selectedNodeIds, selectedEdgeIds } = s()
    const picked = nodes.filter((n) => isBlockNode(n) && selectedNodeIds.includes(n.id))
    const ids = new Set(picked.map((n) => n.id))
    const data = {
      nodes: picked,
      edges: edges.filter((e) => {
        if (selectedEdgeIds.includes(e.id)) return true
        const src = e.source || e.sourceId
        const tgt = e.target || e.targetId
        return ids.has(src) && ids.has(tgt)
      }),
    }
    memoryClipboard = data
    try {
      await navigator.clipboard.writeText(JSON.stringify({ app: 'resonance', ...data }))
    } catch { /* clipboard unavailable — memory copy still works */ }
    return data
  },
  pasteClipboard: (position) => {
    const clip = memoryClipboard
    if (!clip || clip.nodes.length === 0) return null
    const before = s().history.length
    const anchor = clip.nodes[0]?.position || { x: 0, y: 0 }
    const base = position || { x: anchor.x + 60, y: anchor.y + 60 }
    const idMap = {}
    const created = clip.nodes.map((n) => {
      const node = s().addNode(n.data?.type, {
        x: base.x + (n.position.x - anchor.x),
        y: base.y + (n.position.y - anchor.y),
      }, {
        label: `${n.data?.label || 'Block'} copy`,
        icon: n.data?.icon,
        color: n.data?.color,
        category: n.data?.category,
        description: n.data?.description,
        config: n.data?.config,
        isCustom: n.data?.isCustom,
      })
      idMap[n.id] = node.id
      return node
    })
    let edgePushes = 0
    clip.edges.forEach((e) => {
      const src = idMap[e.source || e.sourceId]
      const tgt = idMap[e.target || e.targetId]
      if (src && tgt && s().addEdge({ source: src, target: tgt }, e.data?.connectionType || 'http')) edgePushes += 1
    })
    collapseHistory(before, created.length + edgePushes)
    s().setSelectedNodes(created)
    return created
  },
  focusSelection: () => {
    const inst = getFlowInstance()
    if (!inst) return
    const { nodes, selectedNodeIds } = s()
    const n = nodes.find((x) => x.id === selectedNodeIds[0]) || nodes[0]
    if (!n) {
      inst.fitView({ padding: 0.2, duration: 300 })
      return
    }
    const w = n.measured?.width ?? n.width ?? 200
    const h = n.measured?.height ?? n.height ?? 60
    inst.setCenter(n.position.x + w / 2, n.position.y + h / 2, { zoom: 1.2, duration: 300 })
  },
  fitArchitecture: () => getFlowInstance()?.fitView({ padding: 0.2, duration: 300 }),
  undo: () => s().undo(),
  redo: () => s().redo(),
  openInspector: (nodeId) => s().selectNode(nodeId), // panel visibility is editor-local; call sites also open it
  openNodePicker: (sourceId = null) => s().openNodePicker(sourceId),
  closeNodePicker: () => s().closeNodePicker(),
  createGroup: () => {
    const g = s().createGroup()
    if (g) s().selectNode(g.id)
    return g
  },
  renameGroup: (id, label) => s().renameGroup(id, label),
  toggleGroupCollapse: (id) => s().toggleGroupCollapse(id),
  ungroup: (id) => s().ungroup(id),
  addNote: (position) => {
    const n = s().addNote(position)
    if (n) s().selectNode(n.id)
    return n
  },
  updateNoteText: (id, text) => s().updateNoteText(id, text),
}
