// Contract tests for AI narrative validation, healthy-state, and fallback.
// Imports the REAL module (Gemini SDK import is side-effect safe); the model
// call itself is injected via options.generateFn — no network in tests.
// Run from repo root: node apps/api/src/simulation/ai/narrative.check.js
import assert from 'node:assert/strict'
import {
  generateAIInsights,
  buildNarrativePrompt,
  validateNarrativeAgainstEvidence,
  generateHealthyInsights,
  generateRuleBasedInsights,
} from './ai-analysis.js'
import { buildEvidencePacket } from './evidence-builder.js'

const p3 = () => ({
  reliabilityAnalysis: { availability: 0.9977, singlePointsOfFailure: ['api-gateway'], failureChains: [], blastRadiuses: [] },
  scalabilityAnalysis: {
    bottlenecks: [{ severity: 'critical', blockId: 'api', message: 'api saturated', currentRps: 900, maxRps: 1000 }],
    growthProjections: [
      { status: 'measured', trafficMultiplier: 2, isSustainable: false, predictedLatencyMs: 800, predictedBottlenecks: ['api'] },
      { status: 'unavailable', trafficMultiplier: 4, isSustainable: null, predictedLatencyMs: null, predictedBottlenecks: null },
    ],
  },
  securityAnalysis: { securityScore: 62, bySeverity: { critical: [], high: [] } },
  costAnalysis: { currentMonthlyCost: 120, drivers: [] },
})
const agg = () => ({
  globalMetrics: { p99LatencyMs: 250, errorRate: 0.02, throughputRps: 400 },
  blockMetrics: { blocks: {} },
})
const ev = () => buildEvidencePacket(p3(), agg(), { simulation: { id: 's1', designId: 'd1' } })
const spofId = 'ev-reliability:single_point_of_failure:api-gateway'

const good = (over = {}) => ({
  id: 'ai-1',
  category: 'reliability',
  severity: 'critical',
  title: 'API Gateway is a single point of failure',
  description: `Finding ${spofId} shows api-gateway has no redundancy. Current availability is 99.77%.`,
  recommendation: 'Introduce redundancy or failover for api-gateway.',
  evidenceIds: [spofId],
  ...over,
})

// --- deterministic validation ---
{
  const packet = ev()
  assert.deepEqual(validateNarrativeAgainstEvidence({ insights: [good()] }, packet).insights.length, 1)
  // unknown evidence id → rejected
  assert.deepEqual(validateNarrativeAgainstEvidence({ insights: [good({ evidenceIds: ['ev-nope'] })] }, packet).insights.length, 0)
  // missing ids → rejected
  const { evidenceIds, ...noIds } = good()
  assert.deepEqual(validateNarrativeAgainstEvidence({ insights: [noIds] }, packet).insights.length, 0)
  // bad enum → rejected
  assert.deepEqual(validateNarrativeAgainstEvidence({ insights: [good({ severity: 'urgent' })] }, packet).insights.length, 0)
  // incidental substring number NOT in cited evidence → rejected
  assert.deepEqual(
    validateNarrativeAgainstEvidence({ insights: [good({ description: `Error rate is 5% per ${spofId}.` })] }, packet).insights.length, 0)
  // outcome promise in recommendation absent from evidence → rejected
  assert.deepEqual(
    validateNarrativeAgainstEvidence({ insights: [good({ recommendation: 'This improves availability to 99.99%.' })] }, packet).insights.length, 0)
  // malformed envelope → empty, never throws
  assert.deepEqual(validateNarrativeAgainstEvidence(null, packet).insights, [])
  assert.deepEqual(validateNarrativeAgainstEvidence({ insights: 'x' }, packet).insights, [])
  // cap at 5
  const many = Array.from({ length: 7 }, (_, i) => good({ id: `ai-${i}` }))
  assert.equal(validateNarrativeAgainstEvidence({ insights: many }, packet).insights.length, 5)
}

// --- prompt constrains the model to ids and unavailable sections ---
{
  const text = buildNarrativePrompt(ev())
  assert.ok(text.includes(spofId)) // stable ids citable
  assert.ok(text.includes('evidenceIds'))
  assert.ok(text.includes('UNAVAILABLE OR FAILED'))
}

// --- healthy path requires evaluated, measured data ---
{
  const cleanP3 = { ...p3(), reliabilityAnalysis: { ...p3().reliabilityAnalysis, singlePointsOfFailure: [] } }
  const full = generateHealthyInsights(buildEvidencePacket(cleanP3, agg()))
  assert.ok(full.insights.some((i) => i.category === 'reliability'))
  assert.equal(full.evidencePacket.schemaVersion, '2.0.0') // real packet attached, not { findings: [] }
  assert.ok(full.evidencePacket.findings.length > 0) // other findings remain; reliability is clean

  const noRel = generateHealthyInsights(buildEvidencePacket({ ...p3(), reliabilityAnalysis: null }, agg()))
  assert.ok(!noRel.insights.some((i) => i.category === 'reliability')) // missing data → no claim
  assert.ok(!JSON.stringify(noRel.insights).includes('NaN')) // never NaN%

  const failed = generateHealthyInsights(buildEvidencePacket({ ...p3(), reliabilityAnalysis: { error: true } }, agg()))
  assert.ok(!failed.insights.some((i) => i.category === 'reliability'))

  const empty = generateHealthyInsights(buildEvidencePacket({}, null))
  assert.deepEqual(empty.insights, []) // nothing evaluated → empty set, not healthy claims
}

// --- fallback: deterministic, measured-only, same packet rules ---
{
  const a = generateRuleBasedInsights(ev())
  const b = generateRuleBasedInsights(ev())
  const strip = (o) => JSON.parse(JSON.stringify(o, (k, v) => (k === 'generatedAt' ? 0 : v)))
  assert.deepEqual(strip(a), strip(b))
  assert.equal(a.fallback, true)
  assert.ok(!a.insights.some((i) => i.title.includes('4x'))) // unavailable growth excluded
  assert.ok(a.insights.some((i) => i.title.includes('2x'))) // measured unsustainable included
  assert.ok(a.insights.every((i) => Array.isArray(i.evidenceIds) && i.evidenceIds.length > 0))
}

// --- generateAIInsights wiring (stubbed model, no network) ---
{
  let calls = 0
  const stub = async () => {
    calls += 1
    return { insights: [good()] }
  }
  const out = await generateAIInsights({ id: 's1', designId: 'd1' }, p3(), agg(), { generateFn: stub })
  assert.equal(calls, 1)
  assert.equal(out.fallback, false)
  assert.equal(out.insights.length, 1)
  assert.equal(out.insights[0].evidenceValidated, true)
  assert.ok(out.evidencePacket.findings.length > 0)
}
{
  // Model failure → evidence-constrained fallback (one slow path: 3 bounded retries)
  const failing = async () => { throw new Error('model down') }
  const out = await generateAIInsights({ id: 's1' }, p3(), agg(), { generateFn: failing })
  assert.equal(out.fallback, true)
  assert.ok(out.insights.length > 0)
}
{
  // No findings → healthy path, model never called
  let calls = 0
  const stub = async () => { calls += 1; return { insights: [] } }
  const out = await generateAIInsights({ id: 's1' }, {}, null, { generateFn: stub })
  assert.equal(calls, 0)
  assert.deepEqual(out.insights, [])
}
{
  // All insights invalid → fallback, not empty silence
  const bad = async () => ({ insights: [good({ evidenceIds: ['ev-nope'] })] })
  const out = await generateAIInsights({ id: 's1' }, p3(), agg(), { generateFn: bad })
  assert.equal(out.fallback, true)
}

console.log('narrative.check: OK')
