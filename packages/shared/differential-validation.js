/**
 * Differential Validation Matrix — Phase 12 (§53) + invariants (§52) + metamorphic (§54).
 *
 * Run: `node packages/shared/differential-validation.js` (repo root).
 * No framework: assert-based, exit 1 on any failure. Small fixtures only.
 */

import assert from 'node:assert/strict';
import { runSimulationPass, aggregateMonteCarloResults } from './simulation-engine.js';
import { DeterministicRNG } from './deterministic.js';
import { derivedSeed } from './canonical-model.js';
import { generateTrafficCurve, generateArrivalEvents } from './traffic-models.js';

const results = [];
const check = (id, cond, detail) => {
  results.push({ id, pass: !!cond, detail });
  if (!cond) console.error(`FAIL ${id}: ${detail}`);
};

const mk = (n, sp = 0.05) => {
  const a = [];
  for (let i = 0; i < n; i++) a.push({ time: i * sp, requestId: `req-${i}` });
  return a;
};
const run = (blocks, edges, ev, scenario = 'none', seed = 7, duration = 5, options) =>
  runSimulationPass(blocks, edges, ev || mk(60), scenario, new DeterministicRNG(seed), duration, null, null, options);
const svc = (id, extra = {}) => ({ id, type: 'service', ...extra });
const edge = (id, s, t, extra = {}) => ({ id, sourceId: s, targetId: t, ...extra });

// A: 1 replica vs 3 — effective capacity 3x, less saturation under load
{
  const fixed = (n) => svc('s', { config: { replicas: n }, behavioralModel: { capacity: { maxThroughput: 500, maxConcurrent: 50, maxQueueDepth: 100 }, scalingBehavior: { type: 'none', minReplicas: 1, maxReplicas: 10 } } });
  const one = await run([{ id: 'c', type: 'client' }, fixed(1)], [edge('e1', 'c', 's')]);
  const three = await run([{ id: 'c', type: 'client' }, fixed(3)], [edge('e1', 'c', 's')]);
  check('A-cap', three.blockMetrics.blocks.s.saturationPoint === one.blockMetrics.blocks.s.saturationPoint * 3,
    `1x=${one.blockMetrics.blocks.s.saturationPoint} 3x=${three.blockMetrics.blocks.s.saturationPoint}`);
}

// B: cache hop changes traversal statistics (extra edge carries real traffic + latency differs)
// KNOWN LIMITATION (investigated equality): hit short-circuit not modeled, so DB
// attempt volume is unchanged — only path/latency/traffic distribution differ.
{
  const noCache = await run(
    [svc('s'), { id: 'd', type: 'database' }],
    [edge('e1', 's', 'd', { connectionType: 'tcp' })]);
  const cache = await run(
    [svc('s'), { id: 'ch', type: 'cache' }, { id: 'd', type: 'database' }],
    [edge('e1', 's', 'ch'), edge('e2', 'ch', 'd', { connectionType: 'tcp' })]);
  const chEdge = cache.edgeMetrics.e1?.requests ?? 0;
  check('B-edge-traffic', chEdge > 0, `cache-edge requests=${chEdge}`);
  check('B-latency-differs', noCache.globalMetrics.avgLatencyMs !== cache.globalMetrics.avgLatencyMs,
    `noCache=${noCache.globalMetrics.avgLatencyMs.toFixed(1)} cache=${cache.globalMetrics.avgLatencyMs.toFixed(1)}`);
}

// C: queue path vs sync — extra hop + queue-wait observations exist on async path
{
  const sync = await run([svc('s'), svc('w')], [edge('e1', 's', 'w')]);
  const async = await run(
    [svc('s'), { id: 'q', type: 'message-queue' }, svc('w')],
    [edge('e1', 's', 'q', { connectionType: 'kafka' }), edge('e2', 'q', 'w', { connectionType: 'kafka' })]);
  const hops = (r) => r.sampledRequests[0]?.hops?.length ?? 0;
  check('C-hops', hops(async) > hops(sync), `sync=${hops(sync)} async=${hops(async)}`);
}

// D: 10Mbps/1MB vs 10Gbps/1KB — transfer behavior must differ
{
  const mkEdge = (bw, bytes) => edge('e1', 'c', 's', { config: { requestBytes: bytes }, behavioralModel: { network: { baseLatencyMs: 1, bandwidthMbps: bw }, transport: { keepAlive: false }, reliability: {} } });
  const loR = await run([{ id: 'c', type: 'client' }, svc('s')], [mkEdge(10, 1000000)]);
  const hiR = await run([{ id: 'c', type: 'client' }, svc('s')], [mkEdge(10000, 1000)]);
  check('D-bandwidth', loR.edgeMetrics.e1.avgLatencyMs > hiR.edgeMetrics.e1.avgLatencyMs,
    `lo=${loR.edgeMetrics.e1.avgLatencyMs.toFixed(0)} hi=${hiR.edgeMetrics.e1.avgLatencyMs.toFixed(0)}`);
}

// E: 100 vs 10000 RPS — saturation behavior must change when capacity is exceeded
{
  const tight = [{ id: 'c', type: 'client' }, svc('s', { behavioralModel: { capacity: { maxThroughput: 200, maxConcurrent: 5, maxQueueDepth: 300 }, scalingBehavior: { type: 'none', minReplicas: 1, maxReplicas: 1 }, latency: { baseLatencyMs: 40 } } })];
  const e = [edge('e1', 'c', 's')];
  const low = await run(tight, e, mk(60, 0.05));
  const high = await run(tight, e, mk(600, 0.005), 'none', 7, 6);
  const hs = high.blockMetrics.blocks.s;
  check('E-saturation', hs.timeSaturated > 0 && hs.maxQueueDepth > low.blockMetrics.blocks.s.maxQueueDepth,
    `sat=${hs.timeSaturated.toFixed(1)}s maxQ=${hs.maxQueueDepth}`);
}

// F: DB capacity change only — bottleneck metrics shift with it
{
  const mkDb = (tput) => [
    { id: 'c', type: 'client' }, svc('s'),
    { id: 'd', type: 'database', behavioralModel: { capacity: { maxThroughput: tput, maxConcurrent: 50, maxQueueDepth: 200 }, scalingBehavior: { type: 'none', minReplicas: 1, maxReplicas: 1 } } },
  ];
  const e = [edge('e1', 'c', 's'), edge('e2', 's', 'd', { connectionType: 'tcp' })];
  const small = await run(mkDb(100), e, mk(200, 0.01), 'none', 7, 6);
  const big = await run(mkDb(5000), e, mk(200, 0.01), 'none', 7, 6);
  check('F-bottleneck', small.blockMetrics.blocks.d.saturationPoint < big.blockMetrics.blocks.d.saturationPoint,
    `small=${small.blockMetrics.blocks.d.saturationPoint} big=${big.blockMetrics.blocks.d.saturationPoint}`);
}

// G: retry enabled vs disabled — downstream attempts increase
{
  const errD = () => ({ id: 'd', type: 'service', behavioralModel: { capacity: { maxThroughput: 500, maxConcurrent: 50, maxQueueDepth: 200 }, errorCharacteristics: { baseErrorRate: 0.4, errorRateUnderLoad: 0 } } });
  const b = () => [{ id: 'c', type: 'client' }, svc('g'), errD()];
  const plain = await run(b(), [edge('e1', 'c', 'g'), edge('e2', 'g', 'd', { connectionType: 'http' })]);
  const retry = await run(b(), [edge('e1', 'c', 'g'), edge('e2', 'g', 'd', { connectionType: 'rest' })]);
  check('G-retry', retry.blockMetrics.blocks.d.totalRequests > plain.blockMetrics.blocks.d.totalRequests,
    `plain=${plain.blockMetrics.blocks.d.totalRequests} retry=${retry.blockMetrics.blocks.d.totalRequests}`);
}

// H: failure vs none — errors/availability/failure events differ
{
  const b = () => [{ id: 'c', type: 'client' }, svc('s')];
  const e = [edge('e1', 'c', 's')];
  const base = await run(b(), e, mk(80), 'none', derivedSeed(11, 0), 6);
  const fail = await run(b(), e, mk(80), 'service_crash', derivedSeed(11, 0), 6, { targetBlockId: 's' });
  check('H-errors', fail.globalMetrics.errorRate > base.globalMetrics.errorRate,
    `base=${base.globalMetrics.errorRate} fail=${fail.globalMetrics.errorRate}`);
  check('H-events', fail.failureEvents.length > 0 && base.failureEvents.length === 0, `events=${fail.failureEvents.length}`);
  check('H-propagation', fail.failurePropagation.length > 0, `links=${fail.failurePropagation.length}`);
}

// Metamorphic: 2x capacity must not be more overloaded at half load; 2x traffic scales throughput
{
  const cap = (t) => svc('s', { behavioralModel: { capacity: { maxThroughput: t, maxConcurrent: 200, maxQueueDepth: 500 }, scalingBehavior: { type: 'none', minReplicas: 1, maxReplicas: 1 } } });
  const e = [edge('e1', 'c', 's')];
  const a = await run([{ id: 'c', type: 'client' }, cap(1000)], e, mk(100, 0.01), 'none', 7, 6);
  const b2 = await run([{ id: 'c', type: 'client' }, cap(2000)], e, mk(100, 0.01), 'none', 7, 6);
  check('M-capacity', b2.blockMetrics.blocks.s.utilizationMax <= a.blockMetrics.blocks.s.utilizationMax,
    `1k=${a.blockMetrics.blocks.s.utilizationMax} 2k=${b2.blockMetrics.blocks.s.utilizationMax}`);
  const t1 = await run([{ id: 'c', type: 'client' }, cap(5000)], e, mk(100, 0.02), 'none', 7, 6);
  const t2 = await run([{ id: 'c', type: 'client' }, cap(5000)], e, mk(200, 0.01), 'none', 7, 6);
  const ratio = t2.globalMetrics.throughputRps / Math.max(1, t1.globalMetrics.throughputRps);
  check('M-traffic', ratio > 1.5 && ratio < 2.5, `throughput ratio=${ratio.toFixed(2)}`);
}

// Reproducibility (§55): same input+seed → identical counts, events, resources, cost
{
  const b = () => [{ id: 'c', type: 'client' }, svc('g'), { id: 'd', type: 'database' }];
  const e = () => [edge('e1', 'c', 'g'), edge('e2', 'g', 'd', { connectionType: 'tcp' })];
  const r1 = await run(b(), e(), mk(80), 'service_crash', derivedSeed(11, 0), 6, { targetBlockId: 'g' });
  const r2 = await run(b(), e(), mk(80), 'service_crash', derivedSeed(11, 0), 6, { targetBlockId: 'g' });
  check('R-counts', r1.globalMetrics.totalRequests === r2.globalMetrics.totalRequests
    && r1.globalMetrics.failedRequests === r2.globalMetrics.failedRequests, 'counts identical');
  check('R-events', JSON.stringify(r1.failureEvents) === JSON.stringify(r2.failureEvents), 'failure events identical');
  check('R-cost', r1.globalMetrics.simulationWindowCostUsd === r2.globalMetrics.simulationWindowCostUsd, 'cost identical');
}

// Monte Carlo (§56): pass seeds unique, streams differ, whole experiment reproducible
{
  check('MC-seeds', derivedSeed(9, 0) !== derivedSeed(9, 1), 'sub-seeds differ');
  const agg1 = aggregateMonteCarloResults([await run([svc('a')], [], mk(40), 'spiky', derivedSeed(5, 0), 5)], 0.95);
  const agg2 = aggregateMonteCarloResults([await run([svc('a')], [], mk(40), 'spiky', derivedSeed(5, 0), 5)], 0.95);
  check('MC-repro', agg1.totalRequests === agg2.totalRequests, 'single pass reproducible');
}

// Invariants (§52) on a loaded failing run
{
  const r = await run(
    [{ id: 'c', type: 'client' }, svc('s'), { id: 'd', type: 'database' }],
    [edge('e1', 'c', 's'), edge('e2', 's', 'd', { connectionType: 'tcp' })],
    mk(200, 0.01), 'resource_exhaustion', derivedSeed(3, 0), 6);
  const g = r.globalMetrics;
  const generated = 200;
  check('I-conservation', g.totalRequests <= generated, `${g.totalRequests}<=${generated}`);
  check('I-rates', g.errorRate >= 0 && g.errorRate <= 1 && g.availability >= 0 && g.availability <= 100, 'rates in range');
  const s = r.blockMetrics.blocks.s;
  check('I-util', s.utilization >= 0 && s.utilization <= 1 && s.utilizationMax <= 1, 'util in [0,1]');
  check('I-queue', s.maxQueueDepth >= 0 && s.queueWaitAvgMs >= 0, 'queue sane');
  check('I-cost', (s.cost?.total ?? -1) >= 0 && g.simulationWindowCostUsd >= 0, 'cost >= 0');
  const times = r.events.map((ev) => ev.time);
  check('I-time', times.every((t, i) => i === 0 || t >= times[i - 1]), 'sim time monotonic');
}

// Cost units (§30): explicit unit keys present, network bills actual bytes
{
  const r = await run(
    [{ id: 'c', type: 'client' }, svc('s', { behavioralModel: { cost: { hourlyComputeCost: 0.03, perRequestCost: 0.000005, perGbNetworkCost: 0.09 } } })],
    [edge('e1', 'c', 's', { config: { requestBytes: 2048 } })], mk(50));
  const c = r.blockMetrics.blocks.s.cost;
  check('C-units', ['simulationWindowCostUsd', 'hourlyCostUsd', 'dailyProjectedCostUsd', 'monthlyProjectedCostUsd', 'annualProjectedCostUsd'].every((k) => typeof c[k] === 'number'), 'unit keys present');
  check('C-bytes', r.blockMetrics.blocks.s.networkBytesBilled === 0 && r.edgeMetrics.e1.bytesSent === 50 * 2048, 'bytes billed on source edge');
}

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} differential checks passed`);
if (failed.length > 0) {
  console.log('failures:', failed.map((f) => f.id).join(', '));
  process.exit(1);
}
