/**
 * Canonical Simulation Model — single source of truth (Phase 0 + 1).
 *
 * Legacy engine version frozen as baseline: engine 2.0.0, report 1.0.0.
 * New canonical path is versioned independently and immutable (Object.freeze).
 *
 * Ladder: reuses getBlock/ConnectionBehavioralModel, no new deps.
 */

import {
  getBlockBehavioralModel,
  getConnectionBehavioralModel,
} from './simulation-models.js';

export const CANONICAL_MODEL_VERSION = '0.1.0';
export const LEGACY_ENGINE_VERSION = '2.0.0';
export const LEGACY_REPORT_VERSION = '1.0.0';
export const SIMULATION_ENGINE_VERSION = 'canonical-0.1.0';
export const REPORT_SCHEMA_VERSION = 'canonical-report-0.1.0';

// Distinct traffic patterns — ramp is NOT seasonal (spec §61).
export const CANONICAL_TRAFFIC_PATTERNS = Object.freeze([
  'constant', 'ramp', 'burst', 'spike', 'seasonal', 'random', 'custom',
]);

// Minimal explicit edge semantics; protocol stays on transport, semantics here.
const ASYNC_TRANSPORTS = new Set(['kafka', 'rabbitmq', 'amqp', 'mqtt', 'event-stream']);
export const EDGE_SEMANTICS = Object.freeze([
  'route', 'load_balance', 'dependency', 'fan_out', 'fallback',
  'async_publish', 'async_consume', 'cache_lookup',
]);

function parseConfig(c) {
  if (c == null) return {};
  if (typeof c === 'string') { try { return JSON.parse(c); } catch { return {}; } }
  return c;
}

// ponytail: 32-bit FNV-1a sub-seed; per-pass streams if Monte Carlo proves it needs more
export function derivedSeed(experimentSeed, passIndex) {
  let h = 0x811c9dc5 ^ (Number(experimentSeed) >>> 0);
  h ^= Number(passIndex) >>> 0;
  h = Math.imul(h, 0x01000193);
  h ^= h >>> 13;
  return h >>> 0;
}

export function makeAssumption(id, value, unit, description) {
  return { id, value, unit, source: 'model_default', description };
}

function parseCpu(cpu) {
  if (cpu == null) return null;
  if (typeof cpu === 'number') return cpu;
  const m = String(cpu).match(/^(\d+(?:\.\d+)?)(m?)$/);
  if (!m) return null;
  return m[2] === 'm' ? parseFloat(m[1]) / 1000 : parseFloat(m[1]);
}

function parseMem(mem) {
  if (mem == null) return null;
  if (typeof mem === 'number') return mem;
  const m = String(mem).match(/^(\d+(?:\.\d+)?)([KMGT]?i?)?$/i);
  if (!m) return null;
  const mult = { '': 1, K: 1024, M: 1024 ** 2, G: 1024 ** 3, T: 1024 ** 4 };
  return parseFloat(m[1]) * (mult[(m[2] || '').replace(/i/i, '').toUpperCase()] ?? 1);
}

function compileBlock(raw, assumptions) {
  const config = parseConfig(raw.config ?? raw.data?.config);
  const type = raw.type ?? raw.data?.type ?? 'service';
  const base = getBlockBehavioralModel(type);
  const user = config.behavioralModel ?? {};
  // Shallow-merge top level only; deep model stays canonical.
  const model = { ...base, ...user };

  // Replicas resolved exactly once here — engine must NOT re-multiply.
  const replicas = Number.isInteger(config.replicas) ? config.replicas : 1;
  const cap = model.capacity ?? {};
  const capacityPerReplica = {
    throughputPerReplica: cap.maxThroughput ?? cap.throughputPerReplica ?? 1000,
    concurrencyPerReplica: cap.maxConcurrent ?? cap.concurrencyPerReplica ?? 100,
    queueCapacity: cap.maxQueueDepth ?? cap.queueCapacity ?? 1000,
  };
  if (cap.maxThroughput == null) {
    assumptions.push(makeAssumption(
      `${type}.default.throughput_per_replica`, capacityPerReplica.throughputPerReplica,
      'rps', 'Default modeled throughput when no user/provider value is configured'));
  }
  const effectiveReplicaCount = replicas;
  const effectiveCapacity = {
    throughput: capacityPerReplica.throughputPerReplica * effectiveReplicaCount,
    concurrency: capacityPerReplica.concurrencyPerReplica * effectiveReplicaCount,
  };

  const resources = model.resourceConsumption ?? {};
  const cpu = parseCpu(config.cpu ?? config.cpuLimit) ?? null;
  const memory = parseMem(config.memory ?? config.memoryLimit) ?? null;
  const resourceAlloc = {
    cpu: cpu ?? null, memoryBytes: memory ?? null,
    connections: resources.connectionPoolSize ?? null,
    threads: resources.threadPoolSize ?? null,
  };
  if (cpu == null && memory == null) {
    assumptions.push(makeAssumption(
      `${type}.resource.unknown`, null, 'unknown',
      'No explicit CPU/memory allocation; resource = unknown, not 1GB/100CPU'));
  }

  return Object.freeze({
    id: raw.id, type,
    capacityPerReplica: Object.freeze(capacityPerReplica),
    replicas: Object.freeze({ initial: effectiveReplicaCount, min: effectiveReplicaCount, max: effectiveReplicaCount }),
    effectiveCapacity: Object.freeze(effectiveCapacity),
    effectiveReplicaCount,
    resources: Object.freeze(resourceAlloc),
    latency: model.latency ?? {},
    errors: model.errorCharacteristics ?? {},
    timeoutMs: config.timeoutMs ?? config.timeout ?? null,
    costModel: model.cost ?? {},
    provenance: { source: 'user+model', behavioralModel: 'simulation-models.js' },
  });
}

function compileEdge(raw, assumptions) {
  const config = parseConfig(raw.config ?? raw.data?.config);
  const connectionType = raw.connectionType ?? raw.data?.connectionType ?? 'http';
  const base = getConnectionBehavioralModel(connectionType);
  const semantics = config.semantics
    ?? (ASYNC_TRANSPORTS.has(connectionType) ? 'async_publish' : 'route');
  if (!config.semantics) {
    assumptions.push(makeAssumption(
      `edge.${raw.id}.semantics.default`, semantics, 'enum',
      `No explicit edge semantics; defaulted to ${semantics}`));
  }
  const net = { ...(base.network ?? {}) };
  if (config.bandwidthMbps != null) net.bandwidthMbps = config.bandwidthMbps;
  if (config.mtuBytes != null) net.mtuBytes = config.mtuBytes;
  return Object.freeze({
    id: raw.id, source: raw.sourceId ?? raw.source, target: raw.targetId ?? raw.target,
    semantics, connectionType,
    network: Object.freeze(net),
    transport: base.transport ?? {},
    payload: Object.freeze({
      requestBytes: config.requestBytes ?? null,
      responseBytes: config.responseBytes ?? null,
    }),
    timeoutMs: config.timeoutMs ?? config.timeout ?? base.reliability?.timeoutMs ?? null,
    retryPolicy: base.reliability ?? {},
    provenance: { source: 'user+model' },
  });
}

/**
 * compileDesignToSimulationModel(design, experiment) → frozen CanonicalSimulationModel.
 * design: { blocks, edges }, experiment: { seed, trafficPattern, rps, durationSeconds, ... }
 */
export function compileDesignToSimulationModel(design = {}, experiment = {}) {
  const assumptions = [];
  const blocks = (design.blocks ?? []).map((b) => compileBlock(b, assumptions));
  const edges = (design.edges ?? []).map((e) => compileEdge(e, assumptions));

  const trafficPattern = experiment.trafficPattern ?? 'constant';
  if (!CANONICAL_TRAFFIC_PATTERNS.includes(trafficPattern)) {
    throw new Error(`Unknown canonical traffic pattern: ${trafficPattern}`);
  }

  const model = {
    version: CANONICAL_MODEL_VERSION,
    engineVersion: SIMULATION_ENGINE_VERSION,
    reportSchemaVersion: REPORT_SCHEMA_VERSION,
    legacyBaseline: { engine: LEGACY_ENGINE_VERSION, report: LEGACY_REPORT_VERSION },
    experiment: Object.freeze({
      seed: experiment.seed ?? 12345,
      trafficPattern,
      baselineRps: experiment.rps ?? experiment.baselineRps ?? 100,
      durationSeconds: experiment.duration ?? experiment.durationSeconds ?? 60,
      monteCarloPasses: experiment.monteCarloPasses ?? 1,
      scenario: experiment.scenario ?? 'none',
    }),
    workload: Object.freeze({
      arrivalProcess: trafficPattern,
      baselineRps: experiment.rps ?? experiment.baselineRps ?? 100,
      durationSeconds: experiment.duration ?? experiment.durationSeconds ?? 60,
    }),
    blocks: Object.freeze(blocks),
    edges: Object.freeze(edges),
    assumptions: Object.freeze(assumptions),
  };
  return Object.freeze(model);
}

/** validateCanonicalSimulationModel(model) → { ok, errors[] }. Pure, no throws. */
export function validateCanonicalSimulationModel(model) {
  const errors = [];
  if (!model || typeof model !== 'object') return { ok: false, errors: ['model missing'] };
  const ids = new Set();
  for (const b of model.blocks ?? []) {
    if (!b.id) errors.push('block missing id');
    else if (ids.has(b.id)) errors.push(`duplicate block id: ${b.id}`);
    else ids.add(b.id);
    if (b.effectiveCapacity?.throughput < 0) errors.push(`negative capacity: ${b.id}`);
    if (b.effectiveCapacity?.throughput === 0) errors.push(`zero capacity: ${b.id}`);
    if (!Number.isInteger(b.effectiveReplicaCount) || b.effectiveReplicaCount < 1) errors.push(`invalid replicas: ${b.id}`);
    if (b.replicas?.max < b.replicas?.min) errors.push(`max replicas < min replicas: ${b.id}`);
    const t = b.timeoutMs;
    if (t != null && !(Number.isInteger(t) && t >= 1)) errors.push(`invalid timeout: ${b.id}`);
  }
  for (const e of model.edges ?? []) {
    if (!e.id) errors.push('edge missing id');
    if (e.source === e.target) errors.push(`self-loop: ${e.id}`);
    if (e.source != null && !ids.has(e.source)) errors.push(`edge ${e.id} missing source ${e.source}`);
    if (e.target != null && !ids.has(e.target)) errors.push(`edge ${e.id} missing target ${e.target}`);
    if (!EDGE_SEMANTICS.includes(e.semantics)) errors.push(`unknown edge semantics: ${e.id}=${e.semantics}`);
    const n = e.network ?? {};
    if (n.baseLatencyMs != null && n.baseLatencyMs < 0) errors.push(`negative latency: ${e.id}`);
    if (n.bandwidthMbps != null && n.bandwidthMbps <= 0) errors.push(`invalid bandwidth: ${e.id}`);
    if (n.packetLossRate != null && (n.packetLossRate < 0 || n.packetLossRate > 1)) errors.push(`invalid packet loss: ${e.id}`);
  }
  const w = model.workload ?? {};
  if (w.baselineRps != null && w.baselineRps < 0) errors.push('negative RPS');
  if (w.durationSeconds != null && !(w.durationSeconds > 0)) errors.push('zero duration');
  return { ok: errors.length === 0, errors };
}

// ponytail: node --test compatible self-check, no framework
if (process.argv[1]?.endsWith('canonical-model.js')) {
  const assert = (await import('node:assert/strict')).default;
  const m = compileDesignToSimulationModel(
    { blocks: [{ id: 's', type: 'service', config: { replicas: 3 } }], edges: [] },
    { seed: 7, rps: 100, duration: 60 },
  );
  assert.equal(m.blocks[0].effectiveCapacity.throughput, m.blocks[0].capacityPerReplica.throughputPerReplica * 3);
  assert.equal(derivedSeed(7, 0) !== derivedSeed(7, 1), true);
  assert.equal(validateCanonicalSimulationModel(m).ok, true);
  assert.equal(validateCanonicalSimulationModel(null).ok, false);
  console.log('canonical-model self-check ok');
}
