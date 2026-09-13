const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs/promises');
const path = require('node:path');

const sessionModule = fs.readFile(path.join(__dirname, '../utils/session.js'), 'utf8')
  .then(source => import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`));
const future = () => Date.now() + 60000;

test('missing tokens and expired sessions never start protected requests', async () => {
  const { createSessionScope } = await sessionModule;
  for (const options of [{ token: '', expiresAt: future() }, { token: 'expired', expiresAt: 1 }, { token: 'unknown-expiry' }]) {
    const scope = createSessionScope(options);
    let requests = 0;
    await assert.rejects(scope.request(async () => { requests += 1; }, '/api/transcribe'), { name: 'AbortError' });
    assert.equal(requests, 0);
  }
});

test('verified scope owns the token and abort signal on every request', async () => {
  const { createSessionScope } = await sessionModule;
  const scope = createSessionScope({ token: 'verified', expiresAt: future() });
  const result = await scope.request(async (route, options, retry) => {
    assert.equal(route, '/api/history');
    assert.equal(options.token, 'verified');
    assert.equal(options.signal, scope.signal);
    assert.equal(options.method, 'GET');
    assert.deepEqual(retry, { attempts: 2 });
    return { history: [] };
  }, '/api/history', { token: 'other-user', method: 'GET' }, { attempts: 2 });
  assert.deepEqual(result, { history: [] });
});

test('logout discards responses that arrive after cancellation', async () => {
  const { createSessionScope } = await sessionModule;
  const scope = createSessionScope({ token: 'verified', expiresAt: future() });
  let finish;
  const pending = scope.request(() => new Promise(resolve => { finish = resolve; }), '/api/status/task');
  scope.invalidate();
  finish({ corrected_text: 'private result' });
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(scope.signal.aborted, true);
});

test('401 invalidates a session once, even with concurrent failing requests', async () => {
  const { createSessionScope } = await sessionModule;
  let expired = 0;
  const scope = createSessionScope({ token: 'verified', expiresAt: future(), onExpired: () => { expired += 1; } });
  const unauthorized = Object.assign(new Error('unauthorized'), { status: 401 });
  const fail = async () => { throw unauthorized; };
  const results = await Promise.allSettled([scope.request(fail, '/api/usage'), scope.request(fail, '/api/history')]);
  assert.equal(results.every(result => result.status === 'rejected'), true);
  assert.equal(expired, 1);
  assert.equal(scope.isActive(), false);
});

test('network failures do not sign a valid user out', async () => {
  const { createSessionScope } = await sessionModule;
  const scope = createSessionScope({ token: 'verified', expiresAt: future() });
  await assert.rejects(scope.request(async () => { throw new TypeError('Network request failed'); }, '/api/history'), TypeError);
  assert.equal(scope.isActive(), true);
});

test('a new login stays separate from the old scope even with the same token', async () => {
  const { createSessionScope } = await sessionModule;
  const options = { token: 'same-token', expiresAt: future() };
  const old = createSessionScope(options);
  const current = createSessionScope(options);
  old.invalidate();
  assert.equal(old.isActive(), false);
  assert.equal(current.isActive(), true);
  assert.notEqual(old.signal, current.signal);
});

test('expiration during a request discards the result and notifies once', async () => {
  const { createSessionScope } = await sessionModule;
  const now = Date.now;
  let clock = now();
  Date.now = () => clock;
  try {
    let expired = 0;
    const scope = createSessionScope({ token: 'verified', expiresAt: clock + 1000, onExpired: () => { expired += 1; } });
    await assert.rejects(scope.request(async () => { clock += 1001; return 'private'; }, '/api/records'), { name: 'AbortError' });
    assert.equal(scope.isActive(), false);
    assert.equal(expired, 1);
  } finally { Date.now = now; }
});

test('all native screen style references have definitions', async () => {
  const parser = require('@babel/parser');
  const traverse = require('@babel/traverse').default;
  const source = await fs.readFile(path.join(__dirname, '../App.js'), 'utf8');
  const ast = parser.parse(source, { sourceType: 'module', plugins: ['jsx'] });
  const used = new Set(), defined = new Set();
  traverse(ast, {
    MemberExpression({ node }) {
      if (node.object.name === 'styles' && !node.computed) used.add(node.property.name);
    },
    VariableDeclarator({ node }) {
      if (node.id.name === 'styles') {
        for (const property of node.init.arguments[0].properties) defined.add(property.key.name);
      }
    },
  });
  assert.deepEqual([...used].filter(name => !defined.has(name)), []);
});
