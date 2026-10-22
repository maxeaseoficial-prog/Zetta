import { test, expect } from '@playwright/test'
import { jsPDF } from 'jspdf'
import fs from 'node:fs/promises'

test('text → outline → edit → undo → save/reopen → presentation → PDF → backup', async ({
  page,
}, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /Suas ideias\.\s*Em boa forma\./ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Criar apresentação', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Experimentar com um texto' }).click()
  await page.getByRole('button', { name: 'Criar apresentação', exact: true }).click()
  await expect(page.getByLabel('Nome da apresentação')).toBeVisible()
  await page.getByLabel('Nome da apresentação').fill('Estratégia editável Zetta')
  await page.getByRole('button', { name: 'Criar minha apresentação' }).click()
  await expect(page.getByRole('button', { name: 'Baixar PDF', exact: true })).toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: 'Salvo neste navegador' })).toBeVisible()
  const slides = page.locator('.slides-scroll .slide-thumbnail')
  const count = await slides.count()
  expect(count).toBeGreaterThanOrEqual(3)
  await page.locator('.slide-canvas-frame [data-block-id="title"]').dblclick()
  await page.getByLabel('Editar texto no slide').fill('Uma ideia que ganhou forma')
  await page.getByRole('button', { name: 'Aplicar', exact: true }).click()
  await expect(page.locator('.slide-canvas-frame')).toContainText('Uma ideia que ganhou forma')
  await page.getByRole('button', { name: 'Desfazer', exact: true }).click()
  await expect(page.locator('.slide-canvas-frame')).not.toContainText('Uma ideia que ganhou forma')
  await page.getByRole('button', { name: 'Refazer', exact: true }).click()
  await expect(page.locator('.slide-canvas-frame')).toContainText('Uma ideia que ganhou forma')
  await page.getByRole('button', { name: 'Tema e cores' }).click()
  await page
    .locator('.properties-panel')
    .getByRole('button', { name: /Executivo/ })
    .click()
  await expect(page.locator('.slide-canvas-frame')).toContainText('Uma ideia que ganhou forma')
  await page.getByRole('button', { name: 'Propriedades', exact: true }).click()
  await page.getByRole('button', { name: 'Desmarcar elemento' }).click()
  await page.getByRole('button', { name: 'Duplicar slide' }).click()
  await expect(slides).toHaveCount(count + 1)
  await page.getByRole('button', { name: 'Excluir slide', exact: true }).click()
  await expect(slides).toHaveCount(count)
  await page.getByRole('button', { name: 'Desfazer', exact: true }).click()
  await expect(slides).toHaveCount(count + 1)
  await page.getByRole('button', { name: 'Refazer', exact: true }).click()
  await expect(slides).toHaveCount(count)
  await page.getByRole('button', { name: 'Voltar às apresentações' }).click()
  await page.reload()
  await page.getByRole('button', { name: 'Abrir Estratégia editável Zetta' }).click()
  await expect(page.locator('.slide-canvas-frame')).toContainText('Uma ideia que ganhou forma')
  await page.getByRole('button', { name: 'Apresentar', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Modo apresentação' })).toBeVisible()
  await page.keyboard.press('Tab')
  expect(await page.evaluate(() => !!document.activeElement?.closest('.presenter'))).toBe(true)
  await page.keyboard.press('ArrowRight')
  await expect(page.locator('.presenter footer strong')).toHaveText('2 / ' + count)
  await page.getByRole('button', { name: 'Voltar ao editor' }).click()
  const pdfPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Baixar PDF', exact: true }).click()
  const pdf = await pdfPromise
  const pdfPath = testInfo.outputPath('generated.pdf')
  await pdf.saveAs(pdfPath)
  const pdfBytes = await fs.readFile(pdfPath)
  expect(pdfBytes.subarray(0, 5).toString()).toBe('%PDF-')
  expect(pdfBytes.length).toBeGreaterThan(10000)
  const backupPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Baixar backup editável' }).click()
  const backup = await backupPromise
  const backupPath = testInfo.outputPath('generated.zetta.json')
  await backup.saveAs(backupPath)
  const saved = JSON.parse(await fs.readFile(backupPath, 'utf8'))
  expect(saved.title).toBe('Estratégia editável Zetta')
  expect(saved.slides[0].title).toBe('Uma ideia que ganhou forma')
  expect(saved.themeId).toBe('executive')
  await page.screenshot({ path: testInfo.outputPath('editor.png') })
  expect(errors).toEqual([])
})

test('digital PDF import is local and scanned PDF receives an actionable error', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Criar apresentação', exact: true })).toBeVisible()
  const document = new jsPDF()
  document.text('Proposta comercial', 20, 20)
  document.text('Objetivo: organizar o processo de vendas e acompanhar resultados.', 20, 35)
  document.addPage()
  document.text('Etapas do projeto', 20, 20)
  document.text('Diagnostico, planejamento, implementacao e acompanhamento.', 20, 35)
  await page.locator('input[type=file][accept=".pdf,application/pdf"]').setInputFiles({
    name: 'proposta.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(document.output('arraybuffer')),
  })
  await expect(page.getByText('2 páginas · conteúdo pronto para organizar')).toBeVisible()
  await page.getByRole('button', { name: 'Criar apresentação', exact: true }).click()
  await expect(page.getByLabel('Título do tópico 1')).toBeVisible()
  await page.getByRole('button', { name: 'Criar minha apresentação' }).click()
  await page.getByRole('button', { name: 'Fonte original', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('Página 1')
  await expect(page.getByRole('dialog')).toContainText('Página 2')
  await expect(page.getByRole('dialog')).toContainText('organizar o processo de vendas')
  await page.getByRole('button', { name: 'Fechar', exact: true }).click()
  await page.getByRole('button', { name: 'Voltar às apresentações' }).click()
  const scanned = new jsPDF()
  scanned.setFillColor('#2563eb')
  scanned.rect(10, 10, 100, 100, 'F')
  await page.locator('input[type=file][accept=".pdf,application/pdf"]').setInputFiles({
    name: 'escaneado.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(scanned.output('arraybuffer')),
  })
  await expect(page.getByRole('alert')).toContainText(/OCR|texto/i)
  await expect(page.getByRole('button', { name: 'Criar apresentação', exact: true })).toBeDisabled()
})

test('empty chart saves as draft, numeric edits persist and backups reopen', async ({
  page,
}, testInfo) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Conhecer o editor' }).click()
  await page.getByRole('button', { name: 'Novo slide', exact: true }).click()
  await page.getByRole('button', { name: 'Adicionar', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Gráfico' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Salvo neste navegador' })).toBeVisible()
  await page
    .getByLabel('Dados do gráfico', { exact: true })
    .fill('Janeiro; 0\nFevereiro; -12,5\nMarço; 22,5')
  await page.getByRole('button', { name: 'Aplicar dados' }).click()
  await page.getByLabel('Dados do gráfico', { exact: true }).blur()
  await expect(page.getByRole('status').filter({ hasText: 'Salvo neste navegador' })).toBeVisible()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Baixar backup editável' }).click()
  const download = await downloadPromise
  const filename = testInfo.outputPath('chart.zetta.json')
  await download.saveAs(filename)
  const data = JSON.parse(await fs.readFile(filename, 'utf8'))
  const chart = data.slides
    .flatMap((s: { blocks: unknown[] }) => s.blocks)
    .find((b: { type: string }) => b.type === 'chart')
  expect(chart.chart.data.map((d: { value: number }) => d.value)).toEqual([0, -12.5, 22.5])
  await page.getByRole('button', { name: 'Voltar às apresentações' }).click()
  await page.locator('input[type=file][accept=".json,.zetta"]').setInputFiles(filename)
  await expect(page.getByRole('button', { name: 'Baixar PDF', exact: true })).toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: 'Salvo neste navegador' })).toBeVisible()
})

test('mobile creation remains usable without horizontal page overflow', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Criar apresentação', exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
  await page.screenshot({ path: testInfo.outputPath('mobile-home.png'), fullPage: true })
  await page.getByRole('button', { name: 'Experimentar com um texto' }).click()
  await page.getByRole('button', { name: 'Criar apresentação', exact: true }).click()
  await page.getByRole('button', { name: 'Criar minha apresentação' }).click()
  await expect(page.locator('.slide-canvas-frame')).toBeVisible()
  await expect(page.locator('.properties-panel')).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
  await page.screenshot({ path: testInfo.outputPath('mobile-editor.png') })
})
