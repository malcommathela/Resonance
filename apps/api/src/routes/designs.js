import { Router } from 'express'
import { requireAuth, getAuth } from '@clerk/express'
import { prisma } from '../lib/db.js'

const router = Router()

async function getDbUser(req) {
  const auth = getAuth(req)
  if (!auth?.userId) return null
  return prisma.user.findUnique({
    where: { clerkId: auth.userId },
    select: { id: true, email: true, name: true, avatar: true, tier: true, githubId: true, clerkId: true }
  })
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
        id: true, name: true, description: true, status: true,
        repoUrl: true, repoBranch: true, thumbnail: true,
        ownerId: true, teamId: true, createdAt: true, updatedAt: true,
        _count: { select: { blocks: true, edges: true, simulations: true } }
      }
    })
    res.json(designs)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /designs/:id — load single design with blocks, edges, recent simulations
router.get('/:id', async (req, res) => {
  const user = await getDbUser(req)
  if (!user) return res.status(401).json({ error: 'User not found' })

  try {
    const design = await prisma.design.findFirst({
      where: { id: req.params.id, ownerId: user.id },
      include: {
        blocks: true,
        edges: true,
        simulations: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true, status: true, trafficPattern: true, rps: true,
            duration: true, metrics: true, startedAt: true, completedAt: true,
            createdAt: true, updatedAt: true,
          }
        }
      }
    })

    if (!design) return res.status(404).json({ error: 'Design not found' })

    const nodes = design.blocks.map(b => ({
      id: b.id,
      type: 'customBlock',
      position: { x: b.x, y: b.y },
      data: {
        type: b.type,
        label: b.label,
        color: b.color,
        config: typeof b.config === 'string' ? JSON.parse(b.config) : b.config,
        metrics: typeof b.metrics === 'string' ? JSON.parse(b.metrics) : b.metrics,
      }
    }))

    const edges = design.edges.map(e => ({
      id: e.id,
      source: e.sourceId,
      target: e.targetId,
      type: 'customEdge',
      animated: e.animated,
      label: e.label,
      data: { connectionType: e.connectionType }
    }))

    res.json({ ...design, nodes, edges })
  } catch (err) {
    console.error('Load design error:', err)
    res.status(500).json({ error: err.message })
  }
})

// POST /designs — create new design
router.post('/', async (req, res) => {
  const user = await getDbUser(req)
  if (!user) return res.status(401).json({ error: 'User not found' })

  const { name, description, repoUrl, repoBranch } = req.body
  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' })

  try {
    const design = await prisma.design.create({
      data: {
        name: name.trim(),
        description: description?.trim(),
        repoUrl: repoUrl?.trim(),
        repoBranch: repoBranch?.trim() || 'main',
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

  const { name, description, repoUrl, repoBranch, status } = req.body

  try {
    const design = await prisma.design.updateMany({
      where: { id: req.params.id, ownerId: user.id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim() }),
        ...(repoUrl !== undefined && { repoUrl: repoUrl?.trim() }),
        ...(repoBranch !== undefined && { repoBranch: repoBranch?.trim() }),
        ...(status !== undefined && { status }),
        updatedAt: new Date(),
      }
    })

    if (design.count === 0) return res.status(404).json({ error: 'Design not found' })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ============================================================
// SAVE / AUTOSAVE — shared implementation
// ============================================================

async function saveCanvasData(req, res, isAutoSave = false) {
  const user = await getDbUser(req)
  if (!user) return res.status(401).json({ error: 'User not found' })

  const { nodes, edges } = req.body
  if (!Array.isArray(nodes) || !Array.isArray(edges)) {
    return res.status(400).json({ error: 'nodes and edges arrays required' })
  }

  try {
    const design = await prisma.design.findFirst({
      where: { id: req.params.id, ownerId: user.id }
    })
    if (!design) return res.status(404).json({ error: 'Design not found' })

    // ============================================================
    // DELETE blocks/edges that are no longer in the canvas
    // ============================================================
    
    // Delete blocks not in the new node set
    const nodeIds = nodes.map(n => n.id).filter(Boolean)
    if (nodeIds.length > 0) {
      await prisma.block.deleteMany({
        where: { designId: req.params.id, id: { notIn: nodeIds } }
      })
    } else {
      // If no nodes sent, delete ALL blocks for this design
      await prisma.block.deleteMany({ where: { designId: req.params.id } })
    }

    // Delete edges not in the new edge set
    const edgeIds = edges.map(e => e.id).filter(Boolean)
    if (edgeIds.length > 0) {
      await prisma.edge.deleteMany({
        where: { designId: req.params.id, id: { notIn: edgeIds } }
      })
    } else {
      await prisma.edge.deleteMany({ where: { designId: req.params.id } })
    }

    // ============================================================
    // Upsert remaining blocks
    // ============================================================
    const BATCH_SIZE = 20
    for (let i = 0; i < nodes.length; i += BATCH_SIZE) {
      const batch = nodes.slice(i, i + BATCH_SIZE)
      await Promise.all(batch.map(node => prisma.block.upsert({
        where: { id: node.id },
        update: {
          type: node.data?.type || 'service',
          label: node.data?.label || 'Untitled',
          x: node.position?.x ?? 0,
          y: node.position?.y ?? 0,
          color: node.data?.color || '#8b5cf6',
          config: node.data?.config ? JSON.stringify(node.data.config) : '{}',
          metrics: node.data?.metrics ? JSON.stringify(node.data.metrics) : null,
          updatedAt: new Date(),
        },
        create: {
          id: node.id,
          designId: req.params.id,
          type: node.data?.type || 'service',
          label: node.data?.label || 'Untitled',
          x: node.position?.x ?? 0,
          y: node.position?.y ?? 0,
          color: node.data?.color || '#8b5cf6',
          config: node.data?.config ? JSON.stringify(node.data.config) : '{}',
          metrics: node.data?.metrics ? JSON.stringify(node.data.metrics) : null,
        }
      })))
    }

    // ============================================================
    // Upsert remaining edges
    // ============================================================
    for (let i = 0; i < edges.length; i += BATCH_SIZE) {
      const batch = edges.slice(i, i + BATCH_SIZE)
      await Promise.all(batch.map(edge => prisma.edge.upsert({
        where: { id: edge.id },
        update: {
          sourceId: edge.source,
          targetId: edge.target,
          connectionType: edge.data?.connectionType || 'http',
          animated: edge.animated ?? true,
          label: edge.label,
        },
        create: {
          id: edge.id || `e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          designId: req.params.id,
          sourceId: edge.source,
          targetId: edge.target,
          connectionType: edge.data?.connectionType || 'http',
          animated: edge.animated ?? true,
          label: edge.label,
        }
      })))
    }

    await prisma.design.update({
      where: { id: req.params.id },
      data: { updatedAt: new Date() }
    })

    res.json({ success: true, blocksCount: nodes.length, edgesCount: edges.length, autoSave: isAutoSave })
  } catch (err) {
    console.error(isAutoSave ? 'Auto-save error:' : 'Save canvas error:', err)
    res.status(500).json({ error: err.message })
  }
}

// POST /designs/:id/save — manual save
router.post('/:id/save', (req, res) => saveCanvasData(req, res, false))

// POST /designs/:id/autosave — auto save (same logic, silent)
router.post('/:id/autosave', (req, res) => saveCanvasData(req, res, true))

// POST /designs/:id/canvas — alias for save (matches api.js)
router.post('/:id/canvas', (req, res) => saveCanvasData(req, res, false))

// DELETE /designs/:id
router.delete('/:id', async (req, res) => {
  const user = await getDbUser(req)
  if (!user) return res.status(401).json({ error: 'User not found' })

  try {
    const result = await prisma.design.deleteMany({
      where: { id: req.params.id, ownerId: user.id }
    })
    if (result.count === 0) return res.status(404).json({ error: 'Design not found' })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router