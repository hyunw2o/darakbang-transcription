const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const { chromium } = require('playwright')

const base = process.env.UI_TEST_URL || 'http://127.0.0.1:3107'
const output = '/tmp/mallog-privacy-qa'
async function main() {
  assert.equal(await fs.readFile(path.resolve(__dirname, '../content/privacyPolicy.js'), 'utf8'), await fs.readFile(path.resolve(__dirname, '../../mobile/privacyPolicy.js'), 'utf8'), 'Policy parity')
  const app = JSON.parse(await fs.readFile(path.resolve(__dirname, '../../mobile/app.json'), 'utf8'))
  const dependencies = JSON.parse(await fs.readFile(path.resolve(__dirname, '../../mobile/package-lock.json'), 'utf8'))
  assert(!JSON.stringify(dependencies).includes('react-native-google-mobile-ads'))
  assert(!JSON.stringify(app.expo.plugins).includes('google-mobile-ads'))
  assert(app.expo.android.blockedPermissions.includes('com.google.android.gms.permission.AD_ID'))
  await fs.mkdir(output, { recursive: true })
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_EXECUTABLE ? { executablePath: process.env.CHROME_EXECUTABLE } : {}) })
  try {
    for (const [locale, width] of [['ko', 320], ['ko', 1440], ['en', 390]]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 } })
      let accepted = false, deleteFails = true, deleted = false
      const errors = [], calls = [], thirdParty = []
      const page = await context.newPage()
      page.setDefaultTimeout(15000)
      page.on('pageerror', error => errors.push(error.message))
      await context.route('**/*', async route => {
        const req = route.request(), url = new URL(req.url())
        if (url.pathname.startsWith('/api/')) {
          calls.push(url.pathname)
          let data = {}, status = 200
          if (url.pathname === '/api/auth/bootstrap') data = { session_established: true, user: { id: 'test', email: 'privacy@example.test' }, session_expires_at: Math.floor(Date.now() / 1000) + 3600 }
          else if (url.pathname === '/api/auth/privacy') {
            if (req.method() === 'PUT') accepted = req.postDataJSON().accepted
            data = { version: '2026-10-31', accepted, deletion_pending: false }
          } else if (url.pathname === '/api/auth/account') {
            if (deleteFails) { status = 503; data = { detail: 'Cleanup failed; retry deletion.' } }
            else { deleted = true; data = { success: true } }
          } else if (url.pathname === '/api/glossary') data = { terms: [] }
          else if (url.pathname === '/api/history' || url.pathname === '/api/records') data = []
          else if (url.pathname === '/api/usage') data = { plan_tier: 'free', monthly_limit_seconds: null }
          await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data), headers: { 'access-control-allow-origin': base, 'access-control-allow-credentials': 'true' } })
        } else if (url.origin === base) await route.continue()
        else { thirdParty.push(url.hostname); await route.abort() }
      })
      await page.goto(base + (locale === 'en' ? '/en' : '/'))
      const panel = page.locator('#privacy-settings')
      await panel.waitFor()
      const save = panel.getByRole('button', { name: locale === 'en' ? 'Save consent' : '동의 저장', exact: true })
      assert(await save.isDisabled(), 'No preselected consent')
      assert.equal(await panel.locator('input[type=checkbox]').first().isChecked(), false)
      await page.getByRole('button', { name: locale === 'en' ? 'Transcription history' : '변환 기록', exact: true }).click()
      assert(calls.includes('/api/history'), 'History must work without AI consent')
      await panel.locator('input[type=checkbox]').first().check()
      await save.click()
      const withdraw = panel.getByRole('button', { name: locale === 'en' ? 'Withdraw consent' : '동의 철회', exact: true })
      await withdraw.waitFor()
      assert(accepted)
      await withdraw.click()
      await save.waitFor()
      assert(!accepted)
      assert(await save.isDisabled(), 'Withdrawal resets checkbox')
      await panel.locator('summary').click()
      await panel.locator('details input[type=checkbox]').check()
      await panel.getByRole('button', { name: locale === 'en' ? 'Delete account' : '계정 삭제', exact: true }).click()
      await panel.getByText('Cleanup failed; retry deletion.').waitFor()
      assert(!deleted)
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
      assert.deepEqual(await panel.locator('button').evaluateAll(nodes => nodes.filter(n => n.scrollWidth > n.clientWidth + 2).map(n => n.textContent)), [])
      await panel.screenshot({ path: path.join(output, `privacy-${locale}-${width}.png`) })
      deleteFails = false
      await panel.getByRole('button', { name: locale === 'en' ? 'Delete account' : '계정 삭제', exact: true }).click()
      await panel.waitFor({ state: 'detached' })
      assert(deleted)
      assert.deepEqual(errors, [])
      assert.equal(thirdParty.some(host => /doubleclick|googlesyndication|googleadservices/.test(host)), false)
      await page.goto(base + '/delete-account')
      await page.getByRole('heading', { name: 'mallog24 계정 삭제', exact: true }).waitFor()
      await context.close()
      console.log(`PASS privacy consent/withdraw/delete/layout/no-ad ${locale} ${width}`)
    }
  } finally { await browser.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
