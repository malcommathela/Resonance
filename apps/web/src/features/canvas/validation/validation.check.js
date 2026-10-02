// Self-check for validationAdapter.js (dependency-free, not bundled).
// Run: node apps/web/src/features/canvas/validation/validation.check.js
import assert from 'node:assert/strict'
import { findingKey, normalizeFinding, mergeFindings, pruneFindings, isFreshResult } from './validationAdapter.js'

// Same invalid property from both sources shares one semantic key despite ids
const client = { id: 'cli-x', severity: 'critical', type: 'invalid_replicas', message: 'c', blockId: 'n1', property: 'replicas' }
const server = { id: 'val-y', severity: 'critical', type: 'invalid_replicas', message: 's', blockId: 'n1', property: 'replicas' }
assert.equal(findingKey(client), findingKey(server))
assert.equal(findingKey(client), 'node:n1:invalid_replicas:replicas')

const merged = mergeFindings([client], [server], 42)
assert.equal(merged.findings.length, 1) // one UI finding, not two
assert.deepEqual(merged.findings[0].source, ['client', 'server'])
assert.equal(merged.revision, 42)
assert.deepEqual(merged.findings[0].element, { type: 'node', id: 'n1' })

// Edge + canvas keys
assert.equal(findingKey({ id: 'e', type: 'broken_edges', edgeId: 'e7' }), 'edge:e7:broken_edges:-')
assert.equal(findingKey({ id: 'c', type: 'empty_architecture' }), 'canvas:-:empty_architecture:-')

// Client-only finding survives the merge
const only = mergeFindings([client], [], 1)
assert.equal(only.findings.length, 1)
assert.deepEqual(only.findings[0].source, ['client'])

// Deleted node drops its finding; rename keeps it (id-keyed, not label-keyed)
const nodes = [{ id: 'n1' }]
assert.equal(pruneFindings(merged.findings, nodes, []).length, 1)
assert.equal(pruneFindings(merged.findings, [], []).length, 0)
assert.equal(pruneFindings([{ element: { type: 'node', id: null } }], [], []).length, 1) // canvas-level stays

// Revision gate
assert.equal(isFreshResult(42, 42), true)
assert.equal(isFreshResult(41, 42), false) // stale ignored
assert.equal(isFreshResult(null, 42), true) // legacy untagged results still apply

assert.equal(normalizeFinding(client, 'client').source[0], 'client')

console.log('validation.check: OK')
