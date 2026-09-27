/**
 * Phase 0 baseline fixtures — frozen representative architectures.
 * Minimal shapes only: { id, blocks, edges, workload }. No engine import.
 */

const b = (id, type, config = {}) => ({ id, type, config });
const e = (id, sourceId, targetId, connectionType = 'http') => ({ id, sourceId, targetId, connectionType });

export const BASELINE_FIXTURES = Object.freeze([
  { id: 'simple-client-service', blocks: [b('c', 'client'), b('s', 'service')], edges: [e('e1', 'c', 's')], workload: { rps: 100, duration: 60 } },
  { id: 'gateway-service-db', blocks: [b('c', 'client'), b('g', 'api-gateway'), b('s', 'service'), b('d', 'database')], edges: [e('e1', 'c', 'g'), e('e2', 'g', 's'), e('e3', 's', 'd')], workload: { rps: 200, duration: 120 } },
  { id: 'gateway-lb-replicas', blocks: [b('g', 'api-gateway'), b('lb', 'load-balancer'), b('s', 'service', { replicas: 3 })], edges: [e('e1', 'g', 'lb'), e('e2', 'lb', 's')], workload: { rps: 500, duration: 120 } },
  { id: 'service-cache-db', blocks: [b('s', 'service'), b('ch', 'cache'), b('d', 'database')], edges: [e('e1', 's', 'ch'), e('e2', 's', 'd', 'tcp')], workload: { rps: 300, duration: 120 } },
  { id: 'service-queue-worker-db', blocks: [b('s', 'service'), b('q', 'message-queue'), b('w', 'service'), b('d', 'database')], edges: [e('e1', 's', 'q', 'kafka'), e('e2', 'q', 'w', 'kafka'), e('e3', 'w', 'd', 'tcp')], workload: { rps: 200, duration: 180 } },
  { id: 'service-external-api', blocks: [b('s', 'service'), b('x', 'external-api')], edges: [e('e1', 's', 'x', 'https')], workload: { rps: 50, duration: 60 } },
  { id: 'multi-path', blocks: [b('g', 'api-gateway'), b('s1', 'service'), b('s2', 'service'), b('d', 'database')], edges: [e('e1', 'g', 's1'), e('e2', 'g', 's2'), e('e3', 's1', 'd'), e('e4', 's2', 'd')], workload: { rps: 400, duration: 120 } },
  { id: 'failure-scenario', blocks: [b('s', 'service'), b('d', 'database')], edges: [e('e1', 's', 'd', 'tcp')], workload: { rps: 200, duration: 120 }, scenario: 'db_slowdown' },
  { id: 'high-load', blocks: [b('c', 'client'), b('s', 'service', { replicas: 2 }), b('d', 'database')], edges: [e('e1', 'c', 's'), e('e2', 's', 'd', 'tcp')], workload: { rps: 5000, duration: 300 } },
]);

export const BASELINE_VERSIONS = Object.freeze({ engine: '2.0.0', report: '1.0.0', canonical: '0.1.0' });
