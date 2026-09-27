// Self-check for groups/meta.js (not bundled — never imported).
// Run: node apps/web/src/features/canvas/groups/meta.check.js
import assert from 'node:assert/strict'
import { groupBox, pruneGroupMembers, extractMetaNodes } from './meta.js'

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

console.log('meta.check: OK')
