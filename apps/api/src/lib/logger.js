// ============================================================================
// STRUCTURED LOGGER — L08 Security & L12 Error Tracking
// ============================================================================
// Zero-dependency structured logger. Outputs JSON in production, pretty in dev.
// Redacts sensitive keys automatically. Supports child loggers for correlation IDs.
//
// Replaces all console.log/console.error to prevent leaking secrets like
// DATABASE_URL, CLERK_SECRET_KEY, etc.
// ============================================================================

const SENSITIVE_KEYS = new Set([
  'password', 'token', 'secret', 'authorization', 'cookie',
  'database_url', 'direct_url', 'clerk_secret_key', 'redis_password',
  'upstash_redis_rest_token', 'api_key', 'private_key', 'github_token',
  'pat', 'personal_access_token', 'sentry_dsn', 'webhook_url',
])

function redact(obj, depth = 0) {
  if (depth > 10) return '[MAX_DEPTH]'
  if (!obj || typeof obj !== 'object') return obj
  if (typeof obj === 'string' && obj.length > 500) return obj.slice(0, 500) + '...[TRUNCATED]'

  const result = Array.isArray(obj) ? [...obj] : { ...obj }
  for (const key in result) {
    const lowerKey = key.toLowerCase().replace(/[-_]/g, '')
    if (SENSITIVE_KEYS.has(lowerKey) || key.includes('URL') || key.includes('KEY')) {
      const val = result[key]
      result[key] = typeof val === 'string' && val.length > 0 ? '[REDACTED]' : val
    } else if (typeof result[key] === 'object' && result[key] !== null) {
      result[key] = redact(result[key], depth + 1)
    }
  }
  return result
}

function log(level, msg, extra = {}) {
  const entry = {
    level,
    time: new Date().toISOString(),
    pid: process.pid,
    env: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || 'unknown',
    msg,
    ...redact(extra),
  }

  if (process.env.NODE_ENV === 'production') {
    // Structured JSON for log aggregation (Sentry, Datadog, CloudWatch, etc.)
    console.log(JSON.stringify(entry))
  } else {
    const colors = {
      fatal: '\u001b[35m', // magenta
      error: '\u001b[31m', // red
      warn: '\u001b[33m',  // yellow
      info: '\u001b[36m',  // cyan
      debug: '\u001b[90m', // gray
    }
    const c = colors[level] || ''
    const reset = '\u001b[0m'
    const extraStr = Object.keys(extra).length ? JSON.stringify(redact(extra), null, 2) : ''
    console.log(`${c}[${level.toUpperCase()}]${reset} ${msg}${extraStr ? ' ' + extraStr : ''}`)
  }
}

export const logger = {
  fatal: (extra, msg) => {
    if (typeof extra === 'string') { msg = extra; extra = {} }
    log('fatal', msg || 'Fatal', extra)
  },
  error: (extra, msg) => {
    if (typeof extra === 'string') { msg = extra; extra = {} }
    log('error', msg || extra?.err || 'Error', extra)
  },
  warn: (extra, msg) => {
    if (typeof extra === 'string') { msg = extra; extra = {} }
    log('warn', msg || 'Warning', extra)
  },
  info: (extra, msg) => {
    if (typeof extra === 'string') { msg = extra; extra = {} }
    log('info', msg || 'Info', extra)
  },
  debug: (extra, msg) => {
    if (typeof extra === 'string') { msg = extra; extra = {} }
    log('debug', msg || 'Debug', extra)
  },
  child: (bindings) => ({
    fatal: (extra, msg) => logger.fatal({ ...bindings, ...(typeof extra === 'object' ? extra : {}) }, msg || extra),
    error: (extra, msg) => logger.error({ ...bindings, ...(typeof extra === 'object' ? extra : {}) }, msg || extra),
    warn: (extra, msg) => logger.warn({ ...bindings, ...(typeof extra === 'object' ? extra : {}) }, msg || extra),
    info: (extra, msg) => logger.info({ ...bindings, ...(typeof extra === 'object' ? extra : {}) }, msg || extra),
    debug: (extra, msg) => logger.debug({ ...bindings, ...(typeof extra === 'object' ? extra : {}) }, msg || extra),
    child: (more) => logger.child({ ...bindings, ...more }),
  }),
}

// ============================================================================
// REQUEST LOGGER — attaches to Express response finish event
// L12: includes requestId for distributed tracing
// ============================================================================
export function requestLogger(req, res, next) {
  const start = Date.now()
  res.on('finish', () => {
    logger.info({
      req: {
        method: req.method,
        url: req.originalUrl || req.url,
        ip: req.ip,
        userId: req.userId || null,
        requestId: req.requestId,
      },
      res: { statusCode: res.statusCode },
      responseTime: Date.now() - start,
    }, 'request completed')
  })
  next()
}