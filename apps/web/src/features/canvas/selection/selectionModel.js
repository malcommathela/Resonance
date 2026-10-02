// Semantic selection model (Phase 6). One authority: canvasStore.
// React Flow, validation, overlays, and menus REQUEST selection through
// canvasCommands — they never own it. Validation emphasis (transient,
// "finding X concerns A") is separate state from selection ("user picked A").
// Dependency-free: covered by selection.check.js (run: node selection.check.js).
export const emptySelection = () => ({ nodes: [], edges: [], primary: { type: null, id: null } })

export function normalizeSelection(sel) {
  const nodes = Array.isArray(sel?.nodes) ? [...new Set(sel.nodes)] : []
  const edges = Array.isArray(sel?.edges) ? [...new Set(sel.edges)] : []
  const primary = sel?.primary?.id != null &&
    ((sel.primary.type === 'node' && nodes.includes(sel.primary.id)) ||
      (sel.primary.type === 'edge' && edges.includes(sel.primary.id)))
    ? { type: sel.primary.type, id: sel.primary.id }
    : { type: nodes.length ? 'node' : edges.length ? 'edge' : null, id: nodes[0] ?? edges[0] ?? null }
  return { nodes, edges, primary }
}

// Drop ids whose elements are gone (delete/undo/load). Pure so every producer
// shares the rule; the store applies it on selection writes.
export function pruneSelection(sel, nodeIds, edgeIds) {
  const validNodes = new Set(nodeIds)
  const validEdges = new Set(edgeIds)
  return normalizeSelection({
    nodes: (sel?.nodes || []).filter((id) => validNodes.has(id)),
    edges: (sel?.edges || []).filter((id) => validEdges.has(id)),
    primary: sel?.primary,
  })
}

export function selectionFromIds(nodeIds = [], edgeIds = []) {
  return normalizeSelection({ nodes: nodeIds, edges: edgeIds })
}

// A highlight target is live only while its element exists — stale emphasis
// after delete/undo resolves to null instead of panning to a ghost.
export function resolveHighlightTarget(highlight, nodes, edges) {
  if (!highlight?.elementId) return null
  const list = highlight.elementType === 'edge' ? edges : nodes
  return (list || []).some((n) => n.id === highlight.elementId) ? highlight : null
}
