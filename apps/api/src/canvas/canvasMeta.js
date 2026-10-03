// Canonical canvas metadata contract (Phase 1). Pure, dependency-free.
// Groups are presentation-only, never simulation input. Shape:
// { schemaVersion: 1, groups: [...] } or a bare groups array (compat).
export const CANVAS_META_MAX_GROUPS = 200
export const CANVAS_META_MAX_MEMBERS = 500
export const CANVAS_META_MAX_BYTES = 256 * 1024

function invalid(msg) {
  const err = new Error(msg)
  err.status = 400
  err.code = 'CANVAS_META_INVALID'
  throw err
}

export function normalizeCanvasMeta(input) {
  const raw = Array.isArray(input) ? input : input?.groups
  if (input == null) return { schemaVersion: 1, groups: [] }
  if (!Array.isArray(raw)) invalid('canvasMeta.groups must be an array')
  if (raw.length > CANVAS_META_MAX_GROUPS) invalid(`Too many groups (max ${CANVAS_META_MAX_GROUPS})`)
  const seen = new Set()
  const groups = raw.map((g, i) => {
    if (!g || typeof g !== 'object' || g.type !== 'group' || typeof g.id !== 'string' || !g.id) {
      invalid(`groups[${i}]: id/type='group' required`)
    }
    if (seen.has(g.id)) invalid(`Duplicate group id: ${g.id}`)
    seen.add(g.id)
    const x = Number(g.position?.x)
    const y = Number(g.position?.y)
    if (!Number.isFinite(x) || !Number.isFinite(y)) invalid(`groups[${i}]: numeric position required`)
    const label = String(g.data?.label ?? '').slice(0, 120)
    const nodeIds = [...new Set((g.data?.nodeIds || []).filter((m) => typeof m === 'string'))]
      .slice(0, CANVAS_META_MAX_MEMBERS)
    // RF v12 streams resize dims into top-level width/height (+measured) and
    // leaves style frozen at creation — prefer style, fall back to the live
    // attrs, or a resize silently reverts on reload.
    const dim = (k) => {
      for (const v of [g.style?.[k], g[k], g.measured?.[k]]) {
        const n = Number(v)
        if (Number.isFinite(n)) return Math.min(Math.max(n, 0), 5000)
      }
      return undefined
    }
    const width = dim('width')
    const height = dim('height')
    const style = (width !== undefined || height !== undefined) ? {
      ...(width !== undefined ? { width } : {}),
      ...(height !== undefined ? { height } : {}),
    } : undefined
    return {
      id: g.id,
      type: 'group',
      position: { x, y },
      ...(style ? { style } : {}),
      data: {
        label,
        ...(typeof g.data?.color === 'string' ? { color: g.data.color.slice(0, 32) } : {}),
        nodeIds,
        ...(g.data?.collapsed != null ? { collapsed: !!g.data.collapsed } : {}),
      },
    }
  })
  const meta = { schemaVersion: 1, groups }
  if (JSON.stringify(meta).length > CANVAS_META_MAX_BYTES) invalid('canvasMeta payload too large')
  return meta
}
