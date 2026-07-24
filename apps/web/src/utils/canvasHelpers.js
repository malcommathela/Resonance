/**
 * Canvas Helper Utilities
 *
 * Viewport manipulation, coordinate math, and canvas interaction helpers.
 */

// ============================================================================
// BATCH 3: VIEWPORT PAN / ZOOM HELPERS
// ============================================================================

/**
 * Pan the React Flow viewport to center on a specific element.
 *
 * @param {Object} reactFlowInstance — The React Flow instance (from useReactFlow)
 * @param {Object} params
 * @param {string} params.elementId — Node ID or Edge ID
 * @param {('node'|'edge')} params.elementType — Type of element
 * @param {Array<Object>} params.nodes — Current nodes array
 * @param {Array<Object>} params.edges — Current edges array
 * @param {number} [params.zoom=1.2] — Target zoom level
 * @param {number} [params.duration=800] — Animation duration in ms
 * @returns {boolean} True if pan was executed, false if element not found
 */
export function panToElement(reactFlowInstance, {
  elementId,
  elementType,
  nodes,
  edges,
  zoom = 1.2,
  duration = 800,
}) {
  if (!reactFlowInstance || !elementId) return false

  if (elementType === 'node') {
    const node = nodes.find(n => n.id === elementId)
    if (!node) return false

    const x = node.position.x + (node.width || 180) / 2
    const y = node.position.y + (node.height || 80) / 2
    reactFlowInstance.setCenter(x, y, { zoom, duration })
    return true
  }

  if (elementType === 'edge') {
    const edge = edges.find(e => e.id === elementId)
    if (!edge) return false

    const sourceNode = nodes.find(n => n.id === (edge.source || edge.sourceId))
    const targetNode = nodes.find(n => n.id === (edge.target || edge.targetId))
    if (!sourceNode || !targetNode) return false

    const x = (sourceNode.position.x + targetNode.position.x) / 2
    const y = (sourceNode.position.y + targetNode.position.y) / 2
    reactFlowInstance.setCenter(x, y, { zoom, duration })
    return true
  }

  return false
}

/**
 * Fit the viewport to show all nodes with padding.
 *
 * @param {Object} reactFlowInstance — The React Flow instance
 * @param {Object} [options]
 * @param {number} [options.padding=0.2] — Padding ratio
 * @param {number} [options.duration=500] — Animation duration in ms
 */
export function fitViewToAll(reactFlowInstance, { padding = 0.2, duration = 500 } = {}) {
  if (!reactFlowInstance) return
  reactFlowInstance.fitView({ padding, duration })
}

/**
 * Get the bounding box of a set of node IDs.
 *
 * @param {string[]} nodeIds
 * @param {Array<Object>} nodes
 * @returns {{x: number, y: number, width: number, height: number}|null}
 */
export function getNodesBoundingBox(nodeIds, nodes) {
  if (!nodeIds.length) return null

  const selected = nodes.filter(n => nodeIds.includes(n.id))
  if (!selected.length) return null

  const xs = selected.map(n => n.position.x)
  const ys = selected.map(n => n.position.y)
  const widths = selected.map(n => n.width || 180)
  const heights = selected.map(n => n.height || 80)

  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  const maxX = Math.max(...xs.map((x, i) => x + widths[i]))
  const maxY = Math.max(...ys.map((y, i) => y + heights[i]))

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  }
}

/**
 * Check if a point is inside a node's bounding box.
 *
 * @param {{x: number, y: number}} point
 * @param {Object} node
 * @returns {boolean}
 */
export function isPointInNode(point, node) {
  const width = node.width || 180
  const height = node.height || 80
  return (
    point.x >= node.position.x &&
    point.x <= node.position.x + width &&
    point.y >= node.position.y &&
    point.y <= node.position.y + height
  )
}

/**
 * Snap a value to the nearest grid multiple.
 *
 * @param {number} value
 * @param {number} [gridSize=20]
 * @returns {number}
 */
export function snapToGrid(value, gridSize = 20) {
  return Math.round(value / gridSize) * gridSize
}

/**
 * Calculate the distance between two points.
 *
 * @param {{x: number, y: number}} a
 * @param {{x: number, y: number}} b
 * @returns {number}
 */
export function distance(a, b) {
  return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2))
}

/**
 * Calculate the midpoint between two points.
 *
 * @param {{x: number, y: number}} a
 * @param {{x: number, y: number}} b
 * @returns {{x: number, y: number}}
 */
export function midpoint(a, b) {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  }
}