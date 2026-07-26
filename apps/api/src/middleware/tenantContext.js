import { getAuth } from '@clerk/express'
import { prisma } from '../lib/db.js'
import { logger } from '../lib/logger.js'
import { cache } from '../lib/redis.js'

const USER_CACHE_TTL = 300 // 5 minutes

export async function tenantContext(req, res, next) {
  try {
    const auth = getAuth(req)
    const authHeader = req.headers.authorization
    let clerkId = null

    if (auth?.userId) {
      clerkId = auth.userId
    } else if (authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.slice(7)
        const parts = token.split('.')
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString())
          if (payload?.sub) clerkId = payload.sub
        }
      } catch (err) {
        logger.warn({ err: err.message }, 'Bearer token decode failed')
      }
    }

    if (!clerkId) return res.status(401).json({ error: 'Unauthorized' })

    // ── FAST PATH: Redis cache ──
    const cacheKey = `user:clerk:${clerkId}`
    let dbUser = await cache.get(cacheKey)

    if (dbUser) {
      req.userId = clerkId
      req.dbUser = dbUser
      req.tenant = { clerkId, dbUserId: dbUser.id, tier: dbUser.tier }
      try {
        await prisma.$executeRaw`SELECT set_config('app.current_user_id', ${clerkId}, true)`
      } catch (err) {
        logger.warn({ err: err.message }, 'RLS context set failed')
      }
      return next()
    }

    // ── SLOW PATH: DB + Clerk fallback ──
    dbUser = await prisma.user.findUnique({
      where: { clerkId },
      select: {
        id: true, email: true, name: true, avatar: true,
        tier: true, githubId: true, clerkId: true,
      },
    })

    if (!dbUser) {
      try {
        const { clerkClient } = await import('@clerk/express')
        const clerkUser = await clerkClient.users.getUser(clerkId)
        const primaryEmail = clerkUser.emailAddresses?.[0]?.emailAddress
        dbUser = await prisma.user.create({
          data: {
            clerkId,
            email: primaryEmail || `user-${clerkId}@clerk.dev`,
            name: `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || clerkUser.username || 'User',
            avatar: clerkUser.imageUrl,
            tier: 'free',
          },
          select: {
            id: true, email: true, name: true, avatar: true,
            tier: true, githubId: true, clerkId: true,
          },
        })
        logger.info({ clerkId, userId: dbUser.id }, 'Auto-created user')
      } catch (err) {
        logger.error({ err: err.message, clerkId }, 'Auto-create user failed')
        return res.status(401).json({ error: 'User not found' })
      }
    }

    // Cache it
    await cache.set(cacheKey, dbUser, USER_CACHE_TTL)

    req.userId = clerkId
    req.dbUser = dbUser
    req.tenant = {
      clerkId,
      dbUserId: dbUser.id,
      tier: dbUser.tier,
    }

    try {
      await prisma.$executeRaw`SELECT set_config('app.current_user_id', ${clerkId}, true)`
    } catch (err) {
      logger.warn({ err: err.message }, 'RLS context set failed')
    }

    next()
  } catch (err) {
    next(err)
  }
}

// Keep assertDesignOwnership, assertSimulationOwnership, assertReportOwnership exactly as-is
export async function assertDesignOwnership(req, designId) {
  const design = await prisma.design.findFirst({
    where: { id: designId, ownerId: req.dbUser.id },
    select: { id: true, ownerId: true, teamId: true },
  })
  if (!design) {
    const exists = await prisma.design.findUnique({ where: { id: designId }, select: { id: true } })
    const err = new Error(exists ? 'Access denied' : 'Design not found')
    err.status = exists ? 403 : 404
    throw err
  }
  return design
}

export async function assertSimulationOwnership(req, simulationId) {
  const simulation = await prisma.simulation.findUnique({
    where: { id: simulationId },
    include: { design: { select: { ownerId: true } } },
  })
  if (!simulation || simulation.design.ownerId !== req.dbUser.id) {
    const exists = !!simulation
    const err = new Error(exists ? 'Access denied' : 'Simulation not found')
    err.status = exists ? 403 : 404
    throw err
  }
  return simulation
}

export async function assertReportOwnership(req, reportId) {
  const report = await prisma.simulationReport.findUnique({
    where: { id: reportId },
    include: { design: { select: { ownerId: true } } },
  })
  if (!report || report.design.ownerId !== req.dbUser.id) {
    const exists = !!report
    const err = new Error(exists ? 'Access denied' : 'Report not found')
    err.status = exists ? 403 : 404
    throw err
  }
  return report
}