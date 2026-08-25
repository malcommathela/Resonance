import crypto from 'crypto'
import { Router } from 'express'
import { prisma } from '../lib/db.js'
import { logger } from '../lib/logger.js'
import { sendTeamInvite } from '../lib/email.js'
import { requireTeamRole } from '../middleware/tenantContext.js'
import { cache } from '../lib/redis.js'

const router = Router()
const VALID_ROLES = ['owner', 'admin', 'member']
const ROLE_RANK = { owner: 3, admin: 2, member: 1 }

const CACHE_TTL = 60

function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : ''
}

function transformTeam(team, currentUserId) {
  const membership = team.members.find((m) => m.userId === currentUserId)
  return {
    id: team.id,
    name: team.name,
    description: team.description,
    ownerId: team.ownerId,
    maxMembers: team.maxMembers,
    memberCount: team._count?.members ?? team.members.length,
    designCount: team._count?.designs ?? 0,
    myRole: membership?.role || 'member',
    createdAt: team.createdAt,
    updatedAt: team.updatedAt,
  }
}

async function getCached(key, fetcher, ttl = CACHE_TTL) {
  try {
    const cached = await cache.get(key)
    if (cached) return JSON.parse(cached)
  } catch (e) { /* ignore */ }

  const data = await fetcher()
  try {
    await cache.set(key, JSON.stringify(data), 'EX', ttl)
  } catch (e) { /* ignore */ }
  return data
}

function invalidateTeam(teamId, userId) {
  // User-specific caches (new)
  cache.del(`teams:list:${userId}`).catch(() => {})
  cache.del(`team:${teamId}:user:${userId}`).catch(() => {})
  cache.del(`team:${teamId}:members:user:${userId}`).catch(() => {})

  // Legacy/shared caches (clear during transition)
  cache.del(`team:${teamId}`).catch(() => {})
  cache.del(`team:${teamId}:members`).catch(() => {})
  cache.del(`team:${teamId}:invites`).catch(() => {})
  cache.del(`team:${teamId}:designs`).catch(() => {})
}

// ============================================================================
// POST /team  ->  Create team
// ============================================================================
router.post('/', async (req, res) => {
  try {
    const { name, description } = req.body
    if (!name?.trim()) return res.status(400).json({ error: 'Team name is required' })

    const team = await prisma.team.create({
      data: {
        name: name.trim(),
        description: description?.trim(),
        ownerId: req.dbUser.id,
        members: {
          create: {
            userId: req.dbUser.id,
            role: 'owner',
          },
        },
      },
      include: {
        members: { select: { userId: true, role: true } },
        _count: { select: { members: true, designs: true } },
      },
    })

    invalidateTeam(team.id, req.dbUser.id)
    res.status(201).json(transformTeam(team, req.dbUser.id))
  } catch (err) {
    logger.error({ err: err.message, userId: req.dbUser.id }, 'Failed to create team')
    res.status(500).json({ error: err.message })
  }
})

// ============================================================================
// GET /team/teams  ->  List all teams (CACHED)
// ============================================================================
router.get('/teams', async (req, res) => {
  try {
    const userId = req.dbUser.id
    const teams = await getCached(`teams:list:${userId}`, async () => {
      const data = await prisma.team.findMany({
        where: { members: { some: { userId } } },
        include: {
          members: { select: { userId: true, role: true } },
          _count: { select: { members: true, designs: true } },
        },
        orderBy: { updatedAt: 'desc' },
      })
      return data.map((team) => transformTeam(team, userId))
    })

    res.json(teams)
  } catch (err) {
    logger.error({ err: err.message, userId: req.dbUser.id }, 'Failed to list teams')
    res.status(500).json({ error: err.message })
  }
})

// ============================================================================
// GET /team/invites/me  ->  Pending invites for current user (CACHED)
// ============================================================================
router.get('/invites/me', async (req, res) => {
  try {
    const email = normalizeEmail(req.dbUser.email)
    const invites = await getCached(`invites:me:${req.dbUser.id}`, async () => {
      const data = await prisma.teamInvite.findMany({
        where: { email },
        orderBy: { createdAt: 'desc' },
        include: {
          team: { select: { id: true, name: true } },
        },
      })
      return data.map((i) => ({
        id: i.id,
        teamId: i.teamId,
        teamName: i.team.name,
        email: i.email,
        role: i.role,
        token: i.token,
        expiresAt: i.expiresAt,
        createdAt: i.createdAt,
      }))
    }, 30)

    res.json(invites)
  } catch (err) {
    logger.error({ err: err.message, userId: req.dbUser.id }, 'Failed to list my invites')
    res.status(500).json({ error: err.message })
  }
})

// ============================================================================
// GET /team/:id  ->  Team detail (CACHED)
// ============================================================================
router.get('/:id', async (req, res) => {
  try {
    const teamId = req.params.id
    const userId = req.dbUser.id

    const result = await getCached(`team:${teamId}:user:${userId}`, async () => {
      const team = await prisma.team.findUnique({
        where: { id: teamId },
        include: {
          members: {
            include: { user: { select: { id: true, clerkId: true, name: true, email: true, avatar: true } } },
          },
          _count: { select: { members: true, designs: true } },
        },
      })

      if (!team) return null
      const membership = team.members.find((m) => m.userId === userId)
      if (!membership) return { __accessDenied: true }

      return {
        ...transformTeam(team, userId),
        members: team.members.map((m) => ({
          id: m.user.id,
          clerkId: m.user.clerkId,
          name: m.user.name,
          email: m.user.email,
          avatar: m.user.avatar,
          role: m.role,
        })),
      }
    })

    if (!result) return res.status(404).json({ error: 'Team not found' })
    if (result.__accessDenied) return res.status(403).json({ error: 'Access denied' })

    res.json(result)
  } catch (err) {
    logger.error({ err: err.message, userId: req.dbUser.id, teamId: req.params.id }, 'Failed to get team detail')
    res.status(500).json({ error: err.message })
  }
})

// ============================================================================
// GET /team/:id/members  ->  List members (CACHED)
// ============================================================================
router.get('/:id/members', async (req, res) => {
  try {
    const teamId = req.params.id

    const members = await getCached(`team:${teamId}:members:user:${req.dbUser.id}`, async () => {
      const team = await prisma.team.findUnique({
        where: { id: teamId },
        include: {
          members: {
            include: { user: { select: { id: true, clerkId: true, name: true, email: true, avatar: true } } },
          },
        },
      })

      if (!team) return null
      const membership = team.members.find((m) => m.userId === req.dbUser.id)
      if (!membership) return { __accessDenied: true }

      return team.members.map((m) => ({
        id: m.user.id,
        clerkId: m.user.clerkId,
        name: m.user.name,
        email: m.user.email,
        avatar: m.user.avatar,
        role: m.role,
        status: 'active',
        createdAt: m.createdAt,
      }))
    })

    if (!members) return res.status(404).json({ error: 'Team not found' })
    if (members.__accessDenied) return res.status(403).json({ error: 'Access denied' })

    res.json(members)
  } catch (err) {
    logger.error({ err: err.message, userId: req.dbUser.id, teamId: req.params.id }, 'Failed to list team members')
    res.status(500).json({ error: err.message })
  }
})

// ============================================================================
// GET /team/:id/invites  ->  List pending invites (CACHED)
// ============================================================================
router.get('/:id/invites', async (req, res) => {
  try {
    const teamId = req.params.id
    await requireTeamRole(req, teamId, ['owner', 'admin'])

    const invites = await getCached(`team:${teamId}:invites`, async () => {
      const rawInvites = await prisma.teamInvite.findMany({
        where: { teamId },
        orderBy: { createdAt: 'desc' },
        select: { id: true, email: true, role: true, token: true, expiresAt: true, createdAt: true, invitedBy: true },
      })

      const inviterIds = [...new Set(rawInvites.map((i) => i.invitedBy).filter(Boolean))]
      const inviters = inviterIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: inviterIds } },
            select: { id: true, name: true, email: true, avatar: true },
          })
        : []

      const inviterMap = new Map(inviters.map((u) => [u.id, u]))

      return rawInvites.map((i) => ({
        id: i.id,
        email: i.email,
        role: i.role,
        token: i.token,
        expiresAt: i.expiresAt,
        createdAt: i.createdAt,
        invitedBy: i.invitedBy,
        inviter: inviterMap.get(i.invitedBy) || null,
      }))
    })

    res.json(invites)
  } catch (err) {
    const status = err.status || 500
    logger.error({ err: err.message, teamId: req.params.id, userId: req.dbUser.id }, 'Failed to list invites')
    res.status(status).json({ error: err.message })
  }
})

// ============================================================================
// PATCH /team/:id  ->  Update team info
// ============================================================================
router.patch('/:id', async (req, res) => {
  try {
    const teamId = req.params.id
    await requireTeamRole(req, teamId, ['owner', 'admin'])

    const { name, description } = req.body
    const data = {}
    if (name !== undefined) data.name = name.trim()
    if (description !== undefined) data.description = description?.trim() || null

    const team = await prisma.team.update({
      where: { id: teamId },
      data,
      include: {
        members: { select: { userId: true, role: true } },
        _count: { select: { members: true, designs: true } },
      },
    })

    invalidateTeam(teamId, req.dbUser.id)
    res.json(transformTeam(team, req.dbUser.id))
  } catch (err) {
    const status = err.status || 500
    logger.error({ err: err.message, teamId: req.params.id, userId: req.dbUser.id }, 'Failed to update team')
    res.status(status).json({ error: err.message })
  }
})

// ============================================================================
// POST /team/:id/invite  ->  Invite by email
// ============================================================================
router.post('/:id/invite', async (req, res) => {
  try {
    const teamId = req.params.id
    const { email: rawEmail, role = 'member' } = req.body
    const email = normalizeEmail(rawEmail)

    if (!email) return res.status(400).json({ error: 'Invalid email' })
    if (!VALID_ROLES.includes(role)) return res.status(400).json({ error: 'Invalid role' })

    const membership = await requireTeamRole(req, teamId, ['owner', 'admin'])
    if (ROLE_RANK[role] > ROLE_RANK[membership.role]) {
      return res.status(403).json({ error: 'You cannot invite someone with a higher role than your own' })
    }

    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      const existingMembership = await prisma.teamMember.findUnique({
        where: { teamId_userId: { teamId, userId: existingUser.id } },
      })
      if (existingMembership) {
        return res.status(409).json({ error: 'User is already a team member' })
      }
    }

    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    const invite = await prisma.teamInvite.upsert({
      where: { teamId_email: { teamId, email } },
      update: {
        token,
        role,
        invitedBy: req.dbUser.id,
        expiresAt,
        createdAt: new Date(),
      },
      create: {
        teamId,
        email,
        role,
        token,
        invitedBy: req.dbUser.id,
        expiresAt,
      },
    })

    const team = await prisma.team.findUnique({ where: { id: teamId } })
    if (!team) return res.status(404).json({ error: 'Team not found' })

    // ── Fire-and-forget email: respond immediately, send in background ──
    const acceptUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/team/invite?token=${token}`

    sendTeamInvite({
      to: email,
      teamName: team.name,
      inviterName: req.dbUser.name || req.dbUser.email,
      acceptUrl,
    }).catch((err) => {
      // Background failure: log it, but do NOT delete the invite or fail the request.
      // The invite still exists in the DB; admin can resend from the UI if needed.
      logger.error(
        { err: err?.message || err, teamId, email, inviteId: invite.id },
        'Team invite email failed (background)'
      )
    })

    cache.del(`team:${teamId}:invites`).catch(() => {})

    res.status(201).json({
      success: true,
      inviteId: invite.id,
      emailSent: true, // Optimistic: we trust SMTP will work; user doesn't wait
    })
  } catch (err) {
    const status = err.status || 500
    logger.error({ err: err.message, teamId: req.params.id, userId: req.dbUser.id }, 'Failed to invite team member')
    res.status(status).json({ error: err.message })
  }
})

// ============================================================================
// DELETE /team/:id/invites/:inviteId  ->  Revoke invite
// ============================================================================
router.delete('/:id/invites/:inviteId', async (req, res) => {
  try {
    const teamId = req.params.id
    await requireTeamRole(req, teamId, ['owner', 'admin'])

    await prisma.teamInvite.deleteMany({ where: { id: req.params.inviteId, teamId } })
    cache.del(`team:${teamId}:invites`).catch(() => {})
    res.json({ success: true })
  } catch (err) {
    const status = err.status || 500
    logger.error({ err: err.message, teamId: req.params.id, userId: req.dbUser.id }, 'Failed to revoke invite')
    res.status(status).json({ error: err.message })
  }
})

// ============================================================================
// POST /team/invite/accept  ->  Accept invite
// ============================================================================
router.post('/invite/accept', async (req, res) => {
  try {
    const { token } = req.body
    if (!token) return res.status(400).json({ error: 'Token is required' })

    const invite = await prisma.teamInvite.findUnique({ where: { token } })
    if (!invite) return res.status(404).json({ error: 'Invitation not found' })
    if (invite.expiresAt < new Date()) return res.status(410).json({ error: 'Invitation expired' })
    if (invite.email !== normalizeEmail(req.dbUser.email)) {
      return res.status(403).json({ error: 'This invitation was sent to a different email address' })
    }

    const existingMembership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId: invite.teamId, userId: req.dbUser.id } },
    })
    if (existingMembership) {
      await prisma.teamInvite.delete({ where: { id: invite.id } }).catch(() => {})
      return res.status(409).json({ error: 'User is already a team member', teamId: invite.teamId })
    }

    await prisma.teamMember.create({
      data: {
        teamId: invite.teamId,
        userId: req.dbUser.id,
        role: invite.role,
      },
    })

    await prisma.teamInvite.delete({ where: { id: invite.id } })

    invalidateTeam(invite.teamId, req.dbUser.id)
    res.json({ success: true, teamId: invite.teamId })
  } catch (err) {
    const status = err.status || 500
    logger.error({ err: err.message, userId: req.dbUser.id }, 'Failed to accept team invite')
    res.status(status).json({ error: err.message })
  }
})

// ============================================================================
// POST /team/invite/decline  ->  Decline invite
// ============================================================================
router.post('/invite/decline', async (req, res) => {
  try {
    const { token } = req.body
    if (!token) return res.status(400).json({ error: 'Token is required' })

    const invite = await prisma.teamInvite.findUnique({ where: { token } })
    if (!invite) return res.status(404).json({ error: 'Invitation not found' })
    if (invite.email !== normalizeEmail(req.dbUser.email)) {
      return res.status(403).json({ error: 'This invitation was sent to a different email address' })
    }

    await prisma.teamInvite.delete({ where: { id: invite.id } })

    cache.del(`invites:me:${req.dbUser.id}`).catch(() => {})
    res.json({ success: true })
  } catch (err) {
    logger.error({ err: err.message, userId: req.dbUser.id }, 'Failed to decline team invite')
    res.status(500).json({ error: err.message })
  }
})

// ============================================================================
// DELETE /team/:id/members/:userId  ->  Remove member (or self-leave)
// ============================================================================
router.delete('/:id/members/:userId', async (req, res) => {
  try {
    const teamId = req.params.id
    const targetUserId = req.params.userId
    const isSelf = targetUserId === req.dbUser.id || targetUserId === req.dbUser.clerkId

    if (!isSelf) {
      await requireTeamRole(req, teamId, ['owner', 'admin'])
    }

    // Resolve to DB user ID for the Prisma query
    const resolvedUserId = isSelf ? req.dbUser.id : targetUserId

    const target = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: resolvedUserId } },
    })
    if (!target) return res.status(404).json({ error: 'Team member not found' })
    if (target.role === 'owner' && !isSelf) return res.status(403).json({ error: 'Cannot remove the team owner' })
    if (isSelf && target.role === 'owner') return res.status(403).json({ error: 'Owner must delete the team to leave' })

    await prisma.teamMember.delete({ where: { teamId_userId: { teamId, userId: resolvedUserId } } })

    invalidateTeam(teamId, req.dbUser.id)
    res.json({ success: true })
  } catch (err) {
    const status = err.status || 500
    logger.error({ err: err.message, teamId: req.params.id, userId: req.dbUser.id }, 'Failed to remove team member')
    res.status(status).json({ error: err.message })
  }
})

// ============================================================================
// PATCH /team/:id/members/:userId/role  ->  Change role (owner only)
// ============================================================================
router.patch('/:id/members/:userId/role', async (req, res) => {
  try {
    const teamId = req.params.id
    await requireTeamRole(req, teamId, ['owner'])

    const { role } = req.body
    if (!VALID_ROLES.includes(role)) return res.status(400).json({ error: 'Invalid role' })

    const target = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: req.params.userId } },
    })
    if (!target) return res.status(404).json({ error: 'Team member not found' })
    if (target.role === 'owner') return res.status(403).json({ error: 'Cannot change owner role' })

    await prisma.teamMember.update({
      where: { teamId_userId: { teamId, userId: req.params.userId } },
      data: { role },
    })

    invalidateTeam(teamId, req.dbUser.id)
    res.json({ success: true })
  } catch (err) {
    const status = err.status || 500
    logger.error({ err: err.message, teamId: req.params.id, userId: req.dbUser.id }, 'Failed to change member role')
    res.status(status).json({ error: err.message })
  }
})

// ============================================================================
// DELETE /team/:id  ->  Delete team (owner only)
// ============================================================================
router.delete('/:id', async (req, res) => {
  try {
    const teamId = req.params.id
    await requireTeamRole(req, teamId, ['owner'])

    await prisma.team.delete({ where: { id: teamId } })
    invalidateTeam(teamId, req.dbUser.id)
    res.json({ success: true })
  } catch (err) {
    const status = err.status || 500
    logger.error({ err: err.message, teamId: req.params.id, userId: req.dbUser.id }, 'Failed to delete team')
    res.status(status).json({ error: err.message })
  }
})

// ============================================================================
// GET /team/:id/designs  ->  List team designs (CACHED)
// ============================================================================
router.get('/:id/designs', async (req, res) => {
  try {
    const teamId = req.params.id
    await requireTeamRole(req, teamId, ['owner', 'admin', 'member'])

    const designs = await getCached(`team:${teamId}:designs`, async () => {
      return prisma.design.findMany({
        where: { teamId },
        orderBy: { updatedAt: 'desc' },
        include: {
          owner: { select: { id: true, name: true, avatar: true } },
          _count: { select: { blocks: true, edges: true, simulations: true } },
        },
      })
    })

    res.json(designs.map((design) => ({
      id: design.id,
      name: design.name,
      description: design.description,
      status: design.status,
      thumbnail: design.thumbnail,
      createdAt: design.createdAt,
      updatedAt: design.updatedAt,
      owner: {
        id: design.owner.id,
        name: design.owner.name,
        avatar: design.owner.avatar,
      },
      blocks: design._count.blocks,
      edges: design._count.edges,
      simulations: design._count.simulations,
    })))
  } catch (err) {
    const status = err.status || 500
    logger.error({ err: err.message, teamId: req.params.id, userId: req.dbUser.id }, 'Failed to list team designs')
    res.status(status).json({ error: err.message })
  }
})

// ============================================================================
// POST /team/:id/designs  ->  Create team design
// ============================================================================
router.post('/:id/designs', async (req, res) => {
  try {
    const teamId = req.params.id
    const { name, description, repoUrl, repoBranch } = req.body
    await requireTeamRole(req, teamId, ['owner', 'admin'])

    const design = await prisma.design.create({
      data: {
        name: name || 'Untitled Design',
        description,
        repoUrl,
        repoBranch: repoBranch || 'main',
        ownerId: req.dbUser.id,
        teamId,
      },
    })

    cache.del(`team:${teamId}:designs`).catch(() => {})
    res.status(201).json(design)
  } catch (err) {
    const status = err.status || 500
    logger.error({ err: err.message, teamId: req.params.id, userId: req.dbUser.id }, 'Failed to create team design')
    res.status(status).json({ error: err.message })
  }
})

// ============================================================================
// POST /team/:id/designs/import  ->  Import personal design into team
// ============================================================================
router.post('/:id/designs/import', async (req, res) => {
  try {
    const teamId = req.params.id
    const { designId } = req.body
    if (!designId) return res.status(400).json({ error: 'designId is required' })

    await requireTeamRole(req, teamId, ['owner', 'admin'])

    const design = await prisma.design.findUnique({ where: { id: designId } })
    if (!design) return res.status(404).json({ error: 'Design not found' })
    if (design.ownerId !== req.dbUser.id) {
      return res.status(403).json({ error: 'Only the design owner can import it to a team' })
    }
    if (design.teamId === teamId) {
      return res.status(409).json({ error: 'Design is already part of this team' })
    }

    const updated = await prisma.design.update({
      where: { id: designId },
      data: { teamId },
    })

    cache.del(`team:${teamId}:designs`).catch(() => {})
    cache.del(`designs:list:${req.dbUser.id}`).catch(() => {})
    cache.invalidatePattern(`design:${designId}:*`).catch(() => {})
    cache.invalidatePattern(`design:overview:${designId}:*`).catch(() => {})

    res.json(updated)
  } catch (err) {
    const status = err.status || 500
    logger.error({ err: err.message, teamId: req.params.id, userId: req.dbUser.id }, 'Failed to import design into team')
    res.status(status).json({ error: err.message })
  }
})

// ============================================================================
// DELETE /team/:id/designs/:designId  ->  Remove design from team
// ============================================================================
router.delete('/:id/designs/:designId', async (req, res) => {
  try {
    const teamId = req.params.id
    await requireTeamRole(req, teamId, ['owner', 'admin'])

    const design = await prisma.design.findFirst({ where: { id: req.params.designId, teamId } })
    if (!design) return res.status(404).json({ error: 'Design not found in team' })

    await prisma.design.update({ where: { id: req.params.designId }, data: { teamId: null } })
    cache.del(`team:${teamId}:designs`).catch(() => {})
    res.json({ success: true })
  } catch (err) {
    const status = err.status || 500
    logger.error({ err: err.message, teamId: req.params.id, userId: req.dbUser.id }, 'Failed to remove design from team')
    res.status(status).json({ error: err.message })
  }
})

export default router