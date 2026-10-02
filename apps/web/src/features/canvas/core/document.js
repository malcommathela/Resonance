// Canonical V2 architecture document (Phase 2).
// Shape: { nodes, edges, groups, notes, metadata }.
// Groups/notes arrive in Phase 8; until then they ride along as empty arrays
// so old designs (nodes/edges only) load unchanged. IDs/positions/config
// are never rewritten here — normalize only fills missing fields.
// Dependency-free: covered by document.check.js (run: node document.check.js).
export const emptyDocument = () => ({ nodes: [], edges: [], groups: [], notes: [], metadata: {} })

export function normalizeDocument(doc) {
  const nodes = Array.isArray(doc?.nodes) ? doc.nodes : []
  const edges = Array.isArray(doc?.edges) ? doc.edges : []
  const groups = Array.isArray(doc?.groups) ? doc.groups : []
  const notes = Array.isArray(doc?.notes) ? doc.notes : []
  const metadata = doc?.metadata && typeof doc.metadata === 'object' ? doc.metadata : {}
  return { ...doc, nodes, edges, groups, notes, metadata }
}

export function documentFromGraph(nodes, edges) {
  return { nodes: nodes || [], edges: edges || [], groups: [], notes: [], metadata: {} }
}

export const isBlockNode = (n) => n?.type === 'customBlock'
export const isGroupNode = (n) => n?.type === 'group'

// Nodes the backend understands. Group canvas objects plus per-tick
// runtime state never reach the API — single funnel: designStore saves.
// Note: edge retryCount is left alone (config and runtime share the key;
// the engine recomputes it, so a stale value is harmless).
export function stripRuntimeState(nodes, edges) {
  return {
    nodes: (nodes || []).map((n) => {
      if (!isBlockNode(n) || !n.data || !('metrics' in n.data)) return n
      const data = { ...n.data }
      delete data.metrics
      return { ...n, data }
    }),
    edges: (edges || []).map((e) => {
      if (!e?.data || (e.data.circuitOpen === undefined && e.data.latencyMs === undefined)) return e
      const data = { ...e.data }
      delete data.circuitOpen
      delete data.latencyMs
      return { ...e, data }
    }),
  }
}

export function toPersistable(nodes, edges) {
  return stripRuntimeState((nodes || []).filter(isBlockNode), edges || [])
}
