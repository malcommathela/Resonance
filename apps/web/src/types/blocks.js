/**
 * Block & Edge Type Definitions
 *
 * Type-safe definitions for canvas block types, edge types,
 * and validation-related types consumed by block/edge components.
 */

// ============================================================================
// BLOCK TYPE ENUM
// ============================================================================

export const BlockType = {
  API_GATEWAY: 'api-gateway',
  SERVICE: 'service',
  DATABASE: 'database',
  CACHE: 'cache',
  MESSAGE_QUEUE: 'message-queue',
  LOAD_BALANCER: 'load-balancer',
  CDN: 'cdn',
  CLIENT: 'client',
  EXTERNAL_API: 'external-api',
  STORAGE: 'storage',
}

// ============================================================================
// EDGE TYPE ENUM
// ============================================================================

export const ConnectionType = {
  HTTP: 'http',
  HTTPS: 'https',
  REST: 'rest',
  GRAPHQL: 'graphql',
  WEBSOCKET: 'websocket',
  GRPC: 'grpc',
  KAFKA: 'kafka',
  RABBITMQ: 'rabbitmq',
  AMQP: 'amqp',
  MQTT: 'mqtt',
  TCP: 'tcp',
  UDP: 'udp',
  SFTP: 'sftp',
  EVENT_STREAM: 'event_stream',
}

// ============================================================================
// VALIDATION FINDING (referenced by block/edge components)
// ============================================================================

/**
 * @typedef {import('./simulation.js').ValidationFinding} ValidationFinding
 */

/**
 * @typedef {import('./simulation.js').ValidationHighlight} ValidationHighlight
 */

/**
 * @typedef {import('./simulation.js').ValidationResult} ValidationResult
 */

// ============================================================================
// CANVAS NODE / EDGE DATA TYPES
// ============================================================================

/**
 * @typedef {Object} BlockData
 * @property {string} label - Display label
 * @property {string} type - Block type ID (e.g., 'api-gateway', 'service')
 * @property {string} icon - Lucide icon name
 * @property {string} color - Hex color for the block
 * @property {string} category - Category ID
 * @property {string} [description] - Optional description
 * @property {Object} config - Block configuration (includes behavioralModel)
 * @property {boolean} [isCustom] - Whether this is a user-defined custom type
 */

/**
 * @typedef {Object} EdgeData
 * @property {string} connectionType - Connection type ID (e.g., 'http', 'grpc')
 * @property {string} label - Display label
 * @property {string} color - Hex color for the edge
 * @property {string} icon - Lucide icon name
 * @property {string} [description] - Optional description
 * @property {Object} behavioralModel - Edge behavioral model
 * @property {Object} [rawConfig] - Original config from canvas store
 */

/**
 * @typedef {Object} CanvasNode
 * @property {string} id - Unique node ID
 * @property {string} type - React Flow node type (always 'customBlock')
 * @property {{x: number, y: number}} position - Canvas position
 * @property {BlockData} data - Node data
 * @property {number} [width]
 * @property {number} [height]
 * @property {boolean} [selected]
 * @property {boolean} [dragging]
 */

/**
 * @typedef {Object} CanvasEdge
 * @property {string} id - Unique edge ID
 * @property {string} type - React Flow edge type (always 'customEdge')
 * @property {string} source - Source node ID
 * @property {string} target - Target node ID
 * @property {string} sourceId - Source node ID (DB convention)
 * @property {string} targetId - Target node ID (DB convention)
 * @property {EdgeData} data - Edge data
 * @property {boolean} [selected]
 */

// ============================================================================
// SELECTION STATE (for component consumers)
// ============================================================================

/**
 * @typedef {Object} SelectionState
 * @property {string|null} selectedNodeId - Canonical selected node ID
 * @property {string|null} selectedEdgeId - Canonical selected edge ID
 * @property {string[]} selectedNodeIds - Multi-select node IDs
 * @property {string[]} selectedEdgeIds - Multi-select edge IDs
 */

/**
 * @typedef {Object} PanelState
 * @property {{collapsed: boolean, width: number}} blockLibrary
 * @property {{collapsed: boolean, width: number}} properties
 */

/**
 * @typedef {Object} SimulationState
 * @property {'idle'|'running'|'completed'|'failed'|'stopped'} status
 * @property {number} progress - 0 to 100
 * @property {string|null} reportId
 * @property {boolean} autoOpenReport
 * @property {string|null} errorMessage
 */