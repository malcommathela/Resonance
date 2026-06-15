import { Router } from 'express'
import { prisma } from '../lib/db.js'
import { requireAuth } from '../middleware/auth.js'
import { cache } from '../lib/redis.js'
import { generateArchitecture } from '../lib/gemini.js'

const router = Router()

// POST /analyze-and-save/:designId — AI-powered architecture generation
router.post('/analyze-and-save/:designId', requireAuth, async (req, res) => {
  try {
    const { designId } = req.params
    const { files } = req.body

    const design = await prisma.design.findFirst({
      where: { id: designId, ownerId: req.user.id }
    })
    if (!design) return res.status(404).json({ error: 'Design not found' })

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files provided for analysis' })
    }

    const result = await generateArchitecture(files)

    console.log('[AI] blocks:', result.blocks.length, 'edges:', result.edges.length)

    // Build nodes
    const nodes = result.blocks.map(block => ({
      id: block.id,
      type: 'customBlock',
      position: block.position,
      data: {
        label: block.label,
        type: block.type,
        color: block.color,
        config: block.config,
      }
    }))

    // Build edges - ensure IDs match node IDs exactly
    const validNodeIds = new Set(nodes.map(n => n.id))
    let edges = []

    if (result.edges && result.edges.length > 0) {
      edges = result.edges
        .filter(e => {
          const ok = validNodeIds.has(e.source) && validNodeIds.has(e.target) && e.source !== e.target
          if (!ok) console.log('[SKIP] invalid edge:', e)
          return ok
        })
        .map((e, i) => ({
          id: e.id || `e-${i}`,
          source: e.source,
          target: e.target,
          type: 'customEdge',
          animated: true,
          data: { connectionType: e.connectionType || 'http' }
        }))
    }

    console.log('[VALID] edges after filtering:', edges.length)

    // FALLBACK: Create edges if AI didn't generate any valid ones
    if (edges.length === 0 && nodes.length > 1) {
      console.log('[FALLBACK] Creating logical edges...')

      const find = (type) => nodes.filter(n => n.data.type === type)
      const client = find('client')[0]
      const gateway = find('api-gateway')[0] || find('load-balancer')[0]
      const services = find('service')
      const databases = find('database')
      const caches = find('cache')
      const queues = find('message-queue')
      const externals = [...find('external-api'), ...find('storage')]

      let idx = 0
      const add = (src, tgt, ctype = 'http') => {
        if (!src || !tgt) return
        edges.push({
          id: `fb-${idx++}`,
          source: src.id,
          target: tgt.id,
          type: 'customEdge',
          animated: true,
          data: { connectionType: ctype }
        })
        console.log(`[FALLBACK EDGE] ${src.id} -> ${tgt.id} (${ctype})`)
      }

      if (client && gateway) {
        add(client, gateway)
        services.forEach(s => add(gateway, s))
      } else if (client && services[0]) {
        add(client, services[0])
      }

      services.forEach(svc => {
        databases.forEach(db => add(svc, db, 'db'))
        caches.forEach(c => add(svc, c, 'http'))
        queues.forEach(q => add(svc, q, 'event'))
        externals.forEach(ext => add(svc, ext, 'http'))
      })

      console.log('[FALLBACK] total edges:', edges.length)
    }

    // SAVE TO DATABASE — batch create + verification
    console.log('[DB] Starting verified batch save...')

    // Clear existing
    const deletedEdges = await prisma.edge.deleteMany({ where: { designId } })
    const deletedBlocks = await prisma.block.deleteMany({ where: { designId } })
    console.log(`[DB] Cleared ${deletedEdges.count} edges, ${deletedBlocks.count} blocks`)

    // Create blocks
    const blockMap = new Map()
    for (const block of nodes) {
      try {
        const created = await prisma.block.create({
          data: {
            designId,
            type: block.data.type,
            label: block.data.label,
            x: block.position.x,
            y: block.position.y,
            color: block.data.color,
            config: block.data.config || {},
            metrics: null,
          }
        })
        blockMap.set(block.id, created.id)
        console.log(`[DB BLOCK] "${block.id}" -> ${created.id}`)
      } catch (err) {
        console.error(`[DB BLOCK ERROR] ${block.id}:`, err.message)
      }
    }

    // Prepare edges for batch create
    const edgesToCreate = []
    for (const edge of edges) {
      const srcPrisma = blockMap.get(edge.source)
      const tgtPrisma = blockMap.get(edge.target)

      if (!srcPrisma || !tgtPrisma) {
        console.log(`[DB EDGE SKIP] ${edge.id}: missing mapping`)
        continue
      }

      edgesToCreate.push({
        designId,
        sourceId: srcPrisma,
        targetId: tgtPrisma,
        connectionType: edge.data?.connectionType || 'http',
        animated: true,
      })
    }

    console.log(`[DB] Prepared ${edgesToCreate.length} edges for batch create`)

    // Batch create edges (single round-trip = pooler-safe)
    let savedCount = 0
    if (edgesToCreate.length > 0) {
      try {
        const result = await prisma.edge.createMany({
          data: edgesToCreate,
          skipDuplicates: true,
        })
        savedCount = result.count
        console.log(`[DB EDGE BATCH] Created ${savedCount} edges`)
      } catch (err) {
        console.error(`[DB EDGE BATCH ERROR]`, err.message)
        // Fallback: individual creates
        for (const edgeData of edgesToCreate) {
          try {
            await prisma.edge.create({ data: edgeData })
            savedCount++
          } catch (e) {
            console.error(`[DB EDGE FALLBACK ERROR]`, e.message)
          }
        }
      }
    }

    // VERIFY: Count edges in database
    const edgeCount = await prisma.edge.count({ where: { designId } })
    console.log(`[DB VERIFY] ${edgeCount} edges in DB (expected ${edgesToCreate.length})`)

    // Retry if mismatch
    if (edgeCount < edgesToCreate.length && edgesToCreate.length > 0) {
      console.log(`[DB RETRY] Missing ${edgesToCreate.length - edgeCount} edges, retrying...`)
      const retryResult = await prisma.edge.createMany({
        data: edgesToCreate,
        skipDuplicates: true,
      })
      const retryCount = await prisma.edge.count({ where: { designId } })
      console.log(`[DB RETRY] ${retryCount} edges after retry`)
    }

    await prisma.design.update({
      where: { id: designId },
      data: { 
        updatedAt: new Date(), 
        status: 'draft',
        description: design.description + ` | AI: ${result.metadata.description}` 
      }
    })

    // Invalidate cache
    await cache.invalidatePattern(`designs:${req.user.id}*`)
    await cache.del(`design:${designId}`)
    console.log('[CACHE] Invalidated')

    // Final flush delay
    await new Promise(r => setTimeout(r, 500))

    const finalEdgeCount = await prisma.edge.count({ where: { designId } })
    console.log(`[DB FINAL] ${finalEdgeCount} edges persisted`)

    res.json({
      success: true,
      nodes,
      edges,
      metadata: result.metadata,
      _debug: {
        blocksCreated: blockMap.size,
        edgesPrepared: edgesToCreate.length,
        edgesCreated: savedCount,
        edgesInDb: finalEdgeCount,
      }
    })
  } catch (err) {
    console.error('[ERROR]', err)
    res.status(500).json({ error: err.message })
  }
})

// POST /analyze — Just analyze, don't save
router.post('/analyze', requireAuth, async (req, res) => {
  try {
    const { files } = req.body
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files provided' })
    }

    const result = await generateArchitecture(files)

    const nodes = result.blocks.map(block => ({
      id: block.id,
      type: 'customBlock',
      position: block.position,
      data: {
        label: block.label,
        type: block.type,
        color: block.color,
        config: block.config,
      }
    }))

    const edges = result.edges.map(edge => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: 'customEdge',
      animated: true,
      data: { connectionType: edge.connectionType },
    }))

    res.json({ nodes, edges, metadata: result.metadata })
  } catch (err) {
    console.error('[ERROR]', err)
    res.status(500).json({ error: err.message })
  }
})

export default router