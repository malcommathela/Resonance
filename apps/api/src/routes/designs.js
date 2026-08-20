import { Router } from 'express'
import { prisma } from '../lib/db.js'
import { assertDesignAccess, assertDesignWriteAccess, requireTeamRole } from '../middleware/tenantContext.js'
import { logAuditEvent } from '../simulation/utils/audit.js'
import { logger } from '../lib/logger.js'
import { cache } from '../lib/redis.js'

const router = Router()

const LIST_TTL = 60
const DETAIL_TTL = 120
const OVERVIEW_TTL = 60

function getClientInfo(req) {
  return {
    ipAddress: req.headers['x-forwarded-for'] || req.ip || null,
    userAgent: req.headers['user-agent'] || null,
  }
}

async function invalidateDesignCache(ownerId, designId) {
  await cache.del(`designs:list:${ownerId}`)
  await cache.invalidatePattern(`design:${designId}:*`)
  await cache.invalidatePattern(`design:overview:${designId}:*`)
}

// ============================================================================
// GET /designs — cached + paginated
// ============================================================================
router.get('/', async (req, res) => {
  try {
    const cacheKey = `designs:list:${req.dbUser.id}`
    let cached = await cache.get(cacheKey)
    if (cached) return res.json(cached)

    // 1. Lightweight design list (personal + team designs)
    const designs = await prisma.design.findMany({
      where: {
        OR: [
          { ownerId: req.dbUser.id },
          { team: { members: { some: { userId: req.dbUser.id } } } },
        ],
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        thumbnail: true,
        createdAt: true,
        updatedAt: true,
        teamId: true,
        _count: { select: { blocks: true, edges: true, simulations: true } },
      },
    })

    const designIds = designs.map((d) => d.id)
    const teamIds = designs.map((d) => d.teamId).filter(Boolean)

    // 2. Latest simulation per design (uses simulations_designId_createdAt_idx)
    const simulations = designIds.length
      ? await prisma.simulation.findMany({
          where: { designId: { in: designIds } },
          orderBy: [{ designId: 'asc' }, { createdAt: 'desc' }],
          select: {
            designId: true,
            id: true,
            scenario: true,
            createdAt: true,
            projectedMonthlyCost: true,
            status: true,
          },
        })
      : []

    const simMap = new Map()
    for (const s of simulations) {
      if (!simMap.has(s.designId)) simMap.set(s.designId, s)
    }

    // 3. Latest report per design (uses simulation_reports_designId_generatedAt_idx)
    const reports = designIds.length
      ? await prisma.simulationReport.findMany({
          where: { designId: { in: designIds } },
          orderBy: [{ designId: 'asc' }, { generatedAt: 'desc' }],
          select: {
            designId: true,
            id: true,
            overallScore: true,
            generatedAt: true,
          },
        })
      : []

    const reportMap = new Map()
    for (const r of reports) {
      if (!reportMap.has(r.designId)) reportMap.set(r.designId, r)
    }

    // 4. Teams + members in one shot (uses teams_owner_id_idx + team_members_teamId_userId unique index)
    const teams =
      teamIds.length > 0
        ? await prisma.team.findMany({
            where: { id: { in: teamIds } },
            include: {
              members: {
                include: {
                  user: { select: { name: true, avatar: true } },
                },
              },
            },
          })
        : []

    const teamMap = new Map(teams.map((t) => [t.id, t]))

    // 5. Assemble
    const transformed = designs.map((d) => {
      const team = d.teamId ? teamMap.get(d.teamId) : null
      return {
        id: d.id,
        name: d.name,
        description: d.description,
        status: d.status,
        thumbnail: d.thumbnail,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
        blocks: d._count.blocks,
        edges: d._count.edges,
        simulations: d._count.simulations,
        latestSimulation: simMap.get(d.id) || null,
        latestReport: reportMap.get(d.id) || null,
        teamId: d.teamId,
        team:
          team?.members?.map((m) => ({
            name: m.user.name,
            avatar: m.user.avatar,
            initials: m.user.name
              .split(' ')
              .map((n) => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2),
          })) || [],
      }
    })

    await cache.set(cacheKey, transformed, 60)
    res.json(transformed)
  } catch (err) {
    logger.error({ err: err.message, userId: req.dbUser.id }, 'Failed to list designs')
    res.status(500).json({ error: err.message })
  }
})

// ============================================================================
// GET /designs/:id — cached
// ============================================================================
router.get('/:id', async (req, res) => {
  try {
    const cacheKey = `design:${req.params.id}:${req.dbUser.id}`
    let design = await cache.get(cacheKey)

    if (!design) {
      design = await assertDesignAccess(req, req.params.id)
      design = await prisma.design.findUnique({
        where: { id: req.params.id },
        include: {
          blocks: true,
          edges: true,
          simulations: { orderBy: { createdAt: 'desc' }, take: 5 },
        },
      })
      if (!design) return res.status(404).json({ error: 'Design not found' })
      await cache.set(cacheKey, design, DETAIL_TTL)
    }

    const nodes = design.blocks.map((b) => ({
      id: b.id,
      type: 'customBlock',
      position: { x: b.x, y: b.y },
      data: {
        label: b.label,
        type: b.type,
        color: b.color,
        config: typeof b.config === 'string' ? JSON.parse(b.config) : b.config,
        metrics: b.metrics
          ? typeof b.metrics === 'string'
            ? JSON.parse(b.metrics)
            : b.metrics
          : null,
      },
    }))

    const edges = design.edges.map((e) => ({
      id: e.id,
      source: e.sourceId,
      target: e.targetId,
      type: 'customEdge',
      animated: e.animated,
      data: {
        connectionType: e.connectionType,
        label: e.label,
      },
    }))

    res.json({ ...design, nodes, edges })
  } catch (err) {
    logger.error({ err: err.message, designId: req.params.id }, 'Failed to get design')
    res.status(500).json({ error: err.message })
  }
})

// ============================================================================
// POST /designs
// ============================================================================
router.post('/', async (req, res) => {
  try {
    const { name, description, repoUrl, repoBranch, teamId } = req.body
    const data = {
      name: name || 'Untitled Design',
      description,
      repoUrl,
      repoBranch: repoBranch || 'main',
      ownerId: req.dbUser.id,
    }

    if (teamId) {
      await requireTeamRole(req, teamId, ['owner', 'admin'])
      data.teamId = teamId
    }

    const design = await prisma.design.create({ data })
    await invalidateDesignCache(req.dbUser.id, design.id)
    await logAuditEvent({
      userId: req.dbUser.id,
      designId: design.id,
      action: 'design_created',
      details: { name: design.name, repoUrl },
      clientInfo: getClientInfo(req),
    })
    res.status(201).json(design)
  } catch (err) {
    logger.error({ err: err.message }, 'Failed to create design')
    res.status(500).json({ error: err.message })
  }
})

// ============================================================================
// PATCH /designs/:id
// ============================================================================
router.patch('/:id', async (req, res) => {
  try {
    const { name, description, status, repoUrl, repoBranch } = req.body
    await assertDesignWriteAccess(req, req.params.id)
    const design = await prisma.design.update({
      where: { id: req.params.id },
      data: { name, description, status, repoUrl, repoBranch, updatedAt: new Date() },
    })
    if (!design) return res.status(404).json({ error: 'Design not found' })
    await invalidateDesignCache(req.dbUser.id, req.params.id)
    await logAuditEvent({
      userId: req.dbUser.id,
      designId: req.params.id,
      action: 'design_updated',
      details: { name, status },
      clientInfo: getClientInfo(req),
    })
    res.json({ success: true })
  } catch (err) {
    const status = err.status || 500
    logger.error({ err: err.message, designId: req.params.id }, 'Failed to update design')
    res.status(status).json({ error: err.message })
  }
})

// ============================================================================
// BATCHED CANVAS SYNC — replaces N+1 sequential upserts
// ============================================================================
async function syncCanvasData(designId, nodes, edges) {
  const design = await prisma.design.findUnique({
    where: { id: designId },
  })
  if (!design) {
    const err = new Error('Design not found')
    err.status = 404
    throw err
  }

  const nodeIds = nodes?.map((n) => n.id).filter(Boolean) || []
  const edgeIds = edges?.map((e) => e.id).filter(Boolean) || []

  // Delete stale in parallel
  await prisma.$transaction([
    nodeIds.length > 0
      ? prisma.block.deleteMany({ where: { designId, id: { notIn: nodeIds } } })
      : prisma.block.deleteMany({ where: { designId } }),
    edgeIds.length > 0
      ? prisma.edge.deleteMany({ where: { designId, id: { notIn: edgeIds } } })
      : prisma.edge.deleteMany({ where: { designId } }),
  ])

  // Batch upsert blocks + edges in one transaction
  const blockOps = (nodes || []).map((node) =>
    prisma.block.upsert({
      where: { id: node.id },
      update: {
        label: node.data?.label,
        type: node.data?.type,
        x: node.position?.x || 0,
        y: node.position?.y || 0,
        color: node.data?.color,
        config: node.data?.config ? JSON.stringify(node.data.config) : '{}',
        metrics: node.data?.metrics ? JSON.stringify(node.data.metrics) : null,
        updatedAt: new Date(),
      },
      create: {
        id: node.id,
        designId,
        label: node.data?.label || 'Block',
        type: node.data?.type || 'service',
        x: node.position?.x || 0,
        y: node.position?.y || 0,
        color: node.data?.color || '#3b82f6',
        config: node.data?.config ? JSON.stringify(node.data.config) : '{}',
        metrics: node.data?.metrics ? JSON.stringify(node.data.metrics) : null,
      },
    })
  )

  const edgeOps = (edges || []).map((edge) =>
    prisma.edge.upsert({
      where: { id: edge.id },
      update: {
        sourceId: edge.source,
        targetId: edge.target,
        connectionType: edge.data?.connectionType || 'http',
        animated: edge.animated ?? true,
        label: edge.label,
      },
      create: {
        id: edge.id,
        designId,
        sourceId: edge.source,
        targetId: edge.target,
        connectionType: edge.data?.connectionType || 'http',
        animated: edge.animated ?? true,
        label: edge.label,
      },
    })
  )

  const allOps = [...blockOps, ...edgeOps]
  // Chunk to avoid huge transactions (Prisma/Postgres comfort zone)
  const CHUNK_SIZE = 50
  for (let i = 0; i < allOps.length; i += CHUNK_SIZE) {
    await prisma.$transaction(allOps.slice(i, i + CHUNK_SIZE))
  }

  await prisma.design.update({
    where: { id: designId },
    data: { updatedAt: new Date() },
  })
}

router.post('/:id/canvas', async (req, res) => {
  try {
    const { nodes, edges } = req.body
    await assertDesignWriteAccess(req, req.params.id)
    await syncCanvasData(req.params.id, nodes, edges)
    await invalidateDesignCache(req.dbUser.id, req.params.id)
    await logAuditEvent({
      userId: req.dbUser.id,
      designId: req.params.id,
      action: 'design_canvas_saved',
      details: { blockCount: nodes?.length || 0, edgeCount: edges?.length || 0 },
      clientInfo: getClientInfo(req),
    })
    res.json({ success: true })
  } catch (err) {
    const status = err.status || 500
    logger.error({ err: err.message, designId: req.params.id }, 'Failed to save canvas')
    res.status(status).json({ error: err.message })
  }
})

router.post('/:id/autosave', async (req, res) => {
  try {
    const { nodes, edges } = req.body
    await assertDesignWriteAccess(req, req.params.id)
    await syncCanvasData(req.params.id, nodes, edges)
    await invalidateDesignCache(req.dbUser.id, req.params.id)
    res.json({ success: true })
  } catch (err) {
    const status = err.status || 500
    logger.error({ err: err.message, designId: req.params.id }, 'Failed to autosave')
    res.status(status).json({ error: err.message })
  }
})

// ============================================================================
// DELETE /designs/:id
// ============================================================================
router.delete('/:id', async (req, res) => {
  try {
    await assertDesignWriteAccess(req, req.params.id)
    await prisma.design.delete({ where: { id: req.params.id } })
    await invalidateDesignCache(req.dbUser.id, req.params.id)
    await logAuditEvent({
      userId: req.dbUser.id,
      designId: req.params.id,
      action: 'design_deleted',
      details: {},
      clientInfo: getClientInfo(req),
    })
    res.json({ success: true })
  } catch (err) {
    const status = err.status || 500
    logger.error({ err: err.message, designId: req.params.id }, 'Failed to delete design')
    res.status(status).json({ error: err.message })
  }
})

// ============================================================================
// GET /designs/:id/overview — cached + selective queries
// ============================================================================
router.get('/:id/overview', async (req, res) => {
  try {
    const cacheKey = `design:overview:${req.params.id}:${req.dbUser.id}`
    let cached = await cache.get(cacheKey)
    if (cached) return res.json(cached)

    await assertDesignAccess(req, req.params.id)
    const design = await prisma.design.findUnique({
      where: { id: req.params.id },
      include: {
        blocks: { select: { id: true, label: true, type: true, x: true, y: true, color: true } },
        edges: { select: { id: true, sourceId: true, targetId: true, connectionType: true } },
        team: {
          include: {
            members: { include: { user: { select: { name: true, avatar: true } } } },
          },
        },
        _count: { select: { simulations: true, auditLogs: true, reports: true } },
      },
    })
    if (!design) return res.status(404).json({ error: 'Design not found' })

    const [latestReport, latestSimulation] = await prisma.$transaction([
      prisma.simulationReport.findFirst({
        where: { designId: req.params.id },
        orderBy: { generatedAt: 'desc' },
        select: {
          id: true, version: true, overallScore: true, architectureScore: true,
          reliabilityScore: true, performanceScore: true, costScore: true,
          executiveSummary: true, actionPlan: true, generatedAt: true,
        },
      }),
      prisma.simulation.findFirst({
        where: { designId: req.params.id },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, scenario: true, trafficPattern: true, duration: true,
          confidenceLevel: true, monteCarloPasses: true, totalSimulatedCost: true,
          projectedMonthlyCost: true, projectedAnnualCost: true, status: true, createdAt: true,
        },
      }),
    ])

    const result = {
      design: {
        id: design.id,
        name: design.name,
        description: design.description,
        status: design.status,
        repoUrl: design.repoUrl,
        repoBranch: design.repoBranch,
        createdAt: design.createdAt,
        updatedAt: design.updatedAt,
        blocks: design.blocks.length,
        edges: design.edges.length,
        nodes: design.blocks,
        edgesList: design.edges,
        teamName: design.team?.name || null,
        maxMembers: design.team?.maxMembers || 5,
        team: design.team?.members?.map((m) => ({
          name: m.user.name,
          avatar: m.user.avatar,
          initials: m.user.name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2),
        })) || [],
      },
      counts: {
        simulations: design._count.simulations,
        auditLogs: design._count.auditLogs,
        reports: design._count.reports,
      },
      latestReport: latestReport
        ? {
            id: latestReport.id,
            version: latestReport.version,
            overallScore: latestReport.overallScore,
            architectureScore: latestReport.architectureScore,
            reliabilityScore: latestReport.reliabilityScore,
            performanceScore: latestReport.performanceScore,
            costScore: latestReport.costScore,
            executiveSummary: latestReport.executiveSummary,
            actionPlan: latestReport.actionPlan,
            generatedAt: latestReport.generatedAt,
          }
        : null,
      latestSimulation: latestSimulation
        ? {
            id: latestSimulation.id,
            scenario: latestSimulation.scenario,
            trafficPattern: latestSimulation.trafficPattern,
            duration: latestSimulation.duration,
            confidenceLevel: latestSimulation.confidenceLevel,
            monteCarloPasses: latestSimulation.monteCarloPasses,
            totalSimulatedCost: latestSimulation.totalSimulatedCost,
            projectedMonthlyCost: latestSimulation.projectedMonthlyCost,
            projectedAnnualCost: latestSimulation.projectedAnnualCost,
            status: latestSimulation.status,
            createdAt: latestSimulation.createdAt,
          }
        : null,
    }

    await cache.set(cacheKey, result, OVERVIEW_TTL)
    res.json(result)
  } catch (err) {
    logger.error({ err: err.message, designId: req.params.id }, 'Failed to get design overview')
    res.status(500).json({ error: err.message })
  }
})

// ============================================================================
// GET /designs/:id/reports — DO NOT fetch massive JSON blobs for lists
// ============================================================================
router.get('/:id/reports', async (req, res) => {
  try {
    await assertDesignAccess(req, req.params.id)
    const design = await prisma.design.findUnique({
      where: { id: req.params.id },
      select: { id: true, name: true },
    })
    if (!design) return res.status(404).json({ error: 'Design not found' })

    const reports = await prisma.simulationReport.findMany({
      where: { designId: req.params.id },
      orderBy: { generatedAt: 'desc' },
      select: {
        id: true,
        simulationId: true,
        designId: true,
        version: true,
        overallScore: true,
        architectureScore: true,
        reliabilityScore: true,
        performanceScore: true,
        costScore: true,
        securityScore: true,
        scalabilityScore: true,
        confidenceScore: true,
        generatedAt: true,
        simulation: {
          select: {
            scenario: true,
            duration: true,
            monteCarloPasses: true,
            status: true,
            createdAt: true,
          },
        },
      },
    })

    const transformed = reports.map((r) => ({
      ...r,
      designName: design.name,
      simulationType: r.simulation?.scenario || 'Unknown',
      duration: r.simulation?.duration || 0,
      monteCarloPasses: r.simulation?.monteCarloPasses || 1,
      status: r.simulation?.status || 'completed',
    }))

    res.json(transformed)
  } catch (err) {
    logger.error({ err: err.message, designId: req.params.id }, 'Failed to list reports')
    res.status(500).json({ error: err.message })
  }
})

// ============================================================================
// GET /designs/:id/audit-logs
// ============================================================================
router.get('/:id/audit-logs', async (req, res) => {
  try {
    await assertDesignWriteAccess(req, req.params.id)
    const logs = await prisma.auditLog.findMany({
      where: { designId: req.params.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        user: { select: { name: true } },
        simulation: { select: { scenario: true } },
      },
    })
    const transformed = logs.map((l) => ({
      id: l.id,
      action: l.action,
      details: l.details,
      userName: l.user?.name || 'System',
      simulationScenario: l.simulation?.scenario,
      createdAt: l.createdAt,
    }))
    res.json(transformed)
  } catch (err) {
    const status = err.status || 500
    logger.error({ err: err.message, designId: req.params.id }, 'Failed to list audit logs')
    res.status(status).json({ error: err.message })
  }
})

// ============================================================================
// GET /designs/reports/by-simulation/:simId
// ============================================================================
router.get('/reports/by-simulation/:simId', async (req, res) => {
  try {
    const report = await prisma.simulationReport.findUnique({
      where: { simulationId: req.params.simId },
      include: {
        design: { select: { ownerId: true, name: true } },
        simulation: {
          select: {
            scenario: true,
            duration: true,
            monteCarloPasses: true,
            status: true,
            createdAt: true,
          },
        },
      },
    })
    if (!report) {
      return res.status(404).json({ error: 'Report not found' })
    }

    await assertDesignAccess(req, report.designId)
    res.json({
      ...report,
      designName: report.design?.name,
      simulationType: report.simulation?.scenario || 'Unknown',
      duration: report.simulation?.duration || 0,
      monteCarloPasses: report.simulation?.monteCarloPasses || 1,
      status: report.simulation?.status || 'completed',
    })
  } catch (err) {
    logger.error({ err: err.message, simId: req.params.simId }, 'Failed to get report by simulation')
    res.status(500).json({ error: err.message })
  }
})

export default router