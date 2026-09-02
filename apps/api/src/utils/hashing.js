// ============================================================================
// HASHING — Chat spec §42, §70
// Context fingerprints and cache hashes. Version-aware inputs mean a changed
// design/simulation/prompt/model logically invalidates old cache entries —
// no manual deletion required.
// ============================================================================

import { createHash } from 'node:crypto'

export function sha256(input) {
  return createHash('sha256').update(String(input)).digest('hex')
}

/**
 * Stable hash over ordered parts. Undefined/null parts are skipped so
 * optional inputs (simulationVersion, optimizationVersion) don't change the
 * hash when absent.
 */
export function hashParts(...parts) {
  const joined = parts
    .filter((p) => p !== undefined && p !== null && p !== '')
    .map((p) => (typeof p === 'object' ? JSON.stringify(p) : String(p)))
    .join('|')
  return sha256(joined)
}

/**
 * Context fingerprint (spec §70) — identifies exactly which design state an
 * AI request was generated against. If unchanged, cached context can be
 * reused; if changed, context must be rebuilt.
 */
export function contextFingerprint({ designVersion, simulationVersion, optimizationVersion, nodeCount, edgeCount }) {
  return hashParts(
    'ctx-v1',
    designVersion,
    simulationVersion,
    optimizationVersion,
    nodeCount,
    edgeCount
  )
}
