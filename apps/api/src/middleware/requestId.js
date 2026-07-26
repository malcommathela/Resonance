import { randomUUID } from 'node:crypto'

/**
 * L12: Request Correlation ID Middleware
 * Attaches a unique request ID for distributed tracing across logs, Sentry,
 * and downstream services. Respects incoming X-Request-ID from load balancers.
 */
export function requestId(req, res, next) {
  const id = req.get('x-request-id') || randomUUID()
  req.requestId = id
  res.setHeader('X-Request-ID', id)
  next()
}