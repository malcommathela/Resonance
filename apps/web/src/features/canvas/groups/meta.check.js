// Self-check for groups/meta.js (not bundled — never imported).
// Run: node apps/web/src/features/canvas/groups/meta.check.js
import assert from 'node:assert/strict'
import { groupBox, expandGroupBox, pruneGroupMembers, extractMetaNodes } from './meta.js'

const box = groupBox([{ position: { x: 100, y: 100 } }, { position: { x: 400, y: 200 } }])
assert.equal(box.x, 80)
assert.equal(box.y, 56)
assert.equal(box.width, 300 + 208 + 40)
assert.equal(box.height, 100 + 72 + 44 + 20)
assert.equal(groupBox([]), null)

const groups = [
  { id: 'g1', data: { nodeIds: ['a', 'gone'] } },
  { id: 'g2', data: { nodeIds: ['gone'] } },
]
const { kept, dropped } = pruneGroupMembers(groups, ['a', 'b'])
assert.deepEqual(kept.map((g) => g.id), ['g1'])
assert.deepEqual(kept[0].data.nodeIds, ['a'])
assert.equal(kept[0].data.memberCount, 1)
assert.deepEqual(dropped, ['g2'])

const nodes = [
  { id: 'n', type: 'customBlock' },
  { id: 'g', type: 'group' },
  { id: 't', type: 'note' },
]
const meta = extractMetaNodes(nodes)
assert.deepEqual(meta.groups.map((g) => g.id), ['g'])
assert.deepEqual(meta.notes.map((t) => t.id), ['t'])

// expand-only: manual whitespace survives, overflow grows, escape shifts
const members = [{ position: { x: 100, y: 100 } }, { position: { x: 400, y: 200 } }]
assert.equal(expandGroupBox({ position: { x: 80, y: 56 }, style: { width: 600, height: 300 } }, members), null)
assert.equal(expandGroupBox({ position: { x: 80, y: 56 }, style: { width: 548, height: 236 } }, members), null)
assert.deepEqual(
  expandGroupBox({ position: { x: 80, y: 56 }, style: { width: 548, height: 236 } },
    [{ position: { x: 100, y: 100 } }, { position: { x: 500, y: 200 } }]),
  { x: 80, y: 56, width: 648, height: 236 },
)
assert.deepEqual(
  expandGroupBox({ position: { x: 80, y: 56 }, style: { width: 548, height: 236 } },
    [{ position: { x: 0, y: 100 } }, { position: { x: 400, y: 200 } }]),
  { x: -20, y: 56, width: 648, height: 236 },
)
assert.equal(expandGroupBox({ position: { x: 0, y: 0 }, style: { width: 1, height: 1 } }, []), null)

console.log('meta.check: OK')
