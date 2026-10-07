// Run against a production build with UI_TEST_URL and the bundled Playwright runtime.
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const { gzipSync } = require('node:zlib')
const { chromium } = require('playwright')

const base = process.env.UI_TEST_URL || 'http://127.0.0.1:3106'
const output = process.env.UI_TEST_OUTPUT || '/tmp/mallog-startup-qa'
const buildRoot = path.join(__dirname, '../.next')

function gate() {
  let release
  const promise = new Promise(resolve => { release = resolve })
  return { promise, release }
}

async function main() {
  await fs.mkdir(output, { recursive: true })
  const manifest = JSON.parse(await fs.readFile(path.join(buildRoot, 'react-loadable-manifest.json'), 'utf8'))
  const filesFor = name => Object.entries(manifest).find(([key]) => key.endsWith(`-> ./${name}`))[1].files
  const workspaceFiles = [...filesFor('MallogWorkspaceKo'), ...filesFor('MallogWorkspaceEn')]
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROME_EXECUTABLE ? { executablePath: process.env.CHROME_EXECUTABLE } : {}),
  })
  try {
    for (const [locale, width] of [['ko', 1440], ['en', 390]]) {
      const url = `${base}${locale === 'en' ? '/en' : '/'}`
      const html = await (await fetch(url)).text()
      assert.match(html, /id="account-email"/, 'The login form must exist before JavaScript or authentication completes')
      assert.doesNotMatch(html, /<script[^>]+src="https:\/\/pagead2/, 'Ads must not compete with the initial document')
      assert.match(html, /rel="icon" href="\/_next\/image\?/, 'The favicon must not load the full-size original')
      const initialScripts = [...html.matchAll(/<script[^>]+src="\/_next\/([^"]+)"/g)]
        .map(match => match[1])
        .filter(file => !/polyfills|_buildManifest|_ssgManifest/.test(file))
      assert.equal(initialScripts.some(file => workspaceFiles.includes(file)), false)
      let scriptBytes = 0, scriptGzipBytes = 0
      for (const file of initialScripts) {
        const contents = await fs.readFile(path.join(buildRoot, file))
        scriptBytes += contents.length
        scriptGzipBytes += gzipSync(contents).length
      }

      const context = await browser.newContext({ viewport: { width, height: 1000 } })
      const page = await context.newPage()
      const authGate = gate(), usageGate = gate()
      const requests = [], errors = [], imageSizes = []
      page.on('request', request => requests.push(new URL(request.url()).pathname))
      page.on('pageerror', error => errors.push(error.message))
      page.on('response', response => {
        if (new URL(response.url()).pathname === '/_next/image') {
          imageSizes.push(response.body().then(body => body.length))
        }
      })
      await context.route('**/*', async route => {
        const requestUrl = new URL(route.request().url())
        if (requestUrl.pathname.startsWith('/api/')) {
          const pathname = requestUrl.pathname
          if (pathname === '/api/auth/bootstrap') {
            assert.equal(requestUrl.searchParams.get('include_usage'), 'false')
            await authGate.promise
          }
          if (pathname === '/api/usage') await usageGate.promise
          const data = pathname === '/api/auth/bootstrap'
            ? { session_established: true, user: { id: 'startup-test', email: 'startup@example.com' }, session_expires_at: Math.floor(Date.now() / 1000) + 3600 }
            : pathname === '/api/glossary' ? { terms: [] }
              : pathname === '/api/usage' ? { plan_tier: 'free', used_audio_seconds: 0, monthly_limit_seconds: null, remaining_seconds: null } : []
          await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': base, 'access-control-allow-credentials': 'true' }, body: JSON.stringify(data) })
        } else if (requestUrl.origin === base) await route.continue()
        else await route.abort()
      })
      try {
        const cdp = await context.newCDPSession(page)
        await cdp.send('Network.enable')
        await cdp.send('Network.emulateNetworkConditions', {
          offline: false, latency: 150, downloadThroughput: 125000, uploadThroughput: 62500,
        })
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
        await page.goto(url, { waitUntil: 'domcontentloaded' })
        const email = page.locator('#account-email')
        await email.fill('still-loading@example.com')
        assert.equal(await email.inputValue(), 'still-loading@example.com')
        assert.equal(await page.locator('#auth-card').getAttribute('aria-busy'), 'true')
        assert.equal(await page.locator('input[type=file]').count(), 0)
        await page.waitForLoadState('load')
        await page.evaluate(() => document.fonts.ready)
        await page.waitForTimeout(1200)
        const currentWorkspaceFiles = filesFor(locale === 'ko' ? 'MallogWorkspaceKo' : 'MallogWorkspaceEn')
        assert.equal(currentWorkspaceFiles.every(file => requests.some(request => request.endsWith(file))), true, 'Warm the current workspace during authentication, after the SSR form is interactive')
        const otherWorkspaceFiles = filesFor(locale === 'ko' ? 'MallogWorkspaceEn' : 'MallogWorkspaceKo')
          .filter(file => !currentWorkspaceFiles.includes(file))
        assert.equal(requests.some(request => otherWorkspaceFiles.some(file => request.endsWith(file))), false, 'Do not preload the other workspace language')
        const otherLocaleFiles = filesFor(locale === 'ko' ? 'MallogHomeEnView' : 'MallogHomeKoView')
          .filter(file => !filesFor(locale === 'ko' ? 'MallogHomeKoView' : 'MallogHomeEnView').includes(file))
        assert.equal(requests.some(request => otherLocaleFiles.some(file => request.endsWith(file))), false, 'Do not prefetch the other language on entry')
        assert.equal(requests.some(request => /^\/api\/(history|records|glossary|transcribe|stats)/.test(request) || request === '/health'), false)
        assert.equal(requests.includes('/mallog24-app-icon.png'), false, 'Do not download a full-size image for the tiny logo')
        const images = await page.locator('img[data-nimg]').evaluateAll(nodes => nodes.map(img => ({ loaded: img.complete && img.naturalWidth > 0, width: img.width })))
        assert.equal(images.length >= 2 && images.every(img => img.loaded), true, 'Optimized logos must render')
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
        await page.screenshot({ path: path.join(output, `slow-startup-${locale}-${width}.png`), fullPage: true })

        authGate.release()
        await page.locator('.mallog-workspace').waitFor()
        assert.equal(await page.locator('input[type=file]').count(), 1, 'Usage statistics must not block authenticated conversion controls')
        assert.equal(requests.some(request => filesFor(locale === 'ko' ? 'MallogWorkspaceKo' : 'MallogWorkspaceEn').some(file => request.endsWith(file))), true)
        usageGate.release()
        await page.waitForTimeout(100)
        assert.deepEqual(errors, [])
        console.log(JSON.stringify({ locale, width, scriptBytes, scriptGzipBytes, optimizedLogoBytes: await Promise.all(imageSizes), checks: 'SSR form, slow connection, delayed auth and usage, lazy chunks, optimized images, no overflow' }))
      } finally {
        authGate.release()
        usageGate.release()
        await context.close()
      }
    }
    console.log('PASS: production startup loading regressions')
  } finally { await browser.close() }
}

main().catch(error => { console.error(error); process.exitCode = 1 })
