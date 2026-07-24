/**
 * Streaming & Large Architecture Support — P5.8
 * 
 * Prevents OOM and timeouts on massive architectures by:
 *   - Chunking block processing
 *   - Streaming results instead of buffering
 *   - Memory-aware throttling
 *   - Generators for arrival events
 */

/**
 * Split blocks into chunks for memory-efficient processing.
 */
export function chunkBlocks(blocks, chunkSize = 100) {
  const chunks = []
  for (let i = 0; i < blocks.length; i += chunkSize) {
    chunks.push(blocks.slice(i, i + chunkSize))
  }
  return chunks
}

/**
 * Estimate memory usage (MB) for a simulation run.
 */
export function estimateMemoryUsage(blocks, edges, monteCarloPasses, durationSeconds) {
  // Base overhead: ~50MB for engine + Prisma
  const base = 50

  // Per-block memory: behavioral model + metrics buffers
  const blockOverhead = blocks.length * 0.5 // ~0.5MB per block

  // Per-edge memory: connection state
  const edgeOverhead = edges.length * 0.1

  // Per-pass memory: event queue + result buffers
  const eventsPerSecond = 1000 // worst-case RPS
  const eventOverhead = (durationSeconds * eventsPerSecond * 0.001) * monteCarloPasses

  // Percentile tracking overhead
  const percentileOverhead = blocks.length * 0.2

  return Math.round(base + blockOverhead + edgeOverhead + eventOverhead + percentileOverhead)
}

/**
 * Generator-based block processing for memory efficiency.
 * Yields chunks instead of loading all into memory.
 */
export async function* streamProcessBlocks(blocks, processFn, chunkSize = 100) {
  const chunks = chunkBlocks(blocks, chunkSize)

  for (const chunk of chunks) {
    const results = await processFn(chunk)
    yield results

    // Allow event loop to breathe between chunks
    await new Promise(r => setImmediate(r))
  }
}

/**
 * Stream simulation results to response (for HTTP streaming endpoints).
 */
export async function streamSimulationResults(res, asyncGenerator) {
  res.setHeader('Content-Type', 'application/x-ndjson')
  res.setHeader('Transfer-Encoding', 'chunked')

  try {
    for await (const chunk of asyncGenerator) {
      res.write(JSON.stringify(chunk) + '\n')
    }
    res.end()
  } catch (err) {
    res.write(JSON.stringify({ error: err.message }) + '\n')
    res.end()
  }
}

/**
 * Paginated simulation result retrieval.
 */
export async function paginateBlockMetrics(blockMetrics, { page = 1, pageSize = 50 }) {
  const entries = Object.entries(blockMetrics || {})
  const total = entries.length
  const start = (page - 1) * pageSize
  const end = start + pageSize

  return {
    data: entries.slice(start, end).map(([blockId, metrics]) => ({ blockId, ...metrics })),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
      hasNext: end < total,
      hasPrev: page > 1,
    }
  }
}

/**
 * Memory pressure check — abort if heap usage too high.
 */
export function checkMemoryPressure(thresholdPercent = 85) {
  const usage = process.memoryUsage()
  const heapUsedPercent = (usage.heapUsed / usage.heapTotal) * 100

  if (heapUsedPercent > thresholdPercent) {
    console.warn(`[MEMORY] Heap pressure: ${heapUsedPercent.toFixed(1)}% > ${thresholdPercent}%`)
    return {
      pressured: true,
      heapUsedMB: Math.round(usage.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(usage.heapTotal / 1024 / 1024),
      rssMB: Math.round(usage.rss / 1024 / 1024),
    }
  }

  return { pressured: false }
}

/**
 * Adaptive chunk size based on memory pressure.
 */
export function adaptiveChunkSize(baseSize = 100) {
  const pressure = checkMemoryPressure(80)
  if (pressure.pressured) {
    return Math.max(10, Math.floor(baseSize / 2))
  }
  return baseSize
}