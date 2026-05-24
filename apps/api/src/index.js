import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { prisma } from './lib/db.js'
import { redis } from './lib/redis.js'
import authRoutes from './routes/auth.js'
import designRoutes from './routes/designs.js'
import simulationRoutes from './routes/simulations.js'
import githubRoutes from './routes/github.js'
import reverseEngineRoutes from './routes/reverseEngine.js'
import optimizeRoutes from './routes/optimize.js'
import cookieParser from 'cookie-parser'

const app = express()
const PORT = process.env.PORT || 3001

// Security middleware
app.use(helmet())
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}))

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
})
app.use('/api/', limiter)

app.use(express.json({ limit: '10mb' }))
app.use(cookieParser())

// Health check
app.get('/health', async (req, res) => {
  const dbHealthy = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false)
  const redisHealthy = await redis.ping().then(() => true).catch(() => false)

  res.json({
    status: dbHealthy && redisHealthy ? 'ok' : 'degraded',
    service: 'resonance-api',
    version: '1.0.0',
    database: dbHealthy ? 'connected' : 'error',
    redis: redisHealthy ? 'connected' : 'error',
  })
})

// Routes
app.use('/auth', authRoutes)
app.use('/designs', designRoutes)
app.use('/simulations', simulationRoutes)
app.use('/github', githubRoutes)
app.use('/analyze', reverseEngineRoutes)
app.use('/optimize', optimizeRoutes)

// Error handling
app.use((err, req, res, next) => {
  console.error(err)
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  })
})

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully')
  await prisma.$disconnect()
  await redis.quit()
  process.exit(0)
})

app.listen(PORT, () => {
  console.log(`Resonance API running on http://localhost:${PORT}`)
  console.log(`Database: ${process.env.DATABASE_URL?.split('@')[1] || 'not configured'}`)
  console.log(`Redis: ${process.env.REDIS_URL || 'not configured'}`)
})