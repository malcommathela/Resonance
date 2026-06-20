import { Router } from 'express'
import { requireAuth, getAuth, clerkClient } from '@clerk/express'
import { prisma } from '../lib/db.js'

const router = Router()

async function getDbUser(req) {
  const auth = getAuth(req)
  if (!auth?.userId) return null
  let user = await prisma.user.findUnique({
    where: { clerkId: auth.userId },
    select: { id: true, email: true, name: true, avatar: true, tier: true, githubId: true, clerkId: true }
  })
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
    } catch (err) {
      console.error('[AUTO-CREATE] Failed:', err.message)
      return null
    }
  }
  return user
}

async function requireApiAuth(req, res, next) {
  const auth = getAuth(req)
  if (!auth?.userId) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  next()
}
router.use(requireApiAuth)

// GET /designs — list user's designs
router.get('/', async (req, res) => {
  const user = await getDbUser(req)
  if (!user) return res.status(401).json({ error: 'User not found' })

  try {
    const designs = await prisma.design.findMany({
      where: { ownerId: user.id },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        thumbnail: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { blocks: true, edges: true, simulations: true } }
      }
    })
    res.json(designs)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /designs/:id — get single design with blocks and edges
router.get('/:id', async (req, res) => {
  const user = await getDbUser(req)
  if (!user) return res.status(401).json({ error: 'User not found' })

  try {
    const design = await prisma.design.findFirst({
      where: { id: req.params.id, ownerId: user.id },
      include: {
        blocks: true,
        edges: true,
        simulations: { orderBy: { createdAt: 'desc' }, take: 5 }
      }
    })

    if (!design) return res.status(404).json({ error: 'Design not found' })

    // Convert to React Flow format
    const nodes = design.blocks.map(b => ({
      id: b.id,
      type: 'customBlock',
      position: { x: b.x, y: b.y },
      data: {
        label: b.label,
        type: b.type,
        color: b.color,
        config: typeof b.config === 'string' ? JSON.parse(b.config) : b.config,
        metrics: b.metrics ? (typeof b.metrics === 'string' ? JSON.parse(b.metrics) : b.metrics) : null,
      }
    }))

    const edges = design.edges.map(e => ({
      id: e.id,
      source: e.sourceId,
      target: e.targetId,
      type: 'customEdge',
      animated: e.animated,
      data: {
        connectionType: e.connectionType,
        label: e.label,
      }
    }))

    res.json({
      ...design,
      nodes,
      edges,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /designs — create new design
router.post('/', async (req, res) => {
  const user = await getDbUser(req)
  if (!user) return res.status(401).json({ error: 'User not found' })

  try {
    const { name, description, repoUrl, repoBranch } = req.body

    const design = await prisma.design.create({
      data: {
        name: name || 'Untitled Design',
        description,
        repoUrl,
        repoBranch: repoBranch || 'main',
        ownerId: user.id,
      }
    })

    res.status(201).json(design)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PATCH /designs/:id — update design metadata
router.patch('/:id', async (req, res) => {
  const user = await getDbUser(req)
  if (!user) return res.status(401).json({ error: 'User not found' })

  try {
    const { name, description, status, repoUrl, repoBranch } = req.body

    const design = await prisma.design.updateMany({
      where: { id: req.params.id, ownerId: user.id },
      data: { name, description, status, repoUrl, repoBranch, updatedAt: new Date() }
    })

    if (design.count === 0) return res.status(404).json({ error: 'Design not found' })

    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /designs/:id/canvas — save canvas (nodes + edges)
router.post('/:id/canvas', async (req, res) => {
  const user = await getDbUser(req)
  if (!user) return res.status(401).json({ error: 'User not found' })

  try {
    const { nodes, edges } = req.body
    const designId = req.params.id

    // Verify ownership
    const design = await prisma.design.findFirst({
      where: { id: designId, ownerId: user.id }
    })
    if (!design) return res.status(404).json({ error: 'Design not found' })

    // Upsert blocks
    for (const node of nodes || []) {
      await prisma.block.upsert({
        where: { id: node.id },
        update: {
          label: node.data?.label,
          type: node.data?.type,
          x: node.position?.x || 0,
          y: node.position?.y || 0,
          color: node.data?.color,
          config: node.data?.config || {},
          metrics: node.data?.metrics || null,
        },
        create: {
          id: node.id,
          designId,
          label: node.data?.label || 'Block',
          type: node.data?.type || 'service',
          x: node.position?.x || 0,
          y: node.position?.y || 0,
          color: node.data?.color || '#3b82f6',
          config: node.data?.config || {},
        }
      })
    }

    // Upsert edges
    for (const edge of edges || []) {
      await prisma.edge.upsert({
        where: { id: edge.id },
        update: {
          sourceId: edge.source,
          targetId: edge.target,
          connectionType: edge.data?.connectionType || 'http',
          animated: edge.animated ?? true,
          label: edge.data?.label,
        },
        create: {
          id: edge.id,
          designId,
          sourceId: edge.source,
          targetId: edge.target,
          connectionType: edge.data?.connectionType || 'http',
          animated: edge.animated ?? true,
          label: edge.data?.label,
        }
      })
    }

    // Update design timestamp
    await prisma.design.update({
      where: { id: designId },
      data: { updatedAt: new Date() }
    })

    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /designs/:id/autosave — lightweight auto-save
router.post('/:id/autosave', async (req, res) => {
  const user = await getDbUser(req)
  if (!user) return res.status(401).json({ error: 'User not found' })

  try {
    const { nodes, edges } = req.body
    const designId = req.params.id

    const design = await prisma.design.findFirst({
      where: { id: designId, ownerId: user.id }
    })
    if (!design) return res.status(404).json({ error: 'Design not found' })

    // Same as canvas save but don't block response
    for (const node of nodes || []) {
      await prisma.block.upsert({
        where: { id: node.id },
        update: {
          label: node.data?.label,
          type: node.data?.type,
          x: node.position?.x || 0,
          y: node.position?.y || 0,
          color: node.data?.color,
          config: node.data?.config || {},
        },
        create: {
          id: node.id,
          designId,
          label: node.data?.label || 'Block',
          type: node.data?.type || 'service',
          x: node.position?.x || 0,
          y: node.position?.y || 0,
          color: node.data?.color || '#3b82f6',
          config: node.data?.config || {},
        }
      })
    }

    for (const edge of edges || []) {
      await prisma.edge.upsert({
        where: { id: edge.id },
        update: {
          sourceId: edge.source,
          targetId: edge.target,
          connectionType: edge.data?.connectionType || 'http',
        },
        create: {
          id: edge.id,
          designId,
          sourceId: edge.source,
          targetId: edge.target,
          connectionType: edge.data?.connectionType || 'http',
        }
      })
    }

    await prisma.design.update({ where: { id: designId }, data: { updatedAt: new Date() } })

    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /designs/:id
router.delete('/:id', async (req, res) => {
  const user = await getDbUser(req)
  if (!user) return res.status(401).json({ error: 'User not found' })

  try {
    await prisma.design.deleteMany({
      where: { id: req.params.id, ownerId: user.id }
    })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router