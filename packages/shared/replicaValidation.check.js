// Self-check for replicaValidation.js. Run: node packages/shared/replicaValidation.check.js
import assert from 'node:assert/strict'
import { extractReplicaConfig, validateReplicaConfig } from './replicaValidation.js'

// Canonical read: flat wins, behavioralModel is the fallback
assert.deepEqual(extractReplicaConfig({ replicas: 3, behavioralModel: { scalingBehavior: { minReplicas: 2, maxReplicas: 10 } } }),
  { replicas: 3, minReplicas: 2, maxReplicas: 10, autoscaling: false })
assert.equal(extractReplicaConfig({ minReplicas: 2, behavioralModel: { scalingBehavior: { minReplicas: 5, maxReplicas: 8 } } }).minReplicas, 2)
assert.equal(extractReplicaConfig({ autoScaling: true }).autoscaling, true)
assert.deepEqual(extractReplicaConfig(null), { replicas: undefined, minReplicas: undefined, maxReplicas: undefined, autoscaling: false })

// Valid configs produce no issues — and nothing is mutated
const ok = { replicas: 4, minReplicas: 2, maxReplicas: 8, autoscaling: true }
assert.deepEqual(validateReplicaConfig(ok), [])
assert.deepEqual(validateReplicaConfig({}), [])
assert.deepEqual(validateReplicaConfig({ replicas: 3 }), [])

// Each field validated independently; one edit never mutates another
assert.equal(validateReplicaConfig({ replicas: 0 })[0].code, 'replicas')
assert.equal(validateReplicaConfig({ replicas: 1.5 })[0].code, 'replicas')
assert.equal(validateReplicaConfig({ minReplicas: 0 })[0].code, 'minReplicas')
assert.equal(validateReplicaConfig({ maxReplicas: -1 })[0].code, 'maxReplicas')
assert.equal(validateReplicaConfig({ minReplicas: 5, maxReplicas: 3 })[0].code, 'range')
assert.equal(validateReplicaConfig({ autoscaling: true }).length, 1)
assert.equal(validateReplicaConfig({ autoscaling: true, minReplicas: 2, maxReplicas: 8, replicas: 9 })[0].code, 'bounds')
assert.equal(validateReplicaConfig({ autoscaling: true, minReplicas: 2, maxReplicas: 8, replicas: 1 })[0].code, 'bounds')
assert.deepEqual(validateReplicaConfig({ autoscaling: false, minReplicas: 2, maxReplicas: 8, replicas: 99 }), []) // bounds only bind autoscaling
assert.deepEqual(validateReplicaConfig({ minReplicas: 2, maxReplicas: 8, replicas: 99 }), [])

console.log('replicaValidation.check: OK')
