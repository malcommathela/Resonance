// Contract tests for the command layer + store invariants (Phase 12, §18.2).
// Imports the REAL store/commands via the alias shim — no mirrored logic.
// Run from apps/web:
//   node --import ./register-aliases.mjs src/features/canvas/core/commands.check.js
import assert from 'node:assert/strict'
import { useCanvasStore } from '@/stores/canvasStore'
import { canvasCommands } from '@/features/canvas/core/canvasCommands'

const s = () => useCanvasStore.getState()
// Store ids derive from Date.now(): monotonic stub keeps rapid adds distinct.
let now = Date.now()
Date.now = () => ++now
const reset = () => s().loadDesign({ nodes: [], edges: [] })

// --- add / connect / delete cascade ---
reset()
assert.equal(s().revision, 0)
const a = canvasCommands.addNode('service', { x: 0, y: 0 })
const b = canvasCommands.addNode('service', { x: 200, y: 0 })
assert.equal(s().nodes.length, 2)
assert.equal(s().revision, 2)
const e = canvasCommands.connectNodes(a.id, b.id, 'http')
assert.ok(e?.id)
assert.equal(s().edges.length, 1)

// Deleting a node cleans connected edges + selection + highlight + findings
s().selectNode(a.id)
s().setValidationResult({ findings: [{ id: 'f', element: { type: 'node', id: a.id } }] }, s().revision)
s().setValidationHighlight({ id: 'f', blockId: a.id })
canvasCommands.deleteNodes([a.id])
assert.equal(s().nodes.length, 1)
assert.equal(s().edges.length, 0) // connected edge gone
assert.deepEqual(s().selectedNodeIds, [])
assert.equal(s().validationHighlight, null)
assert.deepEqual(s().validationResult.findings, []) // finding for deleted node pruned

// --- duplicate / update / revision ---
const dup = canvasCommands.duplicateNode(b.id)
assert.ok(dup && dup.id !== b.id)
const revBefore = s().revision
canvasCommands.updateNode(b.id, { label: 'renamed' })
assert.equal(s().nodes.find((n) => n.id === b.id).data.label, 'renamed')
assert.equal(s().revision, revBefore + 1) // non-history edits still bump revision

// --- groups: first-class canvas objects, never simulation blocks ---
reset()
const g1 = canvasCommands.addNode('service', { x: 0, y: 0 })
const g2 = canvasCommands.addNode('service', { x: 200, y: 0 })
s().setSelectedNodes([g1, g2].map((n) => n))
const g = canvasCommands.createGroup()
assert.ok(g?.id && g.type === 'group')
assert.deepEqual([...(g.data.nodeIds || [])].sort(), [g1.id, g2.id].sort())
assert.equal(canvasCommands.addGroupMember(g.id, g1.id), false) // dup member rejected
canvasCommands.renameGroup(g.id, 'Team A')
assert.equal(s().nodes.find((n) => n.id === g.id).data.label, 'Team A')
canvasCommands.removeGroupMember(g.id, g1.id)
assert.deepEqual(s().nodes.find((n) => n.id === g.id).data.nodeIds, [g2.id])
canvasCommands.toggleGroupCollapse(g.id)
assert.equal(s().nodes.find((n) => n.id === g.id).data.collapsed, true)
canvasCommands.ungroup(g.id)
assert.ok(!s().nodes.some((n) => n.id === g.id)) // group gone, members stay
assert.equal(s().nodes.length, 2)

// deleteGroup removes the group, keeps members
s().setSelectedNodes([g1, g2].map((n) => n))
const gB = canvasCommands.createGroup()
canvasCommands.deleteGroup(gB.id)
assert.ok(!s().nodes.some((n) => n.id === gB.id))
assert.equal(s().nodes.length, 2)

// resize commit: keeps the user's size, single history entry, marks dirty
s().setSelectedNodes([g1, g2].map((n) => n))
const gC = canvasCommands.createGroup()
const before = s().nodes.find((n) => n.id === gC.id)
const startSize = { ...(before.style || {}), width: 50, height: 50 } // pre-gesture size
canvasCommands.resizeGroup(gC.id, startSize)
const after = s().nodes.find((n) => n.id === gC.id)
assert.ok(after.style.width >= before.style.width) // user size kept, grown to fit members
assert.deepEqual(after.data.nodeIds.sort(), [g1.id, g2.id].sort())
canvasCommands.undo()
const undone = s().nodes.find((n) => n.id === gC.id)
assert.equal(undone.style.width, 50) // one undo restores pre-resize size

// --- selection authority ---
canvasCommands.selectNode(g1.id)
assert.deepEqual(s().selectedNodeIds, [g1.id])
canvasCommands.clearSelection()
assert.deepEqual(s().selectedNodeIds, [])
canvasCommands.selectNodes([g1.id, g2.id])
assert.deepEqual([...s().selectedNodeIds].sort(), [g1.id, g2.id].sort())

// --- stale emphasis ignored at the root (shared setter, all callers fixed) ---
canvasCommands.emphasizeFinding({ id: 'x', blockId: 'ghost' })
assert.equal(s().validationHighlight, null)
canvasCommands.emphasizeFinding({ id: 'y', blockId: g1.id })
assert.equal(s().validationHighlight.elementId, g1.id)
canvasCommands.clearEmphasis()
assert.equal(s().validationHighlight, null)

// --- stale validation results discarded ---
const rev = s().revision
s().setValidationResult({ findings: [] }, rev + 99)
assert.notEqual(s().validationRevision, rev + 99) // ignored, not applied
s().setValidationResult({ findings: [] }, rev)
assert.equal(s().validationRevision, rev)

// --- revision-safe clean (stale saves never clear dirty) ---
canvasCommands.updateNode(g1.id, { label: 'dirty' })
assert.equal(s().isDirty, true)
const cur = s().revision
s().markCanvasClean(cur - 1) // older save finishing late
assert.equal(s().isDirty, true) // still dirty
s().markCanvasClean(cur)
assert.equal(s().isDirty, false)
assert.equal(s().persistedRevision, cur)

// --- copy / paste round-trips through memory clipboard ---
reset()
const c1 = canvasCommands.addNode('service', { x: 0, y: 0 })
const c2 = canvasCommands.addNode('service', { x: 200, y: 0 })
canvasCommands.connectNodes(c1.id, c2.id, 'http')
canvasCommands.selectNodes([c1.id, c2.id])
await canvasCommands.copySelection()
const pasted = canvasCommands.pasteClipboard({ x: 500, y: 500 })
assert.equal(pasted.length, 2)
assert.equal(s().nodes.length, 4)
assert.equal(s().edges.length, 2) // internal edge re-created with new ids

console.log('commands.check: OK')
