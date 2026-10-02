// Regression spec for P0.2 canonical deletion (§2.5): delete B from
// A—B—C / B—D / E—F. Only edges touching B disappear; E—F survives.
// Run: node apps/web/src/features/canvas/core/deletion.check.js
import assert from 'node:assert/strict'

// Mirrors canvasStore.deleteNodes edge filter (Set-based, source/target aware).
const deleteNodesFromGraph = (nodes, edges, ids) => {
  const idSet = new Set(ids)
  return {
    nodes: nodes.filter((n) => !idSet.has(n.id)),
    edges: edges.filter((e) => {
      const src = e.source || e.sourceId
      const tgt = e.target || e.targetId
      return !idSet.has(src) && !idSet.has(tgt)
    }),
  }
}

const nodes = ['A', 'B', 'C', 'D', 'E', 'F'].map((id) => ({ id }))
const edges = [
  { id: 'e1', source: 'A', target: 'B' },
  { id: 'e2', source: 'B', target: 'C' },
  { id: 'e3', sourceId: 'B', targetId: 'D' },
  { id: 'e4', source: 'E', target: 'F' },
]

const { nodes: rn, edges: re } = deleteNodesFromGraph(nodes, edges, ['B'])
assert.deepEqual(rn.map((n) => n.id).sort(), ['A', 'C', 'D', 'E', 'F'])
assert.deepEqual(re.map((e) => e.id), ['e4']) // unrelated E—F survives

const multi = deleteNodesFromGraph(nodes, edges, ['A', 'B', 'C'])
assert.deepEqual(multi.nodes.map((n) => n.id).sort(), ['D', 'E', 'F'])
assert.deepEqual(multi.edges.map((e) => e.id), ['e4'])

const isolated = deleteNodesFromGraph(nodes, edges, ['F'])
assert.equal(isolated.edges.length, 3) // only F's edge gone

console.log('deletion.check: OK')
