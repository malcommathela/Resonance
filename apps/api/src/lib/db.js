import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis

// Supabase Session Pooler (port 5432) — use moderate connection limit
// Supabase Transaction Pooler (port 6543) — use connection_limit=1
// Adjust based on your actual port in DIRECT_URL
export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  // Connection pooling handled by Supabase Transaction Pooler
  // Do NOT set connection_limit here if using Transaction Pooler
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma