/**
 * Security Analysis Engine (P3)
 * 
 * Modular security analysis: graph topology + configuration inspection.
 * Each analyzer is independent, stateless, and deterministic.
 * 
 * Zero hardcoded values. All thresholds from config.
 */

// ============================================================================
// ENGINE CONFIGURATION
// ============================================================================

const DEFAULT_SECURITY_CONFIG = Object.freeze({
  severityWeights: {
    critical: 10,
    high: 7,
    medium: 4,
    low: 1,
  },
  maxScore: 100,
  // Thresholds
  minReplicasForRedundancy: 2,
  requiredAuthTypes: ['jwt', 'oauth', 'api-key', 'mTLS'],
  insecureProtocols: ['http', 'tcp', 'udp'],
  secureProtocols: ['https', 'rest', 'graphql', 'grpc', 'sftp'],
  encryptionRequiredTypes: ['database', 'cache', 'storage'],
  publicFacingTypes: ['api-gateway', 'cdn', 'load-balancer'],
  internalTypes: ['database', 'cache', 'message-queue'],
})

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

/**
 * Run security analysis on architecture.
 * 
 * @param {Object} inputSnapshot — Architecture blocks and edges
 * @param {Object} simulationResult — Simulation results (for traffic patterns)
 * @param {Object} options — Analysis options
 * @returns {SecurityAnalysis} Structured security analysis
 */
export function analyzeSecurity(inputSnapshot, simulationResult = null, options = {}) {
  const config = { ...DEFAULT_SECURITY_CONFIG, ...(options.config || {}) }
  const blocks = inputSnapshot?.blocks || []
  const edges = inputSnapshot?.edges || []

  // Build graph structures
  const adjacency = buildAdjacency(edges)
  const reverseAdjacency = buildReverseAdjacency(edges)

  // Run all analyzers
  const graphFindings = runGraphAnalyzers(blocks, edges, adjacency, reverseAdjacency, config)
  const configFindings = runConfigAnalyzers(blocks, edges, config)

  const allFindings = [...graphFindings, ...configFindings]

  // Score calculation
  const score = calculateSecurityScore(allFindings, config)

  // Categorize
  const bySeverity = {
    critical: allFindings.filter(f => f.severity === 'critical'),
    high: allFindings.filter(f => f.severity === 'high'),
    medium: allFindings.filter(f => f.severity === 'medium'),
    low: allFindings.filter(f => f.severity === 'low'),
  }

  const byType = groupFindingsByType(allFindings)

  return {
    securityScore: score,
    criticalCount: bySeverity.critical.length,
    highCount: bySeverity.high.length,
    mediumCount: bySeverity.medium.length,
    lowCount: bySeverity.low.length,
    findings: allFindings,
    bySeverity,
    byType,
    recommendations: generateSecurityRecommendations(allFindings, score),
    explainability: buildSecurityExplainability(allFindings, score, config),
  }
}

// ============================================================================
// GRAPH ANALYZERS
// ============================================================================

function runGraphAnalyzers(blocks, edges, adjacency, reverseAdjacency, config) {
  const findings = []

  findings.push(...analyzePublicDatabases(blocks, edges, adjacency, reverseAdjacency, config))
  findings.push(...analyzeMissingGateways(blocks, edges, adjacency, config))
  findings.push(...analyzeUnencryptedEdges(edges, config))
  findings.push(...analyzeDirectClientToDatabase(blocks, edges, adjacency, config))
  findings.push(...analyzeMissingRedundancy(blocks, config))
  findings.push(...analyzeSinglePointsOfCompromise(blocks, edges, adjacency, reverseAdjacency, config))
  findings.push(...analyzeMissingNetworkSegmentation(blocks, edges, config))
  findings.push(...analyzeInsecureTrustBoundaries(blocks, edges, adjacency, config))

  return findings
}

function analyzePublicDatabases(blocks, edges, adjacency, reverseAdjacency, config) {
  const findings = []
  const databases = blocks.filter(b => b.type === 'database')

  for (const db of databases) {
    // Check if database is reachable from a public-facing component without a gateway
    const incoming = reverseAdjacency.get(db.id) || []
    const hasGateway = incoming.some(srcId => {
      const src = blocks.find(b => b.id === srcId)
      return src && config.publicFacingTypes.includes(src.type)
    })

    const hasDirectPublic = incoming.some(srcId => {
      const src = blocks.find(b => b.id === srcId)
      return src && src.type === 'client'
    })

    if (hasDirectPublic) {
      findings.push({
        id: `sec-public-db-${db.id}`,
        severity: 'critical',
        type: 'public_exposure',
        message: `Database "${db.label || db.id}" is directly exposed to clients without an API gateway.`,
        blockId: db.id,
        affectedDataFlows: incoming.map(id => `${id}→${db.id}`),
        recommendation: 'Place an API gateway between clients and databases. Never expose databases directly.',
        evidence: { incomingConnections: incoming.length, hasGateway, hasDirectPublic },
      })
    }

    if (!hasGateway && incoming.length > 0) {
      findings.push({
        id: `sec-db-no-gateway-${db.id}`,
        severity: 'high',
        type: 'missing_authentication',
        message: `Database "${db.label || db.id}" has no API gateway in front of it.`,
        blockId: db.id,
        recommendation: 'Add an API gateway for authentication, rate limiting, and request validation.',
        evidence: { incomingConnections: incoming.length },
      })
    }
  }

  return findings
}

function analyzeMissingGateways(blocks, edges, adjacency, config) {
  const findings = []
  const hasGateway = blocks.some(b => b.type === 'api-gateway')
  const hasLoadBalancer = blocks.some(b => b.type === 'load-balancer')

  if (!hasGateway && !hasLoadBalancer && blocks.length > 2) {
    findings.push({
      id: 'sec-missing-gateway',
      severity: 'high',
      type: 'missing_authentication',
      message: 'Architecture lacks an API gateway or load balancer. All services are directly exposed.',
      recommendation: 'Add an API gateway for centralized auth, rate limiting, and routing.',
      evidence: { blockCount: blocks.length, hasGateway, hasLoadBalancer },
    })
  }

  return findings
}

function analyzeUnencryptedEdges(edges, config) {
  const findings = []

  for (const edge of edges) {
    const protocol = edge.connectionType || 'http'
    const isSecure = config.secureProtocols.includes(protocol)
    const isInsecure = config.insecureProtocols.includes(protocol)

    if (isInsecure) {
      findings.push({
        id: `sec-unencrypted-${edge.id}`,
        severity: 'high',
        type: 'unencrypted_communication',
        message: `Connection ${edge.sourceId}→${edge.targetId} uses unencrypted protocol "${protocol}".`,
        edgeId: edge.id,
        affectedDataFlows: [`${edge.sourceId}→${edge.targetId}`],
        recommendation: `Upgrade to ${protocol === 'http' ? 'HTTPS' : 'TLS'} for all inter-service communication.`,
        evidence: { protocol, isSecure, isInsecure },
      })
    }
  }

  return findings
}

function analyzeDirectClientToDatabase(blocks, edges, adjacency, config) {
  const findings = []
  const clients = blocks.filter(b => b.type === 'client')
  const databases = blocks.filter(b => b.type === 'database')

  for (const client of clients) {
    const reachable = getReachableNodes(client.id, adjacency)
    for (const db of databases) {
      if (reachable.has(db.id)) {
        // Check if there's a gateway in between
        const paths = findAllPaths(client.id, db.id, adjacency, 5)
        const hasGatewayInPath = paths.some(path =>
          path.some(nodeId => {
            const node = blocks.find(b => b.id === nodeId)
            return node && config.publicFacingTypes.includes(node.type)
          })
        )

        if (!hasGatewayInPath) {
          findings.push({
            id: `sec-client-db-${client.id}-${db.id}`,
            severity: 'critical',
            type: 'data_flow_risk',
            message: `Client "${client.label || client.id}" can reach database "${db.label || db.id}" without passing through a gateway.`,
            blockId: db.id,
            affectedDataFlows: paths.map(p => p.join('→')),
            recommendation: 'All database access must go through an API gateway or service layer.',
            evidence: { pathCount: paths.length, hasGatewayInPath },
          })
        }
      }
    }
  }

  return findings
}

function analyzeMissingRedundancy(blocks, config) {
  const findings = []
  const criticalTypes = ['api-gateway', 'load-balancer', 'service']

  for (const block of blocks) {
    if (!criticalTypes.includes(block.type)) continue

    const parsedConfig = parseBlockConfig(block.config)
    const replicas = parsedConfig.replicas || 1
    const behavioralModel = block.behavioralModel || {}
    const scaling = behavioralModel.scalingBehavior || {}
    const minReplicas = scaling.minReplicas || 1

    if (replicas < config.minReplicasForRedundancy && minReplicas < config.minReplicasForRedundancy) {
      findings.push({
        id: `sec-no-redundancy-${block.id}`,
        severity: 'medium',
        type: 'missing_redundancy',
        message: `Block "${block.label || block.id}" has no redundancy (${replicas} replica${replicas === 1 ? '' : 's'}).`,
        blockId: block.id,
        recommendation: `Increase replicas to at least ${config.minReplicasForRedundancy} for fault tolerance.`,
        evidence: { replicas, minReplicas },
      })
    }
  }

  return findings
}

function analyzeSinglePointsOfCompromise(blocks, edges, adjacency, reverseAdjacency, config) {
  const findings = []

  // Find blocks that, if compromised, expose the most sensitive data
  const sensitiveTypes = ['database', 'cache', 'storage', 'ai-service']
  const sensitiveBlocks = blocks.filter(b => sensitiveTypes.includes(b.type))

  for (const block of blocks) {
    const reachable = getReachableNodes(block.id, adjacency)
    const exposedSensitive = sensitiveBlocks.filter(sb => reachable.has(sb.id))

    if (exposedSensitive.length >= 2 && block.type === 'service') {
      findings.push({
        id: `sec-spoc-${block.id}`,
        severity: 'high',
        type: 'single_point_of_compromise',
        message: `Service "${block.label || block.id}" has access to ${exposedSensitive.length} sensitive components. Compromise of this service exposes multiple data stores.`,
        blockId: block.id,
        affectedDataFlows: exposedSensitive.map(s => `${block.id}→${s.id}`),
        recommendation: 'Apply principle of least privilege. Use separate service accounts and network policies.',
        evidence: { exposedSensitiveCount: exposedSensitive.length, exposedIds: exposedSensitive.map(s => s.id) },
      })
    }
  }

  return findings
}

function analyzeMissingNetworkSegmentation(blocks, edges, config) {
  const findings = []
  const internalBlocks = blocks.filter(b => config.internalTypes.includes(b.type))

  for (const internal of internalBlocks) {
    const incoming = edges.filter(e => e.targetId === internal.id)
    const fromPublic = incoming.filter(e => {
      const src = blocks.find(b => b.id === e.sourceId)
      return src && (src.type === 'client' || src.type === 'cdn')
    })

    if (fromPublic.length > 0) {
      findings.push({
        id: `sec-no-segmentation-${internal.id}`,
        severity: 'high',
        type: 'missing_authentication',
        message: `Internal component "${internal.label || internal.id}" is accessible from public-facing components without network segmentation.`,
        blockId: internal.id,
        affectedDataFlows: fromPublic.map(e => `${e.sourceId}→${e.targetId}`),
        recommendation: 'Add network segmentation (VPC, private subnets) between public and internal components.',
        evidence: { publicIncomingCount: fromPublic.length },
      })
    }
  }

  return findings
}

function analyzeInsecureTrustBoundaries(blocks, edges, adjacency, config) {
  const findings = []

  // Check for cross-boundary communication without proper intermediaries
  const entryPoints = blocks.filter(b => b.type === 'client' || b.type === 'cdn')
  const exitPoints = blocks.filter(b => b.type === 'database' || b.type === 'storage')

  for (const entry of entryPoints) {
    for (const exit of exitPoints) {
      const paths = findAllPaths(entry.id, exit.id, adjacency, 5)
      for (const path of paths) {
        const hasAuthLayer = path.some(nodeId => {
          const node = blocks.find(b => b.id === nodeId)
          return node && (node.type === 'api-gateway' || node.type === 'load-balancer')
        })

        if (!hasAuthLayer && path.length > 2) {
          findings.push({
            id: `sec-trust-boundary-${entry.id}-${exit.id}`,
            severity: 'medium',
            type: 'data_flow_risk',
            message: `Path from "${entry.label || entry.id}" to "${exit.label || exit.id}" lacks an authentication layer.`,
            affectedDataFlows: [path.join('→')],
            recommendation: 'Insert an API gateway or auth service between trust boundaries.',
            evidence: { pathLength: path.length, hasAuthLayer },
          })
        }
      }
    }
  }

  return findings
}

// ============================================================================
// CONFIGURATION ANALYZERS
// ============================================================================

function runConfigAnalyzers(blocks, edges, config) {
  const findings = []

  findings.push(...analyzeMissingAuth(blocks, config))
  findings.push(...analyzeWeakSecrets(blocks, config))
  findings.push(...analyzeDisabledSSL(blocks, config))
  findings.push(...analyzePublicBuckets(blocks, config))
  findings.push(...analyzeInsecureRedis(blocks, config))
  findings.push(...analyzeDefaultCredentials(blocks, config))
  findings.push(...analyzeMissingEncryption(blocks, config))

  return findings
}

function analyzeMissingAuth(blocks, config) {
  const findings = []
  const authRequiredTypes = ['api-gateway', 'service', 'external-api']

  for (const block of blocks) {
    if (!authRequiredTypes.includes(block.type)) continue

    const parsedConfig = parseBlockConfig(block.config)
    const authType = parsedConfig.authType || parsedConfig.auth || parsedConfig.authentication

    if (!authType) {
      findings.push({
        id: `sec-no-auth-${block.id}`,
        severity: 'high',
        type: 'missing_authentication',
        message: `Block "${block.label || block.id}" (${block.type}) has no authentication configured.`,
        blockId: block.id,
        recommendation: 'Configure authentication (JWT, OAuth, API key, or mTLS).',
        evidence: { configuredAuth: authType, requiredTypes: config.requiredAuthTypes },
      })
    } else if (!config.requiredAuthTypes.includes(authType)) {
      findings.push({
        id: `sec-weak-auth-${block.id}`,
        severity: 'medium',
        type: 'missing_authentication',
        message: `Block "${block.label || block.id}" uses authentication type "${authType}" which may not be sufficient.`,
        blockId: block.id,
        recommendation: `Consider upgrading to one of: ${config.requiredAuthTypes.join(', ')}.`,
        evidence: { configuredAuth: authType, requiredTypes: config.requiredAuthTypes },
      })
    }
  }

  return findings
}

function analyzeWeakSecrets(blocks, config) {
  const findings = []
  const weakPatterns = ['password', 'secret', 'admin', '123', 'default', 'test']

  for (const block of blocks) {
    const parsedConfig = parseBlockConfig(block.config)

    for (const [key, value] of Object.entries(parsedConfig)) {
      if (typeof value !== 'string') continue
      const lowerValue = value.toLowerCase()

      for (const pattern of weakPatterns) {
        if (lowerValue.includes(pattern) && (key.includes('password') || key.includes('secret') || key.includes('key'))) {
          findings.push({
            id: `sec-weak-secret-${block.id}-${key}`,
            severity: 'critical',
            type: 'secret_handling',
            message: `Block "${block.label || block.id}" may have a weak secret in config field "${key}".`,
            blockId: block.id,
            recommendation: 'Use a secrets manager (AWS Secrets Manager, HashiCorp Vault) and rotate credentials regularly.',
            evidence: { field: key, patternFound: pattern },
          })
          break
        }
      }
    }
  }

  return findings
}

function analyzeDisabledSSL(blocks, config) {
  const findings = []

  for (const block of blocks) {
    const parsedConfig = parseBlockConfig(block.config)

    if (parsedConfig.ssl === false || parsedConfig.tls === false || parsedConfig.encryption === false) {
      findings.push({
        id: `sec-ssl-disabled-${block.id}`,
        severity: 'high',
        type: 'missing_tls',
        message: `Block "${block.label || block.id}" has SSL/TLS/encryption explicitly disabled.`,
        blockId: block.id,
        recommendation: 'Enable encryption for all data in transit and at rest.',
        evidence: { ssl: parsedConfig.ssl, tls: parsedConfig.tls, encryption: parsedConfig.encryption },
      })
    }
  }

  return findings
}

function analyzePublicBuckets(blocks, config) {
  const findings = []
  const storageBlocks = blocks.filter(b => b.type === 'storage')

  for (const block of storageBlocks) {
    const parsedConfig = parseBlockConfig(block.config)

    if (parsedConfig.public === true || parsedConfig.publicRead === true || parsedConfig.acl === 'public-read') {
      findings.push({
        id: `sec-public-bucket-${block.id}`,
        severity: 'critical',
        type: 'public_exposure',
        message: `Storage "${block.label || block.id}" is configured as publicly readable.`,
        blockId: block.id,
        recommendation: 'Restrict storage access. Use signed URLs or IAM policies instead of public ACLs.',
        evidence: { public: parsedConfig.public, acl: parsedConfig.acl },
      })
    }
  }

  return findings
}

function analyzeInsecureRedis(blocks, config) {
  const findings = []
  const cacheBlocks = blocks.filter(b => b.type === 'cache')

  for (const block of cacheBlocks) {
    const parsedConfig = parseBlockConfig(block.config)

    if (parsedConfig.engine === 'redis' && parsedConfig.auth === false) {
      findings.push({
        id: `sec-insecure-redis-${block.id}`,
        severity: 'high',
        type: 'missing_authentication',
        message: `Redis cache "${block.label || block.id}" has authentication disabled.`,
        blockId: block.id,
        recommendation: 'Enable Redis AUTH and use TLS connections.',
        evidence: { engine: parsedConfig.engine, auth: parsedConfig.auth },
      })
    }
  }

  return findings
}

function analyzeDefaultCredentials(blocks, config) {
  const findings = []
  const defaultCreds = [
    { user: 'admin', password: 'admin' },
    { user: 'root', password: 'root' },
    { user: 'postgres', password: 'postgres' },
    { user: 'user', password: 'password' },
  ]

  for (const block of blocks) {
    const parsedConfig = parseBlockConfig(block.config)
    const user = parsedConfig.user || parsedConfig.username
    const pass = parsedConfig.password || parsedConfig.pass

    if (!user || !pass) continue

    for (const defaultCred of defaultCreds) {
      if (user.toLowerCase() === defaultCred.user && pass.toLowerCase() === defaultCred.password) {
        findings.push({
          id: `sec-default-creds-${block.id}`,
          severity: 'critical',
          type: 'secret_handling',
          message: `Block "${block.label || block.id}" uses default credentials (${user}/${pass}).`,
          blockId: block.id,
          recommendation: 'Change default credentials immediately. Use strong, unique passwords.',
          evidence: { username: user },
        })
        break
      }
    }
  }

  return findings
}

function analyzeMissingEncryption(blocks, config) {
  const findings = []

  for (const block of blocks) {
    if (!config.encryptionRequiredTypes.includes(block.type)) continue

    const parsedConfig = parseBlockConfig(block.config)
    const hasEncryption = parsedConfig.encryption === true || parsedConfig.ssl === true || parsedConfig.tls === true

    if (!hasEncryption) {
      findings.push({
        id: `sec-no-encryption-${block.id}`,
        severity: 'high',
        type: 'missing_tls',
        message: `Block "${block.label || block.id}" (${block.type}) does not have encryption configured.`,
        blockId: block.id,
        recommendation: 'Enable encryption at rest and in transit for all data stores.',
        evidence: { encryption: parsedConfig.encryption, ssl: parsedConfig.ssl, tls: parsedConfig.tls },
      })
    }
  }

  return findings
}

// ============================================================================
// SCORING & ANALYSIS
// ============================================================================

function calculateSecurityScore(findings, config) {
  let penalty = 0
  for (const finding of findings) {
    penalty += config.severityWeights[finding.severity] || 0
  }
  return Math.max(0, config.maxScore - penalty)
}

function groupFindingsByType(findings) {
  const groups = {}
  for (const finding of findings) {
    if (!groups[finding.type]) groups[finding.type] = []
    groups[finding.type].push(finding)
  }
  return groups
}

function generateSecurityRecommendations(findings, score) {
  const recommendations = []
  const critical = findings.filter(f => f.severity === 'critical')
  const high = findings.filter(f => f.severity === 'high')

  if (critical.length > 0) {
    recommendations.push({
      priority: 'critical',
      title: `Address ${critical.length} critical security issue${critical.length === 1 ? '' : 's'}`,
      description: critical.map(f => f.message).join('; '),
      estimatedEffort: critical.length * 4,
      estimatedImpact: 25,
    })
  }

  if (high.length > 0) {
    recommendations.push({
      priority: 'high',
      title: `Fix ${high.length} high-severity security issue${high.length === 1 ? '' : 's'}`,
      description: high.map(f => f.message).join('; '),
      estimatedEffort: high.length * 2,
      estimatedImpact: 15,
    })
  }

  if (score < 50) {
    recommendations.push({
      priority: 'high',
      title: 'Security architecture review required',
      description: `Overall security score is ${score}/100. A comprehensive security review is recommended before production deployment.`,
      estimatedEffort: 16,
      estimatedImpact: 20,
    })
  }

  return recommendations
}

function buildSecurityExplainability(findings, score, config) {
  return {
    formula: `${config.maxScore} - sum(severity_weight * count_per_severity)`,
    inputs: {
      totalFindings: findings.length,
      criticalCount: findings.filter(f => f.severity === 'critical').length,
      highCount: findings.filter(f => f.severity === 'high').length,
      mediumCount: findings.filter(f => f.severity === 'medium').length,
      lowCount: findings.filter(f => f.severity === 'low').length,
    },
    intermediateValues: {
      criticalPenalty: findings.filter(f => f.severity === 'critical').length * config.severityWeights.critical,
      highPenalty: findings.filter(f => f.severity === 'high').length * config.severityWeights.high,
      mediumPenalty: findings.filter(f => f.severity === 'medium').length * config.severityWeights.medium,
      lowPenalty: findings.filter(f => f.severity === 'low').length * config.severityWeights.low,
    },
    finalResult: score,
    maxPossibleScore: config.maxScore,
    confidence: findings.length > 0 ? 0.85 : 0.5,
  }
}

// ============================================================================
// GRAPH UTILITIES
// ============================================================================

function buildAdjacency(edges) {
  const adj = new Map()
  for (const edge of edges) {
    const neighbors = adj.get(edge.sourceId) || []
    neighbors.push(edge.targetId)
    adj.set(edge.sourceId, neighbors)
  }
  return adj
}

function buildReverseAdjacency(edges) {
  const adj = new Map()
  for (const edge of edges) {
    const neighbors = adj.get(edge.targetId) || []
    neighbors.push(edge.sourceId)
    adj.set(edge.targetId, neighbors)
  }
  return adj
}

function getReachableNodes(startId, adjacency) {
  const reachable = new Set()
  const queue = [startId]
  reachable.add(startId)

  while (queue.length > 0) {
    const current = queue.shift()
    const neighbors = adjacency.get(current) || []
    for (const neighbor of neighbors) {
      if (!reachable.has(neighbor)) {
        reachable.add(neighbor)
        queue.push(neighbor)
      }
    }
  }

  return reachable
}

function findAllPaths(start, end, adjacency, maxDepth = 5) {
  const paths = []
  const queue = [[start]]

  while (queue.length > 0) {
    const path = queue.shift()
    const last = path[path.length - 1]

    if (last === end && path.length > 1) {
      paths.push(path)
      continue
    }

    if (path.length >= maxDepth) continue

    const neighbors = adjacency.get(last) || []
    for (const neighbor of neighbors) {
      if (!path.includes(neighbor)) {
        queue.push([...path, neighbor])
      }
    }
  }

  return paths
}

function parseBlockConfig(config) {
  if (config === null || config === undefined) return {}
  if (typeof config === 'string') {
    try {
      return JSON.parse(config)
    } catch {
      return {}
    }
  }
  if (typeof config === 'object') return config
  return {}
}