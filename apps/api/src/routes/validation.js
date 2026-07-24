import { Router } from 'express'
import { getAuth } from '@clerk/express'
import { prisma } from '../lib/db.js'
import { validateArchitecture } from '../simulation/validation.js'
import { validationLimiter } from '../middleware/rateLimit.js'

const router = Router()

// ============================================================================
// AUTH MIDDLEWARE (same pattern as simulations.js)
// ============================================================================

router.use(async (req, res, next) => {
  const auth = getAuth(req)
  if (auth?.userId) {
    req.userId = auth.userId
    return next()
  }

  const authHeader = req.headers.authorization
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    try {
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString())
      if (payload?.sub) {
        req.userId = payload.sub
        return next()
      }
    } catch (err) {
      console.error('[VALIDATION] Bearer token decode failed:', err.message)
    }
  }

  return res.status(401).json({ error: 'Unauthorized' })
})

// ============================================================================
// POST /validation/:designId/validate
// ============================================================================
// CHANGED: Added validationLimiter (20 req/min per user) to prevent
// graph-traversal abuse on large architectures.
// ============================================================================

router.post('/:designId/validate', validationLimiter, async (req, res) => {
  try {
    const { designId } = req.params

    const user = await prisma.user.findUnique({
      where: { clerkId: req.userId },
      select: { id: true }
    })
    if (!user) return res.status(401).json({ error: 'User not found' })

    const design = await prisma.design.findFirst({
      where: { id: designId, ownerId: user.id },
      include: { blocks: true, edges: true }
    })

    if (!design) return res.status(404).json({ error: 'Design not found' })

    const validation = validateArchitecture(design.blocks, design.edges)

    res.json({
      designId,
      ...validation,
      validatedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[VALIDATION] Error:', err)
    res.status(500).json({ error: err.message })
  }
})

// ============================================================================
// GET /validation/:designId/last
// ============================================================================

router.get('/:designId/last', async (req, res) => {
  try {
    const { designId } = req.params

    const user = await prisma.user.findUnique({
      where: { clerkId: req.userId },
      select: { id: true }
    })
    if (!user) return res.status(401).json({ error: 'User not found' })

    const design = await prisma.design.findFirst({
      where: { id: designId, ownerId: user.id },
      include: { blocks: true, edges: true }
    })

    if (!design) return res.status(404).json({ error: 'Design not found' })

    const validation = validateArchitecture(design.blocks, design.edges)

    res.json({
      designId,
      ...validation,
      validatedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[VALIDATION] Error:', err)
    res.status(500).json({ error: err.message })
  }
})

export default router