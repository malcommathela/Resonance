// Self-check for canvasDiagnostics.js (dependency-free, not bundled).
// Run: node apps/web/src/features/canvas/diagnostics/diagnostics.check.js
import assert from 'node:assert/strict'
import { diagnoseDocument } from './canvasDiagnostics.js'

assert.deepEqual(diagnoseDocument({ nodes: [], edges: [] }), []) // clean doc, no noise

const issues = diagnoseDocument({
  nodes: [
    { id: 'n1', type: 'customBlock', data: { config: { legacy_x: 1, behavioralModel: {} } } },
    { id: 'n1', type: 'customBlock', data: { config: {} } },
    { id: 'g1', type: 'group', data: { nodeIds: ['ghost'] } },
  ],
  edges: [{ id: 'e1', source: 'n1', target: 'missing' }],
})
const codes = issues.map((i) => i.code)
assert.ok(codes.includes('duplicate-node-id'))
assert.ok(codes.includes('edge-references-missing-node'))
assert.ok(codes.includes('group-references-missing-member'))
assert.ok(!codes.includes('unknown-inspector-property')) // legacy keys are handled, never noise
assert.ok(!codes.includes('simulation-payload-contains-canvas-object')) // adapter excludes groups

console.log('diagnostics.check: OK')
