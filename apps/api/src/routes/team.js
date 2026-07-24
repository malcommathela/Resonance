import { Router } from 'express'
import { getAuth } from '@clerk/express'
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
  if (!auth?.userId) return res.status(401).json({ error: 'Unauthorized' })
  next()
}
router.use(requireApiAuth)

// GET /team
router.get('/', async (req, res) => {
  const user = await getDbUser(req)
  if (!user) return res.status(401).json({ error: 'User not found' })

  const team = await prisma.team.findFirst({
    where: { members: { some: { userId: user.id } } },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, email: true, avatar: true } } }
      }
    }
  })

  if (!team) return res.status(404).json({ error: 'No team found' })

  res.json({
    id: team.id,
    name: team.name,
    maxMembers: team.maxMembers,
    createdAt: team.createdAt,
    ownerId: team.ownerId,
  })
})

// GET /team/members
router.get('/members', async (req, res) => {
  const user = await getDbUser(req)
  if (!user) return res.status(401).json({ error: 'User not found' })

  const team = await prisma.team.findFirst({
    where: { members: { some: { userId: user.id } } },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, email: true, avatar: true } } }
      }
    }
  })

  if (!team) return res.status(404).json({ error: 'No team found' })

  const members = team.members.map(m => ({
    id: m.user.id,
    name: m.user.name,
    email: m.user.email,
    role: m.role,
    status: 'active',
    avatar: m.user.avatar,
  }))

  res.json(members)
})

// POST /team/invite
router.post('/invite', async (req, res) => {
  const user = await getDbUser(req)
  if (!user) return res.status(401).json({ error: 'User not found' })

  // Stub: return success (implement email invites later)
  res.json({ success: true, message: 'Invitation sent' })
})

// DELETE /team/members/:id
router.delete('/members/:id', async (req, res) => {
  const user = await getDbUser(req)
  if (!user) return res.status(401).json({ error: 'User not found' })

  const team = await prisma.team.findFirst({
    where: { members: { some: { userId: user.id, role: { in: ['owner', 'admin'] } } } }
  })

  if (!team) return res.status(403).json({ error: 'Not authorized' })

  await prisma.teamMember.deleteMany({
    where: { teamId: team.id, userId: req.params.id }
  })

  res.json({ success: true })
})

// PATCH /team/members/:id/role
router.patch('/members/:id/role', async (req, res) => {
  const user = await getDbUser(req)
  if (!user) return res.status(401).json({ error: 'User not found' })

  const team = await prisma.team.findFirst({
    where: { members: { some: { userId: user.id, role: 'owner' } } }
  })

  if (!team) return res.status(403).json({ error: 'Only owner can change roles' })

  await prisma.teamMember.updateMany({
    where: { teamId: team.id, userId: req.params.id },
    data: { role: req.body.role }
  })

  res.json({ success: true })
})

export default router