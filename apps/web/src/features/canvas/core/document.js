// Canonical canvas document (Phases 1+4).
// Shape: { version, revision, nodes, edges, groups, notes, viewport, metadata }.
// Groups/notes ride along as arrays so old designs (nodes/edges only) load
// unchanged. IDs/positions/config are never rewritten here — normalize only
// fills missing fields.
// Dependency-free: covered by document.check.js (run: node document.check.js).
export const CANVAS_DOCUMENT_VERSION = 1

export const emptyDocument = () => ({
  version: CANVAS_DOCUMENT_VERSION,
  revision: 0,
  nodes: [],
  edges: [],
  groups: [],
  notes: [],
  viewport: { x: 0, y: 0, zoom: 1 },
  metadata: {},
})

export const createCanvasDocument = (overrides = {}) => ({
  ...emptyDocument(),
  ...overrides,
  viewport: { ...emptyDocument().viewport, ...(overrides.viewport || {}) },
  metadata: overrides.metadata && typeof overrides.metadata === 'object' ? overrides.metadata : {},
})

export function normalizeDocument(doc) {
  const nodes = Array.isArray(doc?.nodes) ? doc.nodes : []
  const edges = Array.isArray(doc?.edges) ? doc.edges : []
  const groups = Array.isArray(doc?.groups) ? doc.groups : []
  const notes = Array.isArray(doc?.notes) ? doc.notes : []
  const metadata = doc?.metadata && typeof doc.metadata === 'object' ? doc.metadata : {}
  const viewport = {
    x: Number(doc?.viewport?.x) || 0,
    y: Number(doc?.viewport?.y) || 0,
    zoom: Number(doc?.viewport?.zoom) || 1,
  }
  return {
    ...doc,
    version: Number(doc?.version) || CANVAS_DOCUMENT_VERSION,
    revision: Number(doc?.revision) || 0,
    nodes,
    edges,
    groups,
    notes,
    viewport,
    metadata,
  }
}

// Alias: spec name for the same normalizer.
export const normalizeCanvasDocument = normalizeDocument

export function cloneCanvasDocument(doc) {
  return JSON.parse(JSON.stringify(normalizeDocument(doc)))
}

// Revision advances on every meaningful mutation (store bumps it alongside
// isDirty). Pure helper so the rule is testable without the store.
export function withRevision(doc, revision) {
  return { ...doc, revision }
}

// Deterministic issue list; empty = valid. Checks edge endpoints and group
// membership against known node ids. Unknown/legacy fields are preserved,
// never errors.
export function validateCanvasDocument(doc) {
  const d = normalizeDocument(doc)
  const ids = new Set((d.nodes || []).map((n) => n?.id).filter(Boolean))
  const issues = []
  for (const e of d.edges || []) {
    const src = e?.source ?? e?.sourceId
    const tgt = e?.target ?? e?.targetId
    if (src && !ids.has(src)) issues.push({ type: 'edge-source-missing', edgeId: e?.id, nodeId: src })
    if (tgt && !ids.has(tgt)) issues.push({ type: 'edge-target-missing', edgeId: e?.id, nodeId: tgt })
  }
  const groups = [...(d.groups || []), ...(d.nodes || []).filter((n) => n?.type === 'group')]
  for (const g of groups) {
    for (const m of g?.data?.nodeIds || []) {
      if (!ids.has(m)) issues.push({ type: 'group-member-missing', groupId: g?.id, nodeId: m })
    }
  }
  return issues
}

// React Flow is a renderer, not the domain model: converters isolate it.
export function toReactFlowDocument(doc) {
  const d = normalizeDocument(doc)
  return { nodes: d.nodes, edges: d.edges }
}

export function fromReactFlowDocument(nodes, edges, base) {
  return normalizeDocument({ ...(base || {}), nodes: nodes || [], edges: edges || [] })
}

export function toPersistableCanvas(doc) {
  const d = normalizeDocument(doc)
  return toPersistable(d.nodes, d.edges)
}

// Simulation boundary (Phase 9 stub): same filter as persistence — groups,
// notes, and runtime state never reach the engine. Physics untouched.
export function toSimulationInput(doc) {
  return toPersistableCanvas(doc)
}

export function documentFromGraph(nodes, edges) {
  return { ...emptyDocument(), nodes: nodes || [], edges: edges || [] }
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
