// Canvas groups for AI context (Phase 6). Pure, dependency-free.
// Organizational metadata only — never simulation input. Member IDs resolve
// against known blocks; missing members are excluded, never invented. A null
// column means "no groups saved yet" ([]); corrupt JSON means 'unavailable'.
// Covered by canvasGroups.check.js (run: node canvasGroups.check.js).
export function shapeContextGroups(canvasMeta, blocks) {
  if (canvasMeta == null) return { groups: [], health: 'available' }
  try {
    const parsed = typeof canvasMeta === 'string' ? JSON.parse(canvasMeta) : canvasMeta
    const list = Array.isArray(parsed) ? parsed : parsed?.groups
    if (!Array.isArray(list)) return { groups: null, health: 'unavailable' }
    const names = new Map((blocks || []).map((b) => [b.id, b.label || b.id]))
    const groups = list
      .filter((g) => g?.type === 'group' && typeof g.id === 'string')
      .slice(0, 20)
      .map((g) => {
        const memberIds = (g.data?.nodeIds || []).filter((m) => names.has(m)).slice(0, 30)
        return {
          id: g.id,
          label: String(g.data?.label ?? '').slice(0, 120),
          members: memberIds.map((m) => names.get(m)),
          memberCount: memberIds.length,
        }
      })
    return { groups, health: 'available' }
  } catch {
    return { groups: null, health: 'unavailable' }
  }
}
