// Canonical validation contract (Phase 7). Rules are untouched — this only
// normalizes their output: stable semantic keys dedupe client (`cli-*`) and
// server (`val-*`) findings about the same thing, and every result carries the
// document revision it was computed for so stale responses are discarded.
// Dependency-free: covered by validation.check.js (run: node validation.check.js).

// Deterministic identity: element + finding type + property. Ids differ per
// source, so they are never the dedupe key.
export function findingKey(f) {
  const id = f?.elementId || f?.blockId || f?.edgeId || null
  const kind = f?.elementType || (f?.blockId ? 'node' : f?.edgeId ? 'edge' : 'canvas')
  return [kind, id ?? '-', f?.type ?? 'unknown', f?.property ?? '-'].join(':')
}

export function normalizeFinding(f, source) {
  const id = f?.elementId || f?.blockId || f?.edgeId || null
  const kind = f?.elementType || (f?.blockId ? 'node' : f?.edgeId ? 'edge' : 'canvas')
  return {
    ...f,
    key: findingKey(f),
    element: { type: kind, id },
    source: [source],
  }
}

// Client = fast local feedback, server = authoritative. Same semantic finding
// from both merges into one entry with source: ['client', 'server'].
export function mergeFindings(clientFindings = [], serverFindings = [], revision = null) {
  const byKey = new Map()
  for (const f of clientFindings || []) {
    const n = normalizeFinding(f, 'client')
    byKey.set(n.key, n)
  }
  for (const f of serverFindings || []) {
    const n = normalizeFinding(f, 'server')
    const prev = byKey.get(n.key)
    if (prev) {
      prev.source = [...new Set([...prev.source, 'server'])]
      // Server is authoritative: prefer its message when both agree on the key.
      byKey.set(n.key, { ...n, source: prev.source })
    } else {
      byKey.set(n.key, n)
    }
  }
  return { findings: [...byKey.values()], revision: revision ?? null }
}

// Findings for deleted elements disappear with them; renames keep identity
// (keys use node ids, never labels).
export function pruneFindings(findings, nodes, edges) {
  const nodeIds = new Set((nodes || []).map((n) => n?.id))
  const edgeIds = new Set((edges || []).map((e) => e?.id))
  return (findings || []).filter((f) => {
    const id = f?.element?.id ?? f?.elementId ?? f?.blockId ?? f?.edgeId
    if (id == null) return true // canvas-level findings stay
    const kind = f?.element?.type ?? f?.elementType ?? (f?.blockId ? 'node' : f?.edgeId ? 'edge' : null)
    if (kind === 'edge') return edgeIds.has(id)
    if (kind === 'node') return nodeIds.has(id)
    return nodeIds.has(id) || edgeIds.has(id)
  })
}

// Only apply a result computed for the current revision.
export function isFreshResult(resultRevision, currentRevision) {
  return resultRevision == null || resultRevision === currentRevision
}
