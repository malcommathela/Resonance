// Self-check for simulationInputAdapter.js (dependency-free, not bundled).
// Run: node apps/web/src/features/canvas/simulation/simulationInput.check.js
import assert from 'node:assert/strict'
import { createSimulationInput } from './simulationInputAdapter.js'

const doc = {
  nodes: [
    { id: 'n1', type: 'customBlock', position: { x: 0, y: 0 }, data: { label: 'A', metrics: { rps: 1 } } },
    { id: 'g1', type: 'group', position: { x: 0, y: 0 }, data: { label: 'G', nodeIds: ['n1'] } },
    { id: 't1', type: 'note', position: { x: 0, y: 0 }, data: { text: 'hi' } },
  ],
  edges: [{ id: 'e1', source: 'n1', target: 'n1', data: { connectionType: 'http', circuitOpen: true } }],
}
const input = createSimulationInput(doc)
assert.deepEqual(input.nodes.map((n) => n.id), ['n1']) // groups + notes excluded
assert.ok(!('metrics' in input.nodes[0].data)) // runtime stripped
assert.ok(!('circuitOpen' in input.edges[0].data))
assert.deepEqual(createSimulationInput(null), { nodes: [], edges: [] }) // null-safe

console.log('simulationInput.check: OK')
