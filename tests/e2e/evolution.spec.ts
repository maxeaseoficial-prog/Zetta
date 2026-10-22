import { expect, test, type Page, type TestInfo } from '@playwright/test'
import fs from 'node:fs/promises'
import legacy from '../fixtures/legacy-v02.zetta.json' with { type: 'json' }
import type { Deck } from '../../src/types'
import { validateDeck } from '../../src/lib/validation'

async function backup(page: Page, info: TestInfo, name: string) {
  const ready = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Baixar backup editável', exact: true }).click()
  const file = info.outputPath(name + '.zetta.json')
  await (await ready).saveAs(file)
  return { file, deck: JSON.parse(await fs.readFile(file, 'utf8')) as Deck }
}

async function openBrand(page: Page) {
  await page.getByRole('button', { name: 'Tema e cores', exact: true }).click()
  await page.getByRole('button', { name: 'Kit de marca', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Kit de marca', exact: true })).toBeVisible()
}

test('purpose-driven outline previews preserve manual drafts and composition preserves every character through undo', async ({
  page,
}, info) => {
  test.setTimeout(90_000)
  const material =
    'Material fictício para testar roteiros\n\nQuem somos\nSomos uma equipe de pesquisa e educação.\n\nConceitos\nUma métrica tem definição, unidade e período.\n\nResultados\nA receita fictícia foi de R$ 1.250,75 e a variação foi de -3,25%.\n\nExemplo\nCompare dois períodos com a mesma unidade.\n\nPróximos passos\nRevisar o material antes de apresentar.'
  await page.goto('/')
  await page.getByLabel('Conteúdo da apresentação').fill(material)
  await page.getByRole('button', { name: 'Criar apresentação', exact: true }).click()
  await page.getByLabel('Título do tópico 1', { exact: true }).fill('Rascunho manual preservado')
  await page.getByLabel('Objetivo da apresentação').selectOption('report')
  await page.getByLabel('Público da apresentação').selectOption('decision-makers')
  await page.getByLabel('Duração da apresentação em minutos').fill('6')
  await page.getByRole('button', { name: 'Ver roteiro sugerido', exact: true }).click()
  await expect(page.getByLabel('Prévia do novo roteiro')).toContainText('Resultados')
  await expect(page.getByLabel('Título do tópico 1', { exact: true })).toHaveValue(
    'Rascunho manual preservado',
  )
  await page.getByRole('button', { name: 'Aplicar este roteiro', exact: true }).click()
  await page.getByRole('button', { name: 'Criar minha apresentação', exact: true }).click()
  const generated = await backup(page, info, 'goal-generated')
  expect(generated.deck.settings.brief).toEqual({
    purpose: 'report',
    audience: 'decision-makers',
    durationMinutes: 6,
  })
  expect(generated.deck.source.text).toBe(material)
  const at = generated.deck.slides.findIndex((slide) => slide.origin?.kind === 'source')
  expect(at).toBeGreaterThan(0)
  const target = generated.deck.slides[at]
  const textBlock = target.blocks.find(
    (block) => block.type === 'text' || block.type === 'bullets',
  )!
  await page.getByRole('button', { name: new RegExp(`^Slide ${at + 1}:`) }).click()
  await page.getByRole('button', { name: 'Fonte original', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText(
    'Sem alteração de texto ou dados desde o registro',
  )
  await page.locator('.modal-heading').getByRole('button', { name: 'Fechar', exact: true }).click()
  const longText = Array.from(
    { length: 16 },
    (_, index) =>
      `Etapa ${index + 1}: preservar ação, números R$ 1.250,75 e a referência original.\n`,
  ).join('')
  await page.locator(`.slide-canvas-frame [data-block-id="${textBlock.id}"]`).click()
  await page.getByLabel('Texto do elemento', { exact: true }).fill(longText)
  await page.getByRole('button', { name: 'Fonte original', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText(
    'Texto ou dados editados desde o registro de origem',
  )
  await page.locator('.modal-heading').getByRole('button', { name: 'Fechar', exact: true }).click()
  const before = await backup(page, info, 'before-split')
  await page.getByRole('button', { name: 'Melhorar composição', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('Parte 1 de 2')
  await expect(page.getByRole('dialog')).toContainText('Parte 2 de 2')
  await page.getByRole('button', { name: 'Aplicar composição', exact: true }).click()
  const after = await backup(page, info, 'after-split')
  expect(after.deck.slides).toHaveLength(before.deck.slides.length + 1)
  const parts = after.deck.slides.slice(at, at + 2)
  expect(
    parts
      .flatMap((slide) => slide.blocks)
      .filter((block) => block.type === textBlock.type)
      .map((block) => block.content)
      .join(''),
  ).toBe(longText)
  for (const part of parts) {
    expect(part.notes).toBe(before.deck.slides[at].notes)
    expect(part.origin?.excerpt).toBe(before.deck.slides[at].origin?.excerpt)
    expect(part.sourcePages).toEqual(before.deck.slides[at].sourcePages)
  }
  await page.getByRole('button', { name: 'Desfazer', exact: true }).click()
  const undone = await backup(page, info, 'split-undone')
  expect(undone.deck.slides).toEqual(before.deck.slides)
  await page.getByRole('button', { name: 'Refazer', exact: true }).click()
  const redone = await backup(page, info, 'split-redone')
  expect(redone.deck.slides).toEqual(after.deck.slides)
  await page.screenshot({ path: info.outputPath('composition-result.png') })
})

test('v0.2 document → brand in two decks → nondestructive crop → reuse → delete profile → portable backup', async ({
  page,
}, info) => {
  test.setTimeout(120_000)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  // Seed a real version-1 database before the application gets a connection.
  await page.route('**/__seed', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<html><body>Test fixture</body></html>' }),
  )
  await page.goto('/__seed')
  await page.evaluate(
    (deck) =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('zetta-local', 1)
        request.onupgradeneeded = () => {
          const store = request.result.createObjectStore('decks', { keyPath: 'id' })
          store.createIndex('updatedAt', 'updatedAt')
        }
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const db = request.result
          const transaction = db.transaction('decks', 'readwrite')
          transaction.objectStore('decks').put(deck)
          transaction.oncomplete = () => {
            db.close()
            resolve()
          }
          transaction.onerror = () => reject(transaction.error)
        }
      }),
    legacy,
  )
  await page.goto('/')
  await page.getByRole('button', { name: 'Abrir ' + legacy.title, exact: true }).click()
  const old = await backup(page, info, 'legacy-opened')
  expect(old.deck).toEqual(legacy)
  const database = await page.evaluate(
    () =>
      new Promise<{ version: number; stores: string[] }>((resolve) => {
        const request = indexedDB.open('zetta-local')
        request.onsuccess = () => {
          const db = request.result
          resolve({ version: db.version, stores: Array.from(db.objectStoreNames) })
          db.close()
        }
      }),
  )
  expect(database).toEqual({ version: 2, stores: ['brandProfiles', 'decks', 'reusableSlides'] })
  await openBrand(page)
  await page.getByLabel('Nome do perfil de marca').fill('Azul de teste')
  await page.getByLabel('Rodapé da marca').fill('Zetta · Dados fictícios')
  const sourceImage = validateDeck(legacy).slides[0].blocks.find((block) => block.type === 'image')!
    .image!.src!
  await page.getByLabel('Arquivo do logo').setInputFiles({
    name: 'logo.png',
    mimeType: 'image/png',
    buffer: Buffer.from(sourceImage.split(',')[1], 'base64'),
  })
  await page.getByRole('button', { name: 'Salvar perfil', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Perfil salvo' })).toBeVisible()
  await page.getByRole('button', { name: 'Aplicar marca', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.locator('.slide-canvas-frame')).toContainText('Zetta · Dados fictícios')
  await page.getByRole('button', { name: 'Desfazer', exact: true }).click()
  await expect(page.locator('.slide-canvas-frame')).not.toContainText('Zetta · Dados fictícios')
  await page.getByRole('button', { name: 'Refazer', exact: true }).click()
  await page
    .locator('.slide-canvas-frame')
    .getByRole('button', { name: 'Selecionar imagem 2', exact: true })
    .click()
  await page.getByRole('button', { name: 'Recortar e posicionar', exact: true }).click()
  // Exercise the native sliders with keyboard input, including non-integer zoom.
  await page.getByLabel('Zoom do recorte').focus()
  await page.keyboard.press('Home')
  for (let step = 0; step < 16; step++) await page.keyboard.press('ArrowRight')
  await page.getByLabel('Posição horizontal do recorte').focus()
  await page.keyboard.press('End')
  for (let step = 0; step < 25; step++) await page.keyboard.press('ArrowLeft')
  await page.getByLabel('Posição vertical do recorte').focus()
  await page.keyboard.press('Home')
  for (let step = 0; step < 20; step++) await page.keyboard.press('ArrowRight')
  await page.getByRole('button', { name: 'Aplicar recorte', exact: true }).click()
  await page.getByRole('button', { name: 'Biblioteca de slides', exact: true }).click()
  await page.getByLabel('Nome do slide na biblioteca').fill('Capa aprovada de teste')
  await page.getByRole('button', { name: 'Salvar na biblioteca', exact: true }).click()
  await expect(
    page.getByRole('status').filter({ hasText: 'Slide salvo com conteúdo' }),
  ).toBeVisible()
  await page.locator('.modal-heading').getByRole('button', { name: 'Fechar', exact: true }).click()
  const first = await backup(page, info, 'legacy-evolved')
  const original = first.deck.slides[0]
  expect(original.blocks[1].image?.src).toBe(sourceImage)
  expect(original.blocks[1].image?.crop).toEqual({ x: 75, y: 20, zoom: 1.8 })
  expect(first.deck.source).toEqual(legacy.source)
  expect(first.deck.slides.slice(1)).toEqual(legacy.slides.slice(1))
  await page.getByRole('button', { name: 'Voltar às apresentações', exact: true }).click()
  await page.getByRole('button', { name: 'Experimentar gráficos', exact: true }).click()
  await openBrand(page)
  await page.getByRole('button', { name: 'Azul de teste', exact: true }).click()
  await page.getByRole('button', { name: 'Aplicar marca', exact: true }).click()
  await page.getByRole('button', { name: 'Biblioteca de slides', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Inserir slide', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Inserir slide', exact: true }).click()
  const second = await backup(page, info, 'reused-deck')
  const reused = second.deck.slides[1]
  expect(second.deck.brand).toEqual(first.deck.brand)
  expect(reused.title).toBe(original.title)
  expect(reused.id).not.toBe(original.id)
  expect(reused.blocks[1].image).toEqual(original.blocks[1].image)
  expect(reused.notes).toBe(original.notes)
  expect(reused.sourcePages).toEqual([])
  expect(reused.origin?.kind).toBe('reused')
  expect(reused.appearance?.brand).toEqual(first.deck.brand)
  await openBrand(page)
  await page.getByRole('button', { name: 'Excluir perfil Azul de teste', exact: true }).click()
  await page.getByRole('button', { name: 'Excluir perfil', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Perfil removido' })).toBeVisible()
  await page.locator('.modal-heading').getByRole('button', { name: 'Fechar', exact: true }).click()
  await page.getByRole('button', { name: 'Voltar às apresentações', exact: true }).click()
  await page.reload()
  await page.locator('input[type=file][accept=".json,.zetta"]').setInputFiles(second.file)
  await page.getByRole('button', { name: /^Slide 2:/ }).click()
  await expect(page.locator('.slide-canvas-frame')).toContainText('Zetta · Dados fictícios')
  const reopened = await backup(page, info, 'reimported-independent')
  expect(reopened.deck.brand).toEqual(second.deck.brand)
  expect(reopened.deck.slides).toEqual(second.deck.slides)
  await page.getByRole('button', { name: 'Apresentar', exact: true }).click()
  await expect(page.locator('.presenter-slide')).toContainText('Zetta · Dados fictícios')
  await page.screenshot({ path: info.outputPath('brand-crop-player.png') })
  await page.getByRole('button', { name: 'Voltar ao editor', exact: true }).click()
  expect(errors).toEqual([])
})

test('CSV column preview applies exact selected data and all four diagrams survive editing and backup', async ({
  page,
}, info) => {
  test.setTimeout(120_000)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await page.getByRole('button', { name: 'Experimentar gráficos', exact: true }).click()
  await page.getByRole('button', { name: /^Slide 2:/ }).click()
  await page
    .locator('.slide-canvas-frame')
    .getByRole('button', { name: 'Selecionar gráfico 1', exact: true })
    .click()
  await page
    .getByLabel('Dados do gráfico', { exact: true })
    .fill('Faturamento;Canal;Despesa;Observação\n1.250,75;Azul;0;Conferido\n0;Verde;-12,5;Pendente')
  await page.getByRole('button', { name: 'Prévia e colunas', exact: true }).click()
  await page.getByRole('radio', { name: 'A primeira linha é cabeçalho', exact: true }).check()
  await page.getByLabel('Coluna das categorias').selectOption('1')
  await page.getByLabel('Usar valores de Faturamento', { exact: true }).check()
  await page.getByLabel('Usar valores de Despesa', { exact: true }).check()
  await expect(page.getByRole('table', { name: 'Prévia dos dados mapeados' })).toContainText(
    '1.250,75',
  )
  await expect(page.getByRole('dialog')).toContainText(
    'Colunas que ficarão de fora por esta seleção: Observação.',
  )
  await page.getByRole('button', { name: 'Aplicar dados mapeados', exact: true }).click()
  const mapped = await backup(page, info, 'mapped-chart')
  expect(mapped.deck.slides[1].blocks[0].chart?.data).toEqual([
    { label: 'Azul', value: 1250.75 },
    { label: 'Verde', value: 0 },
  ])
  expect(mapped.deck.slides[1].blocks[0].chart?.additionalSeries).toEqual([
    { name: 'Despesa', values: [0, -12.5] },
  ])
  for (const [index, label] of [
    'Processo',
    'Linha do tempo',
    'Comparação',
    'Indicadores',
  ].entries()) {
    await page.getByRole('button', { name: 'Novo slide', exact: true }).click()
    await page.getByRole('button', { name: 'Adicionar', exact: true }).click()
    await page.getByRole('menuitem', { name: label, exact: true }).click()
    await page.getByLabel('Título do item 1', { exact: true }).fill('Ação e organização')
    await page
      .getByLabel('Descrição do item 1', { exact: true })
      .fill('Dados fictícios. Revisão em português.')
    await page.getByLabel('Rótulo do item 1', { exact: true }).fill('22/10/2026')
    await page
      .getByLabel('Valor do item 1', { exact: true })
      .fill(index === 3 ? 'R$ 1.250,75' : '18,5%')
    await expect(page.locator('.slide-canvas-frame [data-diagram-type]')).toBeVisible()
    await expect(page.locator('.slide-warning')).toHaveCount(0)
  }
  const all = await backup(page, info, 'four-diagrams')
  const diagrams = all.deck.slides.flatMap((slide) =>
    slide.blocks.flatMap((block) => (block.diagram ? [block.diagram] : [])),
  )
  expect(diagrams.map((item) => item.type)).toEqual([
    'process',
    'timeline',
    'comparison',
    'metrics',
  ])
  for (const diagram of diagrams) expect(diagram.items[0].title).toBe('Ação e organização')
  await page.getByRole('button', { name: 'Voltar às apresentações', exact: true }).click()
  await page.reload()
  await page.locator('input[type=file][accept=".json,.zetta"]').setInputFiles(all.file)
  const reopened = await backup(page, info, 'four-diagrams-reimported')
  expect(reopened.deck.slides).toEqual(all.deck.slides)
  await page.getByRole('button', { name: /^Slide 6:/ }).click()
  await page.getByRole('button', { name: 'Apresentar', exact: true }).click()
  await expect(page.locator('.presenter-slide [data-diagram-type]')).toBeVisible()
  await page.screenshot({ path: info.outputPath('diagram-player.png') })
  await page.getByRole('button', { name: 'Voltar ao editor', exact: true }).click()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Baixar PDF', exact: true }).click()
  await page.getByRole('button', { name: 'Exportar PDF pesquisável', exact: true }).click()
  const pdf = info.outputPath('diagrams-and-charts.pdf')
  await (await download).saveAs(pdf)
  await page.getByRole('button', { name: 'Voltar às apresentações', exact: true }).click()
  await page.locator('input[type=file][accept=".pdf,application/pdf"]').setInputFiles(pdf)
  await expect(page.getByText('11 páginas · conteúdo pronto para organizar')).toBeVisible()
  await page.getByRole('button', { name: 'Criar apresentação', exact: true }).click()
  await page.getByRole('button', { name: 'Criar minha apresentação', exact: true }).click()
  const roundtrip = await backup(page, info, 'pdf-extracted-text')
  expect(roundtrip.deck.source.text).toContain('Ação e organização')
  expect(roundtrip.deck.source.text).toContain('1.250,75')
  expect(roundtrip.deck.source.text).toContain('18,5%')
  expect(errors).toEqual([])
})

test('mobile dialogs scroll to their actions, trap keyboard focus and preserve the viewport', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.locator('input[type=file][accept=".json,.zetta"]').setInputFiles({
    name: 'legacy.zetta.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(legacy)),
  })
  await openBrand(page)
  await page.getByLabel('Nome do perfil de marca').fill('Azul no celular')
  await page.getByRole('button', { name: 'Salvar perfil', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Perfil salvo' })).toBeVisible()
  const apply = page.getByRole('button', { name: 'Aplicar marca', exact: true })
  await apply.focus()
  await expect(apply).toBeInViewport()
  expect(
    await page.locator('.modal-body').evaluate((element) => element.scrollTop),
  ).toBeGreaterThan(0)
  await page.keyboard.press('Tab')
  await expect(
    page.locator('.modal-heading').getByRole('button', { name: 'Fechar', exact: true }),
  ).toBeFocused()
  await apply.click()
  await page.getByRole('button', { name: 'Biblioteca de slides', exact: true }).click()
  await page.getByLabel('Nome do slide na biblioteca').fill('Capa móvel')
  await page.getByRole('button', { name: 'Salvar na biblioteca', exact: true }).click()
  await expect(
    page.getByRole('status').filter({ hasText: 'Slide salvo com conteúdo' }),
  ).toBeVisible()
  const insert = page.getByRole('button', { name: 'Inserir slide', exact: true })
  await insert.focus()
  await expect(insert).toBeInViewport()
  const bounds = await page.getByRole('dialog').boundingBox()
  expect(bounds!.x).toBeGreaterThanOrEqual(0)
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390)
  expect(
    await page
      .locator('.modal-body')
      .evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
  ).toBe(true)
  await page.screenshot({ path: info.outputPath('mobile-library.png') })
  await insert.click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.locator('.slides-scroll .slide-thumbnail')).toHaveCount(8)
  await page.getByRole('button', { name: 'Biblioteca de slides', exact: true }).click()
  await page.keyboard.press('Escape')
  await expect(
    page.getByRole('button', { name: 'Biblioteca de slides', exact: true }),
  ).toBeFocused()
  await page.getByRole('button', { name: 'Baixar PDF', exact: true }).click()
  const imagePdf = page.getByRole('button', { name: 'Exportar PDF como imagem', exact: true })
  await imagePdf.focus()
  await expect(imagePdf).toBeInViewport()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
})
