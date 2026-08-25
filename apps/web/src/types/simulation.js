/**
 * Simulation Data Models
 * 
 * Comprehensive type definitions for the architecture simulation platform.
 * These types enforce structure, enable validation, and provide
 * explainability by making every field explicit and documented.
 * 
 * All simulation inputs, outputs, and intermediate states are typed here.
 */

// ============================================================================
// CORE SIMULATION CONFIGURATION
// ============================================================================

/**
 * @typedef {Object} SimulationConfig
 * @property {string} designId — ID of the architecture design being simulated
 * @property {string} [simulationId] — Auto-generated unique simulation run ID
 * @property {string} userId — Clerk ID of the user who initiated the simulation
 * @property {number} seed — Deterministic seed for reproducibility
 * @property {number} duration — Simulation duration in simulated seconds (1-1800)
 * @property {number} rps — Base requests per second (10-10000)
 * @property {TrafficPattern} trafficPattern — Traffic distribution over time
 * @property {FailureScenario} [scenario] — Optional failure injection scenario
 * @property {number} monteCarloPasses — Number of Monte Carlo passes (1-1000)
 * @property {number} confidenceLevel — Statistical confidence level (0.90-0.999)
 * @property {GrowthScenario} [growthScenario] — Optional traffic growth multiplier
 * @property {boolean} generateReport — Whether to generate a structured report
 * @property {string} engineVersion — Version of the simulation engine
 * @property {string} reportVersion — Version of the report schema
 * @property {Object} assumptions — Explicit assumptions made during simulation
 * @property {Date} startedAt — When the simulation started
 */

/**
 * @typedef {Object} TrafficPattern
 * @property {('constant'|'bursty'|'spiky'|'seasonal'|'randomized'|'custom')} type
 * @property {Object} params — Pattern-specific parameters
 * @property {number} [params.burstFactor] — For bursty: peak multiplier
 * @property {number} [params.burstDuration] — For bursty: burst length in seconds
 * @property {number} [params.burstInterval] — For bursty: interval between bursts
 * @property {number} [params.spikeFactor] — For spiky: spike multiplier
 * @property {number} [params.spikeProbability] — For spiky: probability of spike per second
 * @property {number} [params.seasonalPeriod] — For seasonal: period in seconds
 * @property {number} [params.seasonalAmplitude] — For seasonal: amplitude multiplier
 * @property {number} [params.randomSeed] — For randomized: separate seed for traffic randomness
 * @property {Array<{time: number, rps: number}>} [params.customCurve] — For custom: user-defined points
 */

/**
 * @typedef {Object} FailureScenario
 * @property {('none'|'network_partition'|'dns_failure'|'service_crash'|'service_slowdown'|'memory_leak'|'resource_exhaustion'|'db_connection_exhaustion'|'db_replication_lag'|'db_lock_contention'|'db_storage_saturation'|'queue_overflow'|'consumer_lag'|'message_loss'|'external_timeout'|'external_rate_limit'|'external_outage'|'region_outage'|'ddos')} type
 * @property {number} [startTime] — When the failure begins (seconds into simulation)
 * @property {number} [duration] — How long the failure lasts (seconds)
 * @property {string} [targetBlockId] — Specific block to target (null = random/system-wide)
 * @property {string} [targetEdgeId] — Specific connection to target
 * @property {number} [severity] — Failure severity 0.0-1.0
 * @property {Object} [params] — Scenario-specific parameters
 */

/**
 * @typedef {Object} GrowthScenario
 * @property {number} multiplier — Traffic multiplier (1.0 = baseline)
 * @property {number} [rampDuration] — How long to ramp to multiplier (seconds)
 * @property {('linear'|'exponential'|'step')} [rampCurve] — Ramp curve shape
 */

// ============================================================================
// ARCHITECTURE REPRESENTATION (Simulation-Ready)
// ============================================================================

/**
 * @typedef {Object} SimulatedArchitecture
 * @property {string} id — Design ID
 * @property {string} name — Design name
 * @property {string} version — Snapshot version (hash of architecture state)
 * @property {Date} snapshotAt — When the snapshot was taken
 * @property {Array<SimulatedBlock>} blocks — All components in the architecture
 * @property {Array<SimulatedEdge>} edges — All connections in the architecture
 * @property {Array<ValidationFinding>} validationFindings — Pre-simulation validation results
 * @property {number} validationScore — 0.0-1.0, simulation only runs if >= 1.0 (no critical errors)
 */

/**
 * @typedef {Object} SimulatedBlock
 * @property {string} id — Unique block ID
 * @property {string} type — Block type (api-gateway, service, database, etc.)
 * @property {string} label — Display label
 * @property {BlockIdentity} identity — Identity metadata
 * @property {BlockCapacity} capacity — Throughput and connection limits
 * @property {BlockLatency} latency — Latency characteristics
 * @property {BlockErrorCharacteristics} errorCharacteristics — Error behavior
 * @property {BlockAvailability} availability — Reliability characteristics
 * @property {BlockResourceConsumption} resourceConsumption — Resource usage model
 * @property {BlockCostProfile} costProfile — Cost model
 * @property {BlockScalingBehavior} scalingBehavior — Auto-scaling configuration
 * @property {BlockFailureCharacteristics} failureCharacteristics — Failure modes
 * @property {Object} rawConfig — Original config from canvas store (for audit)
 * @property {number} x — Canvas X position
 * @property {number} y — Canvas Y position
 */

/**
 * @typedef {Object} BlockIdentity
 * @property {string} type — Component type
 * @property {string} version — Version string (e.g., "v2.1.0")
 * @property {string} [name] — Human-readable name
 * @property {string} [description] — Description
 */

/**
 * @typedef {Object} BlockCapacity
 * @property {number} maxThroughput — Max requests per second the block can handle
 * @property {number} maxConcurrent — Max concurrent connections/requests
 * @property {number} maxQueueDepth — Max queue depth before dropping
 * @property {number} [maxConnections] — For databases: max DB connections
 * @property {number} [maxPartitions] — For queues: max partitions
 */

/**
 * @typedef {Object} BlockLatency
 * @property {number} baseLatencyMs — Base processing latency in milliseconds
 * @property {number} latencyStdDevMs — Standard deviation of latency
 * @property {number} [serializationMs] — Serialization overhead
 * @property {number} [deserializationMs] — Deserialization overhead
 * @property {number} [queueLatencyMs] — Base queue waiting time
 * @property {number} [dbOperationMs] — Database operation latency
 * @property {number} [cacheHitLatencyMs] — Cache hit latency
 * @property {number} [cacheMissLatencyMs] — Cache miss latency
 * @property {number} [cacheHitRate] — Expected cache hit rate (0.0-1.0)
 */

/**
 * @typedef {Object} BlockErrorCharacteristics
 * @property {number} baseErrorRate — Base error probability (0.0-1.0)
 * @property {number} errorRateUnderLoad — Error rate at 100% utilization
 * @property {('uniform'|'exponential'|'burst')} errorDistribution — How errors are distributed
 * @property {Array<string>} [errorTypes] — Types of errors this block can produce
 */

/**
 * @typedef {Object} BlockAvailability
 * @property {number} slaTarget — Target availability (0.0-1.0, e.g., 0.9999)
 * @property {number} [historicalAvailability] — Observed historical availability
 * @property {number} [mttrMinutes] — Mean time to recovery in minutes
 * @property {number} [mtbfHours] — Mean time between failures in hours
 */

/**
 * @typedef {Object} BlockResourceConsumption
 * @property {number} cpuPerRequest — CPU milliseconds per request
 * @property {number} memoryPerConnection — Memory bytes per active connection
 * @property {number} [storagePerRequest] — Storage bytes per request
 * @property {number} [networkIngressPerRequest] — Ingress bytes per request
 * @property {number} [networkEgressPerRequest] — Egress bytes per request
 * @property {number} [threadPoolSize] — Thread pool size
 * @property {number} [connectionPoolSize] — Connection pool size
 */

/**
 * @typedef {Object} BlockCostProfile
 * @property {number} [hourlyComputeCost] — Cost per hour of operation
 * @property {number} [perRequestCost] — Cost per request processed
 * @property {number} [perGbNetworkCost] — Network cost per GB
 * @property {number} [storageCostPerGbMonth] — Storage cost per GB/month
 */

/**
 * @typedef {Object} BlockScalingBehavior
 * @property {('none'|'horizontal'|'vertical'|'auto')} type — Scaling type
 * @property {number} [scaleUpThreshold] — Utilization % to trigger scale-up
 * @property {number} [scaleDownThreshold] — Utilization % to trigger scale-down
 * @property {number} [scaleUpCooldownSeconds] — Cooldown between scale-ups
 * @property {number} [scaleDownCooldownSeconds] — Cooldown between scale-downs
 * @property {number} [maxReplicas] — Max replicas for horizontal scaling
 * @property {number} [minReplicas] — Min replicas for horizontal scaling
 * @property {number} [scaleUpIncrement] — Replicas to add per scale-up
 */

/**
 * @typedef {Object} BlockFailureCharacteristics
 * @property {Array<FailureMode>} failureModes — Possible failure modes
 * @property {number} [failureProbabilityPerHour] — Base failure probability
 * @property {number} [recoveryProbabilityPerMinute] — Probability of spontaneous recovery
 */

/**
 * @typedef {Object} FailureMode
 * @property {string} id — Failure mode ID
 * @property {string} name — Human-readable name
 * @property {string} description — What happens during this failure
 * @property {number} probability — Relative probability of this mode
 * @property {number} latencyMultiplier — Latency multiplier during failure
 * @property {number} errorRate — Error rate during failure
 * @property {number} throughputMultiplier — Throughput multiplier during failure
 * @property {number} [affectedDownstreamBlocks] — How many downstream blocks are affected
 */

// ============================================================================
// CONNECTION MODELING
// ============================================================================

/**
 * @typedef {Object} SimulatedEdge
 * @property {string} id — Unique edge ID
 * @property {string} sourceId — Source block ID
 * @property {string} targetId — Target block ID
 * @property {ConnectionIdentity} identity — Connection metadata
 * @property {ConnectionTransport} transport — Transport layer characteristics
 * @property {ConnectionOverhead} overhead — Serialization/encryption/compression
 * @property {ConnectionNetwork} network — Network characteristics
 * @property {ConnectionReliability} reliability — Retry, timeout, circuit breaker
 * @property {ConnectionThroughput} throughput — Throughput limits
 * @property {Object} rawConfig — Original config from canvas store
 */

/**
 * @typedef {Object} ConnectionIdentity
 * @property {('http'|'https'|'rest'|'graphql'|'websocket'|'grpc'|'kafka'|'rabbitmq'|'amqp'|'mqtt'|'tcp'|'udp'|'sftp'|'event_stream')} protocol
 * @property {string} [protocolVersion] — e.g., "HTTP/2", "gRPC/1.5"
 * @property {string} [description] — Human-readable description
 */

/**
 * @typedef {Object} ConnectionTransport
 * @property {('tcp'|'udp'|'quic'|'tls'|'plaintext')} type
 * @property {number} [handshakeMs] — Connection handshake latency
 * @property {boolean} [keepAlive] — Whether connections are reused
 * @property {number} [keepAliveTimeoutMs] — Keep-alive timeout
 */

/**
 * @typedef {Object} ConnectionOverhead
 * @property {number} serializationMs — Serialization time per request
 * @property {number} deserializationMs — Deserialization time per request
 * @property {number} [encryptionMs] — Encryption overhead per request
 * @property {number} [decryptionMs] — Decryption overhead per request
 * @property {number} [compressionRatio] — Compression ratio (0.0-1.0, lower = more compressed)
 * @property {number} [compressionMs] — Compression time per request
 * @property {number} [decompressionMs] — Decompression time per request
 */

/**
 * @typedef {Object} ConnectionNetwork
 * @property {number} baseLatencyMs — Base network RTT in milliseconds
 * @property {number} jitterMs — Network jitter (std dev)
 * @property {number} packetLossRate — Packet loss probability (0.0-1.0)
 * @property {number} [bandwidthMbps] — Bandwidth limit in Mbps
 * @property {number} [mtuBytes] — Maximum transmission unit
 */

/**
 * @typedef {Object} ConnectionReliability
 * @property {number} maxRetries — Max retry attempts
 * @property {number} retryBackoffMs — Initial retry backoff in ms
 * @property {number} retryBackoffMultiplier — Exponential backoff multiplier
 * @property {number} timeoutMs — Request timeout in milliseconds
 * @property {boolean} circuitBreakerEnabled — Whether circuit breaker is active
 * @property {number} [circuitBreakerThreshold] — Error rate to open circuit
 * @property {number} [circuitBreakerRecoveryMs] — Time before half-open
 * @property {number} [circuitBreakerHalfOpenRequests] — Requests to test in half-open
 */

/**
 * @typedef {Object} ConnectionThroughput
 * @property {number} maxRps — Max requests per second through this connection
 * @property {number} [maxConcurrent] — Max concurrent requests
 * @property {number} [maxPayloadBytes] — Max payload size in bytes
 */

// ============================================================================
// VALIDATION FINDINGS
// ============================================================================

/**
 * @typedef {Object} ValidationFinding
 * @property {string} id — Unique finding ID
 * @property {('critical'|'warning'|'info'|'risk')} severity
 * @property {('empty_architecture'|'missing_nodes'|'broken_edges'|'invalid_references'|'invalid_config'|'negative_capacity'|'negative_latency'|'impossible_value'|'unsupported_protocol'|'isolated_node'|'dead_end'|'cycle'|'traffic_black_hole'|'redundant_path'|'unused_service'|'excessive_fan_out'|'excessive_fan_in'|'single_point_of_failure'|'missing_redundancy'|'tight_coupling'|'cascading_dependency'|'resource_concentration'|'missing_entry_point'|'missing_exit_point'|'orphaned_node'|'unreachable_node'|'duplicate_edge'|'duplicate_node'|'configuration_corruption')} type
 * @property {string} message — Human-readable description
 * @property {string} [blockId] — Related block ID (legacy — prefer elementId + elementType)
 * @property {string} [edgeId] — Related edge ID (legacy — prefer elementId + elementType)
 * @property {string} [elementId] — Unified element reference (block ID or edge ID). Preferred over blockId/edgeId.
 * @property {('node'|'edge')} [elementType] — Type of element referenced by elementId. Required when elementId is used.
 * @property {Array<string>} [affectedBlockIds] — All affected blocks
 * @property {Object} [details] — Additional structured data
 * @property {string} [recommendation] — Suggested fix
 */

/**
 * @typedef {Object} ValidationHighlight
 * @property {string} elementId — Block ID or edge ID to highlight on the canvas
 * @property {('node'|'edge')} elementType — Type of canvas element
 * @property {string} findingId — ID of the ValidationFinding that triggered this highlight
 * @property {('critical'|'warning'|'info'|'risk')} severity — Severity level for styling
 */

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} canSimulate — True only if no critical errors
 * @property {number} criticalCount
 * @property {number} warningCount
 * @property {number} riskCount
 * @property {number} infoCount
 * @property {Array<ValidationFinding>} findings
 * @property {number} topologyScore — 0.0-1.0 structural quality score
 * @property {number} confidenceScore — 0.0-1.0 data completeness score
 */

// ============================================================================
// SIMULATION EVENTS (Discrete Event Simulation)
// ============================================================================

/**
 * @typedef {Object} SimulationEvent
 * @property {number} time — Event timestamp in simulated seconds
 * @property {('request_arrival'|'request_complete'|'request_failed'|'request_dropped'|'queue_enqueue'|'queue_dequeue'|'resource_allocate'|'resource_release'|'failure_start'|'failure_end'|'scale_up'|'scale_down'|'timeout'|'retry'|'circuit_open'|'circuit_close'|'circuit_half_open')} type
 * @property {string} [blockId] — Affected block
 * @property {string} [edgeId] — Affected edge
 * @property {string} [requestId] — Related request ID
 * @property {Object} [data] — Event-specific data
 */

/**
 * @typedef {Object} SimulatedRequest
 * @property {string} id — Unique request ID
 * @property {number} arrivalTime — When the request arrived at the entry point
 * @property {number} [completionTime] — When the request completed
 * @property {number} [dropTime] — When the request was dropped
 * @property {('pending'|'processing'|'completed'|'failed'|'dropped'|'timeout')} status
 * @property {Array<RequestHop>} hops — Path through the architecture
 * @property {number} [totalLatencyMs] — End-to-end latency
 * @property {string} [failureReason] — Why the request failed
 */

/**
 * @typedef {Object} RequestHop
 * @property {string} blockId — Block visited
 * @property {string} [edgeId] — Edge traversed to reach this block
 * @property {number} arrivalTime — When request arrived at this block
 * @property {number} [departureTime] — When request left this block
 * @property {number} [latencyMs] — Time spent at this block
 * @property {number} [queueTimeMs] — Time spent in queue
 * @property {number} [processingTimeMs] — Time spent processing
 * @property {boolean} [failed] — Whether this hop failed
 * @property {string} [failureReason] — Why this hop failed
 */

// ============================================================================
// SIMULATION RESULTS
// ============================================================================

/**
 * @typedef {Object} SimulationResult
 * @property {string} id — Simulation run ID
 * @property {string} designId
 * @property {string} userId
 * @property {SimulationConfig} config — Exact config used
 * @property {SimulatedArchitecture} inputSnapshot — Architecture state at start
 * @property {('running'|'completed'|'stopped'|'failed'|'validated')} status
 * @property {number} progress — 0.0-100.0
 * @property {number} actualDurationMs — Wall-clock time the simulation took
 * @property {number} simulatedDurationSeconds — Simulated time elapsed
 * @property {PerBlockMetrics} blockMetrics — Metrics per block
 * @property {GlobalMetrics} globalMetrics — Architecture-wide metrics
 * @property {Array<SimulationEvent>} [events] — Key events (sampled for large sims)
 * @property {Array<SimulatedRequest>} [sampledRequests] — Sample of requests for analysis
 * @property {ValidationResult} validationResult — Pre-simulation validation
 * @property {number} confidenceScore — 0.0-1.0 trust in results
 * @property {Object} assumptions — Assumptions used
 * @property {string} engineVersion
 * @property {string} reportVersion
 * @property {Date} startedAt
 * @property {Date} [completedAt]
 * @property {string} [errorMessage] — If status is 'failed'
 *
 * NOTE: Derived analyses (reliability, scalability, cost, security) are
 * available on SimulationReport, not on SimulationResult.
 */

/**
 * @typedef {Object} BlockMetrics
 * @property {number} totalRequests — Total requests received
 * @property {number} successfulRequests — Requests that completed successfully
 * @property {number} failedRequests — Requests that failed
 * @property {number} droppedRequests — Requests dropped (queue full, timeout)
 * @property {number} throughputRps — Average throughput in RPS
 * @property {LatencyDistribution} latency — Full latency distribution
 * @property {number} avgLatencyMs — Average latency
 * @property {number} p50LatencyMs
 * @property {number} p75LatencyMs
 * @property {number} p90LatencyMs
 * @property {number} p95LatencyMs
 * @property {number} p99LatencyMs
 * @property {number} p999LatencyMs
 * @property {number} minLatencyMs
 * @property {number} maxLatencyMs
 * @property {ResourceUtilization} resources — Resource usage
 * @property {number} queueDepth — Average queue depth
 * @property {number} maxQueueDepth — Peak queue depth
 * @property {number} queueDropRate — Rate of queue-full drops
 * @property {number} errorRate — Error rate (0.0-1.0)
 * @property {number} availability — Availability %
 * @property {number} utilization — Utilization (0.0-1.0)
 * @property {number} saturationPoint — RPS at which utilization reaches 1.0
 * @property {Array<FailureEvent>} [failureEvents] — Failures that affected this block
 * @property {number} [currentReplicas] — Current replica count (for auto-scaling)
 */

/**
 * @typedef {Object} LatencyDistribution
 * @property {Array<number>} samples — All latency samples (or histogram bins)
 * @property {number} mean
 * @property {number} median
 * @property {number} stdDev
 * @property {number} min
 * @property {number} max
 * @property {Object} percentiles — { p50, p75, p90, p95, p99, p999 }
 */

/**
 * @typedef {Object} ResourceUtilization
 * @property {number} cpuPercent — Average CPU utilization
 * @property {number} cpuPeakPercent — Peak CPU utilization
 * @property {number} memoryPercent — Average memory utilization
 * @property {number} memoryPeakPercent — Peak memory utilization
 * @property {number} storagePercent — Average storage utilization
 * @property {number} networkIngressMbps — Average ingress
 * @property {number} networkEgressMbps — Average egress
 * @property {number} threadPoolUtilization — Thread pool usage
 * @property {number} connectionPoolUtilization — Connection pool usage
 */

/**
 * @typedef {Object} GlobalMetrics
 * @property {number} totalRequests — Total requests generated
 * @property {number} successfulRequests
 * @property {number} failedRequests
 * @property {number} droppedRequests
 * @property {number} throughputRps — End-to-end throughput
 * @property {number} avgLatencyMs — End-to-end average latency
 * @property {number} p95LatencyMs
 * @property {number} p99LatencyMs
 * @property {number} errorRate — Global error rate
 * @property {number} availability — Global availability %
 * @property {number} totalSimulatedCost — Estimated cost for simulation duration
 * @property {number} [projectedMonthlyCost] — Extrapolated monthly cost
 * @property {number} [projectedAnnualCost] — Extrapolated annual cost
 */

/**
 * @typedef {Object} FailureEvent
 * @property {number} startTime — Simulated seconds
 * @property {number} [endTime] — Simulated seconds
 * @property {string} type — Failure mode type
 * @property {string} [blockId] — Affected block
 * @property {string} [edgeId] — Affected edge
 * @property {number} severity — 0.0-1.0
 * @property {number} requestsAffected — Count of affected requests
 */

// ============================================================================
// ANALYSIS RESULTS
// ============================================================================

/**
 * @typedef {Object} ReliabilityAnalysis
 * @property {number} availability — Predicted availability (0.0-1.0)
 * @property {number} reliabilityScore — 0.0-100
 * @property {number} mttrMinutes — Mean time to recovery
 * @property {number} mtbfHours — Mean time between failures
 * @property {number} failureProbabilityPerDay — Probability of any failure in 24h
 * @property {Array<string>} singlePointsOfFailure — Block IDs that are SPOFs
 * @property {Array<FailureChain>} failureChains — Cascading failure paths
 * @property {Array<BlastRadius>} blastRadiuses — Impact of each block failing
 * @property {number} resilienceScore — 0.0-100
 * @property {Array<ValidationFinding>} risks — Reliability-specific risks
 */

/**
 * @typedef {Object} FailureChain
 * @property {string} id — Chain ID
 * @property {Array<string>} blockIds — Blocks in the chain (order = propagation)
 * @property {number} probability — Probability of this chain occurring
 * @property {number} maxImpact — Max requests affected
 * @property {string} description — Human-readable explanation
 */

/**
 * @typedef {Object} BlastRadius
 * @property {string} blockId — The failing block
 * @property {number} directlyAffectedBlocks — Count of immediate downstream blocks
 * @property {number} indirectlyAffectedBlocks — Count of all downstream blocks
 * @property {number} estimatedRequestsAffected — Requests that would fail
 * @property {number} estimatedAvailabilityImpact — Availability drop %
 */

/**
 * @typedef {Object} ScalabilityAnalysis
 * @property {number} scalabilityScore — 0.0-100
 * @property {Array<CapacityLimit>} capacityLimits — Where the architecture breaks
 * @property {Array<SaturationPoint>} saturationPoints — When components saturate
 * @property {Array<GrowthProjection>} growthProjections — Predictions at multipliers
 * @property {boolean} supportsHorizontalScaling
 * @property {boolean} supportsVerticalScaling
 * @property {boolean} supportsAutoScaling
 * @property {Array<ValidationFinding>} bottlenecks — Scalability bottlenecks
 */

/**
 * @typedef {Object} CapacityLimit
 * @property {string} blockId — The limiting block
 * @property {number} maxRps — RPS at which this block fails
 * @property {string} limitingFactor — What resource runs out
 * @property {string} description — Human-readable explanation
 */

/**
 * @typedef {Object} SaturationPoint
 * @property {string} blockId
 * @property {number} rpsAtSaturation
 * @property {string} resource — Which resource saturates
 * @property {number} currentUtilization — At baseline RPS
 * @property {number} headroomPercent — Room before saturation
 */

/**
 * @typedef {Object} GrowthProjection
 * @property {number} trafficMultiplier — 2, 5, 10, or custom
 * @property {number} predictedLatencyMs
 * @property {number} predictedErrorRate
 * @property {number} predictedAvailability
 * @property {Array<string>} predictedBottlenecks — Block IDs that will fail first
 * @property {boolean} isSustainable — Can architecture handle this growth?
 */

/**
 * @typedef {Object} CostAnalysis
 * @property {number} currentMonthlyCost
 * @property {number} currentAnnualCost
 * @property {Array<CostBreakdown>} breakdown — Per-component costs
 * @property {Array<CostDriver>} drivers — What drives costs
 * @property {Array<GrowthCostProjection>} growthCosts — Cost at multipliers
 */

/**
 * @typedef {Object} CostBreakdown
 * @property {string} blockId
 * @property {number} computeCost
 * @property {number} storageCost
 * @property {number} networkCost
 * @property {number} [aiCost]
 * @property {number} [externalApiCost]
 * @property {number} [databaseCost]
 * @property {number} [queueCost]
 * @property {number} [monitoringCost]
 * @property {number} totalCost
 */

/**
 * @typedef {Object} CostDriver
 * @property {string} blockId
 * @property {string} resourceType — e.g., "compute", "storage", "network"
 * @property {number} cost
 * @property {number} percentageOfTotal
 * @property {string} recommendation — How to reduce
 */

/**
 * @typedef {Object} SecurityAnalysis
 * @property {number} securityScore — 0.0-100
 * @property {Array<SecurityFinding>} findings
 * @property {number} criticalCount
 * @property {number} highCount
 * @property {number} mediumCount
 * @property {number} lowCount
 */

/**
 * @typedef {Object} SecurityFinding
 * @property {string} id
 * @property {('critical'|'high'|'medium'|'low')} severity
 * @property {('unencrypted_communication'|'public_exposure'|'missing_authentication'|'missing_authorization'|'data_flow_risk'|'secret_handling'|'insecure_protocol'|'missing_tls'|'excessive_permissions')} type
 * @property {string} message
 * @property {string} [blockId]
 * @property {string} [edgeId]
 * @property {string} [recommendation]
 * @property {Array<string>} [affectedDataFlows]
 */

// ============================================================================
// REPORT MODEL
// ============================================================================

/**
 * @typedef {Object} SimulationReport
 * @property {string} id — Report ID
 * @property {string} simulationId
 * @property {string} designId
 * @property {string} userId
 * @property {string} version — Report schema version
 * @property {Date} generatedAt
 * @property {number} overallScore — 0.0-100
 * @property {ExecutiveSummary} executiveSummary
 * @property {TopologyAnalysisSection} topologyAnalysis
 * @property {PerformanceAnalysisSection} performanceAnalysis
 * @property {ReliabilityAnalysisSection} reliabilityAnalysis
 * @property {ScalabilityAnalysisSection} scalabilityAnalysis
 * @property {CostAnalysisSection} [costAnalysis]
 * @property {SecurityAnalysisSection} [securityAnalysis]
 * @property {FailureScenariosSection} failureScenarios
 * @property {AIInsightsSection} aiInsights
 * @property {ActionPlanSection} actionPlan
 * @property {Object} metadata — Engine version, assumptions, confidence
 */

/**
 * @typedef {Object} ExecutiveSummary
 * @property {number} architectureScore — 0.0-100
 * @property {number} reliabilityScore
 * @property {number} performanceScore
 * @property {number} costScore
 * @property {number} securityScore
 * @property {number} confidenceScore
 * @property {string} summary — One-paragraph executive summary
 * @property {string} [keyFinding] — Most important finding
 * @property {string} [keyRecommendation] — Most important action
 */

/**
 * @typedef {Object} TopologyAnalysisSection
 * @property {number} nodeCount
 * @property {number} edgeCount
 * @property {number} avgFanOut
 * @property {number} maxFanOut
 * @property {number} avgFanIn
 * @property {number} maxFanIn
 * @property {number} cyclomaticComplexity
 * @property {Array<ValidationFinding>} criticalErrors
 * @property {Array<ValidationFinding>} warnings
 * @property {Array<ValidationFinding>} risks
 * @property {string} graphStructureSummary
 */

/**
 * @typedef {Object} PerformanceAnalysisSection
 * @property {GlobalMetrics} globalMetrics
 * @property {Array<{blockId: string, metrics: BlockMetrics}>} topLatencyBlocks
 * @property {Array<{blockId: string, metrics: BlockMetrics}>} topErrorBlocks
 * @property {Array<{blockId: string, metrics: BlockMetrics}>} topUtilizationBlocks
 * @property {LatencyDistribution} endToEndLatency
 * @property {string} latencyBottleneck — Block ID causing highest latency
 * @property {string} throughputBottleneck — Block ID limiting throughput
 */

/**
 * @typedef {Object} ReliabilityAnalysisSection
 * @property {ReliabilityAnalysis} analysis
 * @property {Array<string>} recommendations
 */

/**
 * @typedef {Object} ScalabilityAnalysisSection
 * @property {ScalabilityAnalysis} analysis
 * @property {Array<string>} recommendations
 */

/**
 * @typedef {Object} CostAnalysisSection
 * @property {CostAnalysis} analysis
 * @property {Array<string>} recommendations
 */

/**
 * @typedef {Object} SecurityAnalysisSection
 * @property {SecurityAnalysis} analysis
 * @property {Array<string>} recommendations
 */

/**
 * @typedef {Object} FailureScenariosSection
 * @property {Array<FailureScenarioResult>} results
 */

/**
 * @typedef {Object} FailureScenarioResult
 * @property {FailureScenario} scenario
 * @property {GlobalMetrics} metricsDuringFailure
 * @property {number} availabilityImpact
 * @property {number} latencyImpactMs
 * @property {Array<string>} affectedBlocks
 * @property {string} impactSummary
 */

/**
 * @typedef {Object} AIInsightsSection
 * @property {Array<AIInsight>} findings
 * @property {Array<AIInsight>} recommendations
 * @property {string} aiModelVersion
 * @property {Date} generatedAt
 */

/**
 * @typedef {Object} AIInsight
 * @property {string} id
 * @property {('bottleneck'|'root_cause'|'optimization'|'risk'|'scalability'|'cost')} category
 * @property {string} title
 * @property {string} description
 * @property {string} evidence — Reference to simulation data supporting this
 * @property {Array<string>} evidenceRefs — Specific metric IDs / block IDs
 * @property {number} confidence — 0.0-1.0
 * @property {('critical'|'high'|'medium'|'low')} priority
 * @property {string} [recommendedAction]
 * @property {number} [predictedImpact] — Predicted improvement if action is taken
 */

/**
 * @typedef {Object} ActionPlanSection
 * @property {Array<ActionItem>} critical
 * @property {Array<ActionItem>} high
 * @property {Array<ActionItem>} medium
 * @property {Array<ActionItem>} low
 * @property {string} summary
 */

/**
 * @typedef {Object} ActionItem
 * @property {string} id
 * @property {string} title
 * @property {string} description
 * @property {string} [blockId] — Target block
 * @property {string} [edgeId] — Target edge
 * @property {number} estimatedEffort — Hours or story points
 * @property {number} estimatedImpact — 0.0-100 improvement in score
 * @property {string} [rationale] — Why this action helps
 * @property {Array<string>} [supportingEvidence] — Links to simulation findings
 */

// ============================================================================
// MONTE CARLO RESULTS
// ============================================================================

/**
 * @typedef {Object} MonteCarloResult
 * @property {number} passes — Number of passes run
 * @property {number} confidenceLevel — e.g., 0.95
 * @property {Object} latencyConfidence — { lowerBound, upperBound, mean, stdDev }
 * @property {Object} throughputConfidence
 * @property {Object} errorRateConfidence
 * @property {Object} availabilityConfidence
 * @property {Array<number>} latencyDistribution — Histogram bins
 * @property {number} worstCaseLatencyMs
 * @property {number} bestCaseLatencyMs
 * @property {number} expectedLatencyMs
 * @property {number} worstCaseErrorRate
 * @property {number} bestCaseErrorRate
 * @property {number} expectedErrorRate
 * @property {number} worstCaseAvailability
 * @property {number} bestCaseAvailability
 * @property {number} expectedAvailability
 */

// ============================================================================
// EXPLAINABILITY
// ============================================================================

/**
 * @typedef {Object} MetricExplanation
 * @property {string} metricId — e.g., "block-123.latency.p95"
 * @property {string} metricName — Human-readable name
 * @property {number} value
 * @property {string} unit — e.g., "ms", "RPS", "%"
 * @property {string} why — Why this value occurred
 * @property {Array<string>} contributingComponents — Block/edge IDs that contributed
 * @property {Array<string>} contributingFactors — e.g., "high_load", "network_partition"
 * @property {Object} assumptions — Assumptions that affected this metric
 * @property {Array<string>} supportingData — References to raw simulation data
 * @property {number} confidence — 0.0-1.0
 */

/**
 * @typedef {Object} SimulationAssumptions
 * @property {Array<{assumption: string, impact: string, confidence: number}>} list
 * @property {number} overallConfidence — 0.0-1.0
 * @property {Array<string>} missingData — What data was not available
 * @property {Array<string>} calibrationNotes — How models were calibrated
 */

export {
  // Re-export for JSDoc consumption — no runtime exports needed
  // Consumers use @typedef imports or import * as SimulationTypes
}