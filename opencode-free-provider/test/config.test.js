import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  newSessionId,
  newRequestId,
  newMessageId,
  encodeIdentifier,
  currentSession,
  buildFingerprintHeaders,
  ZEN_SESSION_MODE,
  MAX_COUNTER,
} from '../src/config.js'

// A real opencode id is `ses_` + 12 lowercase hex (descending 48-bit value) +
// 14 base62 chars. See src/fingerprint.js for the derivation.
const SESSION_RE = /^ses_[0-9a-f]{12}[0-9A-Za-z]{14}$/
const MESSAGE_RE = /^msg_[0-9a-f]{12}[0-9A-Za-z]{14}$/

// Decode the 48-bit hex value back into opencode's `~(ts*0x1000 + counter)` and
// return the counter the gate validates (must be <= 63).
function counterOf(id) {
  const value = BigInt('0x' + id.slice(4, 16))
  const current = (~value) & ((1n << 48n) - 1n)
  return Number(current & 0xfffn)
}

test('newSessionId produces ses_<12hex><14base62> (30 chars, real opencode shape)', () => {
  const s = newSessionId()
  assert.match(s, SESSION_RE)
  assert.equal(s.length, 30)
})

test('newRequestId / newMessageId produce msg_<12hex><14base62>', () => {
  assert.match(newRequestId(), MESSAGE_RE)
  assert.match(newMessageId(), MESSAGE_RE)
  assert.equal(newRequestId().length, 30)
})

test('generated session ids always satisfy the upstream counter bound (<= 63)', () => {
  // Mint far more ids than one millisecond can hold so the rollover path runs.
  for (let i = 0; i < MAX_COUNTER * 4; i++) {
    const c = counterOf(newSessionId())
    assert.ok(c >= 1 && c <= MAX_COUNTER, `counter ${c} out of range`)
  }
})

test('encodeIdentifier matches opencode descending()/ascending() bit layout', () => {
  const ts = 1_700_000_000_000
  const desc = encodeIdentifier(ts, { descending: true })
  const value = BigInt('0x' + desc.slice(0, 12))
  const current = (~value) & ((1n << 48n) - 1n)
  // opencode packs `ts * 0x1000 + counter` into a 48-bit field, so the value is
  // truncated mod 2^48 (the gate does not check the timestamp magnitude).
  const expected = (BigInt(ts) * 0x1000n) & ((1n << 48n) - 1n)
  assert.equal(current >> 12n, expected >> 12n)
  assert.ok(Number(current & 0xfffn) >= 1 && Number(current & 0xfffn) <= MAX_COUNTER)
})

test('currentSession returns a valid session id per-request by default', () => {
  if (ZEN_SESSION_MODE !== 'per-request') return
  const a = currentSession()
  const b = currentSession()
  assert.match(a, SESSION_RE)
  assert.notEqual(a, b, 'per-request mode yields a fresh session each call')
})

test('fingerprint headers carry a matching session and session-id (mismatch => 403)', () => {
  const h = buildFingerprintHeaders()
  assert.match(h['x-opencode-session'], SESSION_RE)
  assert.equal(h['x-opencode-session-id'], h['x-opencode-session'])
  assert.match(h['user-agent'], /^opencode\//)
  assert.equal(h['x-opencode-client'], 'cli')
  assert.equal(h['x-opencode-project'], 'global')
  assert.match(h['x-opencode-request'], MESSAGE_RE)
})

test('filterModels keeps only big-pickle / *-free ids', async () => {
  const { filterModels } = await import('../src/config.js')
  const models = filterModels({
    object: 'list',
    data: [
      { id: 'big-pickle' },
      { id: 'jev-1.13-free' },
      { id: 'muse-spark-1.3-contributor-free' },
      { id: 'claude-opus-5' },
      { id: 'gpt-5.5' },
      { id: 'gemini-3-flash' },
      { id: 'jev-1.13-free' }, // duplicate
    ],
  })
  assert.deepEqual(models.map((m) => m.id), ['big-pickle', 'jev-1.13-free', 'muse-spark-1.3-contributor-free'])
  assert.ok(models.every((m) => m.name && m.contextWindow > 0))
})

test('filterModels accepts a bare array and tolerates junk', async () => {
  const { filterModels } = await import('../src/config.js')
  assert.deepEqual(filterModels(['big-pickle', 'nope', null, 42]).map((m) => m.id), ['big-pickle'])
  assert.deepEqual(filterModels(null), [])
})
