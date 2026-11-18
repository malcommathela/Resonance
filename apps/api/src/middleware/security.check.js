// Contract test for the request-body sanitiser: strip markup handlers without
// corrupting ordinary text (config values, prose) that merely looks similar.
// Run from repo root: node --test apps/api/src/middleware/security.check.js
import assert from 'node:assert/strict'
import { sanitizeInput } from './security.js'

const clean = (body) => {
  const req = { body, query: {} }
  sanitizeInput(req, {}, () => {})
  return req.body
}

// Ordinary text survives (regression: /\s*on\w+=/ ate these).
for (const text of [
  'maxConnections=5',
  'options=fast',
  'session=abc',
  'position=10,20',
  'The options= parameter controls it',
]) {
  assert.equal(clean({ text }).text, text)
}

// Markup payloads are still neutralised.
assert.equal(clean({ html: '<img src=x onerror=alert(1)>' }).html, '<img src=x>')
assert.ok(!clean({ html: '<div onclick="steal()">x</div>' }).html.includes('onclick'))
assert.equal(clean({ html: '<script>alert(1)</script>hello' }).html, 'hello')
assert.equal(clean({ url: 'javascript:alert(1)' }).url, 'blocked:alert(1)')

// Nested values are traversed.
const nested = clean({ a: { b: ['<svg onload=alert(1)>'] } })
assert.equal(nested.a.b[0], '<svg>')

console.log('security.check: OK')
