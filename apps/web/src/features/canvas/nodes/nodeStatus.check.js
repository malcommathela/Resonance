// Self-check for nodeStatus.js (not bundled — never imported).
// Run: node apps/web/src/features/canvas/nodes/nodeStatus.check.js
import assert from 'node:assert/strict'
import { nodeStatus } from './nodeStatus.js'

assert.deepEqual(nodeStatus({}), { tone: 'idle', active: false })
assert.deepEqual(nodeStatus({ highlighted: true, severity: 'critical' }), { tone: 'critical', active: false })
assert.deepEqual(nodeStatus({ highlighted: true }), { tone: 'warning', active: false })
assert.deepEqual(nodeStatus({ running: true, runtime: { circuitOpen: true } }), { tone: 'error', active: true })
assert.deepEqual(nodeStatus({ running: true, runtime: { utilization: 0.99 } }), { tone: 'warning', active: true })
assert.deepEqual(nodeStatus({ running: true, runtime: { utilization: 0.4 } }), { tone: 'ok', active: true })
assert.deepEqual(nodeStatus({ running: true }), { tone: 'idle', active: false }) // no runtime yet
assert.deepEqual(nodeStatus({ running: false, runtime: { utilization: 0.99 } }), { tone: 'idle', active: false })

console.log('nodeStatus.check: OK')
