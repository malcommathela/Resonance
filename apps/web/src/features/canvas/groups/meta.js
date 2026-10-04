// Group helpers (Phase 8). Dependency-free; covered by meta.check.js.
// Groups persist per design in localStorage — the backend Block/Edge
// contract only understands simulating blocks (unknown types fall through to
// the service model), so canvas-only objects stay out of the API payload
// (see document.js toPersistable). Backend migration = the upgrade path.
// ponytail: fixed architecture-node footprint matching ArchitectureNode's
// w-[232px] card + metadata row; read RF measured sizes when resize-aware boxes land
export const NODE_W = 232
export const NODE_H = 88
// RF v12 streams resize dims into node.width/height (+measured) and never
// touches node.style — style is frozen at creation. Live attrs are the
// commit-time truth; style is only the hydrated/legacy fallback. Single
// funnel: every size reader below goes through here or a resize silently
// reverts to the creation size on save/reload.
const numOrUndef = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

export function groupSize(node) {
  const style = node?.style || {}
  const measured = node?.measured || {}
  return {
    width: numOrUndef(node?.width) ?? numOrUndef(measured.width) ?? numOrUndef(style.width),
    height: numOrUndef(node?.height) ?? numOrUndef(measured.height) ?? numOrUndef(style.height),
  }
}
export const PAD_X = 20
export const HEADER_H = 44
export const PAD_BOTTOM = 20
export const COLLAPSED_W = 240
export const COLLAPSED_H = 44
export const GROUP_MIN_W = 200
export const GROUP_MIN_H = 120
export const EMPTY_GROUP_W = 400
export const EMPTY_GROUP_H = 200
// Explicit canvas layers (single source of truth). React Flow runs with
// zIndexMode="manual" + elevateNodesOnSelect={false}, so these exact values
// decide paint order: groups < edges (RF default ~0-1) < architecture < UI.
export const GROUP_Z_INDEX = 0
export const NODE_Z_INDEX = 10
export const GROUP_DRAG_HANDLE = 'group-drag-handle'

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
  const size = groupSize(current)
  const cur = {
    x: current?.position?.x ?? req.x,
    y: current?.position?.y ?? req.y,
    width: size.width ?? req.width,
    height: size.height ?? req.height,
  }
  const x = Math.min(cur.x, req.x)
  const y = Math.min(cur.y, req.y)
  const width = Math.max(cur.width, req.x + req.width - x)
  const height = Math.max(cur.height, req.y + req.height - y)
  if (x === cur.x && y === cur.y && width === cur.width && height === cur.height) return null
  return { x, y, width, height }
}

// Rigid group shift: group + customBlock members move by the identical delta;
// everything else is untouched. Returns { nodes, moved }. Pure — covered by
// meta.check.js; canvasStore.moveGroup reuses it so the tested math is the
// shipped math. Edges need no updates: they reference node ids.
// `snap` keeps the canvas grid invariant (group origins are not grid
// multiples: minX - PAD_X), so each landed position is snapped.
export function shiftGroupNodes(nodes, groupId, dx, dy, snap) {
  if (!dx && !dy) return { nodes, moved: false }
  const g = (nodes || []).find((n) => n.id === groupId && n.type === 'group')
  if (!g) return { nodes, moved: false }
  const apply = typeof snap === 'function' ? snap : (v) => v
  const memberIds = new Set(g.data?.nodeIds || [])
  let moved = false
  const next = nodes.map((n) => {
    if (n.id === groupId) {
      moved = true
      return { ...n, position: { x: apply(n.position.x + dx), y: apply(n.position.y + dy) } }
    }
    if (memberIds.has(n.id) && n.type === 'customBlock') {
      moved = true
      return { ...n, position: { x: apply(n.position.x + dx), y: apply(n.position.y + dy) } }
    }
    return n
  })
  return { nodes: moved ? next : nodes, moved }
}

// Drop member ids that no longer exist; groups are always kept (possibly
// empty) — only explicit Delete/Ungroup removes a group, so empty groups
// created via Add Group survive unrelated node deletions.
export function pruneGroupMembers(groupNodes, validIds) {
  const valid = new Set(validIds)
  const kept = []
  for (const g of groupNodes) {
    const nodeIds = (g.data?.nodeIds || []).filter((id) => valid.has(id))
    kept.push({ ...g, data: { ...g.data, nodeIds, memberCount: nodeIds.length } })
  }
  return { kept, dropped: [] }
}

// Drop detection: architecture-node center inside a group rect? Returns the
// group id or null. Collapsed groups and group nodes never match (flat
// groups only). Pure — covered by meta.check.js.
export function findGroupDropTarget(groups, node) {
  if (!node || node.type !== 'customBlock') return null
  const cx = node.position.x + NODE_W / 2
  const cy = node.position.y + NODE_H / 2
  for (const g of groups || []) {
    if (g?.type !== 'group' || g.data?.collapsed) continue
    const size = groupSize(g)
    const x = g.position?.x ?? 0
    const y = g.position?.y ?? 0
    const w = size.width ?? EMPTY_GROUP_W
    const h = size.height ?? EMPTY_GROUP_H
    if (cx >= x && cx <= x + w && cy >= y && cy <= y + h) return g.id
  }
  return null
}

export function extractMetaNodes(nodes) {
  return {
    groups: (nodes || []).filter((n) => n?.type === 'group'),
    notes: [],
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
      groups: Array.isArray(raw.groups) ? raw.groups.filter((n) => n?.type === 'group') : [],
      notes: [],
    }
  } catch {
    return null
  }
}
