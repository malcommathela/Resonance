// Canvas persistence boundary (Phase 4, server groups Phase 1).
// Architecture blocks/edges AND group canvas objects go through the API via
// designStore (Design.canvasMeta); the localStorage compat key is a one-time
// migration source only, never authoritative.
// Consumers call load/save — they never touch localStorage or decide what is
// persisted. Groups never enter the Block/Edge contract or simulation input
// (see document.js toPersistable).
// Covered by persistence.check.js (run: node persistence.check.js).
import { persistCanvasMeta } from '../groups/meta.js'
import { toPersistable, isGroupNode } from '../core/document.js'

export function splitPersistable(nodes, edges) {
  const { nodes: blocks } = toPersistable(nodes, edges)
  return {
    blocks,
    edges: edges || [],
    groups: (nodes || []).filter(isGroupNode),
  }
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

// Per-design serialized save queue. Without this, rev43 can complete before
// rev42 and 42's late completion would mark newer state clean (or last-write
// stale content over it). Chained promises preserve call order; a rejected
// task never poisons the queue. Factory (not singleton) so tests get isolated
// instances; designStore owns the shared one.
export function createSaveQueue() {
  const queues = new Map()
  function enqueue(id, fn) {
    const prev = queues.get(id) || Promise.resolve()
    const next = prev.catch(() => {}).then(fn)
    queues.set(id, next)
    // then(cleanup, cleanup) resolves either way — unlike finally(), it never
    // forks an unhandled rejection alongside the caller's await.
    next.then(
      () => { if (queues.get(id) === next) queues.delete(id) },
      () => { if (queues.get(id) === next) queues.delete(id) },
    )
    return next
  }
  return { enqueue }
}

// Session identity predicate. A callback or in-flight completion may touch
// client state only when the live session still matches the session it
// started under (same design AND generation). Timer cancellation alone can't
// stop in-flight work — this check can.
export function isSessionCurrent(current, atStart) {
  return !!current
    && !!atStart
    && current.designId === atStart.designId
    && current.generation === atStart.generation
}

// Immutable save snapshot. A save attempt represents a well-defined frozen
// snapshot — later edits, hydration, or session switches cannot mutate what
// the request sends or what its completion acknowledges.
export function freezeSaveSnapshot({ designId, nodes, edges, revision }) {
  return {
    designId,
    nodes: JSON.parse(JSON.stringify(nodes || [])),
    edges: JSON.parse(JSON.stringify(edges || [])),
    revision,
  }
}

// Explicit persistence boundary (Phase 8). The UI decides WHEN to save;
// this decides WHAT goes WHERE: full node list (blocks + groups) → saveFn
// (designStore.saveCanvas / autoSaveCanvas, which funnels groups into the
// versioned server canvasMeta). Transient state (selection, validation, sim
// metrics) is never passed in. The localStorage write is compat only.
export function saveCanvasDocument(designId, { nodes, edges, revision, getVersion }, saveFn) {
  saveCanvasPersistence(designId, nodes, edges)
  return saveFn(designId, { nodes, edges, revision, getVersion })
}
