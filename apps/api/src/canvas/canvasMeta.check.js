// Self-check for canvasMeta.js. Run: node apps/api/src/canvas/canvasMeta.check.js
import assert from 'node:assert/strict'
import { normalizeCanvasMeta } from './canvasMeta.js'

assert.deepEqual(normalizeCanvasMeta(null), { schemaVersion: 1, groups: [] })
assert.deepEqual(normalizeCanvasMeta(undefined), { schemaVersion: 1, groups: [] })

const v = normalizeCanvasMeta([{ id: 'g1', type: 'group', position: { x: 1, y: 2 }, data: { label: 'A', nodeIds: ['n1', 'n1', 7] } }])
assert.equal(v.schemaVersion, 1)
assert.deepEqual(v.groups[0].data.nodeIds, ['n1']) // deduped, non-strings dropped

assert.throws(() => normalizeCanvasMeta({ groups: 'nope' }), /array/)
assert.throws(() => normalizeCanvasMeta([{ id: 'g1', type: 'group', position: { x: 1, y: 2 }, data: {} }, { id: 'g1', type: 'group', position: { x: 0, y: 0 }, data: {} }]), /Duplicate/)
assert.throws(() => normalizeCanvasMeta([{ id: 'g1', type: 'block', position: { x: 0, y: 0 }, data: {} }]), /type='group'/)
assert.throws(() => normalizeCanvasMeta([{ id: 'g1', type: 'group', position: { x: NaN, y: 0 }, data: {} }]), /position/)
assert.throws(() => normalizeCanvasMeta(new Array(201).fill({ id: 'x', type: 'group', position: { x: 0, y: 0 }, data: {} })), /Too many/)

const compat = normalizeCanvasMeta({ schemaVersion: 1, groups: [{ id: 'g2', type: 'group', position: { x: 0, y: 0 }, style: { width: 99999 }, data: { label: 'B', color: 'red', collapsed: 1, nodeIds: [] } }] })
assert.equal(compat.groups[0].style.width, 5000) // clamped, not rejected
assert.equal(compat.groups[0].data.collapsed, true)

// RF v12 resize attrs: style frozen at creation, live size rides top-level/measured
const resized = normalizeCanvasMeta([{ id: 'g3', type: 'group', position: { x: 5, y: 6 }, style: { width: 400, height: 200 }, width: 640, height: 480, measured: { width: 640, height: 480 }, data: { label: 'R', nodeIds: [] } }])
assert.deepEqual(resized.groups[0].style, { width: 640, height: 480 }) // live wins over stale creation style
assert.deepEqual(resized.groups[0].position, { x: 5, y: 6 })
const noStyle = normalizeCanvasMeta([{ id: 'g4', type: 'group', position: { x: 0, y: 0 }, width: 640, height: 480, measured: { width: 1, height: 1 }, data: { label: 'S', nodeIds: [] } }])
assert.deepEqual(noStyle.groups[0].style, { width: 640, height: 480 }) // falls back to live attrs, not measured-stale
const measuredOnly = normalizeCanvasMeta([{ id: 'g5', type: 'group', position: { x: 0, y: 0 }, measured: { width: 700, height: 500 }, data: { label: 'M', nodeIds: [] } }])
assert.deepEqual(measuredOnly.groups[0].style, { width: 700, height: 500 })

// zero/negative positions round-trip (no truthiness defaulting); expanded
// size survives collapse through reload; transient fields are stripped
const zero = normalizeCanvasMeta([{ id: 'g6', type: 'group', position: { x: 0, y: -40 }, style: { width: 300, height: 200 }, data: { label: 'Z', nodeIds: [] } }])
assert.deepEqual(zero.groups[0].position, { x: 0, y: -40 })
const collapsed = normalizeCanvasMeta([{ id: 'g7', type: 'group', position: { x: 10, y: 10 }, style: { width: 240, height: 44 }, data: { label: 'C', collapsed: true, expandedStyle: { width: 640, height: 480 }, nodeIds: [] } }])
assert.deepEqual(collapsed.groups[0].data.expandedStyle, { width: 640, height: 480 })
assert.deepEqual(collapsed.groups[0].style, { width: 240, height: 44 })
const junk = normalizeCanvasMeta([{ id: 'g8', type: 'group', position: { x: 1, y: 1 }, width: 300, height: 200, selected: true, dragging: true, measured: { width: 1 }, data: { label: 'J', nodeIds: [], expandedStyle: { width: 'huge', height: 5 } } }])
assert.deepEqual(junk.groups[0].style, { width: 300, height: 200 })
assert.equal(junk.groups[0].selected, undefined)
assert.equal(junk.groups[0].data.expandedStyle, undefined) // invalid stash dropped, valid geometry kept

console.log('canvasMeta.check: OK')
