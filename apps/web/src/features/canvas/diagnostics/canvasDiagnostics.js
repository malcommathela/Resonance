// Development-only architecture diagnostics (Phase 14). Pure: describe a
// document, get the violations. Wired behind import.meta.env.DEV in
// CanvasEditor — never shown to production users, never blocks saves.
// Dependency-free: covered by diagnostics.check.js.
import { validateCanvasDocument } from '../core/document.js'
import { toSimulationInput } from '../core/document.js'

export function diagnoseDocument(doc) {
  const issues = []
  const nodes = doc?.nodes || []

  // Duplicate node IDs
  const seen = new Set()
  for (const n of nodes) {
    if (!n?.id) continue
    if (seen.has(n.id)) issues.push({ code: 'duplicate-node-id', nodeId: n.id })
    seen.add(n.id)
  }

  // Dangling references (edges + group members)
  for (const i of validateCanvasDocument(doc)) {
    if (i.type === 'edge-source-missing' || i.type === 'edge-target-missing') {
      issues.push({ code: 'edge-references-missing-node', ...i })
    } else if (i.type === 'group-member-missing') {
      issues.push({ code: 'group-references-missing-member', ...i })
    }
  }

  // NOTE: legacy/unknown config keys are intentionally NOT reported — the
  // property resolver already buckets them as Advanced and preserves them.
  // Flagging every pre-existing design on every load was pure console noise.

  // Canvas-only objects leaking toward simulation (adapter must exclude these)
  const input = toSimulationInput(doc)
  const blockIds = new Set((input.nodes || []).map((n) => n?.id))
  for (const n of nodes) {
    if ((n?.type === 'group' || n?.type === 'note') && blockIds.has(n.id)) {
      issues.push({ code: 'simulation-payload-contains-canvas-object', nodeId: n.id })
    }
  }

  return issues
}
