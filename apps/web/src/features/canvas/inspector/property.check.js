// Self-check for propertyDefinitions + propertyResolver (dependency-free).
// Run: node apps/web/src/features/canvas/inspector/property.check.js
import assert from 'node:assert/strict'
import { getPropertyDefinition } from './propertyDefinitions.js'
import { getPropertyValue, setPropertyValue, unknownConfigKeys, isPropertyVisible } from './propertyResolver.js'

const node = {
  id: 'n1',
  type: 'customBlock',
  data: {
    label: 'API', type: 'service',
    config: {
      replicas: 3, engine: 'pg',
      legacy_custom: 'keep-me',
      behavioralModel: {
        scalingBehavior: { minReplicas: 1, maxReplicas: 10 },
        capacity: { maxThroughput: 1000 },
      },
    },
  },
}

// Deployment vs behavior are distinct paths, never conflated
assert.equal(getPropertyValue(node, 'replicas'), 3)
assert.equal(getPropertyValue(node, 'maxReplicas'), 10)
assert.equal(getPropertyValue(node, 'maxThroughput'), 1000)

// Setter preserves siblings (behavioral merge, not replace)
const patch = setPropertyValue(node, 'maxReplicas', 20)
assert.equal(patch.config.behavioralModel.scalingBehavior.maxReplicas, 20)
assert.equal(patch.config.behavioralModel.scalingBehavior.minReplicas, 1)
assert.equal(patch.config.behavioralModel.capacity.maxThroughput, 1000)
assert.equal(patch.config.replicas, 3) // deployment untouched by behavior set

const dep = setPropertyValue(node, 'replicas', 5)
assert.equal(dep.config.replicas, 5)

const pres = setPropertyValue(node, 'label', 'New')
assert.equal(pres.label, 'New')

// Unknown/legacy surfaced, never dropped (known config keys are claimed by defs)
assert.ok(unknownConfigKeys(node).includes('legacy_custom'))
assert.ok(!unknownConfigKeys(node).includes('replicas'))
assert.ok(!unknownConfigKeys(node).includes('engine'))
assert.ok(!unknownConfigKeys(node).includes('behavioralModel'))

// Visibility: engine only on databases
assert.equal(isPropertyVisible(node, 'engine'), false)
assert.equal(isPropertyVisible({ data: { type: 'database' } }, 'engine'), true)

// Registry lookup misses return null/undefined, never throw
assert.equal(getPropertyDefinition('nope'), null)
assert.equal(getPropertyValue(node, 'nope'), undefined)
assert.deepEqual(setPropertyValue(node, 'nope', 1), {})

console.log('property.check: OK')
