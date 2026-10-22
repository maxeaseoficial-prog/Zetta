import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { jsPDF } from 'jspdf'
import type { BrandFontId, BrandKit, Deck, Slide } from '../types'
import { getTheme } from './themes'
import { resolveAppearance } from './brand'
import { loadChartRenderer } from './chartRuntime'
import {
  ensureBrandFonts,
  fontFamilyFor,
  fontFileFor,
  fontIdForFamily,
  loadFontBytes,
} from './fonts'
import {
  getSlideWarnings,
  registerImageDimensions,
  SlideCanvas,
  SLIDE_HEIGHT,
  SLIDE_WIDTH,
} from '../components/SlideCanvas'

export type PdfProgressCallback = (progress: number) => void
export type PdfExportMode = 'searchable' | 'image'
export interface PdfExportReport {
  mode: PdfExportMode
  pageCount: number
  rasterizedElements: { slide: number; reason: string }[]
  warnings: string[]
}
export interface PdfExportOptions {
  mode?: PdfExportMode
}

/** Pure planning keeps native legacy fonts in the editor and makes substitutions explicit. */
export function getPdfFontPlan(
  deck: Deck,
  mode: PdfExportMode,
): { families: BrandFontId[]; warnings: string[] } {
  const families = new Set<BrandFontId>()
  const sans: number[] = [],
    serif: number[] = []
  for (const [index, slide] of deck.slides.entries()) {
    const appearance = resolveAppearance(slide, getTheme(deck.themeId), deck.accent, deck.brand)
    if (appearance.brand) families.add(appearance.brand.font)
    else if (mode === 'searchable') {
      families.add('sans')
      sans.push(index + 1)
      if (appearance.theme.fontFamily.includes('Georgia')) {
        families.add('serif')
        serif.push(index + 1)
      }
    }
  }
  const warnings: string[] = []
  if (sans.length)
    warnings.push(`Neste PDF, Arial usa Liberation Sans (slides ${sans.join(', ')}).`)
  if (serif.length) warnings.push(`Georgia usa Liberation Serif (slides ${serif.join(', ')}).`)
  return { families: [...families], warnings }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    const timer = window.setTimeout(
      () =>
        reject(
          new Error('Uma imagem demorou para carregar. Substitua o arquivo e tente novamente.'),
        ),
      20000,
    )
    image.onload = () => {
      window.clearTimeout(timer)
      if (!image.naturalWidth || !image.naturalHeight)
        reject(
          new Error('Uma imagem não tem dimensões válidas. Substitua o arquivo antes de exportar.'),
        )
      else resolve(image)
    }
    image.onerror = () => {
      window.clearTimeout(timer)
      reject(
        new Error(
          'Não foi possível carregar uma imagem da apresentação. Substitua o arquivo e tente novamente.',
        ),
      )
    }
    image.src = src
  })
}

async function prepareImageSource(
  source: string,
  cache: Map<string, Promise<string>>,
): Promise<string> {
  if (!source.startsWith('data:image/') && !source.startsWith('blob:'))
    throw new Error(
      'Esta apresentação contém uma imagem externa. Envie o arquivo da imagem no editor para incorporá-la ao PDF.',
    )
  let task = cache.get(source)
  if (!task) {
    task = (async () => {
      const decoded = await loadImage(source)
      registerImageDimensions(source, decoded.naturalWidth, decoded.naturalHeight)
      if (source.startsWith('data:image/png') || source.startsWith('data:image/jpeg')) return source
      // Uploaded photos remain images. Normalize other formats to a static PNG.
      const canvas = document.createElement('canvas')
      const scale = Math.min(1, 4096 / Math.max(decoded.naturalWidth, decoded.naturalHeight))
      canvas.width = Math.max(1, Math.round(decoded.naturalWidth * scale))
      canvas.height = Math.max(1, Math.round(decoded.naturalHeight * scale))
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Seu navegador não conseguiu preparar as imagens do PDF.')
      context.drawImage(decoded, 0, 0, canvas.width, canvas.height)
      const embedded = canvas.toDataURL('image/png')
      registerImageDimensions(embedded, canvas.width, canvas.height)
      canvas.width = canvas.height = 1
      return embedded
    })()
    cache.set(source, task)
  }
  return task
}

async function prepareBrand(
  brand: BrandKit | undefined,
  cache: Map<string, Promise<string>>,
): Promise<BrandKit | undefined> {
  return brand?.logo
    ? { ...brand, logo: { ...brand.logo, src: await prepareImageSource(brand.logo.src, cache) } }
    : brand
}

async function prepareImages(slide: Slide, cache: Map<string, Promise<string>>): Promise<Slide> {
  const blocks = await Promise.all(
    slide.blocks.map(async (block) =>
      block.type === 'image' && block.image?.src
        ? {
            ...block,
            image: { ...block.image, src: await prepareImageSource(block.image.src, cache) },
          }
        : block,
    ),
  )
  return {
    ...slide,
    blocks,
    ...(slide.appearance
      ? {
          appearance: {
            ...slide.appearance,
            ...(slide.appearance.brand
              ? { brand: await prepareBrand(slide.appearance.brand, cache) }
              : {}),
          },
        }
      : {}),
  }
}

function binaryString(bytes: Uint8Array): string {
  const parts: string[] = []
  for (let offset = 0; offset < bytes.length; offset += 8192)
    parts.push(String.fromCharCode(...bytes.subarray(offset, offset + 8192)))
  return parts.join('')
}

async function registerFonts(pdf: jsPDF, families: BrandFontId[]): Promise<void> {
  for (const id of families)
    for (const weight of [400, 700] as const) {
      const file = fontFileFor(id, weight)
      pdf.addFileToVFS(file, binaryString(await loadFontBytes(id, weight)))
      pdf.addFont(file, fontFamilyFor(id), weight === 700 ? 'bold' : 'normal')
    }
}

const embeddedFontCss = new Map<BrandFontId, Promise<string>>()
async function fontCss(families: BrandFontId[]): Promise<string> {
  return (
    await Promise.all(
      families.map((id) => {
        let task = embeddedFontCss.get(id)
        if (!task) {
          task = Promise.all(
            ([400, 700] as const).map(async (weight) => {
              const base64 = btoa(binaryString(await loadFontBytes(id, weight)))
              return `@font-face{font-family:'${fontFamilyFor(id)}';font-style:normal;font-weight:${weight};src:url(data:font/ttf;base64,${base64}) format('truetype');}`
            }),
          )
            .then((parts) => parts.join('\n'))
            .catch((error) => {
              embeddedFontCss.delete(id)
              throw error
            })
          embeddedFontCss.set(id, task)
        }
        return task
      }),
    )
  ).join('\n')
}

function svgForSlide(
  slide: Slide,
  deck: Deck,
  index: number,
  portableFonts: boolean,
): SVGSVGElement {
  const markup = renderToStaticMarkup(
    createElement(SlideCanvas, {
      slide,
      theme: getTheme(deck.themeId),
      accent: deck.accent,
      brand: deck.brand,
      portableFonts,
      slideNumber: index + 1,
      totalSlides: deck.slides.length,
      animateCharts: false,
    }),
  )
  const parsed = new DOMParser().parseFromString(markup, 'image/svg+xml')
  if (parsed.querySelector('parsererror'))
    throw new Error(`Não foi possível preparar o SVG do slide ${index + 1}.`)
  const svg = document.importNode(parsed.documentElement, true) as unknown as SVGSVGElement
  if (
    svg.getAttribute('data-font-state') !== 'ready' ||
    svg.querySelector('[data-chart-state="loading"], [data-chart-state="error"]')
  )
    throw new Error(
      `Os recursos do slide ${index + 1} ainda não estão prontos. Tente novamente antes de exportar.`,
    )
  // Explicit dimensions prevent application CSS from changing the export viewport.
  svg.setAttribute('width', String(SLIDE_WIDTH))
  svg.setAttribute('height', String(SLIDE_HEIGHT))
  svg.style.width = `${SLIDE_WIDTH}px`
  svg.style.height = `${SLIDE_HEIGHT}px`
  return svg
}

/** Fail instead of silently dropping unsupported glyphs or non-vector elements. */
function assertVectorContent(svg: SVGSVGElement, pdf: jsPDF, slideNumber: number): void {
  const unsupported = svg.querySelector('foreignObject,filter,mask,video,canvas,script')
  if (unsupported)
    throw new Error(
      `O slide ${slideNumber} contém um recurso sem conversão vetorial (${unsupported.localName}). Escolha PDF como imagem para manter sua aparência.`,
    )
  for (const image of svg.querySelectorAll('image')) {
    const href =
      image.getAttribute('href') ||
      image.getAttributeNS('http://www.w3.org/1999/xlink', 'href') ||
      ''
    if (!/^data:image\/(png|jpeg);base64,/.test(href))
      throw new Error(
        `Uma imagem do slide ${slideNumber} não foi incorporada corretamente. Escolha PDF como imagem ou substitua o arquivo.`,
      )
  }
  for (const text of svg.querySelectorAll('text')) {
    const style = getComputedStyle(text)
    const id = fontIdForFamily(style.fontFamily)
    if (!id)
      throw new Error(
        `Uma fonte do slide ${slideNumber} não tem incorporação disponível. Escolha PDF como imagem para preservar a aparência.`,
      )
    const weight =
      Number.parseInt(style.fontWeight, 10) >= 600 || style.fontWeight === 'bold'
        ? 'bold'
        : 'normal'
    pdf.setFont(fontFamilyFor(id), weight)
    const metadata = pdf.getFont().metadata as { characterToGlyph?: (character: number) => number }
    if (typeof metadata.characterToGlyph !== 'function')
      throw new Error(`Não foi possível incorporar a fonte ${fontFamilyFor(id)}. Tente novamente.`)
    for (const character of text.textContent ?? '') {
      if (/\s/.test(character)) continue
      const code = character.codePointAt(0)!
      if (!metadata.characterToGlyph(code))
        throw new Error(
          `A fonte incorporada não contém o caractere “${character}” do slide ${slideNumber}. Escolha PDF como imagem para preservá-lo.`,
        )
    }
  }
}

/** svg2pdf omits dominant-baseline and letter-spacing; preserve their measured geometry. */
function normalizeSvgText(svg: SVGSVGElement): void {
  for (const text of svg.querySelectorAll('text')) {
    const style = getComputedStyle(text)
    const spacing = Number.parseFloat(style.letterSpacing)
    if (Number.isFinite(spacing) && spacing !== 0 && (text.textContent?.length ?? 0) > 1) {
      const length = text.getComputedTextLength()
      text.style.letterSpacing = '0'
      text.removeAttribute('letter-spacing')
      text.setAttribute('textLength', String(length))
      text.setAttribute('lengthAdjust', 'spacing')
    }
    const baseline = style.dominantBaseline
    if (baseline && baseline !== 'auto' && baseline !== 'alphabetic') {
      const before = text.getBBox().y
      text.style.dominantBaseline = 'alphabetic'
      text.style.alignmentBaseline = 'baseline'
      text.setAttribute('dominant-baseline', 'alphabetic')
      text.setAttribute('alignment-baseline', 'baseline')
      const adjustment = before - text.getBBox().y
      const previous = Number.parseFloat(text.getAttribute('dy') ?? '0') || 0
      if (Math.abs(adjustment) > 0.001) text.setAttribute('dy', String(previous + adjustment))
    }
  }
}

async function rasterize(svg: SVGSVGElement, families: BrandFontId[]): Promise<string> {
  if (families.length) {
    const style = document.createElementNS('http://www.w3.org/2000/svg', 'style')
    style.textContent = await fontCss(families)
    svg.insertBefore(style, svg.firstChild)
  }
  const markup = new XMLSerializer().serializeToString(svg)
  const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml;charset=utf-8' }))
  try {
    const image = await loadImage(url)
    const canvas = document.createElement('canvas')
    canvas.width = SLIDE_WIDTH * 2
    canvas.height = SLIDE_HEIGHT * 2
    const context = canvas.getContext('2d', { alpha: false })
    if (!context) throw new Error('Seu navegador não conseguiu gerar as páginas do PDF.')
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const png = canvas.toDataURL('image/png')
    canvas.width = canvas.height = 1
    return png
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Variable stop opacity and dashed ellipse phase are not faithfully converted by svg2pdf. */
async function preserveDecorativeArtwork(svg: SVGSVGElement): Promise<number> {
  const illustrations = Array.from(
    svg.querySelectorAll<SVGSVGElement>('svg[data-procedural-artwork="true"]'),
  )
  for (const illustration of illustrations) {
    const standalone = illustration.cloneNode(true) as SVGSVGElement
    const width = Number(illustration.getAttribute('width'))
    const height = Number(illustration.getAttribute('height'))
    standalone.removeAttribute('x')
    standalone.removeAttribute('y')
    standalone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    const url = URL.createObjectURL(
      new Blob([new XMLSerializer().serializeToString(standalone)], {
        type: 'image/svg+xml;charset=utf-8',
      }),
    )
    try {
      const source = await loadImage(url)
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.ceil(width * 2))
      canvas.height = Math.max(1, Math.ceil(height * 2))
      const context = canvas.getContext('2d')
      if (!context)
        throw new Error(
          'Seu navegador não conseguiu preservar uma ilustração. Escolha PDF como imagem.',
        )
      context.drawImage(source, 0, 0, canvas.width, canvas.height)
      const image = document.createElementNS('http://www.w3.org/2000/svg', 'image')
      for (const attribute of ['x', 'y', 'width', 'height'])
        image.setAttribute(attribute, illustration.getAttribute(attribute) ?? '0')
      image.setAttribute('href', canvas.toDataURL('image/png'))
      image.setAttribute('preserveAspectRatio', 'none')
      image.setAttribute('data-pdf-fallback', 'decorative-artwork')
      illustration.replaceWith(image)
      canvas.width = canvas.height = 1
    } finally {
      URL.revokeObjectURL(url)
    }
  }
  return illustrations.length
}

function fileName(title: string): string {
  const clean = title
    .normalize('NFKC')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 100)
  return `${clean || 'Apresentacao-Zetta'}.pdf`
}

/** Builds the complete document before download; no partial or silent raster fallback. */
export async function createPdfBlob(
  deck: Deck,
  onProgress?: PdfProgressCallback,
  options: PdfExportOptions = {},
): Promise<{ blob: Blob; report: PdfExportReport }> {
  const mode = options.mode ?? 'searchable'
  if (mode !== 'searchable' && mode !== 'image')
    throw new Error('Escolha PDF pesquisável ou PDF como imagem.')
  if (!deck.slides.length) throw new Error('Adicione pelo menos um slide antes de baixar o PDF.')
  if (typeof document === 'undefined')
    throw new Error('Abra a apresentação no navegador para baixar o PDF.')
  onProgress?.(0)
  const fontPlan = getPdfFontPlan(deck, mode)
  await Promise.all(fontPlan.families.map(ensureBrandFonts))
  if (deck.slides.some((slide) => slide.blocks.some((block) => block.type === 'chart'))) {
    try {
      await loadChartRenderer()
    } catch {
      throw new Error(
        'Não foi possível carregar o gerador de gráficos. Tente novamente antes de exportar; nenhum PDF foi criado.',
      )
    }
  }
  await document.fonts.ready
  const warnings = deck.slides.flatMap((slide, index) =>
    getSlideWarnings(slide, getTheme(deck.themeId), deck.brand, mode === 'searchable').map(
      (warning) => `Slide ${index + 1}: ${warning}`,
    ),
  )
  if (warnings.length)
    throw new Error(`Revise o conteúdo antes de baixar o PDF:\n${warnings.join('\n')}`)
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: [960, 540],
    compress: true,
    putOnlyUsedFonts: true,
  })
  pdf.setProperties({
    title: deck.title,
    subject: 'Apresentação criada no Zetta',
    creator: 'Zetta',
  })
  const converter = mode === 'searchable' ? await import('svg2pdf.js') : null
  if (converter) await registerFonts(pdf, fontPlan.families)
  const report: PdfExportReport = {
    mode,
    pageCount: deck.slides.length,
    rasterizedElements: [],
    warnings: [...fontPlan.warnings],
  }
  const imageCache = new Map<string, Promise<string>>()
  const preparedDeck = { ...deck, brand: await prepareBrand(deck.brand, imageCache) }
  const host = document.createElement('div')
  // Attached text is measurable without being visible or participating in the UI.
  host.style.cssText =
    'position:fixed;left:-20000px;top:0;width:1280px;height:720px;pointer-events:none;contain:layout style paint;'
  host.setAttribute('aria-hidden', 'true')
  document.body.appendChild(host)
  try {
    for (let index = 0; index < deck.slides.length; index++) {
      const slide = await prepareImages(deck.slides[index], imageCache)
      const svg = svgForSlide(slide, preparedDeck, index, mode === 'searchable')
      host.replaceChildren(svg)
      if (index) pdf.addPage([960, 540], 'landscape')
      if (converter) {
        const decorativeImages = await preserveDecorativeArtwork(svg)
        assertVectorContent(svg, pdf, index + 1)
        normalizeSvgText(svg)
        await converter.svg2pdf(svg, pdf, {
          x: 0,
          y: 0,
          width: 960,
          height: 540,
          loadExternalStyleSheets: false,
          loadImages: /^data:image\//,
        })
        if (decorativeImages) {
          report.rasterizedElements.push({
            slide: index + 1,
            reason: `${decorativeImages} ilustração(ões) decorativa(s) preservada(s) como imagem para manter gradientes e traços.`,
          })
          report.warnings.push(
            `Slide ${index + 1}: a ilustração decorativa foi preservada como imagem; textos, gráficos e diagramas continuam vetoriais.`,
          )
        }
        const images = svg.querySelectorAll('image:not([data-pdf-fallback])').length
        if (images)
          report.rasterizedElements.push({
            slide: index + 1,
            reason: `${images} imagem(ns) enviada(s) mantida(s) como bitmap; texto e gráficos permanecem vetoriais.`,
          })
      } else {
        const family = resolveAppearance(
          slide,
          getTheme(deck.themeId),
          deck.accent,
          preparedDeck.brand,
        ).brand?.font
        const page = await rasterize(svg, family ? [family] : [])
        pdf.addImage(page, 'PNG', 0, 0, 960, 540, `slide-${index}`, 'FAST')
        report.rasterizedElements.push({
          slide: index + 1,
          reason: 'Página convertida em imagem por escolha explícita.',
        })
      }
      onProgress?.((index + 1) / (deck.slides.length + 1))
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0))
    }
    return { blob: pdf.output('blob'), report }
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : 'Falha inesperada ao preparar as páginas.'
    throw new Error(
      mode === 'searchable'
        ? `${reason}\nO PDF não foi criado. Você pode escolher PDF como imagem para preservar a aparência.`
        : reason,
    )
  } finally {
    host.remove()
  }
}

/** One real 16:9 PDF page per slide. The editable source remains the Deck. */
export async function exportPdf(
  deck: Deck,
  onProgress?: PdfProgressCallback,
  options: PdfExportOptions = {},
): Promise<PdfExportReport> {
  const { blob, report } = await createPdfBlob(deck, onProgress, options)
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName(deck.title)
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 60000)
  onProgress?.(1)
  return report
}

export default exportPdf
