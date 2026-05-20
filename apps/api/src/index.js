import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import passport from 'passport'
import { prisma } from './lib/db.js'
import { redis } from './lib/redis.js'
import authRoutes from './routes/auth.js'
import designRoutes from './routes/designs.js'
import simulationRoutes from './routes/simulations.js'

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
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
})
app.use('/api/', limiter)

app.use(express.json({ limit: '10mb' }))
app.use(passport.initialize())

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
  console.log(`🚀 Resonance API running on http://localhost:${PORT}`)
  console.log(`📊 Database: ${process.env.DATABASE_URL?.split('@')[1] || 'not configured'}`)
  console.log(`🔴 Redis: ${process.env.REDIS_URL || 'not configured'}`)
})