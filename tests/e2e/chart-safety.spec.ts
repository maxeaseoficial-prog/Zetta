import { expect, test, type Page, type TestInfo } from '@playwright/test'
import fs from 'node:fs/promises'
import type { Deck } from '../../src/types'

async function openChart(page: Page) {
  await page.getByRole('button', { name: /^Slide 2:/ }).click()
  await page
    .locator('.slide-canvas-frame')
    .getByRole('button', { name: 'Selecionar gráfico 1', exact: true })
    .click()
}

async function openLab(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Experimentar gráficos', exact: true }).click()
  await openChart(page)
}

async function backup(page: Page, info: TestInfo, name: string): Promise<Deck> {
  const ready = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Baixar backup editável', exact: true }).click()
  const file = info.outputPath(`${name}.zetta.json`)
  await (await ready).saveAs(file)
  return JSON.parse(await fs.readFile(file, 'utf8')) as Deck
}

test('column mapping requires an explicit header choice and keeps the first data row', async ({
  page,
}, info) => {
  await openLab(page)
  const text = 'Norte;10\nSul;20'
  await page.getByLabel('Dados do gráfico', { exact: true }).fill(text)
  await page.getByRole('button', { name: 'Prévia e colunas', exact: true }).click()
  await expect(
    page.getByRole('radio', { name: 'A primeira linha é cabeçalho', exact: true }),
  ).not.toBeChecked()
  await expect(
    page.getByRole('radio', { name: 'A primeira linha contém dados', exact: true }),
  ).not.toBeChecked()
  await expect(
    page.getByRole('button', { name: 'Aplicar dados mapeados', exact: true }),
  ).toBeDisabled()
  await expect(page.getByLabel('Conteúdo original da tabela', { exact: true })).toHaveText(text)
  await page.getByRole('radio', { name: 'A primeira linha contém dados', exact: true }).check()
  const preview = page.getByRole('table', { name: 'Prévia dos dados mapeados', exact: true })
  await expect(preview.locator('tbody tr')).toHaveCount(2)
  await expect(preview).toContainText('Norte')
  await expect(preview).toContainText('10')
  await page.getByRole('button', { name: 'Aplicar dados mapeados', exact: true }).click()
  const saved = await backup(page, info, 'headerless-mapped')
  expect(saved.slides[1].blocks[0].chart?.data).toEqual([
    { label: 'Norte', value: 10 },
    { label: 'Sul', value: 20 },
  ])
  expect(saved.slides[1].blocks[0].chart?.seriesName).toBe('Coluna 2')
})

test('thirteen data rows cannot become twelve through an implicit header and never replace applied data', async ({
  page,
}, info) => {
  await openLab(page)
  const before = await backup(page, info, 'before-oversized-mapping')
  const text = Array.from({ length: 13 }, (_, index) => `Categoria ${index + 1};${index}`).join(
    '\n',
  )
  await page.getByLabel('Dados do gráfico', { exact: true }).fill(text)
  await page.getByRole('button', { name: 'Prévia e colunas', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Aplicar dados mapeados', exact: true }),
  ).toBeDisabled()
  await page.getByRole('radio', { name: 'A primeira linha contém dados', exact: true }).check()
  await expect(page.getByRole('alert')).toContainText('Use entre 1 e 12 linhas de dados')
  await expect(
    page.getByRole('button', { name: 'Aplicar dados mapeados', exact: true }),
  ).toBeDisabled()
  await expect(page.getByLabel('Conteúdo original da tabela', { exact: true })).toHaveText(text)
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click()
  await expect(page.getByLabel('Dados do gráfico', { exact: true })).toHaveValue(text)
  const after = await backup(page, info, 'after-rejected-mapping')
  expect(after.slides[1].blocks[0].chart).toEqual(before.slides[1].blocks[0].chart)
})

test('undo restores unapplied chart drafts after block and slide deletion; deleted drafts do not block leaving', async ({
  page,
}) => {
  await openLab(page)
  const csv = 'Month,Revenue,Cost\nJanuary,0,8.25\nFebruary,-12.5,0'
  await page.getByLabel('Formato dos números', { exact: true }).selectOption('en-US')
  await page
    .getByLabel('Arquivo de dados CSV', { exact: true })
    .setInputFiles({ name: 'rascunho.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) })
  await expect(page.getByLabel('Dados do gráfico', { exact: true })).toHaveValue(csv)

  await page.getByRole('button', { name: 'Remover elemento', exact: true }).click()
  await page.getByRole('button', { name: 'Desfazer', exact: true }).click()
  await openChart(page)
  await expect(page.getByLabel('Dados do gráfico', { exact: true })).toHaveValue(csv)
  await expect(page.getByLabel('Formato dos números', { exact: true })).toHaveValue('en-US')

  await page.getByRole('button', { name: /^Slide 2:/ }).click()
  await page.getByRole('button', { name: 'Excluir slide', exact: true }).click()
  await page.getByRole('button', { name: 'Desfazer', exact: true }).click()
  await openChart(page)
  await expect(page.getByLabel('Dados do gráfico', { exact: true })).toHaveValue(csv)
  await expect(page.getByLabel('Formato dos números', { exact: true })).toHaveValue('en-US')

  await page.getByRole('button', { name: 'Voltar às apresentações', exact: true }).click()
  await expect(
    page.getByRole('dialog', { name: 'Há dados de gráfico ainda não aplicados', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Revisar dados', exact: true }).click()
  await expect(page.getByLabel('Dados do gráfico', { exact: true })).toHaveValue(csv)
  await page.getByRole('button', { name: 'Remover elemento', exact: true }).click()
  await page.getByRole('button', { name: 'Voltar às apresentações', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Experimentar gráficos', exact: true }),
  ).toBeVisible()
})
