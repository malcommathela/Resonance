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
import { buildEvidencePacket } from './evidence-builder.js'

// ============================================================================
// CONFIGURATION
// ============================================================================

const AI_CONFIG = Object.freeze({
  maxInsights: 5,
  minConfidence: 0.6,
  categories: ['reliability', 'scalability', 'performance', 'cost', 'security'],
  severityOrder: { critical: 0, high: 1, medium: 2, low: 3 },
  maxRetries: 3,
  retryBackoffMs: 1000,
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
        },
        required: ['id', 'category', 'severity', 'title', 'description', 'recommendation'],
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
 * @param {Object} p3Results — P3 analysis pipeline results
 * @param {Object} aggregated — Monte Carlo aggregated results
 * @returns {AINarrative} AI-generated narrative only
 */
export async function generateAIInsights(simulationRecord, p3Results, aggregated) {
  // Build evidence packet (only abnormal findings)
  const evidence = buildEvidencePacket(p3Results, aggregated)

  // If no abnormal findings, skip AI call entirely
  if (evidence.findings.length === 0) {
    console.log('[AI] No abnormal findings — skipping AI call')
    return generateHealthyInsights(p3Results, aggregated)
  }

  try {
    const prompt = buildNarrativePrompt(evidence, p3Results)
    const aiResponse = await callGeminiWithRetry(prompt)

    // Validate: ensure all insights reference actual evidence
    const validated = validateNarrativeAgainstEvidence(aiResponse, evidence)

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
    return generateRuleBasedInsights(p3Results, aggregated)
  }
}

// ============================================================================
// PROMPT BUILDER — MINIMAL, EVIDENCE-CONSTRAINED
// ============================================================================

function buildNarrativePrompt(evidence, p3Results) {
  const summary = evidence.summary
  const findings = evidence.findings

  // Build compact finding list
  const findingsText = findings.map((f, i) => {
    return `${i + 1}. [${f.severity.toUpperCase()}] ${f.category} — ${f.message} (metric: ${f.metric}=${f.value}${f.unit ? f.unit : ''})`
  }).join('\n')

  return `You are an expert cloud architecture analyst. Analyze the following simulation findings and provide narrative insights.

## ARCHITECTURE SUMMARY
- Blocks: ${summary.blockCount}
- Availability: ${summary.overallAvailability ? (summary.overallAvailability * 100).toFixed(2) + '%' : 'N/A'}
- Scalability Score: ${summary.overallScalabilityScore}/100
- Security Score: ${summary.overallSecurityScore}/100
- P99 Latency: ${summary.globalLatencyP99 ? summary.globalLatencyP99.toFixed(0) + 'ms' : 'N/A'}
- Error Rate: ${summary.globalErrorRate ? (summary.globalErrorRate * 100).toFixed(2) + '%' : 'N/A'}
- SPOFs: ${summary.spofCount}
- Critical Bottlenecks: ${summary.criticalBottleneckCount}
- Critical Security Issues: ${summary.criticalSecurityCount}

## ABNORMAL FINDINGS (${evidence.findingsCount} total)
${findingsText}

## CRITICAL CONSTRAINTS
1. You may ONLY reference metrics and findings listed above. NO external knowledge.
2. Every insight MUST directly reference specific findings by number.
3. NO generic advice like "consider monitoring" or "use best practices".
4. Each recommendation MUST be actionable and specific to this architecture.
5. Generate at most ${AI_CONFIG.maxInsights} insights. Prioritize critical issues first.
6. If a finding is ambiguous, explain what additional data would clarify it.

## REQUIRED OUTPUT FORMAT
Return a JSON object with this exact structure:

{
  "insights": [
    {
      "id": "ai-1",
      "category": "reliability|scalability|performance|cost|security",
      "severity": "critical|high|medium|low",
      "title": "Specific, evidence-based finding (max 80 chars)",
      "description": "Detailed explanation referencing findings by number and specific metrics",
      "recommendation": "Specific action the user should take"
    }
  ]
}

Example good insight:
{
  "id": "ai-1",
  "category": "reliability",
  "severity": "critical",
  "title": "API Gateway is a single point of failure",
  "description": "Finding #1 shows api-gateway has no redundancy. With only 1 replica, any failure disconnects all client traffic. Current availability is 99.77%.",
  "recommendation": "Add a second API Gateway replica with a load balancer in front. Target: 99.99% availability."
}
`
}

// ============================================================================
// GEMINI CALL WITH RETRY
// ============================================================================

async function callGeminiWithRetry(prompt) {
  let lastError

  for (let attempt = 1; attempt <= AI_CONFIG.maxRetries; attempt++) {
    try {
      const response = await generateInsights(prompt, {
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
// NARRATIVE VALIDATION
// ============================================================================

function validateNarrativeAgainstEvidence(aiResponse, evidence) {
  const insights = aiResponse.insights || []
  const validatedInsights = []

  for (const insight of insights) {
    // Basic field validation
    if (!insight.id || !insight.title || !insight.description || !insight.recommendation) {
      console.warn('[AI] Insight missing required fields, skipping:', insight)
      continue
    }

    // Check if description references findings (should contain #number or metric values)
    const hasEvidenceReference = evidence.findings.some((f, i) => {
      const findingRef = `\b${i + 1}\b`
      const metricRef = String(f.value).slice(0, 6)
      return insight.description.includes(`#${i + 1}`) ||
             insight.description.includes(metricRef) ||
             insight.description.toLowerCase().includes(f.message.toLowerCase().slice(0, 20))
    })

    if (!hasEvidenceReference) {
      console.warn(`[AI] Insight "${insight.title}" lacks evidence reference — marking low confidence`)
    }

    validatedInsights.push({
      ...insight,
      evidenceValidated: hasEvidenceReference,
    })
  }

  return { insights: validatedInsights }
}

// ============================================================================
// HEALTHY ARCHITECTURE INSIGHTS (no abnormal findings)
// ============================================================================

function generateHealthyInsights(p3Results, aggregated) {
  const globalMetrics = aggregated?.globalMetrics || {}
  const reliability = p3Results.reliabilityAnalysis || {}
  const scalability = p3Results.scalabilityAnalysis || {}
  const security = p3Results.securityAnalysis || {}

  const insights = []

  insights.push({
    id: 'ai-healthy-1',
    category: 'reliability',
    severity: 'low',
    title: 'Architecture shows good reliability posture',
    description: `No single points of failure detected. System availability is ${(reliability.availability * 100).toFixed(2)}% with ${reliability.mtbfHours || 'N/A'} hours MTBF.`,
    recommendation: 'Continue monitoring under growth scenarios.',
    evidenceValidated: true,
  })

  if (scalability.scalabilityScore >= 80) {
    insights.push({
      id: 'ai-healthy-2',
      category: 'scalability',
      severity: 'low',
      title: 'Architecture has adequate scaling headroom',
      description: `Scalability score is ${scalability.scalabilityScore}/100. All growth projections are sustainable.`,
      recommendation: 'Review scaling policies quarterly.',
      evidenceValidated: true,
    })
  }

  if (security.securityScore >= 80) {
    insights.push({
      id: 'ai-healthy-3',
      category: 'security',
      severity: 'low',
      title: 'Security posture is strong',
      description: `Security score is ${security.securityScore}/100 with no critical findings.`,
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
    evidencePacket: { findings: [], summary: {} },
    fallback: false,
  }
}

// ============================================================================
// RULE-BASED FALLBACK (Production Safety)
// ============================================================================

function generateRuleBasedInsights(p3Results, aggregated) {
  const insights = []
  const reliability = p3Results.reliabilityAnalysis || {}
  const scalability = p3Results.scalabilityAnalysis || {}
  const cost = p3Results.costAnalysis || {}
  const security = p3Results.securityAnalysis || {}

  const spofs = reliability.singlePointsOfFailure || []
  for (const spof of spofs.slice(0, 2)) {
    const blockId = typeof spof === 'string' ? spof : spof.blockId
    insights.push({
      id: `ai-spof-${blockId}`,
      category: 'reliability',
      severity: 'critical',
      title: `${blockId} is a single point of failure`,
      description: `Block ${blockId} has no redundancy. Failure would disconnect the architecture.`,
      recommendation: `Add at least 1 replica to ${blockId} or introduce a failover mechanism.`,
      evidenceValidated: true,
    })
  }

  const criticalBottlenecks = (scalability.bottlenecks || []).filter(b => b.severity === 'critical')
  for (const b of criticalBottlenecks.slice(0, 2)) {
    insights.push({
      id: `ai-bottleneck-${b.blockId}`,
      category: 'scalability',
      severity: 'critical',
      title: `${b.label} is saturated`,
      description: b.message,
      recommendation: b.recommendation,
      evidenceValidated: true,
    })
  }

  const unsustainableGrowth = (scalability.growthProjections || []).filter(p => !p.isSustainable)
  if (unsustainableGrowth.length > 0) {
    const first = unsustainableGrowth[0]
    insights.push({
      id: `ai-growth-${first.trafficMultiplier}x`,
      category: 'scalability',
      severity: 'high',
      title: `Architecture cannot sustain ${first.trafficMultiplier}x traffic growth`,
      description: `At ${first.trafficMultiplier}x traffic, ${first.predictedBottlenecks?.length || 0} components will saturate.`,
      recommendation: 'Scale bottleneck components before traffic increases.',
      evidenceValidated: true,
    })
  }

  const criticalSecurity = (security.bySeverity?.critical || [])
  for (const finding of criticalSecurity.slice(0, 2)) {
    insights.push({
      id: `ai-sec-${finding.id}`,
      category: 'security',
      severity: 'critical',
      title: finding.message,
      description: finding.description || finding.message,
      recommendation: finding.recommendation,
      evidenceValidated: true,
    })
  }

  if (cost.currentMonthlyCost && cost.drivers) {
    const topDriver = cost.drivers[0]
    if (topDriver && topDriver.percentageOfTotal > 30) {
      insights.push({
        id: `ai-cost-${topDriver.componentId}`,
        category: 'cost',
        severity: 'medium',
        title: `${topDriver.label || topDriver.componentId} drives ${topDriver.percentageOfTotal.toFixed(1)}% of cost`,
        description: topDriver.recommendation || 'Review capacity and scaling configuration.',
        recommendation: 'Consider right-sizing or reserved capacity.',
        evidenceValidated: true,
      })
    }
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
    evidencePacket: { findings: [], summary: {} },
    fallback: true,
  }
}