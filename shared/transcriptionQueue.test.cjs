const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createTranscriptionQueue } = require('./transcriptionQueue.cjs')
const make = () => { let id = 0; return createTranscriptionQueue(() => `id-${++id}`) }
const files = () => ['a.mp3', 'b.mp3', 'c.mp3'].map(name => ({ name, size: 123, lastModified: 10 }))
const options = { language: 'ko', transcriptionType: 'conversation' }

test('one atomic claim at a time; all files run in order and release binary data', () => {
  const q = make(); const entries = q.enqueue(files()); q.start(options)
  entries.forEach(entry => {
    const item = q.claim(); assert.equal(item.id, entry.id)
    assert.equal(q.claim(), null)
    q.processing(item.id, `task-${item.id}`)
    assert.equal(q.claim(), null)
    q.complete(item.id, { task_id: `task-${item.id}`, raw_text: item.name })
  })
  assert.equal(q.claim(), null)
  assert.equal(q.getSnapshot().running, false)
  assert(q.getSnapshot().items.every(item => item.status === 'completed' && !item.file && item.result))
})

test('pause finishes current item, then resumes without retranscribing it', () => {
  const q = make(); q.enqueue(files()); q.start(options)
  const item = q.claim(); q.pause(); q.complete(item.id, {})
  assert.equal(q.claim(), null)
  q.start(options); assert.equal(q.claim().name, 'b.mp3')
})

test('network uncertainty blocks all following work and cannot be removed', () => {
  const q = make(); q.enqueue(files()); q.start(options)
  const first = q.claim(); q.processing(first.id, 'server-task'); q.fail(first.id, 'offline')
  assert.equal(q.start(options), false); assert.equal(q.claim(), null)
  q.remove(first.id); assert.equal(q.getSnapshot().items.length, 3)
  q.retry(first.id); const resumed = q.claim()
  assert.equal(resumed.taskId, 'server-task'); assert.equal(resumed.uploadId, first.uploadId)
  q.complete(resumed.id, {}); assert.equal(q.claim().name, 'b.mp3')
})

test('lost upload response retries with original idempotency key', () => {
  const q = make(); q.enqueue(files()); q.start(options)
  const first = q.claim(); q.fail(first.id, 'timeout'); q.retry(first.id)
  assert.equal(q.claim().uploadId, first.uploadId)
})

test('confirmed server failure pauses and retry uses a new upload identity', () => {
  const q = make(); q.enqueue(files()); q.start(options)
  const first = q.claim(); q.processing(first.id, 'failed-task'); q.fail(first.id, 'bad audio', false)
  assert.equal(q.start(options), false)
  q.retry(first.id); const resumed = q.claim()
  assert.notEqual(resumed.uploadId, first.uploadId); assert.equal(resumed.taskId, null)
  assert.deepEqual(resumed.options, options)
})

test('remove/reorder only pending work, with stable batch options for added files', () => {
  const q = make(); const entries = q.enqueue(files()); q.start(options); const first = q.claim()
  q.remove(first.id); q.move(first.id, 1); q.move(entries[1].id, -1)
  assert.equal(q.getSnapshot().items[0].id, first.id)
  q.move(entries[2].id, -1); q.remove(entries[1].id)
  q.enqueue([{ name: 'd.mp3', size: 12 }]); q.pause(); q.complete(first.id, {})
  q.start({ language: 'en', transcriptionType: 'sermon' })
  assert.equal(q.claim().name, 'c.mp3')
  assert.deepEqual(q.getSnapshot().items.at(-1).options, options)
})

test('deduplicates pending selections but allows intentional conversion after completion', () => {
  const q = make(); q.enqueue([...files(), ...files()]); q.enqueue(files())
  assert.equal(q.getSnapshot().items.length, 3)
  q.start(options); const item = q.claim(); q.complete(item.id, {})
  assert.equal(q.enqueue(files()).length, 1)
  q.clearCompleted(); assert.equal(q.getSnapshot().items.length, 3)
})

test('logout/reset discards pending work and rejects stale completion/failure', () => {
  const q = make(); q.enqueue(files()); q.start(options); const first = q.claim()
  q.reset(); q.complete(first.id, { raw_text: 'stale' }); q.fail(first.id, 'stale')
  assert.deepEqual(q.getSnapshot(), { items: [], activeId: null, running: false, options: null })
  q.enqueue(files()); q.start(options); const next = q.claim()
  q.complete(first.id, {}); assert.equal(q.getSnapshot().activeId, next.id)
})

test('native files at different URIs are not discarded just because names/sizes match', () => {
  const q = make()
  q.enqueue([{ name: 'recording.m4a', size: 100, uri: 'file:///one.m4a' }, { name: 'recording.m4a', size: 100, uri: 'file:///two.m4a' }])
  assert.equal(q.getSnapshot().items.length, 2)
})
