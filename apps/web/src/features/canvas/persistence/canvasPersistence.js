// Canvas persistence boundary (Phase 4).
// One interface over two mechanisms: architecture blocks/edges go through the
// API via designStore, group canvas objects ride in localStorage compat keys.
// Consumers call load/save — they never touch localStorage or decide what is
// persisted. No DB migration: the Block/Edge contract only understands
// simulating blocks (see document.js toPersistable).
// Covered by persistence.check.js (run: node persistence.check.js).
import { persistCanvasMeta, readCanvasMeta } from '../groups/meta.js'
import { toPersistable, isGroupNode } from '../core/document.js'

export function splitPersistable(nodes, edges) {
  const { nodes: blocks } = toPersistable(nodes, edges)
  return {
    blocks,
    edges: edges || [],
    groups: (nodes || []).filter(isGroupNode),
  }
}

export function loadCanvasPersistence(designId, getState) {
  // Architecture comes from the caller (designStore/API); groups merge from
  // localStorage compat. Returns group nodes to append, or [].
  const meta = readCanvasMeta(designId)
  if (!meta?.groups?.length) return []
  const have = new Set((getState?.().nodes || []).map((n) => n.id))
  return meta.groups.filter((n) => n && n.id && !have.has(n.id))
}

export function saveCanvasPersistence(designId, nodes, edges) {
  persistCanvasMeta(designId, nodes)
  return splitPersistable(nodes, edges)
}

// Lineage of server versions observed by THIS tab: 'ours' = committed by our
// saves, 'seen' = loaded. Lets autosave tell a same-tab race (safe to retry
// with latest state) from a foreign writer (must NOT overwrite — abort loud).
const serverVersionLineage = new Map()
export function noteServerVersion(version, origin) {
  if (version != null) serverVersionLineage.set(version, origin)
}
export function serverVersionOrigin(version) {
  return version == null ? null : (serverVersionLineage.get(version) || null)
}

// Retry only our own lineage within budget; foreign versions never retry.
export function shouldRetryAfterConflict({ origin, retries, maxRetries }) {
  return origin === 'ours' && retries < maxRetries
}

// Explicit persistence boundary (Phase 8). The UI decides WHEN to save;
// this decides WHAT goes WHERE: groups → meta channel, blocks/edges → API
// via saveFn (designStore.saveCanvas / autoSaveCanvas). Transient state
// (selection, validation, sim metrics) is never passed in.
export function saveCanvasDocument(designId, { nodes, edges, revision }, saveFn) {
  saveCanvasPersistence(designId, nodes, edges)
  return saveFn(designId, { nodes, edges, revision })
}
