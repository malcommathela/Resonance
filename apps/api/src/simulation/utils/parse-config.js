/**
 * Shared Config Parser Utility
 *
 * Parses block/edge config from various formats (string JSON, object, null).
 * Used by confidence-engine.js, security-engine.js, and any other engine
 * that needs to inspect raw block configuration.
 */

/**
 * Parse a config value that may be a JSON string, plain object, or null.
 * @param {string|object|null|undefined} config
 * @returns {object}
 */
export function parseConfig(config) {
  if (config === null || config === undefined) return {}
  if (typeof config === 'string') {
    try {
      return JSON.parse(config)
    } catch {
      return {}
    }
  }
  if (typeof config === 'object' && !Array.isArray(config)) return config
  return {}
}

/**
 * Parse block.config specifically, handling Prisma Json defaults.
 * @param {object} block — block with .config field
 * @returns {object}
 */
export function parseBlockConfig(block) {
  const rawConfig = block?.config
  if (rawConfig === null || rawConfig === undefined) return {}
  if (typeof rawConfig === 'string') {
    try {
      return JSON.parse(rawConfig)
    } catch {
      return {}
    }
  }
  if (typeof rawConfig === 'object' && !Array.isArray(rawConfig)) return rawConfig
  return {}
}