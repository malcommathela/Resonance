// Contract tests for the report merger (Phase 7).
// Unknown stays unknown: no fabricated availability, capacity, savings, or scores.
// Run from repo root: node apps/api/src/simulation/pipeline/report.check.js
import assert from 'node:assert/strict'
import {
  mergeInsights,
  findP3EvidenceForInsight,
  buildSimulationReportDTO,
  SIMULATION_REPORT_DTO_VERSION,
} from './report-builder.js'

const spofInsight = (title = 'api-gateway is a single point of failure') => ({
  id: 'ai-1', category: 'reliability', severity: 'critical',
  title, description: 'd', recommendation: 'r', evidenceIds: ['x'],
})

// --- unknown availability → null impact, never 0.99 fabrication ---
{
  const p3 = { reliabilityAnalysis: { availability: null, singlePointsOfFailure: ['api-gateway'] } }
  const e = findP3EvidenceForInsight(spofInsight(), p3, {})
  assert.equal(e.predictedImpact, null)
  assert.equal(e.supportingEvidence[1].value, null)
  assert.equal(e.confidence, 0.9)
}
{
  const p3 = { reliabilityAnalysis: { availability: 0.99, singlePointsOfFailure: ['api-gateway'] } }
  const e = findP3EvidenceForInsight(spofInsight(), p3, {})
  assert.equal(e.predictedImpact.metric, 'availability')
  assert.ok(e.predictedImpact.after > e.predictedImpact.before) // redundancy math intact
}

// --- unknown capacity → null impact, never 1000-RPS default ---
{
  const p3 = { scalabilityAnalysis: { bottlenecks: [{ blockId: 'api', label: 'API', currentRps: 900, maxRps: null }] } }
  const e = findP3EvidenceForInsight(
    { ...spofInsight('api saturated'), category: 'scalability' }, p3, {})
  assert.equal(e.predictedImpact, null)
  assert.equal(e.supportingEvidence[2].value, null)
}
{
  const p3 = { scalabilityAnalysis: { bottlenecks: [{ blockId: 'api', label: 'API', currentRps: 900, maxRps: 1000 }] } }
  const e = findP3EvidenceForInsight(
    { ...spofInsight('api saturated'), category: 'scalability' }, p3, {})
  assert.equal(e.predictedImpact.after, 980) // headroom math intact
}

// --- unavailable growth never matches, even on title substring ---
{
  const p3 = {
    scalabilityAnalysis: {
      growthProjections: [
        { status: 'unavailable', trafficMultiplier: 4, isSustainable: null, predictedLatencyMs: null, evidence: {} },
      ],
    },
  }
  const e = findP3EvidenceForInsight(
    { ...spofInsight('cannot sustain 4x traffic'), category: 'scalability' }, p3, {})
  assert.equal(e.predictedImpact, null) // defaultEvidence: no match
  assert.equal(e.confidence, null)
}

// --- no invented savings: drivers carry no typicalSavingsPercent ---
{
  const p3 = {
    costAnalysis: {
      currentMonthlyCost: 200,
      drivers: [{ componentId: 'db', label: 'DB', cost: 120, percentageOfTotal: 60 }],
    },
  }
  const e = findP3EvidenceForInsight(
    { ...spofInsight('db drives cost'), category: 'cost' }, p3, {})
  assert.equal(e.predictedImpact.before, 200)
  assert.equal(e.predictedImpact.after, null) // no fabricated 10%
}

// --- unknown security score → nulls, never 0 ---
{
  const p3 = {
    securityAnalysis: {
      securityScore: null,
      bySeverity: { critical: [{ id: 's1', type: 'x', blockId: 'api', message: 'hole in api' }], high: [] },
    },
  }
  const e = findP3EvidenceForInsight(
    { ...spofInsight('hole in api panel'), category: 'security' }, p3, {})
  assert.equal(e.predictedImpact.before, null)
  assert.equal(e.predictedImpact.after, null)
}

// --- merger preserves authoritative narrative, enriches only ---
{
  const ai = {
    generatedAt: 't', modelVersion: 'm', fallback: false,
    insights: [spofInsight()],
  }
  const p3 = { reliabilityAnalysis: { availability: 0.99, singlePointsOfFailure: ['api-gateway'] } }
  const merged = mergeInsights(ai, p3, {})
  assert.equal(merged.insights[0].title, spofInsight().title) // untouched
  assert.equal(merged.insights[0].description, 'd')
  assert.ok(Array.isArray(merged.insights[0].supportingEvidence))
  assert.equal(mergeInsights(null, p3, {}), null)
  // no-match insight keeps nulls (Batch 3 contract intact)
  const nomatch = mergeInsights(
    { generatedAt: 't', modelVersion: 'm', fallback: false, insights: [{ ...spofInsight(), title: 'unrelated words here' }] },
    { reliabilityAnalysis: {} }, {})
  assert.equal(nomatch.insights[0].predictedImpact, null)
  assert.equal(nomatch.insights[0].confidence, null)
}

// --- DTO identity passthrough ---
{
  const dto = buildSimulationReportDTO(
    { overallScore: 80, metadata: {} },
    {
      id: 'sim-1', designId: 'd-1', scenario: 'burst', trafficPattern: 'steady',
      rps: 100, duration: 60, monteCarloPasses: 3, deterministicSeed: 's',
      engineVersion: 'e', reportVersion: 'r', status: 'completed',
      createdAt: 'c', startedAt: null, completedAt: 'd',
    },
  )
  assert.equal(dto.dtoVersion, SIMULATION_REPORT_DTO_VERSION)
  assert.equal(dto.simulation.id, 'sim-1')
  assert.equal(dto.simulation.deterministicSeed, 's')
  assert.equal(dto.overallScore, 80) // report data preserved
}

console.log('report.check: OK')
