export async function generateArchitecture(files) {
  const prompt = buildPrompt(files)

  console.log('Calling Gemini with', files.length, 'files')

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 8192 }
      })
    }
  )

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(`Gemini API ${response.status}: ${error.error?.message || 'Unknown error'}`)
  }

  const data = await response.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text

  console.log('Gemini raw response length:', text?.length)

  if (!text) {
    throw new Error('Empty response from Gemini')
  }

  // Parse JSON from text
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/)
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[1])
    } else {
      const anyJson = text.match(/\{[\s\S]*"nodes"[\s\S]*\}/)
      if (anyJson) {
        parsed = JSON.parse(anyJson[0])
      } else {
        throw new Error('Failed to parse AI response')
      }
    }
  }

  console.log('AI raw nodes:', parsed.nodes?.length, 'edges:', parsed.edges?.length)

  return normalizeArchitecture(parsed)
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

MANDATORY CONNECTIONS — create edges for ALL of these:
1. Client → API Gateway (or Client → Service if no gateway)
2. API Gateway → every Service
3. Every Service → Database (if DB exists)
4. Every Service → Cache (if cache exists)
5. Every Service → Message Queue (if queue exists)
6. Every Service → External API (if external APIs exist)
7. Every Service → Storage (if storage exists)

CRITICAL RULE: The "source" and "target" fields in edges MUST exactly match the "id" fields of existing nodes. Do not create edges to non-existent nodes.

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

Return ONLY valid JSON:
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
- Edge source/target MUST exactly match node ids`
}

function normalizeArchitecture(parsed) {
  // First, normalize all nodes with guaranteed unique IDs
  const nodes = (parsed.nodes || []).map((n, i) => ({
    id: n.id || `node-${i}`,
    type: n.type || 'service',
    label: n.label || 'Unknown',
    color: n.color || '#3b82f6',
    position: n.position || { x: 100 + (i % 4) * 250, y: 100 + Math.floor(i / 4) * 200 },
    config: n.config || {},
  }))

  // Build valid node ID set
  const validIds = new Set(nodes.map(n => n.id))
  console.log('Normalized node IDs:', Array.from(validIds))

  // Filter edges: both source and target must exist, and not self-referencing
  let edges = (parsed.edges || [])
    .filter(e => {
      const srcOk = validIds.has(e.source)
      const tgtOk = validIds.has(e.target)
      const notSelf = e.source !== e.target
      if (!srcOk) console.warn('Edge has invalid source:', e.source, 'valid IDs:', Array.from(validIds))
      if (!tgtOk) console.warn('Edge has invalid target:', e.target)
      return srcOk && tgtOk && notSelf
    })
    .map((e, i) => ({
      id: e.id || `edge-${i}`,
      source: e.source,
      target: e.target,
      connectionType: e.connectionType || 'http',
    }))

  console.log('Valid edges after filtering:', edges.length)

  // If AI didn't generate edges or all were invalid, create logical fallback edges
  if (edges.length === 0 && nodes.length > 1) {
    console.log('Creating fallback edges...')

    const byType = (type) => nodes.filter(n => n.type === type)
    const client = byType('client')[0]
    const gateway = byType('api-gateway')[0] || byType('load-balancer')[0]
    const services = byType('service')
    const databases = byType('database')
    const caches = byType('cache')
    const queues = byType('message-queue')
    const externals = [...byType('external-api'), ...byType('storage')]

    let idx = 0
    const makeEdge = (src, tgt, ctype = 'http') => {
      const edge = {
        id: `fallback-${idx++}`,
        source: src.id,
        target: tgt.id,
        connectionType: ctype,
      }
      console.log('Fallback edge:', edge.source, '->', edge.target)
      return edge
    }

    // Client → Gateway → Services
    if (client && gateway) {
      edges.push(makeEdge(client, gateway))
      services.forEach(s => edges.push(makeEdge(gateway, s)))
    } else if (client && services[0]) {
      edges.push(makeEdge(client, services[0]))
    }

    // Services → Data layer
    services.forEach(svc => {
      databases.forEach(db => edges.push(makeEdge(svc, db, 'db')))
      caches.forEach(c => edges.push(makeEdge(svc, c, 'http')))
      queues.forEach(q => edges.push(makeEdge(svc, q, 'event')))
      externals.forEach(ext => edges.push(makeEdge(svc, ext, 'http')))
    })

    console.log('Total fallback edges:', edges.length)
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