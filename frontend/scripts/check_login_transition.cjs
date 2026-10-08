// Production-build regression: slow workspace downloads must overlap authentication.
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const { chromium } = require('playwright')

const base = process.env.UI_TEST_URL || 'http://127.0.0.1:3106'
const baseline = process.env.LOGIN_TIMING_BASELINE === '1'
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

function gate() {
  let release
  const promise = new Promise(resolve => { release = resolve })
  return { promise, release }
}

async function checkDownloadRecovery(browser, files, locale, failure) {
  const context = await browser.newContext({ viewport: { width: 390, height: 900 } })
  const page = await context.newPage()
  const auth = gate(), download = gate(), attempted = gate()
  const errors = []
  let healthy = false, attempts = 0
  page.on('pageerror', error => errors.push(error.message))
  await context.route('**/*', async route => {
    const url = new URL(route.request().url())
    if (url.pathname.endsWith(files.at(-1)) && !healthy) {
      attempts++
      attempted.release()
      if (failure === 'timeout') {
        await download.promise
        await route.abort().catch(() => {})
      } else await route.abort()
    } else if (url.pathname.startsWith('/api/') || url.pathname === '/health') {
      let data = {}
      if (url.pathname === '/health') data = { status: 'healthy' }
      else if (url.pathname === '/api/auth/bootstrap') {
        await auth.promise
        data = { session_established: true, user: { id: 'recovery-test', email: 'test@example.com' }, session_expires_at: Math.floor(Date.now() / 1000) + 3600 }
      } else if (url.pathname === '/api/glossary') data = { terms: [] }
      await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': base, 'access-control-allow-credentials': 'true' }, body: JSON.stringify(data) })
    } else if (url.origin === base) await route.continue()
    else await route.abort()
  })
  try {
    await page.goto(`${base}${locale === 'en' ? '/en' : '/'}`, { waitUntil: 'domcontentloaded' })
    await Promise.race([attempted.promise, delay(5000)])
    assert.equal(attempts, 1, 'Workspace warm-up must run before authentication')
    await delay(300)
    assert.equal(await page.locator('.mallog-workspace').count(), 0)
    if (failure === 'warmup-only') healthy = true
    auth.release()
    if (failure !== 'warmup-only') {
      const reload = page.getByRole('button', { name: locale === 'en' ? 'Reload' : '다시 불러오기', exact: true })
      await reload.waitFor({ timeout: 20000 })
      assert.equal(await page.locator('input[type=file]').count(), 0)
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
      healthy = true
      await reload.click()
      download.release()
    }
    await page.locator('.mallog-upload-zone').waitFor()
    assert.equal(await page.locator('input[type=file]').count(), 1)
    assert.deepEqual(errors, [], 'Failed preloads must not cause unhandled errors')
    console.log(`PASS: ${locale} workspace download ${failure} recovery`)
  } finally {
    auth.release()
    download.release()
    await context.close()
  }
}

async function main() {
  const manifest = JSON.parse(await fs.readFile(path.join(__dirname, '../.next/react-loadable-manifest.json'), 'utf8'))
  const filesFor = name => Object.entries(manifest).find(([key]) => key.endsWith(`-> ./${name}`))[1].files
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROME_EXECUTABLE ? { executablePath: process.env.CHROME_EXECUTABLE } : {}),
  })
  try {
    for (const [locale, width, mode] of [
      ['ko', 1440, 'password'], ['en', 390, 'password'],
      ['ko', 390, 'session'], ['en', 1440, 'session'],
    ]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 } })
      const page = await context.newPage()
      const auth = gate(), extraData = gate()
      const requests = [], errors = [], chunks = []
      const files = filesFor(locale === 'ko' ? 'MallogWorkspaceKo' : 'MallogWorkspaceEn')
      const otherFiles = filesFor(locale === 'ko' ? 'MallogWorkspaceEn' : 'MallogWorkspaceKo').filter(file => !files.includes(file))
      let authFinishedAt = 0
      page.on('pageerror', error => errors.push(error.message))
      page.on('request', request => requests.push(new URL(request.url()).pathname))
      await context.route('**/*', async route => {
        const url = new URL(route.request().url())
        if (files.some(file => url.pathname.endsWith(file))) {
          chunks.push({ pathname: url.pathname, startedAt: performance.now() })
          await delay(2500)
          await route.continue()
        } else if (url.pathname.startsWith('/api/') || url.pathname === '/health') {
          let status = 200, data = {}
          if (url.pathname === '/health') data = { status: 'healthy' }
          else if (url.pathname === '/api/auth/bootstrap' && mode === 'password') {
            status = 401
            data = { detail: 'Sign in required' }
          } else if (['/api/auth/bootstrap', '/api/auth/login'].includes(url.pathname)) {
            assert.equal(url.searchParams.get('include_usage'), 'false')
            await auth.promise
            data = { session_established: true, user: { id: 'login-timing', email: 'test@example.com' }, session_expires_at: Math.floor(Date.now() / 1000) + 3600 }
            authFinishedAt = performance.now()
          } else if (['/api/usage', '/api/glossary'].includes(url.pathname)) {
            await extraData.promise
            data = url.pathname === '/api/glossary' ? { terms: [] } : { plan_tier: 'free', monthly_limit_seconds: null, remaining_seconds: null }
          }
          await route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': base, 'access-control-allow-credentials': 'true' }, body: JSON.stringify(data) })
        } else if (url.origin === base) await route.continue()
        else await route.abort()
      })
      try {
        const cdp = await context.newCDPSession(page)
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
        await page.goto(`${base}${locale === 'en' ? '/en' : '/'}`, { waitUntil: 'domcontentloaded' })
        await page.locator('#account-email').fill('test@example.com')
        if (mode === 'password') {
          await page.locator('#account-password').fill('test-password')
          await page.locator('#auth-card button[type=submit]').click()
        }
        // Keep auth pending longer than the slow chunk transfer to detect a waterfall.
        await delay(3200)
        assert.equal(await page.locator('input[type=file], .mallog-workspace, .mallog-recorder').count(), 0)
        assert.equal(requests.some(request => /^\/api\/(usage|glossary|history|records|transcribe)/.test(request)), false)
        assert.equal(requests.some(request => otherFiles.some(file => request.endsWith(file))), false)
        const preloaded = chunks.length === files.length
        auth.release()
        await page.locator('.mallog-upload-zone').waitFor()
        const transitionMs = Math.round(performance.now() - authFinishedAt)
        assert.equal(await page.locator('input[type=file]').count(), 1)
        assert.equal(await page.locator('.mallog-recorder button').first().isEnabled(), true)
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
        console.log(JSON.stringify({ locale, width, mode, preloaded, transitionMs, chunkDelayMs: 2500, extraData: 'still pending' }))
        if (!baseline) {
          assert.equal(preloaded, true, 'Workspace code must be fetched concurrently with authentication')
          assert.ok(transitionMs < 1000, `Post-auth transition took ${transitionMs}ms despite preloaded code`)
          assert.equal(chunks.every(chunk => chunk.startedAt < authFinishedAt), true, 'Do not start another workspace download after login')
        }
        extraData.release()
        await page.waitForTimeout(100)
        assert.deepEqual(errors, [])
      } finally {
        auth.release()
        extraData.release()
        await context.close()
      }
    }
    if (!baseline) {
      await checkDownloadRecovery(browser, filesFor('MallogWorkspaceKo'), 'ko', 'warmup-only')
      await checkDownloadRecovery(browser, filesFor('MallogWorkspaceKo'), 'ko', 'error')
      await checkDownloadRecovery(browser, filesFor('MallogWorkspaceEn'), 'en', 'timeout')
    }
    console.log(baseline ? 'BASELINE: login transition timing' : 'PASS: login transition timing and auth isolation')
  } finally { await browser.close() }
}

main().catch(error => { console.error(error); process.exitCode = 1 })
