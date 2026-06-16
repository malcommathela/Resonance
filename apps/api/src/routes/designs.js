import { Router } from 'express'
import { getAuth, clerkClient } from '@clerk/express'
import { z } from 'zod'
import { prisma } from '../lib/db.js'
import { cache } from '../lib/redis.js'

const router = Router()

const designSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  repoUrl: z.string().url().optional(),
  repoBranch: z.string().optional(),
})


// Helper: Get or create DB user from Clerk auth
async function getDbUser(req) {
  const auth = getAuth(req)
  if (!auth?.userId) return null
  
  // Try to find existing user
  let user = await prisma.user.findUnique({
    where: { clerkId: auth.userId },
    select: { id: true, email: true, name: true, avatar: true, tier: true, githubId: true, clerkId: true }
  })
  
  // Auto-create from Clerk if not in DB yet
  if (!user) {
    try {
      const clerkUser = await clerkClient.users.getUser(auth.userId)
      const primaryEmail = clerkUser.emailAddresses?.[0]?.emailAddress
      
      user = await prisma.user.create({
        data: {
          clerkId: auth.userId,
          email: primaryEmail || `user-${auth.userId}@clerk.dev`,
          name: `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || clerkUser.username || 'User',
          avatar: clerkUser.imageUrl,
          tier: 'free',
        },
        select: { id: true, email: true, name: true, avatar: true, tier: true, githubId: true, clerkId: true }
      })
      console.log(`[AUTO-CREATE] User created: ${user.id} (${user.email})`)
    } catch (err) {
      console.error('[AUTO-CREATE] Failed:', err.message)
      return null
    }
  }
  
  return user
}

// Apply Clerk's built-in auth to all routes
router.use(requireAuth())

router.get('/', async (req, res) => {
  const user = await getDbUser(req)
  if (!user) return res.status(401).json({ error: 'User not found' })
  
  const cacheKey = `designs:${user.id}`
  let designs = await cache.get(cacheKey)
  if (!designs) {
    designs = await prisma.design.findMany({
      where: { ownerId: user.id },
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { blocks: true, simulations: true } } }
    })
    await cache.set(cacheKey, designs, 60)
  }
  res.json(designs.map(d => ({ ...d, blocks: d._count.blocks, simulations: d._count.simulations })))
})

router.get('/:id', async (req, res) => {
  const user = await getDbUser(req)
  if (!user) return res.status(401).json({ error: 'User not found' })
  
  const design = await prisma.design.findFirst({
    where: { id: req.params.id, ownerId: user.id },
    include: { blocks: true, edges: true, simulations: { orderBy: { startedAt: 'desc' }, take: 5 } }
  })
  if (!design) return res.status(404).json({ error: 'Design not found' })
  res.json(serializeDesign(design))
})

router.post('/', async (req, res) => {
  const user = await getDbUser(req)
  if (!user) return res.status(401).json({ error: 'User not found' })
  
  const parsed = designSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })
  
  const design = await prisma.design.create({ data: { ...parsed.data, ownerId: user.id } })
  await cache.invalidatePattern(`designs:${user.id}*`)
  res.status(201).json(design)
})

router.patch('/:id', async (req, res) => {
  const user = await getDbUser(req)
  if (!user) return res.status(401).json({ error: 'User not found' })
  
  const design = await prisma.design.findFirst({ where: { id: req.params.id, ownerId: user.id } })
  if (!design) return res.status(404).json({ error: 'Not found' })
  
  const updated = await prisma.design.update({ where: { id: req.params.id }, data: { ...req.body, updatedAt: new Date() } })
  await cache.invalidatePattern(`designs:${user.id}*`)
  await cache.del(`design:${req.params.id}`)
  res.json(updated)
})

router.delete('/:id', async (req, res) => {
  const user = await getDbUser(req)
  if (!user) return res.status(401).json({ error: 'User not found' })
  
  await prisma.design.deleteMany({ where: { id: req.params.id, ownerId: user.id } })
  await cache.invalidatePattern(`designs:${user.id}*`)
  await cache.del(`design:${req.params.id}`)
  res.json({ success: true })
})

router.post('/:id/canvas', async (req, res) => {
  const user = await getDbUser(req)
  if (!user) return res.status(401).json({ error: 'User not found' })
  
  // ... your existing canvas save logic
  const { nodes, edges } = req.body
  const designId = req.params.id
  
  try {
    await prisma.edge.deleteMany({ where: { designId } })
    await prisma.block.deleteMany({ where: { designId } })
    
    const blockMap = new Map()
    for (const block of nodes) {
      const created = await prisma.block.create({
        data: {
          designId,
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
    
    for (const edge of edges) {
      const src = blockMap.get(edge.source)
      const tgt = blockMap.get(edge.target)
      if (src && tgt) {
        await prisma.edge.create({
          data: {
            designId,
            sourceId: src,
            targetId: tgt,
            connectionType: edge.data?.connectionType || 'http',
            animated: edge.animated ?? true,
            label: edge.data?.label || null,
          }
        })
      }
    }
    
    await prisma.design.update({ where: { id: designId }, data: { updatedAt: new Date() } })
    await cache.invalidatePattern(`designs:${user.id}*`)
    await cache.del(`design:${designId}`)
    res.json({ success: true })
  } catch (err) {
    console.error('[CANVAS SAVE ERROR]', err)
    res.status(500).json({ error: 'Failed to save canvas', details: err.message })
  }
})

router.post('/:id/autosave', async (req, res) => {
  const user = await getDbUser(req)
  if (!user) return res.status(401).json({ error: 'User not found' })
  
  // ... your existing autosave logic
  const { nodes, edges } = req.body
  const designId = req.params.id
  
  try {
    await prisma.edge.deleteMany({ where: { designId } })
    await prisma.block.deleteMany({ where: { designId } })
    
    const blockMap = new Map()
    for (const block of nodes) {
      const created = await prisma.block.create({
        data: {
          designId,
          type: block.data?.type || 'service',
          label: block.data?.label || 'Untitled',
          x: block.position?.x || 0,
          y: block.position?.y || 0,
          color: block.data?.color || '#8b5cf6',
          config: block.data?.config || {},
          metrics: block.data?.metrics || null,
        }
      })
      blockMap.set(block.id, created.id)
    }
    
    for (const edge of edges) {
      const src = blockMap.get(edge.source)
      const tgt = blockMap.get(edge.target)
      if (src && tgt) {
        await prisma.edge.create({
          data: {
            designId,
            sourceId: src,
            targetId: tgt,
            connectionType: edge.data?.connectionType || 'http',
            animated: edge.animated ?? true,
            label: edge.data?.label || null,
          }
        })
      }
    }
    
    await prisma.design.update({ where: { id: designId }, data: { updatedAt: new Date() } })
    res.json({ success: true, savedAt: new Date().toISOString() })
  } catch (err) {
    console.error('[AUTOSAVE ERROR]', err)
    res.status(500).json({ error: 'Autosave failed', details: err.message })
  }
})

function serializeDesign(design) {
  const nodes = design.blocks.map(block => ({
    id: block.id,
    type: 'customBlock',
    position: { x: block.x, y: block.y },
    data: {
      label: block.label,
      type: block.type,
      color: block.color,
      config: typeof block.config === 'string' ? JSON.parse(block.config) : block.config,
      metrics: block.metrics ? (typeof block.metrics === 'string' ? JSON.parse(block.metrics) : block.metrics) : null,
    }
  }))
  
  const edges = design.edges.map(edge => ({
    id: edge.id,
    source: edge.sourceId,
    target: edge.targetId,
    type: 'customEdge',
    animated: edge.animated,
    data: {
      connectionType: edge.connectionType,
      label: edge.label,
    }
  }))
  
  const { blocks, edges: _edges, _count, ...rest } = design
  return { ...rest, nodes, edges }
}

export default router