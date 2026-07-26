/**
 * Deterministic Random Number Generator
 * 
 * Uses a seeded linear congruential generator (LCG) to produce
 * reproducible pseudo-random numbers across all platforms.
 * 
 * Same seed → same sequence → same simulation results.
 * This is the foundation of reproducibility and auditability.
 */

const LCG_MULTIPLIER = 1664525
const LCG_INCREMENT = 1013904223
const LCG_MODULUS = 4294967296 // 2^32

export class DeterministicRNG {
  constructor(seed = 12345) {
    this._originalSeed = seed
    this._seed = seed >>> 0
  }

  /** Reset to original seed for reproducibility */
  reset() {
    this._seed = this._originalSeed >>> 0
  }

  /** Get the current seed value */
  getSeed() {
    return this._originalSeed
  }

  /** Generate next integer in [0, 2^32) */
  nextInt() {
    this._seed = (LCG_MULTIPLIER * this._seed + LCG_INCREMENT) % LCG_MODULUS
    return this._seed
  }

  /** Generate float in [0, 1) — replaces Math.random() */
  nextFloat() {
    return this.nextInt() / LCG_MODULUS
  }

  /** Generate float in [min, max) */
  nextRange(min, max) {
    return min + this.nextFloat() * (max - min)
  }

  /** Generate integer in [min, max] inclusive */
  nextIntRange(min, max) {
    return Math.floor(this.nextRange(min, max + 1))
  }

  /** Generate boolean with given probability */
  nextBool(probability = 0.5) {
    return this.nextFloat() < probability
  }

  /** Generate from normal distribution (Box-Muller transform) */
  nextNormal(mean = 0, stdDev = 1) {
    let u = 0, v = 0
    while (u === 0) u = this.nextFloat()
    while (v === 0) v = this.nextFloat()
    const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
    return mean + z * stdDev
  }

  /** Generate from exponential distribution (for inter-arrival times) */
  nextExponential(rate) {
    return -Math.log(1 - this.nextFloat()) / rate
  }

  /** Generate from Poisson distribution */
  nextPoisson(lambda) {
    if (lambda < 30) {
      let L = Math.exp(-lambda)
      let k = 0
      let p = 1
      do {
        k++
        p *= this.nextFloat()
      } while (p > L)
      return k - 1
    }
    // Normal approximation for large lambda
    return Math.max(0, Math.round(this.nextNormal(lambda, Math.sqrt(lambda))))
  }

  /** Shuffle array in-place deterministically */
  shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = this.nextIntRange(0, i)
      ;[array[i], array[j]] = [array[j], array[i]]
    }
    return array
  }

  /** Pick random element from array */
  pick(array) {
    return array[this.nextIntRange(0, array.length - 1)]
  }

  /** Generate a hash string from current state (for debugging) */
  getStateHash() {
    return this._seed.toString(16).padStart(8, '0')
  }
}

/** Create RNG from a composite seed (designId + timestamp + config hash) */
export function createSimulationSeed(designId, config = {}) {
  const configStr = JSON.stringify(config)
  let hash = 0
  const str = `${designId}:${configStr}`
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash)
}

/** Validate that two RNGs produce identical sequences */
export function validateDeterminism(seed, count = 10000) {
  const rng1 = new DeterministicRNG(seed)
  const rng2 = new DeterministicRNG(seed)
  for (let i = 0; i < count; i++) {
    if (rng1.nextFloat() !== rng2.nextFloat()) {
      return false
    }
  }
  return true
}