const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs/promises');
const path = require('node:path');

const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
// Replace native configuration only; exercise the actual network and session code.
const networkModule = (async () => {
  const session = await fs.readFile(path.join(__dirname, '../utils/session.js'), 'utf8');
  const source = await fs.readFile(path.join(__dirname, '../utils/network.js'), 'utf8');
  return import(moduleUrl(source
    .replace('import { Platform } from "react-native";', 'const Platform = { OS: "android" };')
    .replace('import { API_FALLBACK_URLS, API_URL } from "../config";', 'const API_URL = "https://primary.invalid"; const API_FALLBACK_URLS = ["https://fallback.invalid"];')
    .replace('from "./session"', `from "${moduleUrl(session)}"`)));
})();

test('fallback uses only the remaining total time budget, including response body', async (t) => {
  const { requestApi } = await networkModule;
  let now = 1000;
  const delays = [];
  const realTimer = setTimeout;
  t.mock.method(Date, 'now', () => now);
  t.mock.method(globalThis, 'setTimeout', (callback, delay) => {
    delays.push(delay);
    return realTimer(callback, delay);
  });
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push(url);
    assert.equal(options.headers.Authorization, 'Bearer verified');
    assert.equal(options.headers['X-Mallog24-Client-Platform'], 'android');
    if (calls.length === 1) {
      now += 90;
      throw new TypeError('Network request failed');
    }
    return { ok: true, text: () => new Promise((resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    }) };
  });
  await assert.rejects(requestApi('/api/auth/me', { token: 'verified', timeoutMs: 100, totalTimeoutMs: 100 }), /timed out/);
  assert.deepEqual(delays, [100, 10]);
  assert.equal(calls.length, 2);
});

test('exhausted deadline does not start a second request', async (t) => {
  const { requestApi } = await networkModule;
  let now = 1000, calls = 0;
  t.mock.method(Date, 'now', () => now);
  t.mock.method(globalThis, 'fetch', async () => {
    calls += 1;
    now += 100;
    throw new TypeError('Network request failed');
  });
  await assert.rejects(requestApi('/api/auth/me', { totalTimeoutMs: 100 }), /timed out/);
  assert.equal(calls, 1);
});

test('caller cancellation never starts fallback or masquerades as timeout', async (t) => {
  const { requestApi } = await networkModule;
  let calls = 0;
  const controller = new AbortController();
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls += 1;
    return new Promise((resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    });
  });
  const pending = requestApi('/api/auth/me', { signal: controller.signal, totalTimeoutMs: 1000 });
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(calls, 1);
});

test('authentication rejection retains status and does not fall back', async (t) => {
  const { requestApi } = await networkModule;
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    calls += 1;
    return new Response(JSON.stringify({ detail: 'Expired' }), { status: 401 });
  });
  await assert.rejects(requestApi('/api/auth/me', { totalTimeoutMs: 1000 }), { status: 401 });
  assert.equal(calls, 1);
});

test('readiness probes rotate configured servers after a cold-start timeout', async t => {
  const { waitForAuthServer } = await networkModule;
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push(url);
    assert.equal(options.method, 'GET');
    assert.equal(options.headers.Authorization, undefined);
    assert.equal(options.body, undefined);
    if (calls.length === 1) return new Promise((resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    });
    return new Response(JSON.stringify({ status: 'healthy' }));
  });
  const base = await waitForAuthServer({ timeoutMs: 1000, attemptTimeoutMs: 10, retryDelayMs: 1 });
  assert.equal(base, 'https://fallback.invalid');
  assert.deepEqual(calls, ['https://primary.invalid/health', 'https://fallback.invalid/health']);
});

test('pinned password POST cannot be replayed against a fallback host', async t => {
  const { requestApi } = await networkModule;
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push(url);
    assert.equal(options.method, 'POST');
    throw new TypeError('Network request failed');
  });
  await assert.rejects(requestApi('/api/auth/login', {
    method: 'POST', baseUrl: 'https://primary.invalid', totalTimeoutMs: 1000,
  }), /Network request failed/);
  assert.deepEqual(calls, ['https://primary.invalid/api/auth/login']);
  await assert.rejects(requestApi('/api/auth/login', { baseUrl: 'https://unknown.invalid' }), /Unknown API server/);
  assert.equal(calls.length, 1);
});

test('readiness recovers from HTTP 503 without sending any credentials', async t => {
  const { waitForAuthServer } = await networkModule;
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    calls++;
    return calls === 1 ? new Response('', { status: 503 }) : new Response(JSON.stringify({ status: 'healthy' }));
  });
  await waitForAuthServer({ timeoutMs: 1000, retryDelayMs: 1 });
  assert.equal(calls, 2);
});

test('readiness respects a global deadline and rejects invalid readiness data', async t => {
  const { waitForAuthServer } = await networkModule;
  let now = 0, calls = 0;
  t.mock.method(Date, 'now', () => now);
  t.mock.method(globalThis, 'fetch', async () => {
    calls++;
    now += 90000;
    throw new TypeError('Network request failed');
  });
  await assert.rejects(waitForAuthServer(), /startup timed out/);
  assert.equal(calls, 1);
  t.mock.method(globalThis, 'fetch', async () => new Response('{}'));
  await assert.rejects(waitForAuthServer(), /not ready/);
});

test('readiness cancellation during backoff prevents further probes', async t => {
  const { waitForAuthServer } = await networkModule;
  const controller = new AbortController();
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; return new Response('', { status: 503 }); });
  const pending = waitForAuthServer({ signal: controller.signal, retryDelayMs: 1000 });
  await new Promise(resolve => setTimeout(resolve, 10));
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(calls, 1);
});

test('timed out wording is translated to the friendly authentication error', async () => {
  const { getFriendlyAuthError } = await networkModule;
  assert.equal(getFriendlyAuthError('Server startup timed out.', { authErrors: { timeout: 'Please try again later.' } }), 'Please try again later.');
});
