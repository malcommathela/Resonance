/**
 * Shared Graph Utilities
 *
 * Graph traversal helpers used by reliability-engine.js and security-engine.js.
 * All functions are pure and deterministic.
 */

/**
 * Build forward adjacency list from edges.
 * @param {Array} edges — [{ sourceId, targetId, ... }]
 * @returns {Map<string, string[]>}
 */
export function buildAdjacency(edges) {
  const adj = new Map()
  for (const edge of edges) {
    const neighbors = adj.get(edge.sourceId) || []
    neighbors.push(edge.targetId)
    adj.set(edge.sourceId, neighbors)
  }
  return adj
}

/**
 * Build reverse adjacency list from edges.
 * @param {Array} edges — [{ sourceId, targetId, ... }]
 * @returns {Map<string, string[]>}
 */
export function buildReverseAdjacency(edges) {
  const adj = new Map()
  for (const edge of edges) {
    const neighbors = adj.get(edge.targetId) || []
    neighbors.push(edge.sourceId)
    adj.set(edge.targetId, neighbors)
  }
  return adj
}

/**
 * Get all nodes reachable from startId via BFS.
 * @param {string} startId
 * @param {Map} adjacency
 * @returns {Set<string>}
 */
export function getReachableNodes(startId, adjacency) {
  const reachable = new Set()
  const queue = [startId]
  reachable.add(startId)

  while (queue.length > 0) {
    const current = queue.shift()
    const neighbors = adjacency.get(current) || []
    for (const neighbor of neighbors) {
      if (!reachable.has(neighbor)) {
        reachable.add(neighbor)
        queue.push(neighbor)
      }
    }
  }

  return reachable
}

/**
 * Check if a path exists between start and end.
 * @param {string} start
 * @param {string} end
 * @param {Map} adjacency
 * @returns {boolean}
 */
export function hasPath(start, end, adjacency) {
  const visited = new Set()
  const queue = [start]
  visited.add(start)

  while (queue.length > 0) {
    const current = queue.shift()
    if (current === end) return true

    const neighbors = adjacency.get(current) || []
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor)
        queue.push(neighbor)
      }
    }
  }

  return false
}

/**
 * Find all simple paths from start to end up to maxDepth.
 * @param {string} start
 * @param {string} end
 * @param {Map} adjacency
 * @param {number} maxDepth
 * @returns {Array<string[]>}
 */
export function findAllPaths(start, end, adjacency, maxDepth = 5) {
  const paths = []
  const queue = [[start]]

  while (queue.length > 0) {
    const path = queue.shift()
    const last = path[path.length - 1]

    if (last === end && path.length > 1) {
      paths.push(path)
      continue
    }

    if (path.length >= maxDepth) continue

    const neighbors = adjacency.get(last) || []
    for (const neighbor of neighbors) {
      if (!path.includes(neighbor)) {
        queue.push([...path, neighbor])
      }
    }
  }

  return paths
}

/**
 * Get all downstream blocks from a starting block (excluding start).
 * @param {string} blockId
 * @param {Map} adjacency
 * @returns {Set<string>}
 */
export function getDownstreamBlocks(blockId, adjacency) {
  const downstream = new Set()
  const queue = [blockId]
  const visited = new Set([blockId])

  while (queue.length > 0) {
    const current = queue.shift()
    const neighbors = adjacency.get(current) || []
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor)
        downstream.add(neighbor)
        queue.push(neighbor)
      }
    }
  }

  return downstream
}

/**
 * Get immediate predecessors of a block.
 * @param {string} blockId
 * @param {Map} adjacency — forward adjacency
 * @returns {string[]}
 */
export function getPredecessors(blockId, adjacency) {
  const preds = []
  for (const [source, targets] of adjacency) {
    if (targets.includes(blockId)) preds.push(source)
  }
  return preds
}