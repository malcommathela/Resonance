// Group/note helpers (Phase 8). Dependency-free; covered by meta.check.js.
// Groups/notes persist per design in localStorage — the backend Block/Edge
// contract only understands simulating blocks (unknown types fall through to
// the service model), so canvas-only objects stay out of the API payload
// (see document.js toPersistable). Backend migration = the upgrade path.
export const GROUP_COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ec4899']

// ponytail: fixed architecture-node footprint; read RF measured sizes when resize-aware boxes land
export const NODE_W = 208
export const NODE_H = 72
export const PAD_X = 20
export const HEADER_H = 44
export const PAD_BOTTOM = 20
export const COLLAPSED_W = 240
export const COLLAPSED_H = 44

const META_KEY = (id) => `resonance.canvas.meta.${id}`

export function groupBox(members) {
  if (!members || members.length === 0) return null
  const xs = members.map((m) => m.position.x)
  const ys = members.map((m) => m.position.y)
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  const maxX = Math.max(...xs)
  const maxY = Math.max(...ys)
  return {
    x: minX - PAD_X,
    y: minY - HEADER_H,
    width: maxX - minX + NODE_W + PAD_X * 2,
    height: maxY - minY + NODE_H + HEADER_H + PAD_BOTTOM,
  }
}

// Expand-only box: grow the current group rect to contain members, never
// shrink it — manual whitespace survives member movement. Returns the rect
// to apply ({ x, y, width, height }) or null when the current rect already
// fits. Collapsed groups are fixed-size and handled by the caller.
export function expandGroupBox(current, members) {
  const req = groupBox(members)
  if (!req) return null
  const cur = {
    x: current?.position?.x ?? req.x,
    y: current?.position?.y ?? req.y,
    width: current?.style?.width ?? req.width,
    height: current?.style?.height ?? req.height,
  }
  const x = Math.min(cur.x, req.x)
  const y = Math.min(cur.y, req.y)
  const width = Math.max(cur.width, req.x + req.width - x)
  const height = Math.max(cur.height, req.y + req.height - y)
  if (x === cur.x && y === cur.y && width === cur.width && height === cur.height) return null
  return { x, y, width, height }
}

// Drop member ids that no longer exist; return kept groups + dropped group ids.
export function pruneGroupMembers(groupNodes, validIds) {
  const valid = new Set(validIds)
  const kept = []
  const dropped = []
  for (const g of groupNodes) {
    const nodeIds = (g.data?.nodeIds || []).filter((id) => valid.has(id))
    if (nodeIds.length === 0) dropped.push(g.id)
    else kept.push({ ...g, data: { ...g.data, nodeIds, memberCount: nodeIds.length } })
  }
  return { kept, dropped }
}

export function extractMetaNodes(nodes) {
  return {
    groups: (nodes || []).filter((n) => n?.type === 'group'),
    notes: (nodes || []).filter((n) => n?.type === 'note'),
  }
}

export function persistCanvasMeta(designId, nodes) {
  if (!designId || designId === 'new') return
  try {
    localStorage.setItem(META_KEY(designId), JSON.stringify(extractMetaNodes(nodes)))
  } catch { /* private mode — canvas meta is best-effort */ }
}

export function readCanvasMeta(designId) {
  if (!designId || designId === 'new') return null
  try {
    const raw = JSON.parse(localStorage.getItem(META_KEY(designId)))
    if (!raw || typeof raw !== 'object') return null
    return {
      groups: Array.isArray(raw.groups) ? raw.groups : [],
      notes: Array.isArray(raw.notes) ? raw.notes : [],
    }
  } catch {
    return null
  }
}
