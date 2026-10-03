// Self-check for canvasGroups.js. Run: node apps/api/src/canvas/canvasGroups.check.js
import assert from 'node:assert/strict'
import { shapeContextGroups } from './canvasGroups.js'

const blocks = [{ id: 'a', label: 'API' }, { id: 'b', label: 'DB' }]

assert.deepEqual(shapeContextGroups(null, blocks), { groups: [], health: 'available' })
assert.deepEqual(shapeContextGroups(undefined, blocks), { groups: [], health: 'available' })

const meta = { schemaVersion: 1, groups: [
  { id: 'g1', type: 'group', position: { x: 0, y: 0 }, data: { label: 'Backend', nodeIds: ['a', 'b', 'gone'] } },
  { id: 'x', type: 'block', position: { x: 0, y: 0 }, data: {} },
] }
const shaped = shapeContextGroups(meta, blocks)
assert.equal(shaped.health, 'available')
assert.deepEqual(shaped.groups, [{ id: 'g1', label: 'Backend', members: ['API', 'DB'], memberCount: 2 }]) // gone excluded, block-type skipped

assert.deepEqual(shapeContextGroups(JSON.stringify(meta), blocks), shaped) // string column works
assert.deepEqual(shapeContextGroups('{corrupt', blocks), { groups: null, health: 'unavailable' }) // never "no groups"
assert.deepEqual(shapeContextGroups({ nope: 1 }, blocks), { groups: null, health: 'unavailable' })

console.log('canvasGroups.check: OK')
