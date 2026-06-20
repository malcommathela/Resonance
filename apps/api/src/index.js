import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import { clerkMiddleware } from '@clerk/express'

import simulationRoutes from './routes/simulations.js'
import optimizationRoutes from './routes/optimize.js'
import designRoutes from './routes/designs.js'
import authRoutes from './routes/auth.js'

const app = express()
const PORT = process.env.PORT || 3001

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}))
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}))
app.use(compression())
app.use(express.json({ limit: '10mb' }))

// Clerk middleware - simple, no extra config for dev
app.use(clerkMiddleware())

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    clerkSecretKey: process.env.CLERK_SECRET_KEY ? 'SET' : 'MISSING',
  })
})

// API routes
app.use('/simulations', simulationRoutes)
app.use('/optimize', optimizationRoutes)
app.use('/designs', designRoutes)
app.use('/auth', authRoutes)

// Error handling
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err)
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  })
})

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' })
})

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`)
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`)
})

export default app