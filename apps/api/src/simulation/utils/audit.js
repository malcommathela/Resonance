/**
 * Audit Trail — P5.4 Production Readiness
 * 
 * Every simulation action is logged for compliance, debugging, and security.
 * Uses Prisma AuditLog model. Tamper-resistant append-only log.
 */

import { prisma } from '../../lib/db.js'

/**
 * Log an audit event.
 * @param {Object} params
 * @param {string} params.userId
 * @param {string} params.designId
 * @param {string} params.simulationId
 * @param {string} params.action — e.g. 'simulation_started', 'simulation_completed', 'simulation_failed', 'simulation_stopped'
 * @param {Object} params.details — arbitrary JSON data
 * @param {Object} params.clientInfo — { ipAddress, userAgent }
 */
export async function logAuditEvent({ userId, designId, simulationId, action, details, clientInfo }) {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        designId,
        simulationId,
        action,
        details: details || {},
        ipAddress: clientInfo?.ipAddress || null,
        userAgent: clientInfo?.userAgent || null,
      },
    })
  } catch (err) {
    // Audit logging must never break the simulation
    console.error('[AUDIT] Failed to log audit event:', err.message)
  }
}

/**
 * Query audit trail for a simulation.
 */
export async function getSimulationAuditTrail(simulationId) {
  return prisma.auditLog.findMany({
    where: { simulationId },
    orderBy: { createdAt: 'asc' },
  })
}

/**
 * Query audit trail for a user (GDPR / compliance).
 */
export async function getUserAuditTrail(userId, { limit = 100, offset = 0 } = {}) {
  return prisma.auditLog.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset,
  })
}