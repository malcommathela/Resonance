// Self-check for document.js (dependency-free, not bundled — never imported).
// Run: node apps/web/src/features/canvas/core/document.check.js
import assert from 'node:assert/strict'
import { emptyDocument, normalizeDocument, documentFromGraph, isBlockNode, toPersistable } from './document.js'

const old = { id: 'd1', nodes: [{ id: 'n1', position: { x: 20, y: 40 } }], edges: [{ id: 'e1', source: 'n1', target: 'n2' }] }
const n = normalizeDocument(old)
assert.deepEqual(n.groups, [])
assert.deepEqual(n.notes, [])
assert.deepEqual(n.metadata, {})
assert.equal(n.nodes[0].id, 'n1') // IDs preserved
assert.deepEqual(n.nodes[0].position, { x: 20, y: 40 })
assert.equal(n.edges[0].id, 'e1')
assert.equal(n.id, 'd1') // extra fields pass through

assert.deepEqual(normalizeDocument(null), emptyDocument()) // null-safe
assert.deepEqual(normalizeDocument({ nodes: 'x', edges: null }).nodes, []) // non-array guards

const future = normalizeDocument({ nodes: [], edges: [], groups: [{ id: 'g1' }], notes: [{ id: 't1' }] })
assert.equal(future.groups[0].id, 'g1') // forward-compat preserved
assert.equal(future.notes[0].id, 't1')

assert.deepEqual(documentFromGraph(null, undefined), emptyDocument())

// Groups/notes + runtime state never persist
const mixed = [
  { id: 'n1', type: 'customBlock', position: { x: 0, y: 0 }, data: { label: 'A', type: 'service', metrics: { rps: 5 }, config: {} } },
  { id: 'g1', type: 'group', position: { x: 0, y: 0 }, data: { label: 'G', nodeIds: ['n1'] } },
  { id: 't1', type: 'note', position: { x: 0, y: 0 }, data: { text: 'hi' } },
]
const mixedEdges = [{ id: 'e1', source: 'n1', target: 'n1', data: { connectionType: 'http', retryCount: 3, circuitOpen: true, latencyMs: 12 } }]
assert.equal(isBlockNode(mixed[0]), true)
assert.equal(isBlockNode(mixed[1]), false)
const clean = toPersistable(mixed, mixedEdges)
assert.deepEqual(clean.nodes.map((n) => n.id), ['n1']) // groups + notes filtered
assert.ok(!('metrics' in clean.nodes[0].data)) // runtime metrics stripped
assert.equal(clean.nodes[0].data.label, 'A') // document fields intact
assert.equal(clean.edges[0].data.retryCount, 3) // ambiguous config key preserved
assert.ok(!('circuitOpen' in clean.edges[0].data))
assert.ok(!('latencyMs' in clean.edges[0].data))

console.log('document.check: OK')
