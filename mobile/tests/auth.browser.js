import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import useMobileAuth from '../hooks/useMobileAuth';

window.IS_REACT_ACT_ENVIRONMENT = true;
const assert = (value, message = 'Assertion failed') => { if (!value) throw new Error(message); };
const now = Date.now;
const jwt = () => `header.${btoa(JSON.stringify({ exp: Math.floor(now() / 1000) + 3600 }))}.signature`;
const expiredJwt = () => `header.${btoa(JSON.stringify({ exp: 1 }))}.signature`;
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const user = { id: 'mobile-user', email: 'mobile@example.invalid' };
const messages = new Proxy({}, { get: (_, key) => String(key) });
const copy = { ...messages, errors: messages, notices: messages, sessionExpiredNotice: 'expired', recoveryComplete: 'recovered' };
const props = { copy, language: 'ko', clearMessages: () => {}, setNotice: () => {}, setError: () => {} };
const mounts = [];
const until = async condition => {
  const deadline = now() + 3000;
  while (!condition() && now() < deadline) await act(async () => { await new Promise(resolve => setTimeout(resolve, 5)); });
  assert(condition(), 'Timed out waiting for native auth state');
};
const fixture = ({ token = '', initialUrl = '', api = async () => ({ user }) } = {}) => {
  const storage = new Map(token ? [['test-token', token]] : []);
  return window.mobileAuthFixture = { storage, initialUrl, api, requests: [], foreground: null, deepLink: null };
};
async function mount(strict = false) {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  let value;
  function Probe() { value = useMobileAuth(props); return null; }
  await act(async () => root.render(strict ? React.createElement(StrictMode, null, React.createElement(Probe)) : React.createElement(Probe)));
  const result = { get current() { return value; }, unmount: async () => { await act(async () => root.unmount()); host.remove(); } };
  mounts.push(result);
  return result;
}
const tests = [
  ['saved token waits for server verification before opening a workspace', async () => {
    const pending = deferred();
    const f = fixture({ token: jwt(), api: () => pending.promise });
    const h = await mount();
    await until(() => f.requests.length === 1);
    assert(!h.current.isLoggedIn && h.current.bootLoading && !h.current.authToken);
    pending.resolve({ user });
    await until(() => h.current.isLoggedIn);
    assert(h.current.authUser.id === user.id && h.current.sessionScope.isActive());
  }],
  ['missing or expired saved tokens stay signed out without a protected API call', async () => {
    for (const token of ['', expiredJwt()]) {
      const f = fixture({ token });
      const h = await mount();
      await until(() => !h.current.bootLoading);
      assert(!h.current.isLoggedIn && !h.current.authToken && f.requests.length === 0);
      assert(!f.storage.has('test-token'));
      await mounts.pop().unmount();
    }
  }],
  ['invalid saved authentication is removed rather than trusted', async () => {
    const f = fixture({ token: jwt(), api: async () => { throw Object.assign(new Error('unauthorized'), { status: 401 }); } });
    const h = await mount();
    await until(() => !h.current.bootLoading);
    assert(!h.current.isLoggedIn && !f.storage.has('test-token'));
  }],
  ['logout wins against a late token verification response', async () => {
    const pending = deferred();
    const f = fixture({ token: jwt(), api: () => pending.promise });
    const h = await mount();
    await until(() => f.requests.length === 1);
    await act(async () => h.current.handleLogout());
    await act(async () => pending.resolve({ user }));
    assert(!h.current.isLoggedIn && !h.current.authToken && !f.storage.has('test-token'));
  }],
  ['signup requiring email verification does not unlock features', async () => {
    const f = fixture({ api: async () => ({ message: 'Verify email' }) });
    const h = await mount();
    await until(() => !h.current.bootLoading);
    await act(async () => { h.current.setAuthMode('signup'); h.current.setAuthEmail(user.email); h.current.setAuthPassword('password123'); });
    await act(async () => h.current.handleAuthSubmit());
    assert(f.requests[0] === '/api/auth/signup' && !h.current.isLoggedIn && !f.storage.has('test-token'));
  }],
  ['recovery credentials cannot open the workspace, even after password confirmation', async () => {
    const token = jwt();
    const f = fixture({ initialUrl: `mallog24://recover#type=recovery&access_token=${token}`, api: async () => ({ user, access_token: token }) });
    const h = await mount();
    await until(() => h.current.authMode === 'recovery');
    assert(!h.current.isLoggedIn && !h.current.authToken && f.requests.length === 0);
    await act(async () => { h.current.setAuthPassword('new-password'); h.current.setAuthPasswordConfirm('new-password'); });
    await act(async () => h.current.handlePasswordRecovery());
    assert(h.current.authMode === 'login' && !h.current.isLoggedIn && !h.current.authToken && !f.storage.has('test-token'));
  }],
  ['foreground 401 invalidates the workspace and persisted token', async () => {
    const f = fixture({ token: jwt() });
    const h = await mount();
    await until(() => h.current.isLoggedIn);
    const old = h.current.sessionScope;
    f.api = async () => { throw Object.assign(new Error('unauthorized'), { status: 401 }); };
    await act(async () => f.foreground('active'));
    await until(() => !h.current.isLoggedIn);
    assert(old.signal.aborted && !f.storage.has('test-token'));
  }],
  ['late usage cannot restore account data after logout', async () => {
    const f = fixture({ token: jwt() });
    const h = await mount();
    await until(() => h.current.isLoggedIn);
    const pending = deferred();
    f.api = () => pending.promise;
    let usagePromise;
    await act(async () => { usagePromise = h.current.fetchUsage(); });
    await act(async () => h.current.handleLogout());
    await act(async () => { pending.resolve({ used_audio_seconds: 100 }); await usagePromise; });
    assert(h.current.usage === null && !h.current.usageLoaded && !h.current.isLoggedIn);
  }],
  ['Strict Mode restores only the live login generation', async () => {
    fixture({ token: jwt() });
    const h = await mount(true);
    await until(() => h.current.isLoggedIn);
    assert(h.current.sessionScope.isActive());
  }],
];
async function main() {
  const results = [];
  for (const [name, run] of tests) {
    try { await run(); results.push({ name }); }
    catch (error) { results.push({ name, error: error.stack || error.message }); }
    finally { while (mounts.length) await mounts.pop().unmount(); }
  }
  window.authGatingResults = results;
}
main();
