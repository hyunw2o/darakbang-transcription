const assert = require('node:assert/strict')
const { test } = require('node:test')
const fs = require('node:fs/promises')
const path = require('node:path')

const networkModule = fs.readFile(path.join(__dirname, '../utils/network.js'), 'utf8')
  .then(source => import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`))
const healthy = () => new Response(JSON.stringify({ status: 'healthy' }))
const abortable = signal => new Promise((resolve, reject) => {
  signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
})

test('readiness retries only public GETs through network, HTTP and cold-start timeouts', async t => {
  const { waitForAuthServer } = await networkModule
  const calls = []
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push(url)
    assert.equal(url, 'https://api.invalid/health')
    assert.equal(options.credentials, 'omit')
    assert.equal(options.body, undefined)
    assert.equal(options.cache, 'no-store')
    if (calls.length === 1) throw new TypeError('Failed to fetch')
    if (calls.length === 2) return new Response('Starting', { status: 503 })
    if (calls.length === 3) return abortable(options.signal)
    return healthy()
  })
  await waitForAuthServer('https://api.invalid', { timeoutMs: 1000, attemptTimeoutMs: 10, retryDelayMs: 1 })
  assert.equal(calls.length, 4)
})

test('continuous unavailability stops at the total startup deadline', async t => {
  const { waitForAuthServer } = await networkModule
  let now = 0, calls = 0
  t.mock.method(Date, 'now', () => now)
  t.mock.method(globalThis, 'fetch', async () => {
    calls++
    now += 90000
    throw new TypeError('Failed to fetch')
  })
  await assert.rejects(waitForAuthServer('https://api.invalid'), { name: 'TimeoutError' })
  assert.equal(calls, 1)
})

test('cancellation stops readiness and is not reported as a timeout', async t => {
  const { waitForAuthServer } = await networkModule
  let calls = 0
  const controller = new AbortController()
  t.mock.method(globalThis, 'fetch', async (_url, options) => { calls++; return abortable(options.signal) })
  const pending = waitForAuthServer('https://api.invalid', { signal: controller.signal })
  controller.abort()
  await assert.rejects(pending, { name: 'AbortError' })
  assert.equal(calls, 1)
})

test('cancellation during retry backoff prevents another request', async t => {
  const { waitForAuthServer } = await networkModule
  const controller = new AbortController()
  let calls = 0
  t.mock.method(globalThis, 'fetch', async () => { calls++; return new Response('', { status: 503 }) })
  const pending = waitForAuthServer('https://api.invalid', { signal: controller.signal, retryDelayMs: 1000 })
  await new Promise(resolve => setTimeout(resolve, 10))
  controller.abort()
  await assert.rejects(pending, { name: 'AbortError' })
  assert.equal(calls, 1)
})

test('invalid health payloads and non-retryable HTTP errors do not allow authentication', async t => {
  const { waitForAuthServer } = await networkModule
  for (const response of [new Response('{}'), new Response('Forbidden', { status: 403 })]) {
    let calls = 0
    t.mock.method(globalThis, 'fetch', async () => { calls++; return response })
    await assert.rejects(waitForAuthServer('https://api.invalid'), /not ready|403/)
    assert.equal(calls, 1)
  }
})

test('response body reads stay within the authentication request timeout', async t => {
  const { apiFetch } = await networkModule
  t.mock.method(globalThis, 'fetch', async (_url, options) => ({ json: () => abortable(options.signal) }))
  await assert.rejects(apiFetch('https://api.invalid/login', {
    method: 'POST', timeoutMs: 10, readResponse: response => response.json(),
  }), { name: 'TimeoutError' })
})

test('retry-after is honored but capped by the remaining startup budget', async t => {
  const { waitForAuthServer } = await networkModule
  let now = 0, calls = 0
  const delays = []
  t.mock.method(Date, 'now', () => now)
  t.mock.method(globalThis, 'setTimeout', (callback, delay) => {
    delays.push(delay)
    if (delays.length === 2) queueMicrotask(() => { now += delay; callback() })
    return 1
  })
  t.mock.method(globalThis, 'clearTimeout', () => {})
  t.mock.method(globalThis, 'fetch', async () => {
    calls++
    return new Response('', { status: 429, headers: { 'Retry-After': '120' } })
  })
  await assert.rejects(waitForAuthServer('https://api.invalid', { timeoutMs: 50 }), { name: 'TimeoutError' })
  assert.deepEqual(delays, [50, 50])
  assert.equal(calls, 1)
})
