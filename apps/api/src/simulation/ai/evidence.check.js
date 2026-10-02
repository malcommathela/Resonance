// Contract tests for the AI evidence builder (Phase 7).
// Missing/unavailable/failed data must never become findings or measurements.
// Run from repo root: node apps/api/src/simulation/ai/evidence.check.js
import assert from 'node:assert/strict'
import {
  buildEvidencePacket,
  isMeasured,
  isMeasuredUnsustainable,
  analysisStatus,
  findingId,
  EVIDENCE_SCHEMA_VERSION,
  THRESHOLD_POLICY,
} from './evidence-builder.js'
import {
  CANONICAL_MODEL_VERSION,
  SIMULATION_ENGINE_VERSION,
  REPORT_SCHEMA_VERSION,
} from '@resonance/shared/canonical-model'

const p3 = () => ({
  reliabilityAnalysis: {
    availability: 0.997,
    singlePointsOfFailure: ['api-gw'],
    failureChains: [{ mode: 'cascade', description: 'a cascades', probability: 0.02, blockIds: ['a', 'b'] }],
    blastRadiuses: [{ severity: 'high', blockId: 'db', label: 'DB', totalAffectedBlocks: 3, affectedRatio: 0.5 }],
  },
  scalabilityAnalysis: {
    bottlenecks: [
      { severity: 'critical', blockId: 'api', message: 'saturated', currentRps: 900, maxRps: 1000 },
      { severity: 'high', blockId: 'cache', message: 'hot', evidence: { headroomPercent: 10 } },
    ],
    growthProjections: [
      { status: 'measured', trafficMultiplier: 2, isSustainable: false, predictedLatencyMs: 800, predictedBottlenecks: ['api'] },
      { status: 'unavailable', trafficMultiplier: 4, isSustainable: null, predictedLatencyMs: null, predictedBottlenecks: null },
    ],
  },
  securityAnalysis: {
    securityScore: 62,
    bySeverity: { critical: [{ id: 's1', type: 'public_exposure', blockId: 'api', message: 'public' }], high: [] },
  },
  costAnalysis: {
    currentMonthlyCost: 120,
    drivers: [{ componentId: 'db', label: 'DB', cost: 60, percentageOfTotal: 50, confidence: 0.8, recommendation: 'rightsizing' }],
  },
})
const agg = () => ({
  globalMetrics: { p99LatencyMs: 250, errorRate: 0.02, throughputRps: 400 },
  blockMetrics: { blocks: { api: { utilization: 0.8, errorRate: 0, p99LatencyMs: 100 } } },
})

// --- validity primitives ---
assert.equal(isMeasured(0), true) // legitimate zero is measured
assert.equal(isMeasured(null), false)
assert.equal(isMeasured(undefined), false)
assert.equal(isMeasured(NaN), false)
assert.equal(isMeasured(Infinity), false)
assert.equal(isMeasured('0.5'), false)
assert.equal(isMeasuredUnsustainable({ status: 'measured', isSustainable: false }), true)
assert.equal(isMeasuredUnsustainable({ status: 'unavailable', isSustainable: null }), false)
assert.equal(isMeasuredUnsustainable({ status: 'measured', isSustainable: true }), false)
assert.equal(isMeasuredUnsustainable(null), false)
assert.equal(analysisStatus(null), 'not-evaluated')
assert.equal(analysisStatus(undefined), 'not-evaluated')
assert.equal(analysisStatus({ error: true }), 'failed')
assert.equal(analysisStatus({ availability: 1 }), 'evaluated')
assert.equal(findingId('reliability', 'single_point_of_failure', 'a'), 'ev-reliability:single_point_of_failure:a')
assert.equal(EVIDENCE_SCHEMA_VERSION, '2.0.0')
assert.equal(THRESHOLD_POLICY.errorRate.value, 0.01) // ratios, not percents

// --- unavailable growth is never failure ---
{
  const packet = buildEvidencePacket(p3(), agg())
  const growth = packet.findings.filter((f) => f.type === 'unsustainable_growth')
  assert.equal(growth.length, 1)
  assert.ok(growth[0].message.includes('2x'))
  assert.deepEqual(packet.summary.unsustainableGrowthAt, ['2x']) // 4x unavailable excluded
}

// --- null/NaN availability: no finding, null summary, failed status tracked ---
for (const availability of [null, undefined, NaN, Infinity]) {
  const r = { ...p3(), reliabilityAnalysis: { availability, singlePointsOfFailure: [] } }
  const packet = buildEvidencePacket(r, agg())
  assert.equal(packet.findings.filter((f) => f.type === 'low_availability').length, 0)
  assert.equal(packet.summary.overallAvailability, null)
}
{
  const packet = buildEvidencePacket({ ...p3(), reliabilityAnalysis: { error: true } }, agg())
  assert.equal(packet.findings.filter((f) => f.category === 'reliability').length, 0)
  assert.equal(packet.analysisStatus.reliability, 'failed')
  assert.ok(packet.unavailable.some((u) => u.category === 'reliability' && u.status === 'failed'))
  const missing = buildEvidencePacket({ ...p3(), costAnalysis: null }, agg())
  assert.equal(missing.analysisStatus.cost, 'not-evaluated')
}

// --- division guard: maxRps 0 → null value, still a finding (engine flagged it) ---
{
  const r = p3()
  r.scalabilityAnalysis.bottlenecks = [{ severity: 'critical', blockId: 'z', message: 'sat', currentRps: 10, maxRps: 0 }]
  const packet = buildEvidencePacket(r, agg())
  const f = packet.findings.find((x) => x.type === 'saturated_component')
  assert.equal(f.value, null) // no NaN/Infinity
}

// --- zero cost preserved as zero (not null), missing cost stays null ---
{
  const r = p3()
  r.costAnalysis.drivers = [{ componentId: 'db', label: 'DB', cost: 0, percentageOfTotal: 50 }]
  const packet = buildEvidencePacket(r, agg())
  assert.equal(packet.findings.find((f) => f.type === 'cost_driver').value, 0)
  const r2 = p3()
  delete r2.costAnalysis.currentMonthlyCost
  assert.equal(buildEvidencePacket(r2, agg()).summary.overallCost, null)
}

// --- versions, identity, stable ids ---
{
  const ctx = {
    simulation: { id: 'sim-1', designId: 'd-1', scenario: 'none', trafficPattern: 'steady', rps: 100, duration: 300, monteCarloPasses: 3, deterministicSeed: 'seed' },
    versions: { dto: '9.9.9' },
  }
  const a = buildEvidencePacket(p3(), agg(), ctx)
  const b = buildEvidencePacket(p3(), agg(), ctx)
  assert.deepEqual(a.findings.map((f) => f.id), b.findings.map((f) => f.id)) // stable
  assert.equal(a.simulation.id, 'sim-1')
  assert.equal(a.simulation.deterministicSeed, 'seed')
  assert.equal(a.versions.dto, '9.9.9')
  assert.equal(a.versions.canonicalModel, CANONICAL_MODEL_VERSION)
  assert.equal(a.versions.engine, SIMULATION_ENGINE_VERSION)
  assert.equal(a.versions.reportSchema, REPORT_SCHEMA_VERSION)
  const bare = buildEvidencePacket(p3(), agg())
  assert.equal(bare.simulation.id, null) // unknown stays unknown
  assert.equal(bare.versions.dto, null)
}

console.log('evidence.check: OK')
