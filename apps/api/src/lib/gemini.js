import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

export async function generateArchitecture(files) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
  const prompt = buildPrompt(files)

  console.log('[Gemini] Analyzing', files.length, 'files')

  try {
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 8192,
        responseMimeType: 'application/json',
      }
    })

    const response = await result.response
    const text = response.text()

    console.log('[Gemini] Raw response length:', text?.length)

    if (!text) {
      throw new Error('Empty response from Gemini')
    }

    const parsed = parseGeminiJson(text)
    console.log('[Gemini] Nodes:', parsed.nodes?.length, 'Edges:', parsed.edges?.length)

    return normalizeArchitecture(parsed)
  } catch (err) {
    console.error('[Gemini] Error:', err.message)
    throw err
  }
}

function parseGeminiJson(text) {
  let jsonText = text.trim()

  // Extract JSON from code blocks
  const codeBlockMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlockMatch) {
    jsonText = codeBlockMatch[1].trim()
  }

  // Remove leading/trailing non-JSON
  const jsonStart = jsonText.indexOf('{')
  const jsonEnd = jsonText.lastIndexOf('}')
  if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
    jsonText = jsonText.slice(jsonStart, jsonEnd + 1)
  }

  try {
    return JSON.parse(jsonText)
  } catch (originalErr) {
    console.warn('[Gemini] Initial JSON parse failed, attempting repair...')
  }

  // JSON repair heuristics
  let repaired = jsonText
  repaired = repaired.replace(/,\s*([\]\}])/g, '$1')

  const openBraces = (repaired.match(/\{/g) || []).length
  const closeBraces = (repaired.match(/\}/g) || []).length
  const openBrackets = (repaired.match(/\[/g) || []).length
  const closeBrackets = (repaired.match(/\]/g) || []).length

  for (let i = 0; i < openBraces - closeBraces; i++) repaired += '}'
  for (let i = 0; i < openBrackets - closeBrackets; i++) repaired += ']'

  const lastBrace = repaired.lastIndexOf('}')
  if (lastBrace !== -1) repaired = repaired.slice(0, lastBrace + 1)

  try {
    return JSON.parse(repaired)
  } catch (repairErr) {
    console.error('[Gemini] JSON repair failed. Raw:', jsonText.slice(0, 500))
    throw new Error('AI returned invalid JSON. Please try again with a different repository.')
  }
}

function buildPrompt(files) {
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

  // Fallback edges if AI failed to generate any
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