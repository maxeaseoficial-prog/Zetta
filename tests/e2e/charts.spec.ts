import { test, expect } from '@playwright/test'
import fs from 'node:fs/promises'

async function openLab(page: import('@playwright/test').Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Experimentar gráficos', exact: true }).click()
  await expect(page.locator('.slides-scroll .slide-thumbnail')).toHaveCount(7)
}
async function openChart(page: import('@playwright/test').Page, slide = 2) {
  await page.getByRole('button', { name: new RegExp('^Slide ' + slide + ':') }).click()
  await page
    .locator('.slide-canvas-frame')
    .getByRole('button', { name: 'Selecionar gráfico 1' })
    .click()
}

test('six chart types stay editable, animate only in presentation and export a complete PDF', async ({
  page,
}, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await openLab(page)
  const types = ['bar', 'horizontalBar', 'line', 'area', 'pie', 'donut']
  for (let index = 0; index < types.length; index++) {
    await page.getByRole('button', { name: new RegExp('^Slide ' + (index + 2) + ':') }).click()
    const image = page.locator('.slide-canvas-frame image[data-chart-type="' + types[index] + '"]')
    await expect(image).toBeVisible()
    await expect(image).toHaveAttribute('data-chart-animated', 'false')
    await expect(page.locator('.slide-warning')).toHaveCount(0)
  }
  await page.getByRole('button', { name: 'Apresentar', exact: true }).click()
  const image = page.locator('.presenter image[data-chart-type="donut"]')
  await expect(image).toHaveAttribute('data-chart-animated', 'true')
  const initial = await image.getAttribute('href')
  await page.getByRole('button', { name: 'Repetir animação' }).click()
  await expect(image).not.toHaveAttribute('href', initial!)
  await page.getByRole('button', { name: 'Animar gráficos', exact: true }).click()
  await expect(image).toHaveAttribute('data-chart-animated', 'false')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(page.getByRole('button', { name: 'Animar gráficos', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Voltar ao editor' }).click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Baixar PDF', exact: true }).click()
  await page.getByRole('button', { name: 'Exportar PDF pesquisável', exact: true }).click()
  const download = await downloadPromise
  const file = testInfo.outputPath('charts-laboratory.pdf')
  await download.saveAs(file)
  const bytes = await fs.readFile(file)
  expect(bytes.subarray(0, 5).toString()).toBe('%PDF-')
  expect(bytes.length).toBeGreaterThan(50000)
  await page.screenshot({ path: testInfo.outputPath('chart-editor.png') })
  expect(errors).toEqual([])
})

test('CSV import preserves multiple series, unapplied drafts and explicit display settings', async ({
  page,
}, testInfo) => {
  await openLab(page)
  await openChart(page)
  await page.getByLabel('Formato dos números').selectOption('en-US')
  const csv = 'Month,Revenue,Cost\nJanuary,0,8.25\nFebruary,-12.5,0\nMarch,22.5,10'
  await page
    .getByLabel('Arquivo de dados CSV')
    .setInputFiles({ name: 'controle.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) })
  await expect(page.getByRole('status').filter({ hasText: 'controle.csv carregado' })).toBeVisible()
  await page.getByRole('button', { name: /^Slide 3:/ }).click()
  await openChart(page)
  await expect(page.getByLabel('Dados do gráfico', { exact: true })).toHaveValue(csv)
  await expect(page.getByLabel('Formato dos números')).toHaveValue('en-US')
  await page.getByRole('button', { name: 'Voltar às apresentações' }).click()
  await expect(
    page.getByRole('dialog', { name: 'Há dados de gráfico ainda não aplicados' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Revisar dados' }).click()
  await page.getByRole('button', { name: 'Aplicar dados', exact: true }).click()
  await expect(page.getByLabel('Fonte dos dados do gráfico')).toHaveValue('controle.csv')
  await page.getByText('Conferir dados aplicados', { exact: false }).click()
  await expect(page.getByRole('table', { name: 'Dados aplicados ao gráfico' })).toContainText(
    '-12,5',
  )
  await page.getByRole('button', { name: 'Rosca', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText(/única série/)
  await expect(page.getByRole('button', { name: 'Colunas', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await page.getByLabel('Mostrar valores no gráfico').check()
  await page
    .getByLabel('Dados do gráfico', { exact: true })
    .fill('Mês;Receita;Custo\nJaneiro;0;8.25\nFevereiro;-12.5;0\nMarço;22.5;10')
  await page.getByRole('button', { name: 'Aplicar dados', exact: true }).click()
  await expect(page.getByLabel('Mostrar valores no gráfico')).toBeChecked()
  await page.getByRole('button', { name: 'Desfazer', exact: true }).click()
  await page.getByRole('button', { name: 'Refazer', exact: true }).click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Baixar backup editável' }).click()
  const download = await downloadPromise
  const file = testInfo.outputPath('multiple-series.zetta.json')
  await download.saveAs(file)
  const deck = JSON.parse(await fs.readFile(file, 'utf8'))
  const chart = deck.slides[1].blocks[0].chart
  expect(chart.data.map((datum: { value: number }) => datum.value)).toEqual([0, -12.5, 22.5])
  expect(chart.additionalSeries[0].values).toEqual([8.25, 0, 10])
  expect(chart.showValues).toBe(true)
  await page.getByRole('button', { name: 'Voltar às apresentações' }).click()
  await page.locator('input[type=file][accept=".json,.zetta"]').setInputFiles(file)
  await openChart(page)
  await expect(page.getByLabel('Dados do gráfico', { exact: true })).toHaveValue(
    /Fevereiro[^\n]*-12,5/,
  )
  await expect(page.getByLabel('Mostrar valores no gráfico')).toBeChecked()
  await expect(page.getByRole('status').filter({ hasText: 'Salvo neste navegador' })).toBeVisible()
})

test('text tables become charts without replacing missing values with zero', async ({
  page,
}, testInfo) => {
  await page.goto('/')
  await page
    .getByLabel('Conteúdo da apresentação')
    .fill(
      'Resultados do trimestre\nMês;Receita;Despesa\nJaneiro;12000;8500\nFevereiro;14500;9200\nMarço;16000;10000',
    )
  await page.getByRole('button', { name: 'Criar apresentação', exact: true }).click()
  await page.getByRole('button', { name: 'Criar minha apresentação' }).click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Baixar backup editável' }).click()
  const download = await downloadPromise
  const file = testInfo.outputPath('generated-table.zetta.json')
  await download.saveAs(file)
  const deck = JSON.parse(await fs.readFile(file, 'utf8'))
  const charts = deck.slides
    .flatMap((slide: { blocks: { chart?: unknown }[] }) => slide.blocks)
    .filter((block: { chart?: unknown }) => block.chart)
  expect(charts).toHaveLength(1)
  expect(charts[0].chart.additionalSeries[0].values).toEqual([8500, 9200, 10000])
  expect(deck.source.text).toContain('Março;16000;10000')
})
