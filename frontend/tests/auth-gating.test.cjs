// Run: NODE_PATH=<bundled node_modules> node --test tests/auth-gating.test.cjs
const assert = require('node:assert/strict')
const { test } = require('node:test')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const http = require('node:http')
const webpackBundle = require('next/dist/compiled/webpack/webpack')

const mobileRoot = path.resolve(__dirname, '../../mobile')
const nativeStub = path.join(mobileRoot, 'tests/auth-native-stubs.js')
const suites = [
  { name: 'web authentication hook regressions', entry: path.join(__dirname, 'auth-gating.browser.js') },
  { name: 'mobile authentication hook regressions (mock native services)', entry: path.join(mobileRoot, 'tests/auth.browser.js'), mobile: true },
]

for (const suite of suites) test(suite.name, { timeout: 90000 }, async () => {
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
  webpackBundle.init()
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'mallog-auth-tests-'))
  let server
  let browser
  try {
    await new Promise((resolve, reject) => {
      const compiler = webpackBundle.webpack({
        mode: 'development',
        devtool: false,
        context: path.join(__dirname, '..'),
        entry: suite.entry,
        output: { path: directory, filename: 'bundle.js' },
        resolve: { alias: {
          'react$': require.resolve('react'),
          'react-dom/client$': require.resolve('react-dom/client'),
          'react-dom/test-utils$': require.resolve('react-dom/test-utils'),
          ...Object.fromEntries(['react-native', 'expo-apple-authentication', 'expo-linking', 'expo-web-browser', '@react-native-async-storage/async-storage'].map(name => [`${name}$`, nativeStub])),
        } },
        plugins: suite.mobile ? [new webpackBundle.webpack.NormalModuleReplacementPlugin(/^(\.\.\/config|\.\.\/utils\/network)$/, resource => {
          if (resource.context.startsWith(mobileRoot)) resource.request = nativeStub
        })] : [],
      })
      compiler.run((error, stats) => {
        compiler.close(() => {})
        if (error || stats.hasErrors()) reject(error || new Error(stats.toString()))
        else resolve()
      })
    })
    const bundle = await fs.readFile(path.join(directory, 'bundle.js'))
    server = http.createServer((request, response) => {
      if (request.url === '/bundle.js') {
        response.setHeader('Content-Type', 'text/javascript')
        response.end(bundle)
      } else {
        response.setHeader('Content-Type', 'text/html')
        response.end('<!doctype html><html><head><title>Auth hook regressions</title><script src="/bundle.js" defer></script></head><body></body></html>')
      }
    })
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    browser = await chromium.launch({
      headless: true,
      ...(process.env.CHROME_EXECUTABLE ? { executablePath: process.env.CHROME_EXECUTABLE } : {}),
    })
    const page = await browser.newPage()
    const pageErrors = []
    page.on('pageerror', (error) => pageErrors.push(error.message))
    await page.goto(`http://127.0.0.1:${server.address().port}`)
    await page.waitForFunction(() => window.authGatingResults, { timeout: 60000 })
    const results = await page.evaluate(() => window.authGatingResults)
    for (const result of results) console.log(`${result.error ? 'FAIL' : 'PASS'} ${result.name}${result.error ? `\n${result.error}` : ''}`)
    assert.deepEqual(pageErrors, [], 'Uncaught browser errors')
    assert.equal(results.filter((result) => result.error).length, 0, 'Hook regressions failed')
  } finally {
    await browser?.close()
    if (server) await new Promise((resolve) => server.close(resolve))
    await fs.rm(directory, { recursive: true, force: true })
  }
})
