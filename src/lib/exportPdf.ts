import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { jsPDF } from 'jspdf'
import type { Deck, Slide } from '../types'
import { getTheme } from './themes'
import {
  getSlideWarnings,
  registerImageDimensions,
  SlideCanvas,
  SLIDE_HEIGHT,
  SLIDE_WIDTH,
} from '../components/SlideCanvas'

export type PdfProgressCallback = (progress: number) => void

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

async function prepareImages(slide: Slide, cache: Map<string, string>): Promise<Slide> {
  const blocks = await Promise.all(
    slide.blocks.map(async (block) => {
      const source = block.image?.src
      if (block.type !== 'image' || !source) return block
      if (!source.startsWith('data:image/') && !source.startsWith('blob:')) {
        throw new Error(
          'Esta apresentação contém uma imagem externa. Envie o arquivo da imagem no editor para incorporá-la ao PDF.',
        )
      }
      let embedded = cache.get(source)
      if (!embedded) {
        const decoded = await loadImage(source)
        registerImageDimensions(source, decoded.naturalWidth, decoded.naturalHeight)
        if (source.startsWith('data:image/png') || source.startsWith('data:image/jpeg')) {
          embedded = source
        } else {
          // Normalize uploads to a self-contained, browser-supported raster image.
          // This also freezes the first frame of an animated upload for a static PDF.
          const canvas = document.createElement('canvas')
          const scale = Math.min(1, 4096 / Math.max(decoded.naturalWidth, decoded.naturalHeight))
          canvas.width = Math.max(1, Math.round(decoded.naturalWidth * scale))
          canvas.height = Math.max(1, Math.round(decoded.naturalHeight * scale))
          const context = canvas.getContext('2d')
          if (!context) throw new Error('Seu navegador não conseguiu preparar as imagens do PDF.')
          context.drawImage(decoded, 0, 0, canvas.width, canvas.height)
          embedded = canvas.toDataURL('image/png')
          registerImageDimensions(embedded, canvas.width, canvas.height)
          canvas.width = canvas.height = 1
        }
        cache.set(source, embedded)
      }
      return { ...block, image: { ...block.image!, src: embedded } }
    }),
  )
  return { ...slide, blocks }
}

async function rasterize(slide: Slide, deck: Deck, index: number): Promise<string> {
  const markup = renderToStaticMarkup(
    createElement(SlideCanvas, {
      slide,
      theme: getTheme(deck.themeId),
      accent: deck.accent,
      slideNumber: index + 1,
      totalSlides: deck.slides.length,
    }),
  )
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

function fileName(title: string): string {
  const clean = title
    .normalize('NFKC')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 100)
  return `${clean || 'Apresentacao-Zetta'}.pdf`
}

/**
 * Real PDF download, one 16:9 page per slide. The editable source remains the Deck.
 * Progress is a fraction from 0 to 1. Selection/editor UI never enters the export.
 * Overflow is a hard failure: exporting must never silently cut off user content.
 */
export async function exportPdf(deck: Deck, onProgress?: PdfProgressCallback): Promise<void> {
  if (!deck.slides.length) throw new Error('Adicione pelo menos um slide antes de baixar o PDF.')
  if (typeof document === 'undefined')
    throw new Error('Abra a apresentação no navegador para baixar o PDF.')
  onProgress?.(0)
  if (document.fonts) await document.fonts.ready
  const theme = getTheme(deck.themeId)
  const warnings = deck.slides.flatMap((slide, index) =>
    getSlideWarnings(slide, theme).map((warning) => `Slide ${index + 1}: ${warning}`),
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
  const imageCache = new Map<string, string>()
  for (let index = 0; index < deck.slides.length; index++) {
    const slide = await prepareImages(deck.slides[index], imageCache)
    const page = await rasterize(slide, deck, index)
    if (index > 0) pdf.addPage([960, 540], 'landscape')
    pdf.addImage(page, 'PNG', 0, 0, 960, 540, `slide-${index}`, 'FAST')
    onProgress?.((index + 1) / (deck.slides.length + 1))
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0))
  }
  await pdf.save(fileName(deck.title), { returnPromise: true })
  onProgress?.(1)
}

export default exportPdf
