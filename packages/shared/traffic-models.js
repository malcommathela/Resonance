/**
 * Traffic Simulation Models
 *
 * Defines how traffic arrives at the architecture over time.
 * Every pattern is deterministic (seeded) and explainable.
 *
 * Traffic is the input to the simulation. These models generate
 * request arrival events that feed into the discrete event simulation.
 */

import { DeterministicRNG } from './deterministic.js'

// ============================================================================
// TRAFFIC PATTERN DEFINITIONS
// ============================================================================

export const TRAFFIC_PATTERNS = {
  constant: {
    id: 'constant',
    label: 'Constant',
    description: 'Steady, unchanging request rate throughout the simulation',
    params: {},
    generator: generateConstantTraffic,
  },

  bursty: {
    id: 'bursty',
    label: 'Bursty',
    description: 'Periodic bursts of high traffic followed by quiet periods',
    params: {
      burstFactor: { type: 'number', default: 10, min: 1.1, max: 100, description: 'Peak multiplier during burst' },
      burstDuration: { type: 'number', default: 10, min: 1, max: 300, description: 'Burst length in seconds' },
      burstInterval: { type: 'number', default: 60, min: 10, max: 1800, description: 'Interval between burst starts in seconds' },
    },
    generator: generateBurstyTraffic,
  },

  spiky: {
    id: 'spiky',
    label: 'Spiky',
    description: 'Random traffic spikes of varying intensity',
    params: {
      spikeFactor: { type: 'number', default: 20, min: 1.1, max: 200, description: 'Max spike multiplier' },
      spikeProbability: { type: 'number', default: 0.05, min: 0.001, max: 1, description: 'Probability of spike per second' },
      spikeDuration: { type: 'number', default: 5, min: 1, max: 60, description: 'Spike duration in seconds' },
    },
    generator: generateSpikyTraffic,
  },

  seasonal: {
    id: 'seasonal',
    label: 'Seasonal',
    description: 'Sinusoidal traffic pattern simulating daily/weekly cycles',
    params: {
      seasonalPeriod: { type: 'number', default: 300, min: 60, max: 1800, description: 'Period of one full cycle in seconds' },
      seasonalAmplitude: { type: 'number', default: 0.5, min: 0.01, max: 2, description: 'Amplitude as fraction of baseline (0.5 = 50% variation)' },
      phaseShift: { type: 'number', default: 0, min: 0, max: 360, description: 'Phase shift in degrees' },
    },
    generator: generateSeasonalTraffic,
  },

  randomized: {
    id: 'randomized',
    label: 'Randomized',
    description: 'Pseudo-random traffic with configurable bounds, fully reproducible with seed',
    params: {
      minMultiplier: { type: 'number', default: 0.1, min: 0, max: 1, description: 'Minimum multiplier of baseline' },
      maxMultiplier: { type: 'number', default: 3, min: 1, max: 50, description: 'Maximum multiplier of baseline' },
      smoothness: { type: 'number', default: 0.5, min: 0, max: 1, description: '0 = independent samples, 1 = heavily smoothed' },
    },
    generator: generateRandomizedTraffic,
  },

  custom: {
    id: 'custom',
    label: 'Custom',
    description: 'User-defined traffic curve via control points',
    params: {
      curve: { type: 'array', default: [], description: 'Array of {time: number, rps: number} points' },
    },
    generator: generateCustomTraffic,
  },
}

// ============================================================================
// BACKWARD-COMPATIBLE ALIASES
// Maps old UI pattern names to new engine names
// ============================================================================

const TRAFFIC_PATTERN_ALIASES = {
  // Old names → new names
  'steady': 'constant',
  'flat': 'constant',
  'uniform': 'constant',
  'spike': 'bursty',       // Old "spike" = new "bursty" (periodic bursts)
  'ramp': 'seasonal',      // Old "ramp" = new "seasonal" (gradual change)
  'chaos': 'randomized',   // Old "chaos" = new "randomized" (random spikes)
}

// ============================================================================
// TRAFFIC GENERATION FUNCTIONS
// ============================================================================

/**
 * Generate traffic pattern as an array of {time, rps} points.
 * @param {string} patternId — Traffic pattern type
 * @param {number} baseRps — Baseline requests per second
 * @param {number} duration — Simulation duration in seconds
 * @param {Object} params — Pattern-specific parameters
 * @param {DeterministicRNG} rng — Seeded random number generator
 * @returns {Array<{time: number, rps: number}>} Traffic curve
 */
export function generateTrafficCurve(patternId, baseRps, duration, params = {}, rng) {
  // Normalize pattern aliases (backward compatibility)
  const normalizedId = TRAFFIC_PATTERN_ALIASES[patternId] || patternId

  const pattern = TRAFFIC_PATTERNS[normalizedId]
  if (!pattern) {
    throw new Error(`Unknown traffic pattern: ${patternId} (tried normalized: ${normalizedId})`)
  }
  return pattern.generator(baseRps, duration, params, rng)
}

/**
 * Constant traffic: rps(t) = baseRps for all t.
 */
function generateConstantTraffic(baseRps, duration, params, rng) {
  const curve = []
  for (let t = 0; t <= duration; t++) {
    curve.push({ time: t, rps: baseRps })
  }
  return curve
}

/**
 * Bursty traffic: periodic high-traffic bursts.
 */
function generateBurstyTraffic(baseRps, duration, params, rng) {
  const { burstFactor = 10, burstDuration = 10, burstInterval = 60 } = params
  const curve = []
  for (let t = 0; t <= duration; t++) {
    const cyclePosition = t % burstInterval
    const isBurst = cyclePosition < burstDuration
    const rps = isBurst ? baseRps * burstFactor : baseRps
    curve.push({ time: t, rps })
  }
  return curve
}

/**
 * Spiky traffic: random spikes with configurable probability and duration.
 */
function generateSpikyTraffic(baseRps, duration, params, rng) {
  const { spikeFactor = 20, spikeProbability = 0.05, spikeDuration = 5 } = params
  const curve = []
  let spikeEnd = -1
  let currentSpikeRps = baseRps

  for (let t = 0; t <= duration; t++) {
    if (t > spikeEnd) {
      // Not in a spike — decide if a new one starts
      if (rng.nextBool(spikeProbability)) {
        spikeEnd = t + spikeDuration
        // Random spike intensity between 2x and spikeFactor
        const intensity = rng.nextRange(2, spikeFactor)
        currentSpikeRps = baseRps * intensity
      } else {
        currentSpikeRps = baseRps
      }
    }
    curve.push({ time: t, rps: currentSpikeRps })
  }
  return curve
}

/**
 * Seasonal traffic: sinusoidal variation.
 * rps(t) = baseRps * (1 + amplitude * sin(2πt/period + phase))
 */
function generateSeasonalTraffic(baseRps, duration, params, rng) {
  const { seasonalPeriod = 300, seasonalAmplitude = 0.5, phaseShift = 0 } = params
  const curve = []
  const phaseRad = (phaseShift * Math.PI) / 180

  for (let t = 0; t <= duration; t++) {
    const sineValue = Math.sin((2 * Math.PI * t) / seasonalPeriod + phaseRad)
    const multiplier = 1 + seasonalAmplitude * sineValue
    const rps = Math.max(0, baseRps * multiplier)
    curve.push({ time: t, rps })
  }
  return curve
}

/**
 * Randomized traffic: seeded pseudo-random with optional smoothing.
 */
function generateRandomizedTraffic(baseRps, duration, params, rng) {
  const { minMultiplier = 0.1, maxMultiplier = 3, smoothness = 0.5 } = params
  const curve = []
  let prevMultiplier = 1.0

  for (let t = 0; t <= duration; t++) {
    // Generate a new random multiplier
    const rawMultiplier = rng.nextRange(minMultiplier, maxMultiplier)
    // Apply smoothing: blend with previous value
    const multiplier = smoothness * prevMultiplier + (1 - smoothness) * rawMultiplier
    prevMultiplier = multiplier
    const rps = Math.max(0, baseRps * multiplier)
    curve.push({ time: t, rps })
  }
  return curve
}

/**
 * Custom traffic: interpolate between user-defined control points.
 */
function generateCustomTraffic(baseRps, duration, params, rng) {
  const { curve: controlPoints = [] } = params

  if (controlPoints.length === 0) {
    // No control points = constant traffic
    return generateConstantTraffic(baseRps, duration, params, rng)
  }

  // Sort control points by time
  const sorted = [...controlPoints].sort((a, b) => a.time - b.time)

  // Add implicit start and end points
  const points = [
    { time: 0, rps: sorted[0].rps },
    ...sorted,
    { time: duration, rps: sorted[sorted.length - 1].rps },
  ]

  const curve = []
  let pointIndex = 0

  for (let t = 0; t <= duration; t++) {
    // Find the two control points that bracket time t
    while (pointIndex < points.length - 1 && points[pointIndex + 1].time < t) {
      pointIndex++
    }

    const p1 = points[pointIndex]
    const p2 = points[pointIndex + 1] || p1

    if (p1.time === p2.time) {
      curve.push({ time: t, rps: p1.rps })
    } else {
      // Linear interpolation
      const ratio = (t - p1.time) / (p2.time - p1.time)
      const rps = p1.rps + ratio * (p2.rps - p1.rps)
      curve.push({ time: t, rps: Math.max(0, rps) })
    }
  }
  return curve
}

// ============================================================================
// TRAFFIC EVENT GENERATION (For Discrete Event Simulation)
// ============================================================================

/**
 * Convert a traffic curve into a stream of request arrival events.
 * Uses Poisson process approximation for each second's RPS.
 *
 * @param {Array<{time: number, rps: number}>} trafficCurve
 * @param {DeterministicRNG} rng
 * @returns {Array<{time: number, requestId: string}>} Arrival events
 */
export function generateArrivalEvents(trafficCurve, rng) {
  const events = []
  let requestCounter = 0

  for (const { time, rps } of trafficCurve) {
    if (rps <= 0) continue

    // For high RPS, use Poisson distribution for count, then uniform spacing
    // For very high RPS, use deterministic spacing with small jitter
    const count = Math.max(0, rng.nextPoisson(rps))

    if (count === 0) continue

    if (count <= 10) {
      // Low count: distribute uniformly within the second with small jitter
      for (let i = 0; i < count; i++) {
        const offset = (i / count) + rng.nextRange(-0.05, 0.05)
        const clampedOffset = Math.max(0, Math.min(0.999, offset))
        events.push({
          time: time + clampedOffset,
          requestId: `req-${requestCounter++}`,
        })
      }
    } else {
      // High count: deterministic spacing with tiny jitter for realism
      const spacing = 1.0 / count
      for (let i = 0; i < count; i++) {
        const jitter = rng.nextRange(-spacing * 0.1, spacing * 0.1)
        const offset = (i * spacing) + jitter
        const clampedOffset = Math.max(0, Math.min(0.999, offset))
        events.push({
          time: time + clampedOffset,
          requestId: `req-${requestCounter++}`,
        })
      }
    }
  }

  // Sort by time (should already be mostly sorted, but jitter can cause minor disorder)
  events.sort((a, b) => a.time - b.time)

  return events
}

/**
 * Generate a traffic summary for reporting.
 */
export function generateTrafficSummary(trafficCurve) {
  const rpsValues = trafficCurve.map(p => p.rps)
  const total = rpsValues.reduce((a, b) => a + b, 0)
  const min = Math.min(...rpsValues)
  const max = Math.max(...rpsValues)
  const avg = total / rpsValues.length

  // Calculate percentiles
  const sorted = [...rpsValues].sort((a, b) => a - b)
  const p = (pct) => sorted[Math.floor((pct / 100) * sorted.length)] || 0

  return {
    totalRequests: Math.round(total),
    averageRps: Math.round(avg),
    minRps: Math.round(min),
    maxRps: Math.round(max),
    p50Rps: Math.round(p(50)),
    p95Rps: Math.round(p(95)),
    p99Rps: Math.round(p(99)),
    duration: trafficCurve.length,
    peakToAverageRatio: avg > 0 ? max / avg : 0,
  }
}

// ============================================================================
// GROWTH SCENARIO MODELS
// ============================================================================

export const GROWTH_SCENARIOS = {
  '2x': { multiplier: 2, rampDuration: 60, rampCurve: 'linear' },
  '5x': { multiplier: 5, rampDuration: 120, rampCurve: 'exponential' },
  '10x': { multiplier: 10, rampDuration: 180, rampCurve: 'exponential' },
}

/**
 * Apply a growth multiplier to a traffic curve.
 */
export function applyGrowthScenario(trafficCurve, scenario) {
  const { multiplier, rampDuration, rampCurve } = scenario

  return trafficCurve.map((point, index) => {
    let appliedMultiplier = 1.0

    if (index < rampDuration) {
      // Still ramping
      const progress = index / rampDuration
      switch (rampCurve) {
        case 'linear':
          appliedMultiplier = 1 + (multiplier - 1) * progress
          break
        case 'exponential':
          appliedMultiplier = Math.exp(progress * Math.log(multiplier))
          break
        case 'step':
          appliedMultiplier = progress >= 0.5 ? multiplier : 1.0
          break
        default:
          appliedMultiplier = 1 + (multiplier - 1) * progress
      }
    } else {
      // Steady state at multiplier
      appliedMultiplier = multiplier
    }

    return {
      time: point.time,
      rps: point.rps * appliedMultiplier,
    }
  })
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate traffic pattern parameters.
 */
export function validateTrafficParams(patternId, params) {
  const normalizedId = TRAFFIC_PATTERN_ALIASES[patternId] || patternId
  const pattern = TRAFFIC_PATTERNS[normalizedId]
  if (!pattern) {
    return { valid: false, errors: [`Unknown traffic pattern: ${patternId}`] }
  }

  const errors = []
  for (const [key, spec] of Object.entries(pattern.params)) {
    const value = params[key]
    if (value !== undefined) {
      if (spec.type === 'number') {
        if (typeof value !== 'number' || isNaN(value)) {
          errors.push(`${key} must be a number`)
        } else if (value < spec.min || value > spec.max) {
          errors.push(`${key} must be between ${spec.min} and ${spec.max}`)
        }
      }
      if (spec.type === 'array' && !Array.isArray(value)) {
        errors.push(`${key} must be an array`)
      }
    }
  }

  // Custom curve validation
  if (normalizedId === 'custom' && params.curve) {
    for (const point of params.curve) {
      if (typeof point.time !== 'number' || point.time < 0) {
        errors.push('Custom curve points must have non-negative time')
      }
      if (typeof point.rps !== 'number' || point.rps < 0) {
        errors.push('Custom curve points must have non-negative RPS')
      }
    }
  }

  return { valid: errors.length === 0, errors }
}

/**
 * List all available traffic patterns.
 */
export function getTrafficPatternList() {
  return Object.values(TRAFFIC_PATTERNS).map(p => ({
    id: p.id,
    label: p.label,
    description: p.description,
    params: p.params,
  }))
}

/**
 * Get the canonical pattern ID for a given input (handles aliases).
 */
export function normalizeTrafficPattern(patternId) {
  return TRAFFIC_PATTERN_ALIASES[patternId] || patternId
}