const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const { chromium } = require('playwright')

const base = process.env.UI_TEST_URL || 'http://127.0.0.1:3000'
const output = process.env.UI_TEST_OUTPUT || '/tmp/mallog-workspace-qa'
const user = { id: 'ui-test-user', email: 'long.account.for.layout.check@example.com', user_metadata: { full_name: '테스트 사용자' } }
const usage = { plan_tier: 'free', used_audio_seconds: 742, monthly_limit_seconds: null, remaining_seconds: null }
const completed = { task_id: 'mock-task', status: 'completed', raw_text: '테스트 음성 기록입니다.', corrected_text: '테스트 음성 기록입니다.', transcription_type: 'prayer' }

function wav() {
  const b = Buffer.alloc(44 + 16000 * 2)
  b.write('RIFF', 0); b.writeUInt32LE(b.length - 8, 4); b.write('WAVEfmt ', 8)
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22)
  b.writeUInt32LE(16000, 24); b.writeUInt32LE(32000, 28); b.writeUInt16LE(2, 32)
  b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(b.length - 44, 40)
  return b
}

async function fixture(browser, { signedIn = false, width = 1440, height = 1000, bootstrapDelay = 0, bootstrapStatus = 0 } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, permissions: ['microphone'] })
  const state = { signedIn, requests: [], expireGlossary: false, errors: [], bootstrapStatus }
  const page = await context.newPage()
  page.on('pageerror', error => state.errors.push(error.message))
  const session = () => ({ session_established: true, user, usage, session_expires_at: Math.floor(Date.now() / 1000) + 3600 })
  await context.route('**/*', async route => {
    const url = new URL(route.request().url())
    if (url.pathname.startsWith('/api/') || url.pathname === '/health') {
      state.requests.push({ path: url.pathname, method: route.request().method(), headers: route.request().headers() })
      let data = {}, status = 200
      if (url.pathname === '/api/auth/bootstrap') {
        if (bootstrapDelay) await new Promise(resolve => setTimeout(resolve, bootstrapDelay))
        status = state.bootstrapStatus || (state.signedIn ? 200 : 401)
        data = state.signedIn ? session() : { detail: '로그인이 필요합니다.' }
      } else if (url.pathname === '/api/auth/login' || url.pathname === '/api/auth/session') {
        state.signedIn = true; data = session()
      } else if (url.pathname === '/api/auth/logout') {
        state.signedIn = false
      } else if (url.pathname === '/api/auth/signup') {
        data = { message: '이메일 인증 후 로그인해주세요.' }
      } else if (url.pathname === '/api/auth/password-reset/confirm') {
        data = { ...session(), message: '비밀번호가 변경되었습니다.' }
      } else if (url.pathname === '/api/glossary') {
        status = state.expireGlossary ? 401 : 200
        data = state.expireGlossary ? { detail: '로그인이 필요합니다.' } : { terms: [] }
      } else if (url.pathname === '/api/usage') data = usage
      else if (url.pathname === '/api/history') data = [{ task_id: completed.task_id, status: 'completed', created_at: new Date().toISOString(), transcription_type: 'prayer', summary_preview: '저장된 테스트 기록' }]
      else if (url.pathname === '/api/records') data = []
      else if (url.pathname === '/api/transcribe' || url.pathname.startsWith('/api/status/')) data = completed
      await route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': base, 'access-control-allow-credentials': 'true', 'access-control-allow-headers': '*' }, body: JSON.stringify(data) })
    } else if (url.origin === base) await route.continue()
    else await route.abort()
  })
  return { context, page, state }
}

async function layout(page, name) {
  await page.evaluate(() => document.fonts.ready)
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${name}: viewport overflow`)
  const overflow = await page.locator('.mallog-auth, .mallog-workspace, .mallog-workspace nav button, .mallog-account, .mallog-conversion-options, .mallog-primary-action, .mallog-social-buttons button').evaluateAll(nodes => nodes.filter(n => n.getClientRects().length && n.scrollWidth > n.clientWidth + 2).map(n => n.className))
  assert.deepEqual(overflow, [], `${name}: overflowing controls`)
  const clippedSelections = await page.locator('select:visible').evaluateAll(selects => selects.filter(select => {
    const style = getComputedStyle(select)
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
    const label = select.selectedOptions[0]?.textContent || ''
    return context.measureText(label).width > select.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
  }).map(select => select.selectedOptions[0]?.textContent))
  assert.deepEqual(clippedSelections, [], `${name}: clipped selected labels`)
  await page.screenshot({ path: path.join(output, `${name}.png`), fullPage: true, animations: 'disabled' })
}

async function assertLoginOnly(page) {
  assert.equal(await page.locator('input[type=file], .mallog-workspace, .mallog-recorder').count(), 0, 'Signed-out page must not mount conversion controls')
  const text = await page.locator('main').innerText()
  for (const removed of ['비로그인 체험', '결제 없이 바로 기록을 시작하세요', '마이크로 바로 녹음', 'Guest trial', 'Start recording', 'Start transcription']) {
    assert.equal(text.includes(removed), false, `Signed-out page still contains: ${removed}`)
  }
}

async function main() {
  await fs.mkdir(output, { recursive: true })
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
    ...(process.env.CHROME_EXECUTABLE ? { executablePath: process.env.CHROME_EXECUTABLE } : {}),
  })
  try {
    const anonymous = await fixture(browser, { bootstrapDelay: 1500 })
    await anonymous.page.goto(base, { waitUntil: 'domcontentloaded' })
    await anonymous.page.getByText('로그인 상태 확인 중...').waitFor()
    assert.equal(await anonymous.page.locator('input[type=file]').count(), 0)
    await anonymous.page.getByLabel('이메일', { exact: true }).waitFor()
    assert.equal(await anonymous.page.getByLabel('이메일', { exact: true }).isEnabled(), true)
    assert.equal(await anonymous.page.getByRole('button', { name: '로그인', exact: true }).last().isEnabled(), true)
    await anonymous.page.evaluate(() => document.fonts.ready)
    const pendingEmailBounds = await anonymous.page.locator('#account-email').boundingBox()
    await anonymous.page.waitForFunction(() => document.querySelector('#auth-card')?.getAttribute('aria-busy') === 'false')
    const readyEmailBounds = await anonymous.page.locator('#account-email').boundingBox()
    assert.equal(readyEmailBounds.y, pendingEmailBounds.y, 'Session verification must not shift the sign-in form')
    await assertLoginOnly(anonymous.page)
    assert.equal(await anonymous.page.getByRole('button', { name: '녹음 시작', exact: true }).count(), 0)
    assert.equal(anonymous.state.requests.some(r => /guest|transcribe|history|records|glossary/.test(r.path)), false)
    assert.equal(anonymous.state.requests.some(r => r.path === '/health' || r.path === '/api/stats'), false)
    await layout(anonymous.page, 'login-desktop')
    await anonymous.page.getByRole('button', { name: '회원가입', exact: true }).click()
    await anonymous.page.getByLabel('이름', { exact: true }).fill('테스트')
    await anonymous.page.getByLabel('이메일', { exact: true }).fill('ui-test@example.com')
    await anonymous.page.getByLabel('비밀번호', { exact: true }).fill('test-password')
    await anonymous.page.getByRole('button', { name: '무료 회원가입', exact: true }).click()
    await anonymous.page.getByText('이메일 인증 후 로그인해주세요.').waitFor()
    assert.equal(await anonymous.page.locator('input[type=file]').count(), 0)
    await anonymous.page.getByLabel('비밀번호', { exact: true }).fill('test-password')
    await anonymous.page.getByRole('button', { name: '로그인', exact: true }).last().click()
    await anonymous.page.getByRole('heading', { name: '새 변환', exact: true }).waitFor()
    await layout(anonymous.page, 'workspace-desktop')
    await anonymous.page.getByRole('button', { name: '변환 기록', exact: true }).click()
    await anonymous.page.getByText('저장된 테스트 기록', { exact: true }).waitFor()
    await anonymous.page.getByText('저장된 테스트 기록', { exact: true }).click()
    await anonymous.page.getByRole('heading', { name: '새 변환', exact: true }).waitFor()
    await anonymous.page.locator('input[type=file]').setInputFiles({ name: '긴_파일명_줄바꿈_검증_음성.wav', mimeType: 'audio/wav', buffer: wav() })
    await anonymous.page.getByRole('button', { name: '변환 시작', exact: true }).click()
    await anonymous.page.getByText(completed.corrected_text, { exact: true }).first().waitFor()
    await layout(anonymous.page, 'completed-desktop')
    assert.equal(anonymous.state.requests.filter(r => r.path === '/api/transcribe').length, 1)
    assert.equal(anonymous.state.requests.some(r => r.headers['x-guest-session-id']), false)
    await anonymous.page.getByRole('button', { name: '사용자 용어집', exact: true }).click()
    anonymous.state.expireGlossary = true
    await anonymous.page.getByRole('button', { name: '새로고침', exact: true }).click()
    await anonymous.page.getByRole('heading', { name: 'mallog24 로그인', exact: true }).waitFor()
    assert.equal(await anonymous.page.locator('input[type=file]').count(), 0)
    assert.deepEqual(anonymous.state.errors, [])
    await anonymous.context.close()

    for (const width of [320, 1440]) {
      const delayed = await fixture(browser, { width, bootstrapStatus: 503 })
      await delayed.page.goto(base)
      await delayed.page.getByRole('button', { name: '연결 다시 확인', exact: true }).waitFor()
      await assertLoginOnly(delayed.page)
      await layout(delayed.page, `connection-retry-${width}`)
      delayed.state.bootstrapStatus = 0
      delayed.state.signedIn = true
      await delayed.page.getByRole('button', { name: '연결 다시 확인', exact: true }).click()
      await delayed.page.locator('.mallog-workspace').waitFor()
      assert.deepEqual(delayed.state.errors, [])
      await delayed.context.close()
    }

    for (const [locale, width] of [['ko', 390], ['ko', 320], ['en', 320], ['en', 390], ['en', 1440]]) {
      const f = await fixture(browser, { width })
      const url = `${base}${locale === 'en' ? '/en' : '/'}`
      await f.page.goto(url)
      await f.page.locator('#account-email').waitFor()
      await assertLoginOnly(f.page)
      await layout(f.page, `login-${locale}-${width}`)
      f.state.signedIn = true
      await f.page.reload()
      await f.page.locator('.mallog-workspace').waitFor()
      await layout(f.page, `workspace-${locale}-${width}`)
      for (const key of [2, 3]) {
        await f.page.locator('.mallog-workspace-nav nav button').nth(key).click()
        await layout(f.page, `workspace-tab${key}-${locale}-${width}`)
      }
      await f.page.getByRole('button', { name: locale === 'en' ? 'Sign out' : '로그아웃', exact: true }).click()
      await f.page.locator('#account-email').waitFor()
      await assertLoginOnly(f.page)
      assert.equal(await f.page.locator('input[type=file]').count(), 0)
      assert.deepEqual(f.state.errors, [])
      await f.context.close()
    }

    const recovery = await fixture(browser)
    const jwt = `header.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.signature`
    await recovery.page.goto(`${base}/recover#access_token=${jwt}&type=recovery`)
    await recovery.page.getByRole('heading', { name: '새 비밀번호 설정', exact: true }).waitFor()
    assert.equal(await recovery.page.locator('input[type=file]').count(), 0)
    assert.equal(recovery.state.requests.some(r => /transcribe|history|records|glossary/.test(r.path)), false)
    await layout(recovery.page, 'password-recovery')
    await recovery.page.goto(`${base}/privacy`)
    assert.equal(await recovery.page.locator('main').count() > 0, true)
    assert.deepEqual(recovery.state.errors, [])
    await recovery.context.close()
    for (const width of [320, 1440]) {
      const dark = await fixture(browser, { width, signedIn: true })
      await dark.context.addInitScript(() => {
        localStorage.setItem('darkMode', 'true')
        localStorage.setItem('mallog24-ui-theme-mode', 'manual')
        localStorage.setItem('mallog24-ui-theme', 'noir')
      })
      await dark.page.goto(base)
      await dark.page.locator('html.dark .mallog-workspace').waitFor()
      await layout(dark.page, `workspace-dark-${width}`)
      assert.deepEqual(dark.state.errors, [])
      await dark.context.close()
    }
    console.log(`PASS: anonymous gate, signup, login, upload, history, 401, logout, recovery, public privacy, KO/EN desktop/mobile layouts. Screenshots: ${output}`)
  } finally { await browser.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
