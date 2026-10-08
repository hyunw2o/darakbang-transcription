import React, { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import useMallogAuth from '../hooks/useMallogAuth'
import useMallogTranscription from '../hooks/useMallogTranscription'
import useMallogGlossary from '../hooks/useMallogGlossary'
import { apiFetch, apiFetchWithNetworkRetry } from '../utils/network'

window.IS_REACT_ACT_ENVIRONMENT = true
const apiUrl = `${location.origin}/backend`
const noop = () => {}
const submitEvent = { preventDefault: noop }
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
const sessionData = (id = 'user-1') => ({ user: { id, email: `${id}@example.com` }, session_established: true, session_expires_at: Math.floor(Date.now() / 1000) + 3600, usage: { plan_tier: 'free' } })
const assert = (value, message = 'Assertion failed') => { if (!value) throw new Error(message) }
const equal = (actual, expected, message = '') => assert(JSON.stringify(actual) === JSON.stringify(expected), `${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
const deferred = () => {
  let resolve
  let reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const tick = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })
const until = async (condition, message = 'Timed out waiting for hook state') => {
  const deadline = native.now() + 3000
  while (!condition() && native.now() < deadline) {
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)) })
  }
  assert(condition(), message)
}
const mounts = []
const defaults = { apiUrl, locale: 'en', setError: noop, setNotice: noop, onResetState: noop, showToast: noop, recordTypeLabels: {}, getAuthHeaders: () => ({}), fetchUsage: noop }
const enabledProps = { ...defaults, authToken: '__cookie_session__', accessEnabled: true, authSessionRevision: 1 }
const native = { fetch: window.fetch, createElement: document.createElement, MediaRecorder: window.MediaRecorder, AudioContext: window.AudioContext, now: Date.now, setInterval: window.setInterval, clearInterval: window.clearInterval }

async function mount(hook, props = defaults, strict = false) {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  let value
  function Probe(nextProps) { value = hook(nextProps); return null }
  const render = async (nextProps) => {
    await act(async () => root.render(strict ? React.createElement(StrictMode, null, React.createElement(Probe, nextProps)) : React.createElement(Probe, nextProps)))
  }
  const result = { get current() { return value }, update: render, unmount: async () => { await act(async () => root.unmount()); host.remove() } }
  mounts.push(result)
  await render(props)
  return result
}

function mockFetch(handler, health = () => json({ status: 'healthy' })) {
  const calls = []
  window.fetch = async (url, options = {}) => {
    const path = String(url).split('?')[0]
    calls.push({ url: path, rawUrl: String(url), options })
    return path.endsWith('/health') ? health(options) : handler(path, options, calls)
  }
  return calls
}

function mockMedia(getUserMedia = async () => { throw new Error('Unexpected microphone access') }) {
  let enumerations = 0
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: {
    enumerateDevices: async () => { enumerations += 1; return [] }, getUserMedia, addEventListener: noop, removeEventListener: noop,
  } })
  window.AudioContext = undefined
  return () => enumerations
}

function mockRecorder() {
  const recorders = []
  window.MediaRecorder = class {
    static isTypeSupported() { return true }
    constructor(stream) { this.stream = stream; this.state = 'inactive'; this.mimeType = 'audio/webm'; recorders.push(this) }
    start() { this.state = 'recording' }
    stop() { this.state = 'inactive'; queueMicrotask(() => this.onstop?.()) }
    requestData() { this.ondataavailable?.({ data: new Blob(['recording']) }) }
  }
  return recorders
}

function mockStream() {
  let stops = 0
  const track = { readyState: 'live', stop: () => { stops += 1 }, addEventListener: noop, getSettings: () => ({}) }
  return { stream: { getTracks: () => [track], getAudioTracks: () => [track] }, get stops() { return stops } }
}

function useWorkspace(props) {
  const auth = useMallogAuth(props)
  const accessEnabled = Boolean(auth.authToken && auth.authUser && !auth.authInitializing && auth.authMode !== 'reset_password' && !props.isAuthPage)
  const accessProps = { ...props, authToken: auth.authToken, accessEnabled, authSessionRevision: auth.authSessionRevision, getAuthHeaders: auth.getAuthHeaders, fetchUsage: auth.fetchUsage }
  const transcription = useMallogTranscription(accessProps)
  const glossary = useMallogGlossary(accessProps)
  return { auth, accessEnabled, transcription, glossary }
}

const cases = []
const test = (name, run) => cases.push({ name, run })

test('bootstrap verifies a user once, including changing parent callback identities', async () => {
  const pending = deferred()
  const calls = mockFetch(() => pending.promise)
  const hook = await mount(useMallogAuth)
  assert(hook.current.authInitializing)
  equal(hook.current.authUser, null)
  await act(async () => pending.resolve(json(sessionData())))
  await until(() => !hook.current.authInitializing)
  assert(!hook.current.authInitializing && hook.current.authUser.id === 'user-1')
  const revision = hook.current.authSessionRevision
  await hook.update({ ...defaults, onResetState: () => {}, setError: () => {}, locale: 'ko' })
  equal(calls.filter((call) => call.url.endsWith('/bootstrap')).length, 1)
  equal(hook.current.authSessionRevision, revision)
})

test('startup skips warmup and loads usage without blocking verified access', async () => {
  const usage = deferred()
  const calls = mockFetch((url) => url.endsWith('/usage') ? usage.promise : json({ ...sessionData(), usage: null }))
  const hook = await mount(useMallogAuth)
  await until(() => Boolean(hook.current.authUser) && !hook.current.authInitializing)
  equal(hook.current.usage, null)
  equal(calls.filter(call => call.url.endsWith('/health')).length, 0)
  equal(calls.filter(call => call.url.endsWith('/bootstrap')).length, 1)
  assert(calls.find(call => call.url.endsWith('/bootstrap')).rawUrl.endsWith('?include_usage=false'))
  await act(async () => usage.resolve(json({ used_audio_seconds: 30 })))
  await until(() => hook.current.usage?.used_audio_seconds === 30)
})

test('sign-in can replace a slow bootstrap without a late response changing the account', async () => {
  const pending = deferred()
  mockFetch(url => url.endsWith('/bootstrap') ? pending.promise : json(sessionData('new-user')))
  const hook = await mount(useMallogAuth)
  assert(hook.current.authInitializing)
  await act(async () => { hook.current.setAuthEmail('new@example.com'); hook.current.setAuthPassword('password') })
  await act(async () => hook.current.handleAuthSubmit(submitEvent))
  equal(hook.current.authUser.id, 'new-user')
  await act(async () => pending.resolve(json(sessionData('old-user'))))
  equal(hook.current.authUser.id, 'new-user')
})

test('network bootstrap failure offers retry without granting access', async () => {
  mockFetch(async () => { throw new TypeError('Failed to fetch') })
  const hook = await mount(useMallogAuth)
  await until(() => hook.current.authRetryAvailable)
  assert(!hook.current.authUser && !hook.current.authToken && !hook.current.authInitializing)
  mockFetch(() => json(sessionData()))
  await act(async () => hook.current.retryAuth())
  assert(hook.current.authUser && !hook.current.authRetryAvailable)
})

test('one password submission waits for cold startup and ignores duplicate clicks', async () => {
  const ready = deferred()
  let notice
  const calls = mockFetch(url => url.endsWith('/bootstrap') ? json({}, 401) : json(sessionData()), () => ready.promise)
  const hook = await mount(useMallogAuth, { ...defaults, setNotice: value => { notice = value } })
  await until(() => !hook.current.authInitializing)
  await act(async () => { hook.current.setAuthEmail('user@example.com'); hook.current.setAuthPassword('password123') })
  let pending
  await act(async () => {
    pending = hook.current.handleAuthSubmit(submitEvent)
    await hook.current.handleAuthSubmit(submitEvent)
  })
  const startedAt = Date.now()
  Date.now = () => startedAt + 60000
  assert(hook.current.authLoading && !hook.current.authUser)
  equal(notice, 'Connecting to the server. Please wait.')
  equal(calls.filter(call => call.url.endsWith('/health')).length, 1)
  equal(calls.filter(call => call.url.endsWith('/login')).length, 0)
  equal(calls.find(call => call.url.endsWith('/health')).options.credentials, 'omit')
  await act(async () => { ready.resolve(json({ status: 'healthy' })); await pending })
  assert(hook.current.authUser && !hook.current.authLoading)
  equal(calls.filter(call => call.url.endsWith('/login')).length, 1)
})

test('logout during readiness prevents a late password submission', async () => {
  const ready = deferred()
  const calls = mockFetch(url => url.endsWith('/bootstrap') ? json({}, 401) : json({}), () => ready.promise)
  const hook = await mount(useMallogAuth)
  await until(() => !hook.current.authInitializing)
  let pending
  await act(async () => { pending = hook.current.handleAuthSubmit(submitEvent) })
  await act(async () => hook.current.handleLogout())
  assert(calls.find(call => call.url.endsWith('/health')).options.signal.aborted)
  await act(async () => { ready.resolve(json({ status: 'healthy' })); await pending })
  equal(calls.filter(call => call.url.endsWith('/login')).length, 0)
  assert(!hook.current.authUser && !hook.current.authLoading)
})

test('bad passwords are not automatically replayed and a user can try again', async () => {
  const calls = mockFetch(() => json({ detail: 'Invalid login credentials' }, 401))
  let error, notice
  const hook = await mount(useMallogAuth, { ...defaults, setError: value => { error = value }, setNotice: value => { notice = value } })
  await until(() => !hook.current.authInitializing)
  await act(async () => hook.current.handleAuthSubmit(submitEvent))
  equal(calls.filter(call => call.url.endsWith('/login')).length, 1)
  equal(error, 'Invalid login credentials')
  equal(notice, null)
  assert(!hook.current.authUser && !hook.current.authLoading)
  await act(async () => hook.current.handleAuthSubmit(submitEvent))
  equal(calls.filter(call => call.url.endsWith('/login')).length, 2)
})

test('bounded requests time out and preserve caller cancellation', async () => {
  mockFetch((_url, options) => new Promise((resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true })
  }))
  try { await apiFetch(`${apiUrl}/slow`, { timeoutMs: 20 }); throw new Error('Expected timeout') }
  catch (error) { equal(error.name, 'TimeoutError') }
  const controller = new AbortController()
  const pending = apiFetch(`${apiUrl}/slow`, { timeoutMs: 200, signal: controller.signal })
  controller.abort()
  try { await pending; throw new Error('Expected cancellation') }
  catch (error) { equal(error.name, 'AbortError') }
})

test('missing users, missing expiry, expired sessions and offline bootstrap fail closed', async () => {
  for (const data of [{ ...sessionData(), user: null }, { ...sessionData(), session_expires_at: 0 }, { ...sessionData(), session_expires_at: 1 }, null]) {
    mockFetch(async () => { if (!data) throw new TypeError('Failed to fetch'); return json(data) })
    const hook = await mount(useMallogAuth)
    await until(() => !hook.current.authInitializing)
    assert(!hook.current.authInitializing)
    assert(!hook.current.authToken && !hook.current.authUser)
    await hook.unmount()
    mounts.pop()
  }
})

test('logout immediately clears state and ignores a late bootstrap response', async () => {
  const bootstrap = deferred()
  const logout = deferred()
  const calls = mockFetch((url) => url.endsWith('/logout') ? logout.promise : bootstrap.promise)
  const hook = await mount(useMallogAuth)
  let pending
  await act(async () => { pending = hook.current.handleLogout() })
  assert(!hook.current.authInitializing && !hook.current.authToken)
  assert(calls.find((call) => call.url.endsWith('/bootstrap')).options.signal.aborted)
  await act(async () => bootstrap.resolve(json(sessionData())))
  assert(!hook.current.authUser)
  await act(async () => { logout.resolve(json({})); await pending })
})

test('late usage does not repopulate a cleared or replaced session', async () => {
  const usage = deferred()
  mockFetch((url) => url.endsWith('/usage') ? usage.promise : json(sessionData()))
  const hook = await mount(useMallogAuth)
  await until(() => Boolean(hook.current.authToken))
  let pending
  await act(async () => { pending = hook.current.fetchUsage() })
  await act(async () => hook.current.handleLogout())
  await act(async () => { usage.resolve(json({ used_audio_seconds: 999 })); await pending })
  equal(hook.current.usage, null)
  assert(!hook.current.authToken)
})

test('password recovery remains gated through social verification and confirmation', async () => {
  const token = `header.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }))}.signature`
  history.replaceState({}, '', `/#access_token=${token}&type=recovery`)
  const establish = deferred()
  const calls = mockFetch((url) => url.endsWith('/auth/session') ? establish.promise : url.endsWith('/glossary') ? json({ terms: [] }) : json(sessionData()))
  mockMedia()
  const hook = await mount(useWorkspace)
  equal(hook.current.auth.authMode, 'reset_password')
  assert(!hook.current.accessEnabled)
  await act(async () => establish.resolve(json(sessionData())))
  await until(() => !hook.current.auth.authInitializing)
  assert(!hook.current.accessEnabled && !hook.current.auth.authInitializing)
  await act(async () => hook.current.auth.fetchUsage())
  equal(calls.filter((call) => /\/api\/(usage|glossary|history|records)$/.test(call.url)).length, 0)
  await act(async () => { hook.current.auth.setAuthPassword('new-password'); hook.current.auth.setAuthPasswordConfirm('new-password') })
  await act(async () => hook.current.auth.handleAuthSubmit(submitEvent))
  equal(hook.current.auth.authMode, 'login')
  assert(hook.current.accessEnabled)
  equal(location.hash, '')
})

test('signup awaiting email verification never creates access', async () => {
  mockFetch((url) => url.endsWith('/bootstrap') ? json({}, 401) : json({ message: 'Verify email' }))
  const hook = await mount(useMallogAuth, { ...defaults, initialAuthMode: 'signup' })
  await until(() => !hook.current.authInitializing)
  await act(async () => { hook.current.setAuthEmail('new@example.com'); hook.current.setAuthPassword('password-123') })
  await act(async () => hook.current.handleAuthSubmit(submitEvent))
  assert(!hook.current.authToken && !hook.current.authUser)
  equal(hook.current.authMode, 'login')
  equal(hook.current.authPassword, '')
})

test('expiry on focus clears auth and protected workspace state', async () => {
  mockFetch((url) => url.endsWith('/glossary') ? json({ terms: [{ id: 'private' }] }) : json(sessionData()))
  mockMedia()
  const hook = await mount(useWorkspace)
  await until(() => hook.current.accessEnabled && hook.current.glossary.glossaryTerms.length > 0)
  assert(hook.current.accessEnabled)
  const now = Date.now()
  Date.now = () => now + 7200000
  await act(async () => window.dispatchEvent(new Event('focus')))
  assert(!hook.current.accessEnabled && !hook.current.auth.authUser)
  equal(hook.current.glossary.glossaryTerms, [])
  equal(hook.current.transcription.result, null)
})

test('disabled handlers never fetch, create guest storage, probe files or request microphones', async () => {
  localStorage.clear()
  const enumerations = mockMedia()
  const calls = mockFetch(() => { throw new Error('Unexpected protected fetch') })
  for (const props of [{ ...defaults }, { ...enabledProps, accessEnabled: false }, { ...enabledProps, authToken: '' }]) {
    const hook = await mount(useMallogTranscription, props)
    const file = new File(['audio'], 'private.webm')
    let clicks = 0
    hook.current.fileInputRef.current = { click: () => { clicks += 1 } }
    await act(async () => {
      hook.current.handleFileChange({ target: { files: [file] } })
      hook.current.handleDrop({ preventDefault: noop, dataTransfer: { files: [file] } })
      hook.current.triggerFilePicker(false)
      hook.current.handleDragOver(submitEvent)
      await hook.current.startRecording(false)
      await hook.current.handleSubmit(submitEvent)
      await hook.current.fetchHistory()
      await hook.current.fetchSavedRecords()
      await hook.current.handleLoadHistory('old-task')
      await hook.current.handleSaveTranscriptCorrection()
    })
    equal(hook.current.file, null)
    equal(clicks, 0)
    equal(hook.current.dragOver, false)
    assert(!('guestUsage' in hook.current) && !('isGuestMode' in hook.current))
  }
  const glossary = await mount(useMallogGlossary, { ...enabledProps, accessEnabled: false })
  await act(async () => {
    await glossary.current.fetchGlossary()
    await glossary.current.handleCreateGlossaryTerm()
    await glossary.current.handleToggleGlossaryTerm('old', true)
    await glossary.current.handleDeleteGlossaryTerm('old')
  })
  equal(calls.length, 0)
  equal(enumerations(), 0)
  equal(localStorage.length, 0)
})

test('a late file duration probe cannot restore a file after logout', async () => {
  mockMedia()
  mockFetch(() => json({}))
  let audio
  document.createElement = function (name, ...args) {
    if (name !== 'audio') return native.createElement.call(this, name, ...args)
    audio = { duration: 12, removeAttribute: noop }
    return audio
  }
  const hook = await mount(useMallogTranscription, enabledProps)
  await act(async () => hook.current.handleFileChange({ target: { files: [new File(['x'], 'voice.webm')] } }))
  assert(audio)
  await hook.update({ ...enabledProps, accessEnabled: false })
  await act(async () => audio.onloadedmetadata())
  equal(hook.current.file, null)
  equal(hook.current.fileDurationSeconds, 0)
})

test('microphone permission arriving after logout stops the stream without recording', async () => {
  const permission = deferred()
  mockMedia(() => permission.promise)
  const recorders = mockRecorder()
  const hook = await mount(useMallogTranscription, enabledProps)
  let pending
  await act(async () => { pending = hook.current.startRecording(false) })
  equal(hook.current.recordingState, 'requesting')
  await hook.update({ ...enabledProps, accessEnabled: false })
  const media = mockStream()
  await act(async () => { permission.resolve(media.stream); await pending })
  equal(media.stops, 1)
  equal(recorders.length, 0)
  equal(hook.current.recordingState, 'idle')
})

test('logout stops an active recorder and discards recording data', async () => {
  const media = mockStream()
  mockMedia(async () => media.stream)
  const recorders = mockRecorder()
  const hook = await mount(useMallogTranscription, enabledProps)
  await act(async () => hook.current.startRecording(false))
  equal(hook.current.recordingState, 'recording')
  await hook.update({ ...enabledProps, accessEnabled: false })
  equal(recorders[0].state, 'inactive')
  assert(media.stops > 0)
  equal(hook.current.recordingState, 'idle')
  equal(hook.current.file, null)
  equal(hook.current.recordingSeconds, 0)
})

test('late uploads cannot begin polling or restore results after access is disabled', async () => {
  mockMedia()
  const upload = deferred()
  const calls = mockFetch(() => upload.promise)
  const hook = await mount(useMallogTranscription, enabledProps)
  await act(async () => hook.current.setFile(new File(['audio'], 'voice.webm')))
  let pending
  await act(async () => { pending = hook.current.handleSubmit(submitEvent) })
  await hook.update({ ...enabledProps, accessEnabled: false })
  assert(calls[0].options.signal.aborted)
  equal(calls[0].options.credentials, 'include')
  assert(!Object.keys(calls[0].options.headers).some((key) => /guest/i.test(key)))
  await act(async () => { upload.resolve(json({ status: 'queued', task_id: 'old-task' })); await pending })
  equal(hook.current.result, null)
  equal(hook.current.loading, false)
  equal(calls.length, 1)
})

test('session revisions isolate history, records and glossary responses with the same cookie token', async () => {
  mockMedia()
  const old = deferred()
  let secondSession = false
  const calls = mockFetch((url) => secondSession ? json(url.endsWith('/glossary') ? { terms: [{ id: 'new' }] } : []) : old.promise)
  const transcript = await mount(useMallogTranscription, enabledProps)
  const glossary = await mount(useMallogGlossary, enabledProps)
  let historyRequest
  let recordsRequest
  await act(async () => { historyRequest = transcript.current.fetchHistory(); recordsRequest = transcript.current.fetchSavedRecords() })
  const staleFetch = glossary.current.fetchGlossary
  secondSession = true
  await transcript.update({ ...enabledProps, authSessionRevision: 2 })
  await glossary.update({ ...enabledProps, authSessionRevision: 2 })
  await tick()
  await act(async () => { old.resolve(json([{ id: 'old', task_id: 'old' }])); await historyRequest; await recordsRequest; await staleFetch() })
  await until(() => glossary.current.glossaryTerms[0]?.id === 'new')
  equal(transcript.current.history, [])
  equal(transcript.current.savedRecords, [])
  equal(glossary.current.glossaryTerms, [{ id: 'new' }])
  assert(calls.slice(0, 3).every((call) => call.options.signal.aborted))
})

test('Strict Mode aborts old generations and still loads the authenticated glossary', async () => {
  const calls = mockFetch(() => json({ terms: [{ id: 'current' }] }))
  const hook = await mount(useMallogGlossary, enabledProps, true)
  await until(() => !hook.current.glossaryLoading && hook.current.glossaryTerms.length > 0)
  equal(hook.current.glossaryTerms, [{ id: 'current' }])
  equal(hook.current.glossaryLoading, false)
  assert(calls.length <= 3, 'Effect replay must not loop')
})

test('protected 401 clears auth and cancels all workspace access', async () => {
  mockMedia()
  let unauthorized = false
  const calls = mockFetch((url) => url.endsWith('/bootstrap') ? json(sessionData()) : unauthorized ? json({ detail: 'Expired' }, 401) : json({ terms: [] }))
  const hook = await mount(useWorkspace)
  await until(() => hook.current.accessEnabled && !hook.current.glossary.glossaryLoading)
  unauthorized = true
  await act(async () => hook.current.transcription.fetchHistory())
  assert(!hook.current.auth.authToken && !hook.current.accessEnabled)
  equal(hook.current.glossary.glossaryTerms, [])
  const count = calls.length
  await act(async () => { await hook.current.transcription.handleLoadHistory('old'); await hook.current.glossary.fetchGlossary() })
  equal(calls.length, count)
})

test('polling 401 clears authentication and does not retry as a network failure', async () => {
  mockMedia()
  let poll
  window.setInterval = (callback, delay) => delay === 3000 ? (poll = callback, 'poll-test') : native.setInterval.call(window, callback, delay)
  window.clearInterval = (id) => { if (id !== 'poll-test') native.clearInterval.call(window, id) }
  const calls = mockFetch((url) => url.endsWith('/bootstrap') ? json(sessionData()) : url.endsWith('/usage') ? json({ plan_tier: 'free' }) : url.endsWith('/glossary') ? json({ terms: [] }) : url.endsWith('/transcribe') ? json({ status: 'queued', task_id: 'task' }) : json({ detail: 'Expired' }, 401))
  const hook = await mount(useWorkspace)
  await until(() => hook.current.accessEnabled)
  await act(async () => hook.current.transcription.setFile(new File(['audio'], 'voice.webm')))
  await act(async () => hook.current.transcription.handleSubmit(submitEvent))
  assert(poll)
  await act(async () => poll())
  assert(!hook.current.accessEnabled)
  const count = calls.length
  await act(async () => poll())
  equal(calls.length, count)
  equal(hook.current.transcription.loading, false)
})

test('transient failures preserve retries and an abort interrupts retry backoff', async () => {
  let attempts = 0
  mockFetch(async () => { attempts += 1; if (attempts === 1) throw new TypeError('Failed to fetch'); return attempts === 2 ? json({}, 503) : json({ ok: true }) })
  const response = await apiFetchWithNetworkRetry('/retry', () => ({}), { baseDelayMs: 1, maxAttempts: 3 })
  equal(response.status, 200)
  equal(attempts, 3)
  const controller = new AbortController()
  attempts = 0
  mockFetch(() => { attempts += 1; return json({}, 503) })
  const pending = apiFetchWithNetworkRetry('/retry', () => ({ signal: controller.signal }), { baseDelayMs: 10000, onRetry: () => controller.abort() })
  let aborted = false
  try { await pending } catch (error) { aborted = error.name === 'AbortError' }
  assert(aborted)
  equal(attempts, 1)
})

test('unprotected login 401 is not a protected-session invalidation', async () => {
  mockFetch((url) => url.endsWith('/bootstrap') ? json(sessionData()) : url.endsWith('/usage') ? json({ plan_tier: 'free' }) : json({}, 401))
  const hook = await mount(useMallogAuth)
  await until(() => Boolean(hook.current.authUser))
  await apiFetch(`${apiUrl}/api/auth/login`, { method: 'POST' })
  assert(hook.current.authUser)
})

async function run() {
  const results = []
  for (const entry of cases) {
    try {
      history.replaceState({}, '', '/')
      await entry.run()
      results.push({ name: entry.name })
    } catch (error) {
      results.push({ name: entry.name, error: error.stack || String(error) })
    } finally {
      while (mounts.length) await mounts.pop().unmount()
      window.fetch = native.fetch
      document.createElement = native.createElement
      window.MediaRecorder = native.MediaRecorder
      window.AudioContext = native.AudioContext
      Date.now = native.now
      window.setInterval = native.setInterval
      window.clearInterval = native.clearInterval
      delete navigator.mediaDevices
    }
  }
  window.authGatingResults = results
}
run()
