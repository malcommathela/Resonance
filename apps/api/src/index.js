import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { clerkMiddleware } from '@clerk/express'
import { prisma } from './lib/db.js'
import { redis } from './lib/redis.js'
import webhookRoutes from './routes/webhooks.js'
import authRoutes from './routes/auth.js'
import designRoutes from './routes/designs.js'
import simulationRoutes from './routes/simulations.js'
import githubRoutes from './routes/github.js'
import reverseEngineRoutes from './routes/reverseEngine.js'
import optimizeRoutes from './routes/optimize.js'

const app = express()
const PORT = process.env.PORT || 3001

app.use(helmet())
app.use(cors({
  origin: (origin, callback) => {
    const allowed = [process.env.FRONTEND_URL, 'http://localhost:5173'].filter(Boolean)
    if (!origin || allowed.includes(origin) || origin.endsWith('.vercel.app')) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed'))
    }
  },
  credentials: true,
}))

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
})
app.use('/api/', limiter)

// WEBHOOKS FIRST — before any body parser that would consume the raw body
app.use('/webhooks', webhookRoutes)

// Clerk auth middleware — only needed for API routes, not webhooks
app.use(clerkMiddleware({
  secretKey: process.env.CLERK_SECRET_KEY,
  publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
}))

// JSON parser — after webhooks and Clerk middleware
app.use(express.json({ limit: '10mb' }))

app.get('/health', async (req, res) => {
  const dbHealthy = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false)
  const redisHealthy = await redis.ping().then(() => true).catch(() => false)
  res.json({ status: dbHealthy && redisHealthy ? 'ok' : 'degraded', database: dbHealthy ? 'connected' : 'error', redis: redisHealthy ? 'connected' : 'error' })
})

app.use('/auth', authRoutes)
app.use('/designs', designRoutes)
app.use('/simulations', simulationRoutes)
app.use('/github', githubRoutes)
app.use('/analyze', reverseEngineRoutes)
app.use('/optimize', optimizeRoutes)

app.use((err, req, res, next) => {
  console.error(err)
  res.status(err.status || 500).json({ error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message })
})

process.on('SIGTERM', async () => {
  await prisma.$disconnect()
  process.exit(0)
})

app.listen(PORT, () => {
  console.log(`API running on port ${PORT}`)
})