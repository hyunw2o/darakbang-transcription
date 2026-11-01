const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const { chromium } = require('playwright')
const base = process.env.UI_TEST_URL || 'http://127.0.0.1:3108'
const output = '/tmp/mallog-queue-ui'
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

async function main() {
  await fs.mkdir(output, { recursive: true })
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE })
  try {
    for (const [locale, width] of [['ko', 320], ['ko', 1440], ['en', 390]]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 } })
      const page = await context.newPage()
      const errors = [], uploads = [], jobs = new Map()
      page.on('pageerror', error => errors.push(error.message))
      await page.route('**/*', async route => {
        const url = new URL(route.request().url())
        let data = null
        if (url.pathname === '/api/auth/bootstrap') data = { user: { id: 'queue-test', email: 'queue@example.com' }, session_established: true, session_expires_at: Math.floor(Date.now()/1000) + 3600 }
        else if (url.pathname === '/api/auth/privacy') data = { accepted: true, version: '2026-10-31' }
        else if (url.pathname === '/api/usage') data = { plan_tier: 'free' }
        else if (url.pathname === '/api/glossary') data = { terms: [] }
        else if (url.pathname === '/api/transcribe') {
          assert(![...jobs.values()].some(job => job.status === 'processing'), 'Concurrent uploads')
          const id = route.request().headers()['x-mallog24-upload-id']
          uploads.push(id); jobs.set(id, { status: 'processing', task_id: id }); data = { status: 'queued', task_id: id }
        } else if (url.pathname.startsWith('/api/status/')) data = jobs.get(url.pathname.split('/').pop())
        else if (url.pathname === '/api/history' || url.pathname === '/api/records') data = []
        else if (url.pathname.startsWith('/api/')) data = {}
        if (data !== null) return route.fulfill({ json: data, headers: { 'access-control-allow-origin': base, 'access-control-allow-credentials': 'true' } })
        if (url.origin === base) return route.continue()
        return route.abort()
      })
      try {
        await page.goto(`${base}${locale === 'en' ? '/en' : '/'}`)
        await page.locator('.mallog-workspace').waitFor()
        // Wait for the privacy panel to propagate accepted consent to the queue.
        await page.getByText(locale === 'en' ? 'AI transfer consented' : 'AI 전송 동의 완료', { exact: false }).waitFor({ timeout: 5000 }).catch(() => sleep(500))
        const names = ['긴파일이름_회의_교육내용_줄바꿈검증_'.repeat(3) + '.wav', 'second.wav', 'third.wav']
        await page.locator('input[type=file]').setInputFiles(names.map(name => ({ name, mimeType: 'audio/wav', buffer: Buffer.from('mock audio') })))
        await page.locator('.mallog-queue-row').nth(2).waitFor()
        const up = locale === 'en' ? 'Move up' : '위로 이동'
        await page.locator('.mallog-queue-row').nth(2).getByLabel(up, { exact: true }).click()
        assert((await page.locator('.mallog-queue-row').nth(1).innerText()).includes('third.wav'))
        await page.locator('.mallog-queue-row').nth(2).getByLabel(locale === 'en' ? 'Remove from queue' : '목록에서 제거', { exact: true }).click()
        assert.equal(await page.locator('.mallog-queue-row').count(), 2)
        await page.locator('.mallog-queue').scrollIntoViewIfNeeded()
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'Page overflow')
        const overflow = await page.locator('.mallog-queue, .mallog-queue-row, .mallog-queue-file, .mallog-queue-actions, .mallog-primary-action').evaluateAll(nodes => nodes.filter(n => n.scrollWidth > n.clientWidth + 2).map(n => n.className))
        assert.deepEqual(overflow, [], 'Queue text/control overflow')
        await page.screenshot({ path: `${output}/queue-${locale}-${width}.png`, fullPage: true })
        await page.locator('button[type=submit]').click()
        await page.locator('.mallog-queue-processing').waitFor()
        assert.equal(uploads.length, 1)
        await page.getByLabel(locale === 'en' ? 'Pause after current file' : '현재 파일 완료 후 일시정지', { exact: true }).click()
        jobs.set(uploads[0], { status: 'completed', task_id: uploads[0], raw_text: '첫 번째 결과', corrected_text: '첫 번째 결과', transcription_type: 'conversation' })
        await page.locator('.mallog-queue-completed').waitFor({ timeout: 12000 })
        await sleep(100)
        assert.equal(uploads.length, 1, 'Pause must stop the next file')
        await page.locator('button[type=submit]').click()
        await page.locator('.mallog-queue-processing').waitFor()
        assert.equal(uploads.length, 2)
        jobs.set(uploads[1], { status: 'completed', task_id: uploads[1], corrected_text: '두 번째 결과', transcription_type: 'conversation' })
        await page.waitForFunction(() => document.querySelectorAll('.mallog-queue-completed').length === 2)
        await page.locator('.mallog-queue-row').first().getByLabel(locale === 'en' ? 'View result' : '결과 보기', { exact: true }).click()
        await page.getByText('첫 번째 결과', { exact: true }).first().waitFor()
        assert.deepEqual(errors, [])
        console.log(`PASS queue UI ${locale} ${width}px, multi-select/reorder/remove/pause/resume/results`)
      } finally { await context.close() }
    }
  } finally { await browser.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
