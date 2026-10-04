// Self-check for canvasPersistence.js (dependency-free paths only).
// Run: node apps/web/src/features/canvas/persistence/persistence.check.js
import assert from 'node:assert/strict'
import {
  splitPersistable, saveCanvasDocument,
  noteServerVersion, serverVersionOrigin, shouldRetryAfterConflict,
  createSaveQueue, freezeSaveSnapshot, isSessionCurrent,
} from './canvasPersistence.js'

const nodes = [
  { id: 'n1', type: 'customBlock', position: { x: 0, y: 0 }, data: { label: 'A' } },
  { id: 'g1', type: 'group', position: { x: 0, y: 0 }, data: { label: 'G', nodeIds: ['n1'] } },
  { id: 't1', type: 'note', position: { x: 0, y: 0 }, data: { text: 'hi' } },
]
const split = splitPersistable(nodes, [{ id: 'e1' }])
assert.deepEqual(split.blocks.map((n) => n.id), ['n1']) // only architecture persists as blocks
assert.deepEqual(split.groups.map((n) => n.id), ['g1']) // groups ride the meta channel
assert.equal(split.edges.length, 1)

// Boundary delegates WHAT/WHERE: raw doc in, revision threaded to saveFn
let seen = null
await saveCanvasDocument('d1', { nodes, edges: [{ id: 'e1' }], revision: 7 }, async (id, payload) => { seen = { id, payload } })
assert.equal(seen.id, 'd1')
assert.equal(seen.payload.revision, 7) // revision rides along for race protection
assert.equal(seen.payload.nodes.length, 3) // API-side filtering stays in designStore (single funnel)
assert.equal(seen.payload.nodes.filter((n) => n.type === 'group').length, 1) // groups ride the versioned server canvasMeta via designStore

// Version lineage: our own race retries, foreign writers never retry
assert.equal(serverVersionOrigin(999), null) // unknown → no retry
noteServerVersion(28, 'ours')
noteServerVersion(27, 'seen')
assert.equal(serverVersionOrigin(28), 'ours')
assert.equal(serverVersionOrigin(27), 'seen')
assert.equal(shouldRetryAfterConflict({ origin: 'ours', retries: 0, maxRetries: 3 }), true)
assert.equal(shouldRetryAfterConflict({ origin: 'ours', retries: 3, maxRetries: 3 }), false) // bounded
assert.equal(shouldRetryAfterConflict({ origin: 'seen', retries: 0, maxRetries: 3 }), false) // foreign never
assert.equal(shouldRetryAfterConflict({ origin: null, retries: 0, maxRetries: 3 }), false)

// Session identity: same design AND generation, nothing else
assert.equal(isSessionCurrent({ designId: 'A', generation: 1 }, { designId: 'A', generation: 1 }), true)
assert.equal(isSessionCurrent({ designId: 'A', generation: 2 }, { designId: 'A', generation: 1 }), false) // re-hydrated
assert.equal(isSessionCurrent({ designId: 'B', generation: 1 }, { designId: 'A', generation: 1 }), false) // switched design
assert.equal(isSessionCurrent(null, { designId: 'A', generation: 1 }), false)
assert.equal(isSessionCurrent({ designId: 'A', generation: 1 }, null), false)

// Immutable snapshots: later mutation cannot alter what a save sends
const live = { nodes: [{ id: 'n1', data: { label: 'A' } }], edges: [] }
const snap = freezeSaveSnapshot({ designId: 'd1', nodes: live.nodes, edges: live.edges, revision: 4 })
live.nodes[0].data.label = 'CHANGED'
live.nodes.push({ id: 'n2' })
assert.equal(snap.nodes.length, 1)
assert.equal(snap.nodes[0].data.label, 'A')
assert.equal(snap.revision, 4)

// Queue: failures never poison; per-design serialization; independent designs
// don't block each other. Deferred promises — no sleeps, deterministic order.
{
  const { enqueue } = createSaveQueue()
  const order = []
  let releaseSecond
  const gate = new Promise((r) => { releaseSecond = r })
  const p1 = enqueue('A', async () => { order.push('a1'); await gate })
  const p2 = enqueue('A', async () => { order.push('a2'); return 'ok2' })
  const pB = enqueue('B', async () => { order.push('b1'); return 'okB' })
  await Promise.resolve()
  await Promise.resolve()
  assert.deepEqual(order, ['a1', 'b1']) // B proceeds while A is gated
  assert.equal(await pB, 'okB')
  releaseSecond()
  assert.equal(await p2, 'ok2') // A serializes in call order
  await p1
  assert.deepEqual(order, ['a1', 'b1', 'a2'])
}
{
  const { enqueue } = createSaveQueue()
  const order = []
  const failing = enqueue('A', async () => { order.push('fail'); throw new Error('boom') })
  const after = enqueue('A', async () => { order.push('after'); return 'recovered' })
  await assert.rejects(failing, /boom/) // caller still sees its own error
  assert.equal(await after, 'recovered') // queue keeps working
  assert.deepEqual(order, ['fail', 'after'])
}

// Version read at EXECUTION time: op2 sees the version op1 established
{
  const { enqueue } = createSaveQueue()
  let serverVersion = 27
  const seen = []
  const op1 = enqueue('A', async () => {
    const v = serverVersion
    seen.push(v)
    serverVersion = v + 1 // server increments on persist
    return { version: serverVersion }
  })
  const op2 = enqueue('A', async () => {
    const v = serverVersion // read now, not at enqueue time
    seen.push(v)
    serverVersion = v + 1
    return { version: serverVersion }
  })
  await op1
  await op2
  assert.deepEqual(seen, [27, 28]) // second save builds on the first — no avoidable 409
}

console.log('persistence.check: OK')
