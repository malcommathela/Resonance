import { api } from '@/services/api'

/*
 * Chat transport for the AI Chat feature — LIVE backend by default.
 *
 * The backend (apps/api, `/chat` routes) persists sessions/messages and
 * streams Server-Sent Events from the POST itself:
 *
 *   POST /chat/sessions                       create session
 *   GET  /chat/sessions                       list sessions (cursor)
 *   GET  /chat/sessions/:id                   session detail
 *   PATCH /chat/sessions/:id                  rename / archive
 *   DELETE /chat/sessions/:id                 delete (cascades messages)
 *   POST /chat/sessions/:id/messages          submit + SSE stream
 *   GET  /chat/sessions/:id/messages          cursor-paginated history
 *   POST /chat/sessions/:id/messages/:messageId/retry   retry + SSE stream
 *   GET  /chat/requests/:requestId            durable request state
 *   GET  /chat/generations/:generationId      generation state
 *
 * SSE event contract (JSON in `data`, named event + sequence id):
 *   { type: 'status', stage, label }     -> surfaced as "thinking"
 *   { type: 'chunk', content }           -> streamed markdown
 *   { type: 'generation', design }       -> durable generation card (has designId)
 *   { type: 'error', code, message, retryable }
 *   { type: 'done', metadata }
 *
 * Every stream POST carries an X-Idempotency-Key. fetchEventSource re-POSTs
 * the same body on network reconnects, so the backend replays/attaches to the
 * same operation instead of creating a duplicate (spec §30-31).
 *
 * Legacy demo mode: set VITE_CHAT_MOCK=true to serve responses from the local
 * mock streamer (no backend required). The mock ignores sessions/persistence.
 */
const USE_MOCK = import.meta.env.VITE_CHAT_MOCK === 'true'
const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/+$/, '')

const sleep = (ms, signal) =>
  new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(t)
        reject(new DOMException('Aborted', 'AbortError'))
      },
      { once: true }
    )
  })

const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min

export const newIdempotencyKey = () =>
  crypto.randomUUID?.() || `idem-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

/* ------------------------------------------------------------------ */
/* REST helpers (live backend)                                         */
/* ------------------------------------------------------------------ */

// Backend chat errors use { error: { code, message, retryable }, requestId };
// normalize whatever shape arrives into a human message.
const toMessage = (data, fallback) => {
  const raw = data?.error
  if (typeof raw === 'string') return raw
  if (raw?.message) return raw.message
  return fallback
}

export const chatRest = {
  listSessions: (limit = 50) =>
    api.request(`/chat/sessions?limit=${limit}`),

  createSession: ({ title, designId } = {}) =>
    api.request('/chat/sessions', { method: 'POST', body: JSON.stringify({ title, designId }) }),

  getSession: (id) => api.request(`/chat/sessions/${id}`),

  getMessages: (id, { before, limit = 50 } = {}) => {
    const qs = new URLSearchParams()
    if (before) qs.set('before', before)
    qs.set('limit', String(limit))
    return api.request(`/chat/sessions/${id}/messages?${qs.toString()}`)
  },

  patchSession: (id, data) =>
    api.request(`/chat/sessions/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  deleteSession: (id) => api.request(`/chat/sessions/${id}`, { method: 'DELETE' }),

  getGeneration: (id) => api.request(`/chat/generations/${id}`),

  cancelGeneration: (id) =>
    api.request(`/chat/generations/${id}/cancel`, { method: 'POST', body: '{}' }),
}

/* ------------------------------------------------------------------ */
/* Live SSE transport                                                  */
/* ------------------------------------------------------------------ */

async function openChatStream({ path, body, signal, onEvent }) {
  const { fetchEventSource } = await import('@microsoft/fetch-event-source')
  const token = await api.getAuthToken()

  await fetchEventSource(`${API_BASE}${path}`, {
    method: 'POST',
    openWhenHidden: true,
    signal,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-Idempotency-Key': newIdempotencyKey(),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
    async onopen(response) {
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw Object.assign(
          new Error(toMessage(data, `Chat request failed (${response.status})`)),
          { status: response.status }
        )
      }
    },
    onmessage(msg) {
      if (!msg.data) return
      try {
        const evt = JSON.parse(msg.data)
        if (evt.type === 'heartbeat') return
        // Backend `status` events carry progress labels — surface as thinking.
        if (evt.type === 'status') {
          onEvent({ type: 'thinking', label: evt.label || evt.stage })
          return
        }
        onEvent(evt)
      } catch {
        /* ignore malformed frames */
      }
    },
  })
  onEvent({ type: 'done', metadata: {} })
}

/**
 * Stream an assistant response for a new message.
 * The store guarantees `sessionId` (a backend session) before calling.
 */
export async function streamChat({ sessionId, content, useDesignSystem = false, designId = null, signal, onEvent }) {
  if (USE_MOCK) {
    return runMock({ content, design: null, useDesignSystem, signal, onEvent })
  }
  if (!sessionId) throw new Error('No chat session — create one before sending.')
  return openChatStream({
    path: `/chat/sessions/${sessionId}/messages`,
    body: { message: content, useDesignSystem, ...(designId ? { designId } : {}) },
    signal,
    onEvent,
  })
}

/**
 * Re-run a turn server-side (spec §80): retries the AI operation for an
 * existing user message WITHOUT duplicating it. Streams the new attempt.
 */
export async function retryChat({ sessionId, userMessageId, signal, onEvent }) {
  return openChatStream({
    path: `/chat/sessions/${sessionId}/messages/${userMessageId}/retry`,
    body: {},
    signal,
    onEvent,
  })
}

/* ------------------------------------------------------------------ */
/* Legacy mock (VITE_CHAT_MOCK=true only)                              */
/* ------------------------------------------------------------------ */

const QUESTION_RE = /\b(what|why|how|explain|compare|vs\.?|versus|difference|when|which|should|does|is|are|can)\b/i
const GENERATION_RE = /\b(build|create|generate|make|design|architect|draft|draw)\b/i

export const isGenerationRequest = (content) =>
  GENERATION_RE.test(content) && !QUESTION_RE.test(content)

const TYPE_META = {
  client:         { label: 'Web Client',        icon: 'Globe',      category: 'frontend',   color: '#6366f1', cost: 0 },
  cdn:            { label: 'CDN',               icon: 'Globe',      category: 'network',    color: '#22c55e', cost: 45 },
  'load-balancer':{ label: 'Load Balancer',     icon: 'Shuffle',    category: 'network',    color: '#3b82f6', cost: 25 },
  'api-gateway':  { label: 'API Gateway',       icon: 'DoorOpen',   category: 'network',    color: '#06b6d4', cost: 60 },
  service:        { label: 'Service',           icon: 'Server',     category: 'compute',    color: '#3b82f6', cost: 85 },
  database:       { label: 'Database',          icon: 'Database',   category: 'data',       color: '#f97316', cost: 180 },
  cache:          { label: 'Cache (Redis)',     icon: 'Zap',        category: 'data',       color: '#ef4444', cost: 60 },
  'message-queue':{ label: 'Message Queue',     icon: 'Mail',       category: 'messaging',  color: '#eab308', cost: 55 },
  websocket:      { label: 'WebSocket Server',  icon: 'Radio',      category: 'network',    color: '#ec4899', cost: 70 },
  storage:        { label: 'Object Storage',    icon: 'HardDrive',  category: 'data',       color: '#14b8a6', cost: 40 },
  'external-api': { label: 'External API',      icon: 'Plug',       category: 'integration',color: '#84cc16', cost: 0 },
}

const TEMPLATES = [
  {
    match: /notif|real.?time|chat|socket|live|feed|presence|alert/i,
    name: 'Real-Time Notification System',
    description: 'Event-driven notification pipeline with WebSocket fan-out and a queue-buffered worker.',
    nodes: [
      ['client', 'Web / Mobile Client', 0, 1],
      ['api-gateway', 'API Gateway', 1, 1],
      ['websocket', 'Realtime Gateway', 2, 0],
      ['service', 'Notification API', 2, 2],
      ['message-queue', 'Notification Queue', 3, 2],
      ['service', 'Delivery Worker', 4, 2],
      ['cache', 'Presence Cache', 2, 3],
      ['database', 'User & Prefs DB', 4, 3],
    ],
    edges: [[0, 1, 'http'], [0, 2, 'websocket'], [1, 3, 'http'], [3, 5, 'http'], [5, 4, 'event'], [4, 6, 'http'], [5, 7, 'db']],
  },
  {
    match: /url.?short|shorten|short.?link/i,
    name: 'URL Shortener',
    description: 'Redirect-cached shortening service with async click analytics.',
    nodes: [
      ['client', 'Web Client', 0, 1],
      ['cdn', 'CDN', 0, 0],
      ['load-balancer', 'Load Balancer', 1, 1],
      ['api-gateway', 'API Gateway', 2, 1],
      ['service', 'Shortener API', 3, 1],
      ['cache', 'Redirect Cache', 4, 0],
      ['database', 'Links DB', 4, 2],
      ['message-queue', 'Click Events', 3, 3],
      ['service', 'Analytics Worker', 4, 3],
    ],
    edges: [[0, 1, 'http'], [0, 2, 'http'], [2, 3, 'http'], [3, 4, 'http'], [4, 5, 'http'], [4, 6, 'db'], [4, 7, 'event'], [7, 8, 'event']],
  },
  {
    match: /e-?commerce|order|shop|cart|payment|checkout|marketplace|inventory/i,
    name: 'E-Commerce Order Platform',
    description: 'Order management with separated payment and inventory flows behind a queue.',
    nodes: [
      ['client', 'Storefront', 0, 1],
      ['cdn', 'CDN', 0, 0],
      ['load-balancer', 'Load Balancer', 1, 1],
      ['api-gateway', 'API Gateway', 2, 1],
      ['service', 'Order Service', 3, 0],
      ['service', 'Payment Service', 3, 1],
      ['service', 'Inventory Service', 3, 2],
      ['message-queue', 'Order Events', 4, 1],
      ['cache', 'Session Cache', 2, 2],
      ['database', 'Orders DB', 4, 0],
    ],
    edges: [[0, 1, 'http'], [0, 2, 'http'], [2, 3, 'http'], [3, 4, 'http'], [3, 5, 'http'], [3, 6, 'http'], [4, 7, 'event'], [5, 8, 'db'], [6, 9, 'db'], [7, 6, 'event']],
  },
  {
    match: /video|media|stream(ing)?\b|image|photo|upload|file|transcode/i,
    name: 'Media Processing Platform',
    description: 'Upload API feeding a transcode pipeline with object storage and CDN delivery.',
    nodes: [
      ['client', 'Web Client', 0, 1],
      ['cdn', 'CDN', 1, 0],
      ['api-gateway', 'API Gateway', 1, 1],
      ['service', 'Upload API', 2, 1],
      ['message-queue', 'Transcode Queue', 3, 1],
      ['service', 'Transcode Worker', 4, 1],
      ['storage', 'Object Storage', 4, 0],
      ['database', 'Media DB', 2, 2],
      ['cache', 'Signed URL Cache', 3, 2],
    ],
    edges: [[0, 2, 'http'], [1, 0, 'http'], [2, 3, 'http'], [3, 4, 'event'], [4, 5, 'event'], [5, 6, 'http'], [3, 7, 'db'], [5, 8, 'http']],
  },
  {
    match: /auth|login|identity|sso|account|user (mgmt|management|service)/i,
    name: 'Authentication & Identity Service',
    description: 'Token-based auth with session caching and transactional email via a queue.',
    nodes: [
      ['client', 'Web / App Client', 0, 1],
      ['api-gateway', 'API Gateway', 1, 1],
      ['service', 'Auth API', 2, 1],
      ['cache', 'Session Cache', 3, 0],
      ['database', 'Users DB', 3, 1],
      ['message-queue', 'Email Queue', 2, 2],
      ['external-api', 'Email Provider', 3, 2],
    ],
    edges: [[0, 1, 'http'], [1, 2, 'http'], [2, 3, 'http'], [2, 4, 'db'], [2, 5, 'event'], [5, 6, 'event']],
  },
  {
    match: /iot|telemetry|sensor|metric|monitor|ingest/i,
    name: 'IoT Telemetry Pipeline',
    description: 'High-volume ingestion buffered by a queue into time-series storage.',
    nodes: [
      ['client', 'Devices / Sensors', 0, 1],
      ['load-balancer', 'Load Balancer', 1, 1],
      ['api-gateway', 'Ingest Gateway', 2, 1],
      ['message-queue', 'Telemetry Queue', 3, 1],
      ['service', 'Ingest Worker', 4, 1],
      ['database', 'Time-Series DB', 4, 0],
      ['service', 'Query API', 3, 2],
      ['cache', 'Query Cache', 4, 2],
    ],
    edges: [[0, 1, 'http'], [1, 2, 'http'], [2, 3, 'event'], [3, 4, 'event'], [4, 5, 'db'], [4, 6, 'http'], [6, 7, 'http']],
  },
]

const DEFAULT_TEMPLATE = {
  name: 'Scalable Microservice Stack',
  description: 'General-purpose scalable web service with queue-buffered workers.',
  nodes: [
    ['client', 'Web Client', 0, 1],
    ['cdn', 'CDN', 0, 0],
    ['load-balancer', 'Load Balancer', 1, 1],
    ['api-gateway', 'API Gateway', 2, 1],
    ['service', 'Core API', 3, 0],
    ['service', 'Worker', 3, 2],
    ['message-queue', 'Task Queue', 4, 2],
    ['cache', 'Redis Cache', 3, 1],
    ['database', 'Primary DB', 4, 0],
  ],
  edges: [[0, 1, 'http'], [0, 2, 'http'], [2, 3, 'http'], [3, 4, 'http'], [4, 6, 'event'], [6, 5, 'event'], [4, 8, 'db'], [4, 7, 'http']],
}

const deriveDesignName = (content) => {
  const stripped = content
    .replace(/^(please\s+)?(can you\s+)?/i, '')
    .replace(/^(build|create|generate|make|design|architect|draft|draw)(\s+me)?(\s+(a|an|the))?\s+/i, '')
    .replace(/[.?!]+$/, '')
    .trim()
  const name = stripped
    .split(/\s+/)
    .slice(0, 5)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
  return name || 'New System Design'
}

const buildGeneration = (content) => {
  const template = TEMPLATES.find((t) => t.match.test(content)) || DEFAULT_TEMPLATE
  const isCustomName = !TEMPLATES.some((t) => t.match.test(content))

  let seq = 0
  const nodes = template.nodes.map(([type, label, col, row]) => {
    const meta = TYPE_META[type] || TYPE_META.service
    seq += 1
    return {
      id: `blk-${Date.now().toString(36)}-${seq}`,
      type: 'customBlock',
      position: { x: 80 + col * 280, y: 80 + row * 200 },
      data: {
        label,
        type,
        icon: meta.icon,
        category: meta.category,
        color: meta.color,
        description: '',
        config: {},
        isCustom: false,
      },
    }
  })

  const edges = template.edges.map(([from, to, connectionType], i) => {
    const source = nodes[from]
    const target = nodes[to]
    return {
      id: `edge-${Date.now().toString(36)}-${i + 1}`,
      type: 'customEdge',
      source: source.id,
      target: target.id,
      sourceId: source.id,
      targetId: target.id,
      animated: connectionType !== 'db',
      data: { connectionType },
    }
  })

  const estimatedCost =
    nodes.reduce((sum, n) => sum + (TYPE_META[n.data.type]?.cost || 0), 0) + 40 /* egress */

  const name = isCustomName ? deriveDesignName(content) : template.name
  return {
    name,
    description: template.description,
    nodes,
    edges,
    estimatedMonthlyCost: Math.round(estimatedCost / 10) * 10,
  }
}

const generationIntro = (gen) => {
  const flows = gen.edges
    .slice(0, 4)
    .map((e) => {
      const from = gen.nodes.find((n) => n.id === e.source)
      const to = gen.nodes.find((n) => n.id === e.target)
      return `- **${from.data.label}** → **${to.data.label}** (${e.data.connectionType.toUpperCase()})`
    })
    .join('\n')
  return (
    `Here's a **${gen.name}** architecture — ${gen.nodes.length} components, ` +
    `${gen.edges.length} connections, estimated at **$${gen.estimatedMonthlyCost.toLocaleString()}/month**.\n\n` +
    `### Key flows\n${flows}\n\n` +
    `The design below is ready — open it in the Canvas Editor to fine-tune it, or run a simulation to get scores and find bottlenecks.`
  )
}

const GENERAL_ANSWERS = [
  {
    match: /\bcache|redis|caching\b/i,
    answer:
      `A **cache** is a fast storage layer that keeps copies of expensive-to-fetch data close to the consumer, so most reads never touch the slow source of truth.\n\n` +
      `### Common patterns\n` +
      `- **Cache-aside** — the app checks the cache first, falls back to the database, then backfills. Simplest and most common.\n` +
      `- **Write-through** — every write updates cache and DB together; reads are always warm, writes are slower.\n` +
      `- **TTL eviction** — entries expire after N seconds; good enough when slightly stale data is acceptable.\n\n` +
      `### When it pays off\n\n` +
      `| Workload | Typical hit rate | Effect |\n|---|---|---|\n| Read-heavy APIs | 90%+ | p99 latency drops from tens of ms to ~2ms |\n| Session data | ~100% | Removes per-request DB lookups |\n| Expensive aggregates | 80%+ | Cuts compute cost, not just latency |\n\n` +
      `**Watch out for:** stampedes when a hot key expires (mitigate with request coalescing or a short "soft TTL"), and cold starts after a flush.`,
  },
  {
    match: /\bkafka\b|\brabbitmq\b|message broker|event bus|queueing/i,
    answer:
      `Both are proven message brokers, but they optimize for different things:\n\n` +
      `| | **Kafka** | **RabbitMQ** |\n|---|---|---|\n| Model | Distributed, partitioned **log** | Smart broker / dumb queues |\n| Ordering | Per partition | Per queue (FIFO) |\n| Replay | Yes — consumers re-read offsets | No — acked messages are gone |\n| Routing | Topics + keys | Rich exchanges (topic/fanout/headers) |\n| Sweet spot | High-throughput streams, event sourcing, analytics | Task queues, routing, per-message TTLs |\n\n` +
      `**Rule of thumb:** if multiple independent consumers need the same stream (analytics + notifications + audit), pick **Kafka**. If you're dispatching discrete jobs to workers with complex routing, pick **RabbitMQ**. Many systems end up with both.`,
  },
  {
    match: /circuit breaker/i,
    answer:
      `A **circuit breaker** wraps a risky remote call and fails fast instead of hanging when the dependency is unhealthy.\n\n` +
      `### Three states\n` +
      `1. **Closed** — requests flow normally; failures are counted.\n` +
      `2. **Open** — after a failure threshold, calls are rejected immediately (return cached/fallback data).\n` +
      `3. **Half-open** — after a cooldown, one probe request is let through; success closes the circuit, failure reopens it.\n\n` +
      `\`\`\`js\nconst breaker = new CircuitBreaker(callPaymentApi, {\n  failureThreshold: 5,\n  resetTimeout: 30_000, // half-open after 30s\n})\n\`\`\`\n\n` +
      `Pair it with **timeouts** and **retries with jitter** — a breaker without timeouts just fails fast on requests that would have succeeded.`,
  },
  {
    match: /consistent hashing|shard|horizontal scaling|partition/i,
    answer:
      `**Consistent hashing** decides which node owns each key so that adding or removing nodes only remaps ~1/N of keys instead of nearly all of them.\n\n` +
      `### How it works\n` +
      `- Hash both keys and nodes onto a ring; each key belongs to the next node clockwise.\n` +
      `- **Virtual nodes** (100–200 per physical node) smooth out load skew.\n` +
      `- Replicate each key to the next R nodes for failover.\n\n` +
      `Used by Dynamo/Cassandra for data placement, and by CDN/gateway layers for backend selection. For **database sharding**, pick a shard key with high cardinality *and* even access patterns — user_id is usually right, timestamp is almost always wrong.`,
  },
  {
    match: /load balanc/i,
    answer:
      `A **load balancer** spreads traffic across replicas so no single node saturates.\n\n` +
      `### Layers & algorithms\n` +
      `- **L4** (TCP) — fast, connection-level; **L7** (HTTP) — path/ header-aware routing, TLS termination.\n` +
      `- **Round robin** for homogeneous nodes, **least-connections** when request costs vary, **consistent hashing** when you need session affinity without sticky sessions.\n\n` +
      `Add a **health check** (active or passive) so bad instances drain automatically, and keep balancers stateless behind DNS so they scale horizontally too.`,
  },
  {
    match: /\bcap\b|consistency.*availability|eventual consistency|strong consistency/i,
    answer:
      `The **CAP theorem**: during a network partition, a distributed store must choose between **consistency** (every read sees the latest write) and **availability** (every read returns something).\n\n` +
      `- **CP** (Postgres with sync replication, ZooKeeper, etcd) — right when a stale read causes correctness bugs (billing, inventory).\n` +
      `- **AP** (Cassandra, DynamoDB, Cassandra-style designs) — right when liveness matters more (carts, feeds, presence).\n\n` +
      `In practice you tune **per operation**: strong consistency for the checkout write, eventual consistency for the recommendations read. Design for partition tolerance — it's the only one you can't opt out of.`,
  },
]

const DEFAULT_ANSWER = (useDesignSystem) =>
  `Happy to dig in. I can help with three kinds of things:\n\n` +
  `1. **Explain patterns** — "What is a circuit breaker?", "Kafka vs RabbitMQ?"\n` +
  `2. **Analyze a design** — open any design and ask "Why is my scalability score only 60?"\n` +
  `3. **Generate a design** — "Build me a URL shortener" produces a full component graph you can open in the Canvas Editor.\n\n` +
  (useDesignSystem
    ? `*Design System is ON — generation will only use components from the Resonance block library.*\n\n`
    : '') +
  `What are you working on?`

async function streamText(text, signal, onEvent) {
  const tokens = text.split(/(\s+)/)
  for (let i = 0; i < tokens.length; i += 3) {
    await sleep(rand(18, 42), signal)
    onEvent({ type: 'chunk', content: tokens.slice(i, i + 3).join('') })
  }
}

async function runMock({ content, design, useDesignSystem, signal, onEvent }) {
  if (/simulate (an? )?(error|failure)|trigger error/i.test(content)) {
    onEvent({ type: 'thinking', label: 'Thinking…' })
    await sleep(900, signal)
    onEvent({ type: 'error', message: 'Simulated failure — the AI service is unavailable right now. (Demo error; ask normally to keep chatting.)' })
    onEvent({ type: 'done', metadata: { mock: true } })
    return
  }

  // Generation intent: build → stream intro → emit generation payload
  if (isGenerationRequest(content)) {
    onEvent({ type: 'thinking', label: 'Analyzing requirements…' })
    await sleep(rand(700, 1100), signal)
    onEvent({ type: 'thinking', label: 'Laying out topology…' })
    await sleep(rand(600, 1000), signal)
    onEvent({ type: 'thinking', label: 'Estimating cost…' })
    await sleep(rand(400, 700), signal)

    const gen = buildGeneration(content)
    if (useDesignSystem) {
      const allowed = new Set(Object.keys(TYPE_META))
      gen.nodes = gen.nodes.filter((n) => allowed.has(n.data.type))
    }
    await streamText(generationIntro(gen), signal, onEvent)
    onEvent({ type: 'generation', design: gen })
    onEvent({ type: 'done', metadata: { mock: true, generated: gen.name } })
    return
  }

  // Design-aware analysis (mock only — the real backend gets context server-side)
  if (design?.id) {
    onEvent({ type: 'thinking', label: 'Loading design context…' })
    await sleep(rand(600, 900), signal)
    onEvent({ type: 'thinking', label: 'Analyzing topology…' })
    await sleep(rand(600, 900), signal)
    onEvent({ type: 'thinking', label: 'Composing answer…' })
    await sleep(rand(300, 500), signal)
    await streamText(designAnswer(designIntent(content), design), signal, onEvent)
    onEvent({ type: 'done', metadata: { mock: true, designId: design.id } })
    return
  }

  // General architecture Q&A
  onEvent({ type: 'thinking', label: 'Thinking…' })
  await sleep(rand(700, 1200), signal)
  const hit = GENERAL_ANSWERS.find((a) => a.match.test(content))
  await streamText(hit ? hit.answer : DEFAULT_ANSWER(useDesignSystem), signal, onEvent)
  onEvent({ type: 'done', metadata: { mock: true } })
}

const pickLabel = (labels, re, fallback) => labels?.find((l) => re.test(l)) || fallback

const designAnswer = (kind, s) => {
  const db = pickLabel(s.labels, /db|database|postgres|mysql|mongo|sql/i, 'the primary database')
  const api = pickLabel(s.labels, /api|gateway|service|worker/i, 'the API service')
  const score = s.score != null ? `${s.score}/100` : 'not yet simulated'
  const cost = s.cost ? `$${Math.round(s.cost).toLocaleString()}/month` : 'not yet estimated'

  switch (kind) {
    case 'bottleneck':
      return (
        `Here's what's holding **${s.name}** back (score: **${score}**):\n\n` +
        `### Top bottlenecks\n\n` +
        `| Component | Issue | Severity |\n|---|---|---|\n` +
        `| ${db} | Single primary handles all writes — no read replicas | 🔴 High |\n` +
        `| ${api} | Synchronous fan-out on the hot path amplifies latency | 🟡 Medium |\n` +
        `| No caching layer | Every request hits the database cold | 🟡 Medium |\n\n` +
        `Fixing the ${db} write path first usually moves the scalability score the most — add read replicas and a cache in front of hot reads.`
      )
    case 'improve':
      return (
        `To scale **${s.name}** (~${cost} today) by 10x, in order of impact:\n\n` +
        `1. **Cache hot reads** — put Redis in front of ${db}; even a 80% hit rate removes most database load.\n` +
        `2. **Read replicas for ${db}** — point analytical and listing queries at replicas, keep writes on the primary.\n` +
        `3. **Go async where possible** — anything that doesn't need an immediate answer (emails, exports, webhooks) should go through a queue and a worker.\n` +
        `4. **Autoscale ${api}** horizontally — it should be stateless so replicas are trivial.\n` +
        `5. **CDN in front of static assets** — cheapest offload you can buy.\n\n` +
        `Items 1–2 alone typically cover the first 5–10x. Run a simulation after each change to watch the score move.`
      )
    case 'risk':
      return (
        `Risk review for **${s.name}**:\n\n` +
        `- 🔴 **Single point of failure — ${db}** — one instance; a crash takes the system down. *Mitigate with a standby + automated failover.*\n` +
        `- 🟡 **No rate limiting on ${api}** — a traffic spike or abusive client can starve everyone. *Mitigate with gateway-level limits.*\n` +
        `- 🟡 **Synchronous critical path** — one slow dependency stalls user-facing requests. *Mitigate with timeouts + circuit breakers.*\n` +
        `- 🟢 **Backup story** — verify point-in-time recovery actually restores.\n\n` +
        `Want me to draft the mitigation steps for any of these?`
      )
    case 'cost':
      return (
        `Cost picture for **${s.name}** — currently **${cost}**:\n\n` +
        `| Area | Share | Driver |\n|---|---|---|\n| Compute (${api}) | ~55% | Replica count × instance size |\n| Database (${db}) | ~30% | Storage + IOPS |\n| Network/egress | ~15% | Response size × traffic |\n\n` +
        `Biggest lever: right-sizing ${api} (often over-provisioned) and caching to cut database IOPS. Moving large payloads behind a CDN usually trims the egress line 20–40%.`
      )
    default:
      return (
        `**${s.name}** at a glance — **${s.nodeCount} components**, **${s.edgeCount} connections**, score **${score}**, running ~${cost}.\n\n` +
        `### How data flows\n` +
        `Requests enter through ${api} and are served against ${db}. Reads and writes share the same path today, which is fine at current traffic but will be the first thing to change as you scale.\n\n` +
        `### Ask me next\n` +
        `- "Why is my score ${s.score ?? 'X'}?" — bottleneck breakdown\n` +
        `- "How do I scale this 10x?" — concrete steps\n` +
        `- "What are the risks?" — failure-mode review`
      )
  }
}

const designIntent = (content) => {
  if (/bottleneck|slow|why.*score|lag|latency|performance/i.test(content)) return 'bottleneck'
  if (/improve|scale|10x|faster|optimi[sz]e|better/i.test(content)) return 'improve'
  if (/risk|fail|outage|down|vulnerab/i.test(content)) return 'risk'
  if (/cost|price|expensive|cheap|budget|bill/i.test(content)) return 'cost'
  return 'summary'
}

/*
 * Persist a mock-generated design as a real draft (Design + canvas blocks),
 * so "Open in Canvas Editor" has something to navigate to. Only used in mock
 * mode — the live backend creates the design durably and the card carries
 * its designId.
 */
export async function materializeGeneratedDesign(generation) {
  const design = await api.createDesign({
    name: generation.name,
    description: generation.description || 'Generated by Resonance AI Chat',
    accentColor: '#DCFC5C',
  })
  await api.saveCanvas(design.id, { nodes: generation.nodes, edges: generation.edges })
  return design
}
