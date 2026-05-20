import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/db.js'
import { authMiddleware } from '../middleware/auth.js'
import { cache } from '../lib/redis.js'

const router = Router()

const designSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  repoUrl: z.string().url().optional(),
  repoBranch: z.string().optional(),
})

// Get all designs for user
router.get('/', authMiddleware, async (req, res) => {
  const cacheKey = `designs:${req.user.id}`
  let designs = await cache.get(cacheKey)

  if (!designs) {
    designs = await prisma.design.findMany({
      where: { ownerId: req.user.id },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: { select: { blocks: true, simulations: true } }
      }
    })
    await cache.set(cacheKey, designs, 60)
  }

  res.json(designs.map(d => ({
    ...d,
    blocks: d._count.blocks,
    simulations: d._count.simulations,
  })))
})

// Get single design with blocks and edges
router.get('/:id', authMiddleware, async (req, res) => {
  const design = await prisma.design.findFirst({
    where: { id: req.params.id, ownerId: req.user.id },
    include: {
      blocks: true,
      edges: true,
      simulations: { orderBy: { startedAt: 'desc' }, take: 5 },
    }
  })

  if (!design) return res.status(404).json({ error: 'Design not found' })
  res.json(design)
})

// Create design
router.post('/', authMiddleware, async (req, res) => {
  const parsed = designSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() })
  }

  const design = await prisma.design.create({
    data: { ...parsed.data, ownerId: req.user.id }
  })

  await cache.invalidatePattern(`designs:${req.user.id}*`)
  res.status(201).json(design)
})

// Update design
router.patch('/:id', authMiddleware, async (req, res) => {
  const design = await prisma.design.findFirst({
    where: { id: req.params.id, ownerId: req.user.id }
  })

  if (!design) return res.status(404).json({ error: 'Not found' })

  const updated = await prisma.design.update({
    where: { id: req.params.id },
    data: { ...req.body, updatedAt: new Date() }
  })

  await cache.invalidatePattern(`designs:${req.user.id}*`)
  await cache.del(`design:${req.params.id}`)
  res.json(updated)
})

// Delete design
router.delete('/:id', authMiddleware, async (req, res) => {
  await prisma.design.deleteMany({
    where: { id: req.params.id, ownerId: req.user.id }
  })

  await cache.invalidatePattern(`designs:${req.user.id}*`)
  res.json({ success: true })
})

// Save canvas state (blocks + edges)
router.post('/:id/canvas', authMiddleware, async (req, res) => {
  const { blocks, edges } = req.body

  await prisma.$transaction(async (tx) => {
    // Delete existing blocks and edges
    await tx.edge.deleteMany({ where: { designId: req.params.id } })
    await tx.block.deleteMany({ where: { designId: req.params.id } })

    // Create new blocks
    const blockMap = new Map()
    for (const block of blocks) {
      const created = await tx.block.create({
        data: {
          designId: req.params.id,
          type: block.data.type,
          label: block.data.label,
          x: block.position.x,
          y: block.position.y,
          color: block.data.color,
          config: block.data.config || {},
          metrics: block.data.metrics || null,
        }
      })
      blockMap.set(block.id, created.id)
    }

    // Create edges with updated block IDs
    for (const edge of edges) {
      await tx.edge.create({
        data: {
          designId: req.params.id,
          sourceId: blockMap.get(edge.source),
          targetId: blockMap.get(edge.target),
          connectionType: edge.data?.connectionType || 'http',
          animated: edge.animated ?? true,
        }
      })
    }

    await tx.design.update({
      where: { id: req.params.id },
      data: { updatedAt: new Date() }
    })
  })

  await cache.invalidatePattern(`designs:${req.user.id}*`)
  res.json({ success: true })
})

export default router