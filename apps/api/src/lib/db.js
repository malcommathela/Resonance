import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis

// ============================================================================
// CONNECTION POOLING — CRITICAL FOR LOAD BALANCING & SCALING
// ============================================================================
// Prisma's connection pool size is controlled via the connection string,
// NOT the PrismaClient constructor. Add ?connection_limit=N to your URL.
//
// FORMULA: connection_limit = floor(DB_MAX_CONNECTIONS / INSTANCE_COUNT)
//
// Examples:
//   • Supabase Transaction Pooler (port 6543): use connection_limit=1
//     The pooler handles multiplexing. Prisma should not pool aggressively.
//     DATABASE_URL="postgresql://.../postgres?connection_limit=1"
//
//   • Supabase Direct (port 5432) with 100 max_conn, 4 API instances:
//     connection_limit = floor(100 / 4) = 25
//     DATABASE_URL="postgresql://.../postgres?connection_limit=25"
//
//   • Neon / serverless: use their pooling proxy, connection_limit=1-5
//
//   • Self-hosted Postgres (200 max_conn), 8 API instances + 4 workers:
//     connection_limit = floor(200 / 12) ≈ 16
//
// ALSO SET: pool_timeout=10 (seconds to wait for a free connection)
//   DATABASE_URL="...?connection_limit=20&pool_timeout=10"
//
// DO NOT set connection_limit in PrismaClient() — it is ignored.
// It belongs in the datasource URL or schema.prisma datasource block.
// ============================================================================

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma