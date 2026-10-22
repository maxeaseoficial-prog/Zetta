import { z } from 'zod'
import type { BrandKit, Deck, Slide } from '../types'

export const MAX_BACKUP_BYTES = 32 * 1024 * 1024
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
export const MAX_TOTAL_IMAGE_BYTES = 20 * 1024 * 1024
const MAX_SOURCE_LENGTH = 500_000
const id = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/, 'Identificador inválido.')
const color = z
  .string()
  .regex(/^#(?:[a-fA-F0-9]{3}|[a-fA-F0-9]{6}|[a-fA-F0-9]{8})$/, 'Use uma cor hexadecimal válida.')
const background = z.union([color, z.literal('transparent')])
const themeId = z.enum(['minimal', 'executive', 'editorial', 'bold', 'dark', 'classroom'])
const pageReferences = z.array(z.number().int().min(1).max(100)).max(100)

/** Only embedded raster data is accepted; MIME and file signature must agree. */
export function isSafeImageDataUrl(value: string): boolean {
  if (value.length > Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 64) return false
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value)
  if (!match || match[2].length % 4 !== 0) return false
  const padding = match[2].endsWith('==') ? 2 : match[2].endsWith('=') ? 1 : 0
  if ((match[2].length * 3) / 4 - padding > MAX_IMAGE_BYTES) return false
  let bytes: string
  try {
    bytes = atob(match[2].slice(0, 32))
  } catch {
    return false
  }
  if (match[1] === 'png') return bytes.startsWith('\x89PNG\r\n\x1a\n')
  if (match[1] === 'jpeg') return bytes.startsWith('\xff\xd8\xff')
  return bytes.startsWith('RIFF') && bytes.slice(8, 12) === 'WEBP'
}

const styleSchema = z.strictObject({
  color: color.optional(),
  background: background.optional(),
  fontSize: z.number().finite().min(8).max(128).optional(),
  bold: z.boolean().optional(),
  align: z.enum(['left', 'center', 'right']).optional(),
})
const embeddedImage = z
  .string()
  .refine(
    isSafeImageDataUrl,
    'A imagem deve ser um arquivo PNG, JPEG ou WebP incorporado de até 5 MB. URLs externas e SVG não são aceitos.',
  )
const brandSchema = z.strictObject({
  id,
  name: z.string().trim().min(1).max(100),
  logo: z.strictObject({ src: embeddedImage, alt: z.string().max(1_000) }).optional(),
  colors: z.strictObject({ accent: color, background: color, foreground: color }),
  font: z.enum(['sans', 'serif']),
  footer: z.string().max(160),
})
const appearanceSchema = z.strictObject({
  themeId,
  accent: color,
  brand: brandSchema.optional(),
})
const briefSchema = z.strictObject({
  purpose: z.enum(['general', 'proposal', 'report', 'lesson', 'institutional']),
  audience: z.enum(['general', 'decision-makers', 'technical', 'students']),
  durationMinutes: z.number().int().min(1).max(180).optional(),
})
const originSchema = z.strictObject({
  kind: z.enum(['source', 'manual', 'editorial', 'reused']),
  sourceName: z.string().max(1_000),
  sourceKind: z.enum(['text', 'pdf', 'example', 'manual']),
  excerpt: z.string().max(MAX_SOURCE_LENGTH),
  pages: pageReferences,
  baseline: z.string().max(100_000).optional(),
})
const imageSchema = z.strictObject({
  src: embeddedImage.optional(),
  alt: z.string().max(1_000),
  illustration: z.enum(['orbit', 'layers', 'growth', 'waves', 'grid']),
  fit: z.enum(['cover', 'contain']),
  position: z.number().finite().min(0).max(100),
  seed: z.number().finite().min(0).max(Number.MAX_SAFE_INTEGER),
  crop: z
    .strictObject({
      x: z.number().finite().min(0).max(100),
      y: z.number().finite().min(0).max(100),
      zoom: z.number().finite().min(1).max(4),
    })
    .optional(),
})
const diagramSchema = z
  .strictObject({
    type: z.enum(['process', 'timeline', 'comparison', 'metrics']),
    items: z
      .array(
        z.strictObject({
          id,
          title: z.string().max(300),
          description: z.string().max(5_000),
          label: z.string().max(120).optional(),
          value: z.string().max(120).optional(),
        }),
      )
      .max(6),
    source: z.string().max(5_000),
  })
  .superRefine((diagram, context) => {
    if (new Set(diagram.items.map((item) => item.id)).size !== diagram.items.length)
      context.addIssue({
        code: 'custom',
        path: ['items'],
        message: 'Identificador de item de diagrama duplicado.',
      })
  })
const chartSchema = z
  .strictObject({
    type: z.enum(['bar', 'horizontalBar', 'line', 'area', 'pie', 'donut']),
    // An empty chart is a valid saved draft. The renderer requires data before export.
    data: z
      .array(
        z.strictObject({
          label: z.string().min(1).max(120),
          value: z.number().finite().min(-1e12).max(1e12),
        }),
      )
      .max(50),
    unit: z.string().max(32),
    source: z.string().max(5_000),
    seriesName: z.string().max(60).optional(),
    additionalSeries: z
      .array(
        z.strictObject({
          name: z.string().trim().min(1).max(60),
          values: z.array(z.number().finite().min(-1e12).max(1e12)).max(50),
        }),
      )
      .max(2)
      .optional(),
    animate: z.boolean().optional(),
    showValues: z.boolean().optional(),
  })
  .superRefine((chart, context) => {
    const names = new Set([(chart.seriesName?.trim() || 'Valores').toLocaleLowerCase('pt-BR')])
    for (const [index, series] of (chart.additionalSeries ?? []).entries()) {
      if (series.values.length !== chart.data.length)
        context.addIssue({
          code: 'custom',
          path: ['additionalSeries', index, 'values'],
          message: 'Cada série precisa de um valor para cada categoria do gráfico.',
        })
      const key = series.name.trim().toLocaleLowerCase('pt-BR')
      if (names.has(key))
        context.addIssue({
          code: 'custom',
          path: ['additionalSeries', index, 'name'],
          message: 'Use nomes diferentes para as séries do gráfico.',
        })
      names.add(key)
    }
  })
const blockSchema = z
  .strictObject({
    id,
    type: z.enum(['text', 'bullets', 'image', 'callout', 'chart', 'diagram']),
    content: z.string().max(100_000),
    style: styleSchema.optional(),
    image: imageSchema.optional(),
    chart: chartSchema.optional(),
    diagram: diagramSchema.optional(),
  })
  .superRefine((block, context) => {
    if (block.type === 'image' && !block.image)
      context.addIssue({
        code: 'custom',
        path: ['image'],
        message: 'Bloco de imagem sem configuração.',
      })
    if (block.type === 'chart' && !block.chart)
      context.addIssue({ code: 'custom', path: ['chart'], message: 'Bloco de gráfico sem dados.' })
    if (block.type === 'diagram' && !block.diagram)
      context.addIssue({
        code: 'custom',
        path: ['diagram'],
        message: 'Bloco de diagrama sem configuração.',
      })
    if (
      block.chart &&
      new Set(block.chart.data.map((datum) => datum.label.trim().toLocaleLowerCase('pt-BR')))
        .size !== block.chart.data.length
    )
      context.addIssue({
        code: 'custom',
        path: ['chart', 'data'],
        message: 'Rótulos de gráfico duplicados.',
      })
  })
const slideSchema = z
  .strictObject({
    id,
    title: z.string().max(300),
    eyebrow: z.string().max(300),
    layout: z.enum([
      'cover',
      'split',
      'bullets',
      'columns',
      'quote',
      'chart',
      'section',
      'closing',
    ]),
    blocks: z.array(blockSchema).max(6),
    notes: z.string().max(MAX_SOURCE_LENGTH + 10_000),
    sourcePages: pageReferences,
    background: background.optional(),
    titleStyle: styleSchema.optional(),
    appearance: appearanceSchema.optional(),
    origin: originSchema.optional(),
    requirements: z.array(z.string().max(1_000)).max(20).optional(),
  })
  .superRefine((slide, context) => {
    const ids = [slide.id, ...slide.blocks.map((block) => block.id)]
    if (new Set(ids).size !== ids.length)
      context.addIssue({
        code: 'custom',
        path: ['blocks'],
        message: 'Identificador de bloco duplicado.',
      })
    if (new Set(slide.sourcePages).size !== slide.sourcePages.length)
      context.addIssue({
        code: 'custom',
        path: ['sourcePages'],
        message: 'Referência de página duplicada.',
      })
    if (slide.origin && new Set(slide.origin.pages).size !== slide.origin.pages.length)
      context.addIssue({
        code: 'custom',
        path: ['origin', 'pages'],
        message: 'Referência de origem duplicada.',
      })
  })
export const deckSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    id,
    title: z.string().min(1).max(300),
    createdAt: z.iso.datetime({ offset: true }),
    updatedAt: z.iso.datetime({ offset: true }),
    themeId,
    accent: color,
    brand: brandSchema.optional(),
    slides: z.array(slideSchema).min(1).max(50),
    source: z.strictObject({
      text: z.string().max(MAX_SOURCE_LENGTH),
      name: z.string().max(1_000),
      kind: z.enum(['text', 'pdf', 'example']),
      pages: z
        .array(
          z.strictObject({
            page: z.number().int().min(1).max(100),
            text: z.string().max(MAX_SOURCE_LENGTH),
          }),
        )
        .max(100)
        .optional(),
    }),
    settings: z.strictObject({
      density: z.enum(['short', 'balanced', 'detailed']),
      composition: z.enum(['simple', 'rich']),
      brief: briefSchema.optional(),
    }),
  })
  .superRefine((deck, context) => {
    const seen = new Set<string>([deck.id])
    const imageSize = (src?: string) => (src ? ((src.split(',')[1]?.length ?? 0) * 3) / 4 : 0)
    let imageBytes = imageSize(deck.brand?.logo?.src)
    const pageNumbers = new Set(deck.source.pages?.map((page) => page.page))
    if (deck.source.pages && pageNumbers.size !== deck.source.pages.length)
      context.addIssue({
        code: 'custom',
        path: ['source', 'pages'],
        message: 'Há números de página duplicados na fonte.',
      })
    if (
      (deck.source.pages?.reduce((sum, page) => sum + page.text.length, 0) ?? 0) > MAX_SOURCE_LENGTH
    )
      context.addIssue({
        code: 'custom',
        path: ['source', 'pages'],
        message: 'O texto das páginas ultrapassa o limite de 500 mil caracteres.',
      })
    deck.slides.forEach((slide, slideIndex) => {
      imageBytes += imageSize(slide.appearance?.brand?.logo?.src)
      if (seen.has(slide.id))
        context.addIssue({
          code: 'custom',
          path: ['slides', slideIndex, 'id'],
          message: 'Identificador de slide duplicado.',
        })
      seen.add(slide.id)
      if (new Set(slide.sourcePages).size !== slide.sourcePages.length)
        context.addIssue({
          code: 'custom',
          path: ['slides', slideIndex, 'sourcePages'],
          message: 'Referência de página duplicada.',
        })
      if (deck.source.pages && slide.sourcePages.some((page) => !pageNumbers.has(page)))
        context.addIssue({
          code: 'custom',
          path: ['slides', slideIndex, 'sourcePages'],
          message: 'O slide faz referência a uma página que não existe na fonte.',
        })
      slide.blocks.forEach((block, blockIndex) => {
        if (seen.has(block.id))
          context.addIssue({
            code: 'custom',
            path: ['slides', slideIndex, 'blocks', blockIndex, 'id'],
            message: 'Identificador de bloco duplicado.',
          })
        seen.add(block.id)
        if (block.image?.src) imageBytes += ((block.image.src.split(',')[1]?.length ?? 0) * 3) / 4
      })
    })
    if (imageBytes > MAX_TOTAL_IMAGE_BYTES)
      context.addIssue({
        code: 'custom',
        path: ['slides'],
        message: 'O conjunto de imagens ultrapassa 20 MB. Reduza as imagens antes de importar.',
      })
  })

export function validateDeck(value: unknown): Deck {
  const result = deckSchema.safeParse(value)
  if (!result.success) {
    const issue = result.error.issues[0]
    const path = issue.path.length ? ` (${issue.path.join('.')})` : ''
    throw new Error(`Apresentação inválida${path}: ${issue.message}`)
  }
  return result.data
}

export function validateBrandKit(value: unknown): BrandKit {
  const result = brandSchema.safeParse(value)
  if (!result.success) throw new Error(`Marca inválida: ${result.error.issues[0].message}`)
  return result.data
}

export function validateSlide(value: unknown): Slide {
  const result = slideSchema.safeParse(value)
  if (!result.success) throw new Error(`Slide inválido: ${result.error.issues[0].message}`)
  return result.data
}

export function parseDeckImport(text: string): Deck {
  if (!text.trim()) throw new Error('O arquivo de apresentação está vazio.')
  if (new Blob([text]).size > MAX_BACKUP_BYTES)
    throw new Error('O backup ultrapassa 32 MB. Use um arquivo menor.')
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    throw new Error('O arquivo não contém um JSON válido do Zetta.')
  }
  return validateDeck(value)
}

export function serializeDeck(deck: Deck): string {
  const serialized = JSON.stringify(validateDeck(deck), null, 2)
  if (new Blob([serialized]).size > MAX_BACKUP_BYTES)
    throw new Error('O backup ultrapassa 32 MB. Reduza o tamanho das imagens antes de exportar.')
  return serialized
}

export function deckBackupFilename(deck: Pick<Deck, 'title'>): string {
  const name = deck.title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
  return `${name || 'apresentacao'}.zetta.json`
}
