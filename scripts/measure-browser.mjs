// Run against a production preview, never the Vite dev module graph.
// ZETTA_BROWSER_PATH=/path/to/chromium ZETTA_TEST_URL=http://127.0.0.1:5274 node scripts/measure-browser.mjs
import { chromium } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { performance } from 'node:perf_hooks'

const url = process.env.ZETTA_TEST_URL || 'http://127.0.0.1:5274'
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.ZETTA_BROWSER_PATH || undefined,
  args: ['--no-sandbox'],
})
const samples = []
try {
  for (let index = 0; index < 3; index++) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
    const page = await context.newPage()
    const scripts = new Set()
    page.on('request', (request) => {
      if (request.resourceType() === 'script') scripts.add(new URL(request.url()).pathname)
    })
    const start = performance.now()
    await page.goto(url)
    await page
      .getByRole('button', { name: 'Experimentar gráficos', exact: true })
      .waitFor({ state: 'visible' })
    const homeReady = performance.now() - start
    const initialScripts = [...scripts]
    const open = performance.now()
    await page.getByRole('button', { name: 'Experimentar gráficos', exact: true }).click()
    await page.locator('.slides-scroll .slide-thumbnail').nth(6).waitFor({ state: 'visible' })
    await page.getByRole('button', { name: /^Slide 2:/ }).click()
    const chart = page.locator('.slide-canvas-frame image[data-chart-type="bar"]')
    await chart.waitFor({ state: 'visible' })
    const labReady = performance.now() - open
    await page
      .locator('.slide-canvas-frame')
      .getByRole('button', { name: 'Selecionar gráfico 1', exact: true })
      .click()
    const before = await chart.getAttribute('href')
    const edit = performance.now()
    await page.getByLabel('Unidade do gráfico', { exact: true }).fill('%')
    await page.waitForFunction(
      (previous) =>
        document
          .querySelector('.slide-canvas-frame image[data-chart-type="bar"]')
          ?.getAttribute('href') !== previous,
      before,
    )
    const editReady = performance.now() - edit
    samples.push({
      homeReady,
      labReady,
      editReady,
      initialScripts,
      afterChartScripts: [...scripts],
    })
    await context.close()
  }
  const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8')
  const entry = html.match(/src="([^"]+\.js)"/)?.[1]
  const source = readFileSync(new URL('../dist' + entry, import.meta.url))
  const median = (key) => [...samples].map((sample) => sample[key]).sort((a, b) => a - b)[1]
  process.stdout.write(
    JSON.stringify(
      {
        environment: {
          browser: browser.version(),
          viewport: '1440x1000',
          origin: 'loopback HTTP, production build, fresh context per sample',
          trials: 3,
        },
        main: { file: entry, bytes: source.length, gzip: gzipSync(source).length },
        medians: {
          homeReady: median('homeReady'),
          labReady: median('labReady'),
          editReady: median('editReady'),
        },
        samples,
      },
      null,
      2,
    ) + '\n',
  )
} finally {
  await browser.close()
}
