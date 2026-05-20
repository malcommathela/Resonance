import express from 'express'
import cors from 'cors'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'resonance-api', version: '1.0.0' })
})

// Auth routes
app.post('/auth/github', (req, res) => {
  // Mock GitHub OAuth
  res.json({
    token: 'mock_jwt_token_' + Date.now(),
    user: {
      id: 'usr_' + Math.random().toString(36).substr(2, 9),
      name: 'Alex Chen',
      email: 'alex@example.com',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alex',
      githubId: 'alexchen',
      tier: 'free',
    }
  })
})

// Designs routes
app.get('/designs', (req, res) => {
  res.json([
    {
      id: 'des_1',
      name: 'E-Commerce Platform',
      description: 'Microservices architecture for online store',
      status: 'active',
      blocks: 8,
      simulations: 12,
      updatedAt: '2026-05-19T14:22:00Z',
    }
  ])
})

app.post('/designs', (req, res) => {
  const design = {
    id: 'des_' + Math.random().toString(36).substr(2, 9),
    ...req.body,
    status: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  res.status(201).json(design)
})

// Simulation routes
app.post('/simulations', (req, res) => {
  res.json({
    id: 'sim_' + Math.random().toString(36).substr(2, 9),
    status: 'running',
    ...req.body,
  })
})

app.listen(PORT, () => {
  console.log(`🚀 Resonance API running on http://localhost:${PORT}`)
})
