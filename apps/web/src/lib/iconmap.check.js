// Self-check: every icon name referenced by shared block/connection types
// must resolve in blockIconMap — otherwise nodes silently share the Server
// fallback logo. Run from repo root: node apps/web/src/lib/iconmap.check.js
import assert from 'node:assert/strict'
import { blockIconMap } from './iconMap.js'
import * as shared from '../../../../packages/shared/constants.js'

const names = new Set()
const collect = (obj) => {
  if (!obj || typeof obj !== 'object') return
  if (typeof obj.icon === 'string') names.add(obj.icon)
  for (const v of Object.values(obj)) collect(v)
}
collect({
  BLOCK_TYPES: shared.BLOCK_TYPES,
  SIMULATION_BLOCK_TYPES: shared.SIMULATION_BLOCK_TYPES,
  CONNECTION_TYPES: shared.CONNECTION_TYPES,
  SIMULATION_CONNECTION_TYPES: shared.SIMULATION_CONNECTION_TYPES,
})

assert.ok(names.size > 0, 'expected block types with icons')
const missing = [...names].filter((n) => !blockIconMap[n])
assert.deepEqual(missing, [], `unmapped icons fall back to Server logo: ${missing}`)
// Legacy alias: persisted designs carry 'FileTransfer' (no such lucide icon)
assert.ok(blockIconMap.FileTransfer, 'FileTransfer alias required for stored designs')

console.log(`iconmap.check: OK (${names.size} icons resolve)`)
