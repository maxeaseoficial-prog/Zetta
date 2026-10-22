import { z } from 'zod'
import type { BrandKit, ContentOrigin, Deck, ReusableSlide, Slide, Theme } from '../types'
import { getTheme } from './themes'
import { fontFamilyFor } from './fonts'
import {
  MAX_BACKUP_BYTES,
  MAX_TOTAL_IMAGE_BYTES,
  validateBrandKit,
  validateDeck,
  validateSlide,
} from './validation'

export type BrandApplyMode = 'preserve' | 'reset-colors'
export type ReuseAppearanceMode = 'preserve' | 'adapt'
export interface ResolvedAppearance {
  theme: Theme
  accent: string
  brand?: BrandKit
}

function channels(color: string): [number, number, number, number] {
  const hex = color.slice(1)
  const expanded = hex.length === 3 ? [...hex].map((value) => value + value).join('') : hex
  if (!/^[a-f\d]{6}([a-f\d]{2})?$/i.test(expanded)) return [255, 255, 255, 1]
  return [
    parseInt(expanded.slice(0, 2), 16),
    parseInt(expanded.slice(2, 4), 16),
    parseInt(expanded.slice(4, 6), 16),
    expanded.length === 8 ? parseInt(expanded.slice(6, 8), 16) / 255 : 1,
  ]
}

function blend(foreground: string, background: string, opacity = 1): string {
  const front = channels(foreground),
    back = channels(background)
  const alpha = front[3] * opacity
  return (
    '#' +
    front
      .slice(0, 3)
      .map((value, index) =>
        Math.round(value * alpha + back[index] * (1 - alpha))
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  )
}

/** A slide appearance is a complete snapshot; an absent snapshot brand does not inherit. */
export function resolveAppearance(
  slide: Pick<Slide, 'appearance'>,
  baseTheme: Theme,
  accent: string,
  brand?: BrandKit,
): ResolvedAppearance {
  const theme = slide.appearance ? getTheme(slide.appearance.themeId) : baseTheme
  const selectedBrand = slide.appearance ? slide.appearance.brand : brand
  const selectedAccent = slide.appearance?.accent ?? accent
  if (!selectedBrand) return { theme, accent: selectedAccent }
  const background = blend(selectedBrand.colors.background, theme.background)
  const foreground = blend(selectedBrand.colors.foreground, background)
  const chosenAccent = blend(selectedBrand.colors.accent, background)
  const rgb = channels(background)
  return {
    theme: {
      ...theme,
      background,
      foreground,
      accent: chosenAccent,
      muted: blend(foreground, background, 0.66),
      surface: blend(foreground, background, 0.055),
      fontFamily: fontFamilyFor(selectedBrand.font),
      dark: rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722 < 135,
    },
    accent: chosenAccent,
    brand: selectedBrand,
  }
}

export function documentBytes(value: unknown): number {
  return new Blob([JSON.stringify(value)]).size
}

function checkedDeck(value: Deck): Deck {
  const result = validateDeck(value)
  // Match the formatted backup budget, so an applied operation stays exportable.
  if (new Blob([JSON.stringify(result, null, 2)]).size > MAX_BACKUP_BYTES)
    throw new Error(
      'A apresentação ultrapassaria 32 MB. Reduza imagens ou conteúdo antes de aplicar.',
    )
  return result
}

/** Applies one explicit, undoable operation without changing the caller's document. */
export function applyBrandToDeck(
  deck: Deck,
  kit: BrandKit,
  mode: BrandApplyMode = 'preserve',
): Deck {
  if (mode !== 'preserve' && mode !== 'reset-colors')
    throw new Error('Escolha como aplicar a marca.')
  const brand = validateBrandKit(kit)
  const next = structuredClone(deck)
  next.brand = brand
  next.accent = brand.colors.accent
  if (mode === 'reset-colors') {
    for (const slide of next.slides) {
      delete slide.appearance
      delete slide.background
      if (slide.titleStyle) {
        delete slide.titleStyle.color
        delete slide.titleStyle.background
      }
      for (const block of slide.blocks)
        if (block.style) {
          delete block.style.color
          delete block.style.background
        }
    }
  }
  return checkedDeck(next)
}

const reusableEnvelope = z.strictObject({
  id: z
    .string()
    .min(1)
    .max(128)
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/),
  name: z.string().trim().min(1).max(100),
  createdAt: z.iso.datetime({ offset: true }),
  slide: z.unknown(),
})

export function validateReusableSlide(value: unknown): ReusableSlide {
  const envelope = reusableEnvelope.safeParse(value)
  if (!envelope.success) throw new Error('O item da biblioteca de slides é inválido.')
  const slide = validateSlide(envelope.data.slide)
  if (!slide.appearance || !slide.origin)
    throw new Error('O slide da biblioteca precisa incorporar sua aparência e origem.')
  const dataSize = (src?: string) => (src ? ((src.split(',')[1]?.length ?? 0) * 3) / 4 : 0)
  const imageBytes =
    dataSize(slide.appearance.brand?.logo?.src) +
    slide.blocks.reduce((sum, block) => sum + dataSize(block.image?.src), 0)
  if (imageBytes > MAX_TOTAL_IMAGE_BYTES)
    throw new Error('As imagens deste slide ultrapassam o limite de 20 MB.')
  const result = { ...envelope.data, slide }
  if (documentBytes(result) > MAX_BACKUP_BYTES)
    throw new Error(
      'O slide salvo ultrapassa 32 MB. Reduza as imagens antes de salvar na biblioteca.',
    )
  return result
}

function originForReuse(deck: Deck, slide: Slide): ContentOrigin {
  if (slide.origin) return { ...structuredClone(slide.origin), kind: 'reused' }
  const sourceAvailable = Boolean(deck.source.text.trim())
  const excerpt = sourceAvailable ? deck.source.text : slide.notes
  if (excerpt.length > 500_000)
    throw new Error(
      'A origem deste slide ultrapassa 500 mil caracteres. Revise as notas antes de salvar na biblioteca; nenhum conteúdo foi removido.',
    )
  return {
    kind: 'reused',
    sourceName: sourceAvailable ? deck.source.name || deck.title : `Notas de ${deck.title}`,
    sourceKind: sourceAvailable ? deck.source.kind : 'manual',
    excerpt,
    pages: [...slide.sourcePages],
  }
}

export function createReusableSlide(deck: Deck, slideId: string, name?: string): ReusableSlide {
  const source = deck.slides.find((slide) => slide.id === slideId)
  if (!source) throw new Error('Selecione um slide existente para salvar na biblioteca.')
  const slide = validateSlide(source)
  slide.appearance = structuredClone(
    source.appearance ?? {
      themeId: deck.themeId,
      accent: deck.accent,
      ...(deck.brand ? { brand: deck.brand } : {}),
    },
  )
  slide.origin = originForReuse(deck, source)
  slide.sourcePages = []
  return validateReusableSlide({
    id: crypto.randomUUID(),
    name: name ?? (source.title.trim().slice(0, 100) || 'Slide salvo'),
    createdAt: new Date().toISOString(),
    slide,
  })
}

export function insertReusableSlide(
  deck: Deck,
  value: ReusableSlide,
  afterIndex: number,
  mode: ReuseAppearanceMode = 'preserve',
): Deck {
  if (deck.slides.length >= 50)
    throw new Error('Esta apresentação já tem 50 slides. Remova um slide antes de inserir outro.')
  if (!Number.isInteger(afterIndex) || afterIndex < -1 || afterIndex >= deck.slides.length)
    throw new Error('A posição escolhida para inserir o slide não existe.')
  if (mode !== 'preserve' && mode !== 'adapt') throw new Error('Escolha como inserir o slide.')
  const item = validateReusableSlide(value)
  const slide = structuredClone(item.slide)
  slide.id = crypto.randomUUID()
  for (const block of slide.blocks) {
    block.id = crypto.randomUUID()
    for (const entry of block.diagram?.items ?? []) entry.id = crypto.randomUUID()
  }
  slide.sourcePages = []
  slide.origin = { ...slide.origin!, kind: 'reused' }
  if (mode === 'adapt') delete slide.appearance
  const next = structuredClone(deck)
  next.slides.splice(afterIndex + 1, 0, slide)
  return checkedDeck(next)
}
