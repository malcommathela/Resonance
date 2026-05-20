import { Router } from 'express'
import { prisma } from '../lib/db.js'
import { authMiddleware } from '../middleware/auth.js'
import { cache } from '../lib/redis.js'

const router = Router()

// Run simulation
router.post('/', authMiddleware, async (req, res) => {
  const { designId, trafficPattern, rps, duration } = req.body

  const design = await prisma.design.findFirst({
    where: { id: designId, ownerId: req.user.id },
    include: { blocks: true, edges: true }
  })

  if (!design) return res.status(404).json({ error: 'Design not found' })

  // Rate limit check
  const today = new Date().toISOString().split('T')[0]
  const simCount = await prisma.simulation.count({
    where: {
      userId: req.user.id,
      startedAt: { gte: new Date(today) }
    }
  })

  const tierLimits = { free: 3, engineer: 100, team: 9999 }
  if (simCount >= (tierLimits[req.user.tier] || 3)) {
    return res.status(429).json({ error: 'Daily simulation limit reached' })
  }

  const simulation = await prisma.simulation.create({
    data: {
      designId,
      userId: req.user.id,
      trafficPattern: trafficPattern || 'steady',
      rps: rps || 100,
      duration: duration || 300,
      status: 'running',
    }
  })

  // Queue simulation job in Redis
  await redis.lpush('simulation:queue', JSON.stringify({
    simulationId: simulation.id,
    designId,
    blocks: design.blocks,
    edges: design.edges,
    trafficPattern,
    rps,
    duration,
  }))

  res.status(201).json(simulation)
})

// Get simulation results
router.get('/:id', authMiddleware, async (req, res) => {
  const simulation = await prisma.simulation.findFirst({
    where: { id: req.params.id, userId: req.user.id }
  })

  if (!simulation) return res.status(404).json({ error: 'Not found' })
  res.json(simulation)
})

export default router