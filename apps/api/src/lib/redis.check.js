// The cache must degrade to a no-op when Upstash is unreachable: a failed
// cache read falls through to the DB, and a failed write must not fail the
// request whose DB write already succeeded.
// Run from repo root: node --test apps/api/src/lib/redis.check.js
import assert from 'node:assert/strict'

process.env.UPSTASH_REDIS_REST_URL = 'http://127.0.0.1:1'
process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token'

const { cache, redisConnection, redisSubscriber } = await import('./redis.js')

try {
  assert.equal(await cache.get('missing'), null)
  await cache.set('key', { name: 'value' }, 60)
  await cache.del('key')
  assert.deepEqual(await cache.keys('*'), [])
  await cache.invalidatePattern('*')
} finally {
  // ioredis retries forever by design; disconnect so the check can exit.
  redisConnection.disconnect()
  redisSubscriber.disconnect()
}

console.log('redis.check: OK')
