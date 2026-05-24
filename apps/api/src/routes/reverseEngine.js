import { Router } from 'express'
import { authMiddleware } from '../middleware/auth.js'
import { cache } from '../lib/redis.js'
import { prisma } from '../lib/db.js'
import { generateArchitecture } from '../lib/gemini.js'

const router = Router()

// POST /analyze-and-save/:designId — AI-powered architecture generation
router.post('/analyze-and-save/:designId', authMiddleware, async (req, res) => {
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
    console.log('[AI] block IDs:', result.blocks.map(b => b.id))
    console.log('[AI] edge sources:', result.edges.map(e => e.source))
    console.log('[AI] edge targets:', result.edges.map(e => e.target))

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

    // SAVE TO DATABASE
    console.log('[DB] Starting transaction...')
    await prisma.$transaction(async (tx) => {
      await tx.edge.deleteMany({ where: { designId } })
      await tx.block.deleteMany({ where: { designId } })

      // Create blocks
      const blockMap = new Map()
      for (const block of nodes) {
        const created = await tx.block.create({
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
      }

      console.log('[DB] BlockMap:', Array.from(blockMap.entries()))

      // Create edges - THIS IS THE CRITICAL PART
      let savedCount = 0
      for (const edge of edges) {
        const srcPrisma = blockMap.get(edge.source)
        const tgtPrisma = blockMap.get(edge.target)

        console.log(`[DB EDGE CHECK] "${edge.source}"->${srcPrisma}, "${edge.target}"->${tgtPrisma}`)

        if (!srcPrisma || !tgtPrisma) {
          console.log(`[DB EDGE SKIP] Missing mapping for edge ${edge.id}`)
          continue
        }

        await tx.edge.create({
          data: {
            designId,
            sourceId: srcPrisma,
            targetId: tgtPrisma,
            connectionType: edge.data?.connectionType || 'http',
            animated: true,
          }
        })
        savedCount++
        console.log(`[DB EDGE SAVED] ${edge.source} -> ${edge.target}`)
      }

      console.log(`[DB] Saved ${savedCount}/${edges.length} edges`)

      await tx.design.update({
        where: { id: designId },
        data: { 
          updatedAt: new Date(), 
          status: 'draft',
          description: design.description + ` | AI: ${result.metadata.description}` 
        }
      })
    })

    // Invalidate cache
    await cache.invalidatePattern(`designs:${req.user.id}*`)
    await cache.del(`design:${designId}`)
    console.log('[CACHE] Invalidated')

    res.json({
      success: true,
      nodes,
      edges,
      metadata: result.metadata,
    })
  } catch (err) {
    console.error('[ERROR]', err)
    res.status(500).json({ error: err.message })
  }
})

// POST /analyze — Just analyze, don't save
router.post('/analyze', authMiddleware, async (req, res) => {
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