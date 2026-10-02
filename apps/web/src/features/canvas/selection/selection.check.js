// Self-check for selectionModel.js (dependency-free, not bundled).
// Run: node apps/web/src/features/canvas/selection/selection.check.js
import assert from 'node:assert/strict'
import { emptySelection, normalizeSelection, pruneSelection, selectionFromIds, resolveHighlightTarget } from './selectionModel.js'

assert.deepEqual(emptySelection(), { nodes: [], edges: [], primary: { type: null, id: null } })

const multi = normalizeSelection({ nodes: ['a', 'a', 'b'], edges: [] })
assert.deepEqual(multi.nodes, ['a', 'b']) // deduped
assert.deepEqual(multi.primary, { type: 'node', id: 'a' }) // primary falls back to first

const explicit = normalizeSelection({ nodes: ['a'], edges: ['e'], primary: { type: 'edge', id: 'e' } })
assert.deepEqual(explicit.primary, { type: 'edge', id: 'e' })

const dangling = normalizeSelection({ nodes: ['a'], primary: { type: 'node', id: 'gone' } })
assert.deepEqual(dangling.primary, { type: 'node', id: 'a' }) // dangling primary repaired

// Deleted elements leave the selection (no ghost selection/highlight)
const pruned = pruneSelection({ nodes: ['a', 'gone'], edges: ['e'], primary: { type: 'node', id: 'gone' } }, ['a'], [])
assert.deepEqual(pruned.nodes, ['a'])
assert.deepEqual(pruned.edges, [])
assert.deepEqual(pruned.primary, { type: 'node', id: 'a' })

assert.deepEqual(selectionFromIds([], []).primary, { type: null, id: null })

const nodes = [{ id: 'a' }]
assert.equal(resolveHighlightTarget({ elementId: 'a', elementType: 'node' }, nodes, [] ).elementId, 'a')
assert.equal(resolveHighlightTarget({ elementId: 'ghost', elementType: 'node' }, nodes, []), null)
assert.equal(resolveHighlightTarget(null, nodes, []), null)

console.log('selection.check: OK')
