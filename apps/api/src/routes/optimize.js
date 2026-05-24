import { Router } from 'express'
import { prisma } from '../lib/db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

// Optimization heuristics database
const OPTIMIZATION_RULES = [
  {
    id: 'db-read-replica',
    name: 'Add Read Replica',
    description: 'Your database is the bottleneck. Adding a read replica would offload read traffic.',
    condition: (metrics, blocks) => {
      const db = blocks.find(b => b.data?.type === 'database')
      const dbMetrics = db ? metrics[db.id] : null
      return dbMetrics && dbMetrics.utilization > 0.8 && dbMetrics.avgLatency > 100
    },
    impact: (metrics, blocks) => {
      const db = blocks.find(b => b.data?.type === 'database')
      const dbMetrics = metrics[db?.id]
      if (!dbMetrics) return null

      const currentCapacity = dbMetrics.throughput
      const newCapacity = Math.floor(currentCapacity * 2.5)
      const latencyImprovement = Math.floor(dbMetrics.avgLatency * 0.4)

      return {
        currentRps: currentCapacity,
        projectedRps: newCapacity,
        latencyReduction: latencyImprovement,
        costIncrease: 280, // $/month
        confidence: 0.92,
      }
    },
    action: {
      type: 'add_block',
      blockType: 'database',
      label: 'Read Replica',
      config: { engine: 'postgres', role: 'replica', port: 5432 },
      connectTo: 'database',
      connectionType: 'db',
    },
  },
  {
    id: 'cache-lru-to-lfu',
    name: 'Switch Cache to LFU',
    description: 'Your cache hit ratio is low. Switching from LRU to LFU would better match your access patterns.',
    condition: (metrics, blocks) => {
      const cache = blocks.find(b => b.data?.type === 'cache')
      const cacheMetrics = cache ? metrics[cache.id] : null
      return cacheMetrics && cacheMetrics.errorRate > 0.3 // High miss rate
    },
    impact: (metrics, blocks) => {
      const cache = blocks.find(b => b.data?.type === 'cache')
      const cacheMetrics = metrics[cache?.id]
      if (!cacheMetrics) return null

      return {
        hitRatioImprovement: 18, // percentage points
        dbLoadReduction: 35, // percentage
        latencyReduction: 25,
        costIncrease: 0,
        confidence: 0.85,
      }
    },
    action: {
      type: 'update_config',
      blockType: 'cache',
      config: { eviction: 'allkeys-lfu', maxMemory: '512mb' },
    },
  },
  {
    id: 'add-load-balancer',
    name: 'Add Load Balancer',
    description: 'Your API Gateway is handling too much load. A dedicated load balancer would improve distribution.',
    condition: (metrics, blocks) => {
      const gateway = blocks.find(b => b.data?.type === 'api-gateway')
      const gwMetrics = gateway ? metrics[gateway.id] : null
      return gwMetrics && gwMetrics.utilization > 0.85
    },
    impact: (metrics, blocks) => {
      const gateway = blocks.find(b => b.data?.type === 'api-gateway')
      const gwMetrics = metrics[gateway?.id]
      if (!gwMetrics) return null

      return {
        latencyReduction: 18,
        throughputIncrease: 40,
        availabilityImprovement: 2.5,
        costIncrease: 120,
        confidence: 0.88,
      }
    },
    action: {
      type: 'add_block',
      blockType: 'load-balancer',
      label: 'Load Balancer',
      config: { algorithm: 'least-connections', healthCheck: true },
      insertBefore: 'api-gateway',
    },
  },
  {
    id: 'scale-services',
    name: 'Scale Services Horizontally',
    description: 'Your services are at high utilization. Adding replicas would improve throughput.',
    condition: (metrics, blocks) => {
      const services = blocks.filter(b => b.data?.type === 'service')
      return services.some(s => {
        const m = metrics[s.id]
        return m && m.utilization > 0.75
      })
    },
    impact: (metrics, blocks) => {
      const services = blocks.filter(b => b.data?.type === 'service')
      const maxUtil = Math.max(...services.map(s => metrics[s.id]?.utilization || 0))

      return {
        currentReplicas: 1,
        projectedReplicas: 3,
        throughputIncrease: 180,
        latencyReduction: 30,
        costIncrease: 200,
        confidence: 0.90,
      }
    },
    action: {
      type: 'update_config',
      blockType: 'service',
      config: { replicas: 3 },
    },
  },
  {
    id: 'add-cdn',
    name: 'Add CDN Layer',
    description: 'Static assets could be served from edge locations to reduce origin load.',
    condition: (metrics, blocks) => {
      const client = blocks.find(b => b.data?.type === 'client')
      const hasCdn = blocks.some(b => b.data?.type === 'cdn')
      return client && !hasCdn
    },
    impact: (metrics, blocks) => {
      return {
        latencyReduction: 60,
        bandwidthReduction: 70,
        costIncrease: 150,
        confidence: 0.95,
      }
    },
    action: {
      type: 'add_block',
      blockType: 'cdn',
      label: 'CDN',
      config: { provider: 'cloudfront', caching: '1h' },
      insertBefore: 'client',
    },
  },
  {
    id: 'db-connection-pool',
    name: 'Increase Connection Pool',
    description: 'Database connection pool is exhausted. Increasing pool size would reduce queue depth.',
    condition: (metrics, blocks) => {
      const db = blocks.find(b => b.data?.type === 'database')
      const dbMetrics = db ? metrics[db.id] : null
      return dbMetrics && dbMetrics.queueDepth > 20
    },
    impact: (metrics, blocks) => {
      const db = blocks.find(b => b.data?.type === 'database')
      const dbMetrics = metrics[db?.id]
      if (!dbMetrics) return null

      return {
        queueDepthReduction: Math.floor(dbMetrics.queueDepth * 0.7),
        latencyReduction: 45,
        costIncrease: 0,
        confidence: 0.87,
      }
    },
    action: {
      type: 'update_config',
      blockType: 'database',
      config: { connectionPool: 50, maxConnections: 100 },
    },
  },
]

// POST /optimize/analyze — Analyze simulation and suggest optimizations
router.post('/analyze', authMiddleware, async (req, res) => {
  try {
    const { simulationId, designId } = req.body

    // Get simulation results
    const simulation = await prisma.simulation.findFirst({
      where: { id: simulationId, userId: req.user.id }
    })

    if (!simulation) return res.status(404).json({ error: 'Simulation not found' })

    // Get design blocks
    const design = await prisma.design.findFirst({
      where: { id: designId, ownerId: req.user.id },
      include: { blocks: true, edges: true }
    })

    if (!design) return res.status(404).json({ error: 'Design not found' })

    const blocks = design.blocks.map(b => ({
      id: b.id,
      data: {
        type: b.type,
        label: b.label,
        config: typeof b.config === 'string' ? JSON.parse(b.config) : b.config,
      }
    }))

    const metrics = simulation.metrics || {}

    // Evaluate all rules
    const suggestions = []
    for (const rule of OPTIMIZATION_RULES) {
      try {
        if (rule.condition(metrics, blocks)) {
          const impact = rule.impact(metrics, blocks)
          if (impact) {
            suggestions.push({
              id: rule.id,
              name: rule.name,
              description: rule.description,
              impact,
              action: rule.action,
              priority: impact.confidence * (impact.latencyReduction || impact.throughputIncrease || 1) / 100,
            })
          }
        }
      } catch (e) {
        console.warn(`Rule ${rule.id} failed:`, e)
      }
    }

    // Sort by priority
    suggestions.sort((a, b) => b.priority - a.priority)

    res.json({
      simulationId,
      designId,
      totalSuggestions: suggestions.length,
      estimatedTotalCost: suggestions.reduce((sum, s) => sum + (s.impact.costIncrease || 0), 0),
      suggestions: suggestions.slice(0, 5), // Top 5
    })
  } catch (err) {
    console.error('Optimization analyze error:', err)
    res.status(500).json({ error: err.message })
  }
})

// POST /optimize/apply — Apply a suggestion to the design
router.post('/apply', authMiddleware, async (req, res) => {
  try {
    const { designId, suggestionId, simulationId } = req.body

    const design = await prisma.design.findFirst({
      where: { id: designId, ownerId: req.user.id },
      include: { blocks: true, edges: true }
    })

    if (!design) return res.status(404).json({ error: 'Design not found' })

    const rule = OPTIMIZATION_RULES.find(r => r.id === suggestionId)
    if (!rule) return res.status(404).json({ error: 'Suggestion not found' })

    const action = rule.action
    let changes = []

    await prisma.$transaction(async (tx) => {
      if (action.type === 'add_block') {
        // Create new block
        const newBlock = await tx.block.create({
          data: {
            designId,
            type: action.blockType,
            label: action.label,
            x: 400 + Math.random() * 200,
            y: 300 + Math.random() * 200,
            color: action.blockType === 'database' ? '#10b981' : 
                   action.blockType === 'cache' ? '#f59e0b' :
                   action.blockType === 'load-balancer' ? '#06b6d4' :
                   action.blockType === 'cdn' ? '#ec4899' : '#3b82f6',
            config: action.config || {},
          }
        })

        changes.push({ type: 'add_block', block: newBlock })

        // Create connection if specified
        if (action.connectTo) {
          const targetBlock = design.blocks.find(b => b.data?.type === action.connectTo || b.type === action.connectTo)
          if (targetBlock) {
            const newEdge = await tx.edge.create({
              data: {
                designId,
                sourceId: newBlock.id,
                targetId: targetBlock.id,
                connectionType: action.connectionType || 'http',
                animated: true,
              }
            })
            changes.push({ type: 'add_edge', edge: newEdge })
          }
        }

        if (action.insertBefore) {
          const targetBlock = design.blocks.find(b => b.data?.type === action.insertBefore || b.type === action.insertBefore)
          if (targetBlock) {
            // Find edges pointing to target and reroute through new block
            const incomingEdges = design.edges.filter(e => e.targetId === targetBlock.id)
            for (const edge of incomingEdges) {
              // Create edge from source to new block
              await tx.edge.create({
                data: {
                  designId,
                  sourceId: edge.sourceId,
                  targetId: newBlock.id,
                  connectionType: edge.connectionType || 'http',
                  animated: true,
                }
              })
              // Create edge from new block to target
              await tx.edge.create({
                data: {
                  designId,
                  sourceId: newBlock.id,
                  targetId: targetBlock.id,
                  connectionType: edge.connectionType || 'http',
                  animated: true,
                }
              })
              // Delete old edge
              await tx.edge.delete({ where: { id: edge.id } })
            }
          }
        }
      } else if (action.type === 'update_config') {
        const targetBlocks = design.blocks.filter(b => b.data?.type === action.blockType || b.type === action.blockType)
        for (const block of targetBlocks) {
          const currentConfig = typeof block.config === 'string' ? JSON.parse(block.config) : block.config || {}
          const updatedConfig = { ...currentConfig, ...action.config }

          await tx.block.update({
            where: { id: block.id },
            data: { config: updatedConfig }
          })

          changes.push({ type: 'update_config', blockId: block.id, config: updatedConfig })
        }
      }

      await tx.design.update({
        where: { id: designId },
        data: { updatedAt: new Date() }
      })
    })

    res.json({
      success: true,
      suggestionId,
      changes,
      message: `Applied: ${rule.name}`,
    })
  } catch (err) {
    console.error('Apply optimization error:', err)
    res.status(500).json({ error: err.message })
  }
})

// POST /optimize/simulate — Apply + run new simulation to validate
router.post('/simulate', authMiddleware, async (req, res) => {
  try {
    const { designId, suggestionId, simulationConfig } = req.body

    // Apply the optimization
    const applyRes = await fetch(`http://localhost:${process.env.PORT || 3001}/optimize/apply`, {
      method: 'POST',
      headers: {
        'Authorization': req.headers.authorization,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ designId, suggestionId }),
    })

    if (!applyRes.ok) {
      const error = await applyRes.json()
      throw new Error(error.error || 'Failed to apply optimization')
    }

    // Run new simulation
    const simRes = await fetch(`http://localhost:${process.env.PORT || 3001}/simulations/${designId}/run`, {
      method: 'POST',
      headers: {
        'Authorization': req.headers.authorization,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(simulationConfig),
    })

    if (!simRes.ok) {
      const error = await simRes.json()
      throw new Error(error.error || 'Failed to run validation simulation')
    }

    const simResult = await simRes.json()

    res.json({
      success: true,
      applied: true,
      simulationId: simResult.simulationId,
      message: 'Optimization applied and validating...',
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
