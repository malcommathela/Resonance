// Self-check for groups/meta.js (not bundled — never imported).
// Run: node apps/web/src/features/canvas/groups/meta.check.js
import assert from 'node:assert/strict'
import { groupBox, expandGroupBox, shiftGroupNodes, pruneGroupMembers, extractMetaNodes, findGroupDropTarget, GROUP_Z_INDEX, NODE_Z_INDEX } from './meta.js'

// Layer invariant: explicit non-negative backdrop < architecture (manual zIndexMode)
assert.ok(GROUP_Z_INDEX >= 0 && NODE_Z_INDEX >= 0)
assert.ok(GROUP_Z_INDEX < NODE_Z_INDEX)

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
assert.deepEqual(kept.map((g) => g.id), ['g1', 'g2']) // empty groups kept, never auto-dropped
assert.deepEqual(kept[0].data.nodeIds, ['a'])
assert.equal(kept[0].data.memberCount, 1)
assert.deepEqual(kept[1].data.nodeIds, [])
assert.deepEqual(dropped, [])

const nodes = [
  { id: 'n', type: 'customBlock' },
  { id: 'g', type: 'group' },
  { id: 't', type: 'note' },
]
const meta = extractMetaNodes(nodes)
assert.deepEqual(meta.groups.map((g) => g.id), ['g'])
assert.deepEqual(meta.notes, []) // legacy notes ignored, never persisted

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

// rigid movement: group + members share the exact delta, rest untouched
const snap20 = (v) => Math.round(v / 20) * 20
const graph = [
  { id: 'g', type: 'group', position: { x: 80, y: 56 }, data: { nodeIds: ['a', 'b'] } },
  { id: 'a', type: 'customBlock', position: { x: 100, y: 100 } },
  { id: 'b', type: 'customBlock', position: { x: 400, y: 200 } },
  { id: 'c', type: 'customBlock', position: { x: 900, y: 900 } },
]
const { nodes: shifted, moved } = shiftGroupNodes(graph, 'g', 100, 50, snap20)
assert.equal(moved, true)
const byId = new Map(shifted.map((n) => [n.id, n]))
assert.deepEqual(byId.get('g').position, { x: 180, y: 100 }) // snapped
assert.deepEqual(byId.get('a').position, { x: 200, y: 160 })
assert.deepEqual(byId.get('b').position, { x: 500, y: 260 })
assert.deepEqual(byId.get('c').position, { x: 900, y: 900 }) // outsider untouched
assert.deepEqual(byId.get('g').data.nodeIds, ['a', 'b']) // membership unchanged
assert.deepEqual(shiftGroupNodes(graph, 'g', 0, 0).moved, false)
assert.deepEqual(shiftGroupNodes(graph, 'nope', 100, 50).nodes, graph)

// drop detection: center-in-rect, flat groups only, collapsed excluded
const dropGroups = [
  { id: 'g1', type: 'group', position: { x: 0, y: 0 }, style: { width: 400, height: 200 }, data: {} },
  { id: 'g2', type: 'group', position: { x: 500, y: 500 }, style: { width: 400, height: 200 }, data: { collapsed: true } },
]
assert.equal(findGroupDropTarget(dropGroups, { id: 'a', type: 'customBlock', position: { x: 100, y: 100 } }), 'g1')
assert.equal(findGroupDropTarget(dropGroups, { id: 'a', type: 'customBlock', position: { x: 600, y: 550 } }), null) // collapsed excluded
assert.equal(findGroupDropTarget(dropGroups, { id: 'a', type: 'customBlock', position: { x: 900, y: 900 } }), null)
assert.equal(findGroupDropTarget(dropGroups, { id: 'g', type: 'group', position: { x: 100, y: 100 } }), null) // no nested groups

console.log('meta.check: OK')
