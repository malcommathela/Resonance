// ============================================================================
// SECURITY MIDDLEWARE — L08 Security & RLS
// ============================================================================
// Hardens Helmet with a strict Content-Security-Policy and adds lightweight
// XSS sanitization for incoming request bodies.
//
// Replaces the basic helmet() call in index.js with production-grade headers.
// ============================================================================

import helmet from 'helmet'

export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'", // Vite HMR needs inline scripts in dev; tighten for prod builds
      ],
      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        'https://fonts.googleapis.com',
      ],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: [
        "'self'",
        'data:',
        'https://img.clerk.com',
        'https://avatars.githubusercontent.com',
      ],
      connectSrc: [
        "'self'",
        'https://api.clerk.com',
        'https://*.clerk.accounts.dev',
        'https://api.github.com',
      ],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false, // Required for some asset loading patterns
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  dnsPrefetchControl: { allow: false },
  frameguard: { action: 'deny' },
  hidePoweredBy: true,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  ieNoOpen: true,
  noSniff: true,
  originAgentCluster: true,
  permittedCrossDomainPolicies: { permittedPolicies: 'none' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xssFilter: true,
})

// ============================================================================
// LIGHTWEIGHT XSS SANITIZATION
// ============================================================================
// Strips <script> tags and javascript: URLs from request bodies.
// This is a defense-in-depth layer — frontend should also sanitize.
// ============================================================================

const XSS_SCRIPT_PATTERN = /<script[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi
const XSS_EVENT_PATTERN = /\s*on\w+\s*=\s*["']?[^"'>]*["']?/gi
const XSS_JS_URL_PATTERN = /javascript:/gi

function sanitizeString(str) {
  if (typeof str !== 'string') return str
  return str
    .replace(XSS_SCRIPT_PATTERN, '')
    .replace(XSS_EVENT_PATTERN, '')
    .replace(XSS_JS_URL_PATTERN, 'blocked:')
}

function sanitizeObject(obj, depth = 0) {
  if (depth > 10) return obj
  if (typeof obj === 'string') return sanitizeString(obj)
  if (Array.isArray(obj)) return obj.map((v) => sanitizeObject(v, depth + 1))
  if (obj && typeof obj === 'object') {
    const result = {}
    for (const key of Object.keys(obj)) {
      result[key] = sanitizeObject(obj[key], depth + 1)
    }
    return result
  }
  return obj
}

export function sanitizeInput(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body)
  }
  // Also sanitize query params that might be reflected
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query)
  }
  next()
}