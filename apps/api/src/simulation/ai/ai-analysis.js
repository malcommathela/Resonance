/**
 * AI Analysis Layer (P4) — Production Grade
 *
 * ARCHITECTURAL PRINCIPLE:
 *   P3 engines compute ALL structured data (bottlenecks, risks, costs, scores).
 *   AI generates ONLY narrative insights (title, description, recommendation).
 *   Report Builder merges P3 data + AI narrative into final report.
 *
 * This eliminates:
 *   - Token truncation from massive JSON schemas
 *   - AI hallucination of metrics
 *   - Unverifiable predictedImpact values
 *
 * CONTRACT:
 *   Input:  EvidencePacket (abnormal findings only) from evidence-builder.js
 *   Output: AINarrative { insights: [{id, category, severity, title, description, recommendation}] }
 *
 *   All structured fields (bottleneckAnalysis, riskAssessment, etc.) are NULL here.
 *   They are populated by P3 engines in report-builder.js.
 */

import { generateInsights, MODEL_CONFIG } from '../../lib/gemini.js'
import {
  buildEvidencePacket,
  isMeasured,
  THRESHOLD_POLICY,
} from './evidence-builder.js'

// ============================================================================
// CONFIGURATION
// ============================================================================

const AI_CONFIG = Object.freeze({
  maxInsights: 5,
  minConfidence: 0.6,
  categories: ['reliability', 'scalability', 'performance', 'cost', 'security'],
  severities: ['critical', 'high', 'medium', 'low'],
  severityOrder: { critical: 0, high: 1, medium: 2, low: 3 },
  maxRetries: 3,
  retryBackoffMs: 1000,
  // Bounded narrative strings (defense against runaway model output).
  maxTitleLength: 160,
  maxDescriptionLength: 3000,
  maxRecommendationLength: 1500,
})

// ============================================================================
// TINY OUTPUT SCHEMA — AI ONLY GENERATES NARRATIVE
// ============================================================================

/**
 * Minimal schema for Gemini structured output.
 * ~200 tokens of JSON structure vs ~3000+ in the old schema.
 */
const NARRATIVE_INSIGHTS_SCHEMA = {
  type: 'object',
  properties: {
    insights: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          category: {
            type: 'string',
            enum: ['reliability', 'scalability', 'performance', 'cost', 'security'],
          },
          severity: {
            type: 'string',
            enum: ['critical', 'high', 'medium', 'low'],
          },
          title: {
            type: 'string',
            description: 'Concise, specific finding (max 80 chars)',
          },
          description: {
            type: 'string',
            description: 'Evidence-based explanation using ONLY provided metrics',
          },
          recommendation: {
            type: 'string',
            description: 'Specific, actionable recommendation tied to the evidence',
          },
          evidenceIds: {
            type: 'array',
            description: 'Stable finding ids from the evidence packet this insight uses',
            items: { type: 'string' },
          },
        },
        required: ['id', 'category', 'severity', 'title', 'description', 'recommendation', 'evidenceIds'],
      },
      maxItems: 5,
    },
  },
  required: ['insights'],
}

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

/**
 * Generate AI narrative insights from P3 results.
 *
 * @param {Object} simulationRecord — Full DB simulation record (for metadata)
 * @param {Object} p3Results — P3 analysis pipeline results (sanitized: null
 *   where an engine failed or never ran)
 * @param {Object} aggregated — Monte Carlo aggregated results
 * @param {Object} options — Optional { generateFn, versions }. generateFn
 *   replaces the Gemini call (tests); versions supplies report versions for
 *   the evidence packet (e.g. { dto } from the report builder).
 * @returns {AINarrative} AI-generated narrative only
 */
export async function generateAIInsights(simulationRecord, p3Results, aggregated, options = {}) {
  // Build evidence packet once (only abnormal findings) with traceability.
  const record = simulationRecord || {}
  const evidence = buildEvidencePacket(p3Results, aggregated, {
    simulation: {
      id: record.id,
      designId: record.designId,
      scenario: record.scenario,
      trafficPattern: record.trafficPattern,
      rps: record.rps,
      duration: record.duration,
      monteCarloPasses: record.monteCarloPasses,
      deterministicSeed: record.deterministicSeed,
    },
    versions: options.versions || {},
  })

  // If no abnormal findings, skip AI call entirely
  if (evidence.findings.length === 0) {
    console.log('[AI] No abnormal findings — skipping AI call')
    return generateHealthyInsights(evidence)
  }

  try {
    const prompt = buildNarrativePrompt(evidence)
    const aiResponse = await callGeminiWithRetry(prompt, options.generateFn)

    // Validate: every insight must cite real evidence ids — reject the rest.
    const validated = validateNarrativeAgainstEvidence(aiResponse, evidence)

    if (validated.insights.length === 0) {
      // Gemini produced nothing usable: deterministic fallback, documented.
      console.warn('[AI] All Gemini insights failed validation — using rule-based fallback')
      return generateRuleBasedInsights(evidence)
    }

    return {
      generatedAt: new Date().toISOString(),
      modelVersion: MODEL_CONFIG?.insightsModel || 'gemini-2.5-flash',
      insights: validated.insights,
      // Structured fields are intentionally null — populated by P3 in report-builder
      bottleneckAnalysis: null,
      rootCauseAnalysis: null,
      optimizationRecommendations: null,
      riskAssessment: null,
      costOptimization: null,
      evidencePacket: evidence,
      fallback: false,
    }
  } catch (err) {
    console.error('[AI] Gemini failed, using rule-based fallback:', err.message)
    return generateRuleBasedInsights(evidence)
  }
}

// ============================================================================
// PROMPT BUILDER — MINIMAL, EVIDENCE-CONSTRAINED
// ============================================================================

function fmtSummaryValue(value, format) {
  if (!isMeasured(value)) return 'unavailable (never zero, never healthy)'
  return format(value)
}

export function buildNarrativePrompt(evidence) {
  const summary = evidence.summary || {}
  const unavailable = evidence.unavailable || []

  // Build compact finding list with STABLE ids — the only citable references.
  const findingsText = evidence.findings.map((f) => {
    const rendered = isMeasured(f.value) ? `${f.value}${f.unit && f.unit !== 'mixed' ? ` ${f.unit}` : ''}` : 'unavailable'
    return `- [${f.id}] [${f.severity.toUpperCase()}] ${f.category} — ${f.message} (metric: ${f.metric}=${rendered}) [${f.status}]`
  }).join('\n')

  const unavailableText = unavailable.length
    ? unavailable.map(u => `- ${u.category}: ${u.status} — ${u.reason}`).join('\n')
    : '- none (all analyses evaluated)'

  return `You are an expert cloud architecture analyst. Analyze the following simulation findings and provide narrative insights.

## ARCHITECTURE SUMMARY (measured values only — "unavailable" means unknown, never zero, never healthy)
- Blocks: ${summary.blockCount ?? 'unavailable'}
- Availability: ${fmtSummaryValue(summary.overallAvailability, v => (v * 100).toFixed(2) + '%')}
- Scalability Score: ${fmtSummaryValue(summary.overallScalabilityScore, v => `${v}/100`)}
- Security Score: ${fmtSummaryValue(summary.overallSecurityScore, v => `${v}/100`)}
- P99 Latency: ${fmtSummaryValue(summary.globalLatencyP99, v => v.toFixed(0) + 'ms')}
- Error Rate: ${fmtSummaryValue(summary.globalErrorRate, v => (v * 100).toFixed(2) + '%')}
- SPOFs: ${summary.spofCount ?? 'unavailable'}
- Critical Bottlenecks: ${summary.criticalBottleneckCount ?? 'unavailable'}
- Critical Security Issues: ${summary.criticalSecurityCount ?? 'unavailable'}

## UNAVAILABLE OR FAILED ANALYSIS (draw NO conclusions from these — no healthy claims, no failure claims)
${unavailableText}

## ABNORMAL FINDINGS (${evidence.findingsCount} total)
${findingsText}

## CRITICAL CONSTRAINTS
1. You may ONLY reference metrics and findings listed above. NO external knowledge.
2. Every insight MUST include evidenceIds listing the [id] values it uses. An insight citing nothing is rejected.
3. Numbers in an explanation MUST restate values from the cited findings. Never invent latency, availability, cost, replica, or savings figures.
4. A recommendation MUST NOT promise a numerical outcome (no "improves availability to X%", no "saves Y%") unless that number appears in the cited findings.
5. NO generic advice like "consider monitoring" or "use best practices".
6. Each recommendation MUST be actionable and specific to this architecture.
7. Generate at most ${AI_CONFIG.maxInsights} insights. Prioritize critical issues first.
8. If evidence is insufficient, explain what is missing instead of concluding.

## REQUIRED OUTPUT FORMAT
Return a JSON object with this exact structure:

{
  "insights": [
    {
      "id": "ai-1",
      "category": "reliability|scalability|performance|cost|security",
      "severity": "critical|high|medium|low",
      "title": "Specific, evidence-based finding (max 80 chars)",
      "description": "Detailed explanation referencing finding ids and specific metrics",
      "recommendation": "Specific action the user should take",
      "evidenceIds": ["ev-reliability:single_point_of_failure:api-gateway"]
    }
  ]
}

Example good insight:
{
  "id": "ai-1",
  "category": "reliability",
  "severity": "critical",
  "title": "API Gateway is a single point of failure",
  "description": "Finding ev-reliability:single_point_of_failure:api-gateway shows api-gateway has no redundancy. Current availability is 99.77%.",
  "recommendation": "Add redundancy to the API Gateway (second replica or failover).",
  "evidenceIds": ["ev-reliability:single_point_of_failure:api-gateway"]
}
`
}

// ============================================================================
// GEMINI CALL WITH RETRY
// ============================================================================

async function callGeminiWithRetry(prompt, generateFn) {
  const generate = generateFn || generateInsights
  let lastError

  for (let attempt = 1; attempt <= AI_CONFIG.maxRetries; attempt++) {
    try {
      const response = await generate(prompt, {
        temperature: 0.1,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json',
        responseSchema: NARRATIVE_INSIGHTS_SCHEMA,
      })

      // Response is already parsed JSON from gemini.js extractStructuredOutput
      if (!response || !Array.isArray(response.insights)) {
        throw new Error('Invalid response structure: missing insights array')
      }

      return response
    } catch (err) {
      lastError = err
      console.warn(`[AI] Gemini attempt ${attempt}/${AI_CONFIG.maxRetries} failed:`, err.message)

      if (attempt < AI_CONFIG.maxRetries) {
        const backoffMs = attempt * AI_CONFIG.retryBackoffMs
        console.log(`[AI] Retrying in ${backoffMs}ms...`)
        await new Promise(r => setTimeout(r, backoffMs))
      }
    }
  }

  throw lastError
}

// ============================================================================
// NARRATIVE VALIDATION — DETERMINISTIC EVIDENCE-REFERENCE CHECK
// ============================================================================

// Rejection policy (documented): an insight is KEPT only if every check
// passes; otherwise it is REJECTED (never downgraded — a downgraded insight
// would still present unvalidated claims). A bare number or incidental
// substring never validates: numbers must occur inside CITED findings.
const NUMBER_PATTERN = /-?\d+(\.\d+)?\s*(%|percent|ms|milliseconds?|seconds?|rps|gb|\$|usd)?/gi
// Outcome units in recommendations promise results — only allowed verbatim
// from cited evidence. Plain integers (counts) are config actions, allowed.
const OUTCOME_UNIT_PATTERN = /-?\d+(\.\d+)?\s*(%|percent|ms|milliseconds?|seconds?|rps|\$|usd)/i

function normalizeNumberToken(token) {
  return token.replace(/,/g, '').replace(/\s*(%|percent|ms|milliseconds?|seconds?|rps|gb|\$|usd)\s*/i, '').trim().toLowerCase()
}

function trimNum(n) {
  return String(Math.round(n * 10000) / 10000)
}

// Every number the cited findings can vouch for: their raw numeric tokens
// plus the percent form of ratio values (0.9977 observed ⇒ "99.77" is a
// restatement, not an invention). Anything outside this set is unsupported.
function acceptedNumbers(findings) {
  const set = new Set()
  for (const f of findings || []) {
    for (const m of JSON.stringify(f).toLowerCase().match(/-?\d+(\.\d+)?/g) || []) set.add(m)
    const v = f?.value
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1) {
      set.add(trimNum(v * 100))
    }
  }
  return set
}

function descriptionNumbersSupported(text, accepted) {
  // Legacy "#N" finding references carry no numeric claim — strip them.
  const stripped = String(text).replace(/#\d+/g, '')
  const matches = stripped.match(NUMBER_PATTERN) || []
  return matches.every((token) => {
    const bare = normalizeNumberToken(token)
    if (!bare) return true
    return accepted.has(bare)
  })
}

export function validateNarrativeAgainstEvidence(aiResponse, evidence) {
  const insights = Array.isArray(aiResponse?.insights) ? aiResponse.insights : []
  const findingsById = Object.fromEntries((evidence?.findings || []).map(f => [f.id, f]))
  const validatedInsights = []

  for (const insight of (insights || []).slice(0, AI_CONFIG.maxInsights)) {
    // Shape: required fields, enums, bounded non-empty strings.
    if (!insight || typeof insight !== 'object') continue
    const { id, category, severity, title, description, recommendation, evidenceIds } = insight
    if (typeof id !== 'string' || !id
      || !AI_CONFIG.categories.includes(category)
      || !AI_CONFIG.severities.includes(severity)
      || typeof title !== 'string' || !title.trim() || title.length > AI_CONFIG.maxTitleLength
      || typeof description !== 'string' || !description.trim() || description.length > AI_CONFIG.maxDescriptionLength
      || typeof recommendation !== 'string' || !recommendation.trim() || recommendation.length > AI_CONFIG.maxRecommendationLength
      || !Array.isArray(evidenceIds) || evidenceIds.length === 0) {
      console.warn('[AI] Insight failed shape validation, rejecting:', id)
      continue
    }

    // Every cited id must exist. Unknown ids invalidate the whole insight —
    // a fabricated reference contaminates the explanation.
    if (!evidenceIds.every(eid => typeof eid === 'string' && findingsById[eid])) {
      console.warn(`[AI] Insight "${title}" cites unknown evidence ids — rejecting`)
      continue
    }

    const cited = evidenceIds.map(eid => findingsById[eid])

    // Description numbers must restate cited evidence.
    if (!descriptionNumbersSupported(description, acceptedNumbers(cited))) {
      console.warn(`[AI] Insight "${title}" contains numbers outside its cited evidence — rejecting`)
      continue
    }

    // Recommendations must not promise numerical outcomes absent from evidence.
    const accepted = acceptedNumbers(cited)
    const outcomeClaims = (title + ' ' + recommendation).match(new RegExp(OUTCOME_UNIT_PATTERN.source, 'gi')) || []
    const unsupportedOutcome = outcomeClaims.some((token) => {
      const bare = normalizeNumberToken(token)
      return bare && !accepted.has(bare)
    })
    if (unsupportedOutcome) {
      console.warn(`[AI] Insight "${title}" promises an outcome absent from evidence — rejecting`)
      continue
    }

    validatedInsights.push({ ...insight, evidenceValidated: true })
  }

  return { insights: validatedInsights }
}

// ============================================================================
// HEALTHY ARCHITECTURE INSIGHTS (no abnormal findings)
// ============================================================================

// A positive claim requires EVALUATED analysis with measured values.
// Missing/failed analysis yields no claim — never a healthy narrative.
export function generateHealthyInsights(evidence) {
  const summary = evidence?.summary || {}
  const status = evidence?.analysisStatus || {}
  const insights = []

  if (status.reliability === 'evaluated'
    && isMeasured(summary.overallAvailability)
    && (summary.spofCount || 0) === 0) {
    insights.push({
      id: 'ai-healthy-1',
      category: 'reliability',
      severity: 'low',
      title: 'Architecture shows good reliability posture',
      description: `No single points of failure detected. System availability is ${(summary.overallAvailability * 100).toFixed(2)}%.`,
      recommendation: 'Continue monitoring under growth scenarios.',
      evidenceValidated: true,
    })
  }

  if (status.scalability === 'evaluated'
    && isMeasured(summary.overallScalabilityScore)
    && summary.overallScalabilityScore >= THRESHOLD_POLICY.healthyScore.value
    && (summary.unsustainableGrowthAt || []).length === 0) {
    insights.push({
      id: 'ai-healthy-2',
      category: 'scalability',
      severity: 'low',
      title: 'Architecture has adequate scaling headroom',
      description: `Scalability score is ${summary.overallScalabilityScore}/100. All evaluated growth projections are sustainable.`,
      recommendation: 'Review scaling policies quarterly.',
      evidenceValidated: true,
    })
  }

  if (status.security === 'evaluated'
    && isMeasured(summary.overallSecurityScore)
    && summary.overallSecurityScore >= THRESHOLD_POLICY.healthyScore.value
    && (summary.criticalSecurityCount || 0) === 0) {
    insights.push({
      id: 'ai-healthy-3',
      category: 'security',
      severity: 'low',
      title: 'Security posture is strong',
      description: `Security score is ${summary.overallSecurityScore}/100 with no critical findings.`,
      recommendation: 'Schedule annual security audit.',
      evidenceValidated: true,
    })
  }

  return {
    generatedAt: new Date().toISOString(),
    modelVersion: 'healthy-architecture-template',
    insights,
    bottleneckAnalysis: null,
    rootCauseAnalysis: null,
    optimizationRecommendations: null,
    riskAssessment: null,
    costOptimization: null,
    evidencePacket: evidence,
    fallback: false,
  }
}

// ============================================================================
// RULE-BASED FALLBACK (Production Safety)
// ============================================================================

// Same evidence packet, same validity rules as the AI path. Deterministic for
// identical inputs. Never invents capacities, savings, or availability.
export function generateRuleBasedInsights(evidence) {
  const insights = []
  const findings = evidence?.findings || []
  const byType = (type) => findings.filter(f => f.type === type).slice(0, 2)

  for (const f of byType('single_point_of_failure')) {
    insights.push({
      id: `ai-spof-${f.target}`,
      category: 'reliability',
      severity: 'critical',
      title: `${f.target} is a single point of failure`,
      description: `${f.target} has no redundancy. Failure would disconnect the architecture.`,
      recommendation: `Introduce redundancy or failover for ${f.target}.`,
      evidenceIds: [f.id],
      evidenceValidated: true,
    })
  }

  for (const f of byType('saturated_component').concat(byType('near_saturation'))) {
    insights.push({
      id: `ai-bottleneck-${f.target}`,
      category: 'scalability',
      severity: f.severity,
      title: `${f.target} is near or at saturation`,
      description: f.message,
      // Engine recommendation when present, else the finding itself — never invented.
      recommendation: fallbackRecommendation(f),
      evidenceIds: [f.id],
      evidenceValidated: true,
    })
  }

  for (const f of byType('unsustainable_growth').slice(0, 1)) {
    insights.push({
      id: `ai-growth-${f.target}`,
      category: 'scalability',
      severity: 'high',
      title: f.message.split(' — ')[0],
      description: f.message,
      recommendation: 'Scale bottleneck components before traffic increases.',
      evidenceIds: [f.id],
      evidenceValidated: true,
    })
  }

  for (const f of [...byType('blast_radius'), ...byType('high_latency'), ...byType('high_error_rate')].slice(0, 2)) {
    insights.push({
      id: `ai-perf-${f.target}-${f.type}`,
      category: f.category,
      severity: f.severity,
      title: f.message.split(':')[0].slice(0, 120),
      description: f.message,
      recommendation: fallbackRecommendation(f),
      evidenceIds: [f.id],
      evidenceValidated: true,
    })
  }

  const criticalSecurity = findings.filter(f => f.category === 'security' && f.severity === 'critical').slice(0, 2)
  for (const f of criticalSecurity) {
    insights.push({
      id: `ai-sec-${f.target}-${f.type}`,
      category: 'security',
      severity: 'critical',
      title: f.message,
      description: f.message,
      recommendation: fallbackRecommendation(f),
      evidenceIds: [f.id],
      evidenceValidated: true,
    })
  }

  const costDrivers = byType('cost_driver').slice(0, 1)
  for (const f of costDrivers) {
    insights.push({
      id: `ai-cost-${f.target}`,
      category: 'cost',
      severity: 'medium',
      title: f.message,
      description: f.message,
      recommendation: fallbackRecommendation(f),
      evidenceIds: [f.id],
      evidenceValidated: true,
    })
  }

  return {
    generatedAt: new Date().toISOString(),
    modelVersion: 'rule-based-fallback',
    insights: insights.sort((a, b) => AI_CONFIG.severityOrder[a.severity] - AI_CONFIG.severityOrder[b.severity]),
    bottleneckAnalysis: null,
    rootCauseAnalysis: null,
    optimizationRecommendations: null,
    riskAssessment: null,
    costOptimization: null,
    evidencePacket: evidence,
    fallback: true,
  }
}

// Engine-authored recommendation when present; otherwise restate the finding.
// A restated finding is traceable — an invented fix is not.
function fallbackRecommendation(finding) {
  if (typeof finding?.recommendation === 'string' && finding.recommendation.trim()) {
    return finding.recommendation
  }
  return `${finding?.message || 'See cited evidence.'} Review this component before scaling or release.`
}
