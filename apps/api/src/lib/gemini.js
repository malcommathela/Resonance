import { GoogleGenAI } from '@google/genai'

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

// ============================================================================
// MODEL CONFIGURATION
// ============================================================================

const MODEL_CONFIG = Object.freeze({
  architectureModel: 'gemini-2.5-flash',
  insightsModel: 'gemini-2.5-flash',
  maxArchitectureTokens: 8192,
  maxInsightTokens: 4096,
  defaultTemperature: 0.1,
})

// ============================================================================
// ARCHITECTURE GENERATION
// ============================================================================

export async function generateArchitecture(files) {
  const prompt = buildArchitecturePrompt(files)

  console.log('[Gemini] Analyzing', files.length, 'files')

  try {
    const result = await genAI.models.generateContent({
      model: MODEL_CONFIG.architectureModel,
      contents: prompt,
      config: {
        temperature: MODEL_CONFIG.defaultTemperature,
        maxOutputTokens: MODEL_CONFIG.maxArchitectureTokens,
        responseMimeType: 'application/json',
      },
    })

    logResponseMeta(result, 'Architecture')

    const parsed = extractStructuredOutput(result)
    if (!parsed) {
      throw new Error('Empty or unparsable response from Gemini')
    }

    console.log('[Gemini] Nodes:', parsed.nodes?.length, 'Edges:', parsed.edges?.length)
    return normalizeArchitecture(parsed)
  } catch (err) {
    console.error('[Gemini] Architecture generation error:', err.message)
    throw err
  }
}

// ============================================================================
// AI INSIGHTS GENERATION
// ============================================================================

export async function generateInsights(prompt, options = {}) {
  console.log('[Gemini Insights] Prompt length:', prompt?.length, 'chars')

  const config = {
    temperature: options.temperature ?? MODEL_CONFIG.defaultTemperature,
    maxOutputTokens: options.maxOutputTokens ?? MODEL_CONFIG.maxInsightTokens,
    responseMimeType: 'application/json',
  }

  if (options.responseSchema) {
    config.responseSchema = options.responseSchema
  }

  try {
    const result = await genAI.models.generateContent({
      model: MODEL_CONFIG.insightsModel,
      contents: prompt,
      config,
    })

    logResponseMeta(result, 'Insights')

    const parsed = extractStructuredOutput(result)

    if (!parsed) {
      throw new Error('Empty or unparsable response from Gemini')
    }

    console.log('[Gemini Insights] Parsed successfully.')
    return parsed
  } catch (err) {
    console.error('[Gemini Insights] Error:', err.message)
    throw err
  }
}

// ============================================================================
// UNIFIED STRUCTURED OUTPUT EXTRACTION
// ============================================================================

function extractStructuredOutput(result) {
  if (!result) return null

  // Attempt 1: SDK v2+ structured output
  if (result.parsed && typeof result.parsed === 'object') {
    console.log('[Gemini] Using SDK structured output (result.parsed)')
    return result.parsed
  }

  if (result.response?.parsed && typeof result.response.parsed === 'object') {
    console.log('[Gemini] Using SDK structured output (result.response.parsed)')
    return result.response.parsed
  }

  // Attempt 2: Output field (some SDK versions)
  if (result.output && typeof result.output === 'object') {
    console.log('[Gemini] Using SDK output field')
    return result.output
  }

  // Attempt 3: Text parsing (fallback)
  const text = result.text
  if (!text || typeof text !== 'string') {
    console.warn('[Gemini] No text field in response')
    return null
  }

  console.log('[Gemini] Falling back to text parsing, length:', text.length)
  return safeJsonParse(text)
}

// ============================================================================
// DEBUG LOGGING
// ============================================================================

function logResponseMeta(result, label) {
  try {
    // FIX: @google/genai SDK returns candidates directly on result, not nested under result.response
    const candidate = result?.candidates?.[0]
    const finishReason = candidate?.finishReason
    const usage = result?.usageMetadata
    const textLen = result?.text?.length ?? 0

    console.log(`[Gemini ${label}] Finish reason:`, finishReason)
    console.log(`[Gemini ${label}] Usage:`, JSON.stringify(usage))
    console.log(`[Gemini ${label}] Text length:`, textLen)

    if (finishReason === 'MAX_TOKENS') {
      console.warn(`[Gemini ${label}] WARNING: Response truncated due to MAX_TOKENS. Increase maxOutputTokens.`)
    }
    if (finishReason === 'SAFETY') {
      console.warn(`[Gemini ${label}] WARNING: Response blocked by SAFETY filters.`)
    }
    if (finishReason === 'RECITATION') {
      console.warn(`[Gemini ${label}] WARNING: Response blocked by RECITATION.`)
    }
  } catch (e) {
    // Non-fatal
  }
}

// ============================================================================
// ROBUST JSON PARSER (truncation-aware)
// ============================================================================

function safeJsonParse(raw) {
  if (!raw || typeof raw !== 'string') {
    return null
  }

  let text = raw.trim()

  // Remove markdown fences
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()

  // Direct parse
  try {
    return JSON.parse(text)
  } catch {}

  // Extract outermost JSON object using proper brace tracking
  const start = text.indexOf('{')
  if (start === -1) return null

  let depth = 0
  let inString = false
  let escape = false

  for (let i = start; i < text.length; i++) {
    const ch = text[i]

    if (escape) {
      escape = false
      continue
    }
    if (ch === '\\') {
      escape = true
      continue
    }
    if (ch === '"') {
      inString = !inString
      continue
    }
    if (inString) continue

    if (ch === '{') depth++
    if (ch === '}') {
      depth--
      if (depth === 0) {
        const candidate = text.substring(start, i + 1)

        // Try direct parse
        try {
          return JSON.parse(candidate)
        } catch {}

        // Try removing trailing commas
        const repaired = candidate.replace(/,\s*([}\]])/g, '$1')
        try {
          return JSON.parse(repaired)
        } catch {}

        return null
      }
    }
  }

  // If we reach here, the JSON is incomplete (no matching closing brace)
  console.error('[Gemini] Incomplete JSON — model response was truncated.')
  return null
}

// ============================================================================
// ARCHITECTURE PROMPT BUILDER
// ============================================================================

function buildArchitecturePrompt(files) {
  const fileSummary = files.map(f => {
    const content = f.content.length > 3000
      ? f.content.slice(0, 3000) + '\n... [truncated]'
      : f.content
    return `=== ${f.path} ===\n${content}`
  }).join('\n\n')

  return `Analyze this codebase and generate a system architecture diagram as JSON.

CODEBASE FILES:
${fileSummary}

Generate a complete system architecture with nodes and edges. CRITICAL: Every component must be connected to at least one other component via edges.

Node types:
- client (frontend apps)
- service (backend APIs, workers)
- database (postgres, mysql, mongodb)
- cache (redis, memcached)
- message-queue (kafka, rabbitmq)
- api-gateway (nginx, kong)
- load-balancer (nginx, traefik)
- external-api (stripe, aws, sendgrid)
- storage (s3, gcs)
- cdn (cloudflare)

MANDATORY CONNECTIONS:
1. Client → API Gateway (or Client → Service if no gateway)
2. API Gateway → every Service
3. Every Service → Database (if DB exists)
4. Every Service → Cache (if cache exists)
5. Every Service → Message Queue (if queue exists)
6. Every Service → External API (if external APIs exist)
7. Every Service → Storage (if storage exists)

CRITICAL: The "source" and "target" fields in edges MUST exactly match the "id" fields of existing nodes.

Position layout (y coordinates):
- Clients: y = 50-150
- API Gateway / Load Balancer: y = 200-300
- Services: y = 400-600
- Databases / Cache / Queue: y = 700-900
- External APIs / Storage: y = 700-900 (right side)
Spread x coordinates evenly: 100, 350, 600, 850, 1100

Colors:
- client: #6366f1
- service: #3b82f6
- database: #10b981
- cache: #f59e0b
- message-queue: #ef4444
- api-gateway: #8b5cf6
- load-balancer: #06b6d4
- external-api: #84cc16
- storage: #ec4899
- cdn: #14b8a6

Return ONLY valid JSON. Do NOT include markdown formatting, explanations, or code blocks. Return raw JSON only:
{
  "nodes": [
    {
      "id": "unique-string-no-spaces",
      "type": "client|service|database|cache|message-queue|api-gateway|load-balancer|external-api|storage|cdn",
      "label": "Human Readable Name",
      "color": "#hexcolor",
      "position": {"x": 100, "y": 100},
      "config": {"port": 3000, "framework": "express", "engine": "postgres"}
    }
  ],
  "edges": [
    {
      "id": "edge-1",
      "source": "MUST-match-a-node-id-exactly",
      "target": "MUST-match-a-node-id-exactly",
      "connectionType": "http|db|event|grpc|websocket|s3"
    }
  ],
  "metadata": {
    "architecture": "microservices|monolith|serverless|layered|event-driven",
    "description": "2-3 sentence summary of the architecture",
    "technologies": ["express", "react", "postgres", "redis"]
  }
}

IMPORTANT:
- Every service MUST have at least one outgoing edge to a database, cache, or external API
- The client MUST connect to something
- Create 1-3 edges per service minimum
- Use descriptive labels like "Resonance Web App" not generic "Client"
- Edge source/target MUST exactly match node ids
- Do NOT include trailing commas
- Ensure all arrays and objects are properly closed`
}

// ============================================================================
// ARCHITECTURE NORMALIZER
// ============================================================================

function normalizeArchitecture(parsed) {
  const nodes = (parsed.nodes || []).map((n, i) => ({
    id: n.id || `node-${i}`,
    type: n.type || 'service',
    label: n.label || 'Unknown',
    color: n.color || '#3b82f6',
    position: n.position || { x: 100 + (i % 4) * 250, y: 100 + Math.floor(i / 4) * 200 },
    config: n.config || {},
  }))

  const validIds = new Set(nodes.map(n => n.id))
  console.log('[Gemini] Valid node IDs:', Array.from(validIds))

  let edges = (parsed.edges || [])
    .filter(e => {
      const srcOk = validIds.has(e.source)
      const tgtOk = validIds.has(e.target)
      const notSelf = e.source !== e.target
      if (!srcOk) console.warn('[Gemini] Invalid source:', e.source)
      if (!tgtOk) console.warn('[Gemini] Invalid target:', e.target)
      return srcOk && tgtOk && notSelf
    })
    .map((e, i) => ({
      id: e.id || `edge-${i}`,
      source: e.source,
      target: e.target,
      connectionType: e.connectionType || 'http',
    }))

  console.log('[Gemini] Valid edges:', edges.length)

  if (edges.length === 0 && nodes.length > 1) {
    console.log('[Gemini] Creating fallback edges...')
    const byType = (type) => nodes.filter(n => n.type === type)
    const client = byType('client')[0]
    const gateway = byType('api-gateway')[0] || byType('load-balancer')[0]
    const services = byType('service')
    const databases = byType('database')
    const caches = byType('cache')
    const queues = byType('message-queue')
    const externals = [...byType('external-api'), ...byType('storage')]

    let idx = 0
    const makeEdge = (src, tgt, ctype = 'http') => ({
      id: `fallback-${idx++}`,
      source: src.id,
      target: tgt.id,
      connectionType: ctype,
    })

    if (client && gateway) {
      edges.push(makeEdge(client, gateway))
      services.forEach(s => edges.push(makeEdge(gateway, s)))
    } else if (client && services[0]) {
      edges.push(makeEdge(client, services[0]))
    }

    services.forEach(svc => {
      databases.forEach(db => edges.push(makeEdge(svc, db, 'db')))
      caches.forEach(c => edges.push(makeEdge(svc, c, 'http')))
      queues.forEach(q => edges.push(makeEdge(svc, q, 'event')))
      externals.forEach(ext => edges.push(makeEdge(svc, ext, 'http')))
    })

    console.log('[Gemini] Fallback edges created:', edges.length)
  }

  return {
    blocks: nodes,
    edges,
    metadata: parsed.metadata || {
      architecture: 'unknown',
      description: 'Architecture generated by AI',
      technologies: [],
    }
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export { MODEL_CONFIG }