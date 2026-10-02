// Self-check for canvasPersistence.js (dependency-free paths only).
// Run: node apps/web/src/features/canvas/persistence/persistence.check.js
import assert from 'node:assert/strict'
import {
  splitPersistable, saveCanvasDocument,
  noteServerVersion, serverVersionOrigin, shouldRetryAfterConflict,
} from './canvasPersistence.js'

const nodes = [
  { id: 'n1', type: 'customBlock', position: { x: 0, y: 0 }, data: { label: 'A' } },
  { id: 'g1', type: 'group', position: { x: 0, y: 0 }, data: { label: 'G', nodeIds: ['n1'] } },
  { id: 't1', type: 'note', position: { x: 0, y: 0 }, data: { text: 'hi' } },
]
const split = splitPersistable(nodes, [{ id: 'e1' }])
assert.deepEqual(split.blocks.map((n) => n.id), ['n1']) // only architecture persists as blocks
assert.deepEqual(split.groups.map((n) => n.id), ['g1']) // groups ride the meta channel
assert.equal(split.edges.length, 1)

// Boundary delegates WHAT/WHERE: raw doc in, revision threaded to saveFn
let seen = null
await saveCanvasDocument('d1', { nodes, edges: [{ id: 'e1' }], revision: 7 }, async (id, payload) => { seen = { id, payload } })
assert.equal(seen.id, 'd1')
assert.equal(seen.payload.revision, 7) // revision rides along for race protection
assert.equal(seen.payload.nodes.length, 3) // API-side filtering stays in designStore (single funnel)

// Version lineage: our own race retries, foreign writers never retry
assert.equal(serverVersionOrigin(999), null) // unknown → no retry
noteServerVersion(28, 'ours')
noteServerVersion(27, 'seen')
assert.equal(serverVersionOrigin(28), 'ours')
assert.equal(serverVersionOrigin(27), 'seen')
assert.equal(shouldRetryAfterConflict({ origin: 'ours', retries: 0, maxRetries: 3 }), true)
assert.equal(shouldRetryAfterConflict({ origin: 'ours', retries: 3, maxRetries: 3 }), false) // bounded
assert.equal(shouldRetryAfterConflict({ origin: 'seen', retries: 0, maxRetries: 3 }), false) // foreign never
assert.equal(shouldRetryAfterConflict({ origin: null, retries: 0, maxRetries: 3 }), false)

console.log('persistence.check: OK')
