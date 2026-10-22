import { useEffect, useId, useState, type KeyboardEvent, type MouseEvent } from 'react'
import type { Slide, SlideBlock, Theme, IllustrationKind, BrandKit } from '../types'
import { getChartWarnings } from '../lib/chartLayout'
import { getLoadedChartRenderer, loadChartRenderer } from '../lib/chartRuntime'
import { resolveAppearance } from '../lib/brand'
import { areBrandFontsReady, ensureBrandFonts, fontFamilyFor, fontIdForFamily } from '../lib/fonts'
import { resolveImagePlacement } from '../lib/imageCrop'
import { getDiagramWarnings } from '../lib/diagramLayout'
import { DiagramBlock } from './DiagramBlock'
import { InlineChartSvg } from './InlineChartSvg'

export const SLIDE_WIDTH = 1280
export const SLIDE_HEIGHT = 720

export interface SlideCanvasProps {
  slide: Slide
  theme: Theme
  accent: string
  brand?: BrandKit
  /** Export-only: replace legacy host fonts with explicitly reported portable fonts. */
  portableFonts?: boolean
  selectedBlockId?: string
  onSelect?: (id: string) => void
  onEditText?: (id: string) => void
  className?: string
  slideNumber?: number
  totalSlides?: number
  animateCharts?: boolean
  animationKey?: number
}

type Rect = { x: number; y: number; w: number; h: number }
type TextLayout = {
  lines: string[]
  size: number
  lineHeight: number
  height: number
  fits: boolean
}
type Placement = Rect & { block: SlideBlock; index: number; plain?: boolean }
type Colors = {
  bg: string
  fg: string
  muted: string
  accent: string
  ink: string
  surface: string
  tint: string
}
type Plan = {
  title: TextLayout
  titleRect: Rect
  placements: Placement[]
  warnings: string[]
  hero: boolean
}

let measurementContext: CanvasRenderingContext2D | null | undefined
const imageDimensions = new Map<string, { width: number; height: number }>()

/** Used by the exporter after decoding uploads, and by live SVG image cropping. */
export function registerImageDimensions(src: string, width: number, height: number): void {
  if (width > 0 && height > 0) imageDimensions.set(src, { width, height })
}

function validColor(value: string | undefined, fallback: string): string {
  return value && /^#[\da-f]{3}(?:[\da-f]{3})?$/i.test(value) ? value : fallback
}

function rgb(hex: string): number[] {
  const normalized =
    hex.length === 4
      ? hex
          .slice(1)
          .split('')
          .map((c) => c + c)
          .join('')
      : hex.slice(1)
  return [0, 2, 4].map((i) => parseInt(normalized.slice(i, i + 2), 16))
}

function mix(a: string, b: string, amount: number): string {
  const aa = rgb(a),
    bb = rgb(b)
  return (
    '#' +
    aa
      .map((c, i) =>
        Math.round(c + (bb[i] - c) * amount)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  )
}

function luminance(color: string): number {
  const channels = rgb(color).map((c) => {
    const s = c / 255
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
}

function contrast(a: string, b: string): number {
  const aa = luminance(a),
    bb = luminance(b)
  return (Math.max(aa, bb) + 0.05) / (Math.min(aa, bb) + 0.05)
}

function readable(color: string, background: string, fallback?: string): string {
  if (contrast(color, background) >= 4.5) return color
  const destination = fallback ?? (luminance(background) > 0.4 ? '#202622' : '#F7F8F0')
  for (let amount = 0.12; amount <= 1; amount += 0.12) {
    const result = mix(color, destination, Math.min(amount, 1))
    if (contrast(result, background) >= 4.5) return result
  }
  return destination
}

function colorsFor(slide: Slide, theme: Theme, accent: string): Colors {
  const bg = validColor(slide.background, theme.background)
  const chosenAccent = validColor(accent, theme.accent)
  const fg = readable(theme.foreground, bg)
  const surface = slide.background ? mix(bg, fg, 0.055) : theme.surface
  return {
    bg,
    fg,
    surface,
    accent: chosenAccent,
    muted: readable(theme.muted, bg),
    ink: readable(chosenAccent, bg),
    tint: mix(bg, chosenAccent, 0.12),
  }
}

function fontFamily(theme: Theme): string {
  if (fontIdForFamily(theme.fontFamily)) return theme.fontFamily
  return theme.fontFamily.includes('Georgia') ? 'Georgia, serif' : 'Arial, sans-serif'
}

function slideAppearance(
  slide: Slide,
  theme: Theme,
  accent: string,
  brand?: BrandKit,
  portableFonts = false,
) {
  const appearance = resolveAppearance(slide, theme, accent, brand)
  const bodyFamily = appearance.brand
    ? fontFamilyFor(appearance.brand.font)
    : portableFonts
      ? fontFamilyFor('sans')
      : 'Arial, sans-serif'
  if (portableFonts && !appearance.brand)
    appearance.theme = {
      ...appearance.theme,
      fontFamily: fontFamilyFor(appearance.theme.fontFamily.includes('Georgia') ? 'serif' : 'sans'),
    }
  return { ...appearance, bodyFamily }
}

function footerContent(slide: Slide, brand?: BrandKit): string {
  return [
    brand?.footer,
    slide.sourcePages.length
      ? `Fonte: PDF · ${slide.sourcePages.length === 1 ? 'p.' : 'pp.'} ${slide.sourcePages.join(', ')}`
      : '',
  ]
    .filter(Boolean)
    .join(' · ')
}

function widthOf(text: string, size: number, family: string, weight = 400, spacing = 0): number {
  if (measurementContext === undefined && typeof document !== 'undefined') {
    try {
      measurementContext = document.createElement('canvas').getContext('2d')
    } catch {
      measurementContext = null
    }
  }
  if (measurementContext) {
    measurementContext.font = `${weight} ${size}px ${family}`
    return (
      measurementContext.measureText(text).width +
      Math.max(0, Array.from(text).length - 1) * spacing
    )
  }
  // Server-side fallback; the browser/exporter use actual font measurement above.
  return (
    Array.from(text).reduce(
      (sum, c) =>
        sum +
        (/\s/.test(c) ? 0.28 : /[ilI.,:;!'|]/.test(c) ? 0.27 : /[MW@%]/.test(c) ? 0.88 : 0.55),
      0,
    ) *
      size +
    Math.max(0, text.length - 1) * spacing
  )
}

function wrap(
  text: string,
  width: number,
  size: number,
  family = 'Arial, sans-serif',
  weight = 400,
  spacing = 0,
): string[] {
  const result: string[] = []
  for (const paragraph of text.replace(/\r\n?/g, '\n').split('\n')) {
    if (!paragraph.trim()) {
      result.push('')
      continue
    }
    let line = ''
    for (const token of paragraph.trim().split(/\s+/)) {
      const candidate = line ? `${line} ${token}` : token
      if (widthOf(candidate, size, family, weight, spacing) <= width) {
        line = candidate
        continue
      }
      if (line) {
        result.push(line)
        line = ''
      }
      if (widthOf(token, size, family, weight, spacing) <= width) {
        line = token
        continue
      }
      // Break long URLs/words without removing characters or using an ellipsis.
      let part = ''
      for (const character of Array.from(token)) {
        if (part && widthOf(part + character, size, family, weight, spacing) > width) {
          result.push(part)
          part = character
        } else part += character
      }
      line = part
    }
    if (line) result.push(line)
  }
  return result.length ? result : ['']
}

function fit(
  text: string,
  width: number,
  height: number,
  preferred: number,
  minimum: number,
  family: string,
  weight: number,
  leading = 1.25,
): TextLayout {
  const safeWidth = Math.max(30, width)
  let size = Math.max(minimum, preferred)
  let lines = wrap(text, safeWidth, size, family, weight)
  while (size > minimum && lines.length * size * leading > height) {
    size = Math.max(minimum, size - 1)
    lines = wrap(text, safeWidth, size, family, weight)
  }
  const lineHeight = size * leading
  return {
    lines,
    size,
    lineHeight,
    height: lines.length * lineHeight,
    fits: lines.length * lineHeight <= height + 0.5,
  }
}

function distribute(
  blocks: { block: SlideBlock; index: number }[],
  rect: Rect,
  placements: Placement[],
  columns = 1,
  plain = false,
): void {
  if (!blocks.length) return
  const cols = Math.min(columns, blocks.length)
  const rows = Math.ceil(blocks.length / cols)
  const gap = 18
  const w = (rect.w - gap * (cols - 1)) / cols
  const h = (rect.h - gap * (rows - 1)) / rows
  blocks.forEach((item, i) =>
    placements.push({
      ...item,
      x: rect.x + (i % cols) * (w + gap),
      y: rect.y + Math.floor(i / cols) * (h + gap),
      w,
      h,
      plain,
    }),
  )
}

function stack(
  blocks: { block: SlideBlock; index: number }[],
  rect: Rect,
  placements: Placement[],
  plain = false,
): void {
  if (!blocks.length) return
  const gap = blocks.length > 3 ? 12 : 18
  const available = rect.h - gap * (blocks.length - 1)
  const weights = blocks.map(({ block }) => {
    if (block.type === 'chart' || block.type === 'diagram') return 8
    if (block.type === 'image') return 6
    const lines = Math.max(
      block.content.split('\n').length,
      block.content.length / Math.max(20, rect.w / 12),
    )
    return Math.max(2.6, Math.min(lines + 1.8, 10))
  })
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  let y = rect.y
  blocks.forEach((item, i) => {
    const h = (available * weights[i]) / total
    placements.push({ ...item, x: rect.x, y, w: rect.w, h, plain })
    y += h + gap
  })
}

function textForBlock(
  block: SlideBlock,
  rect: Rect,
  family = 'Arial, sans-serif',
): { paragraphs: TextLayout[]; size: number; height: number; fits: boolean; padding: number } {
  const padding = Math.min(28, Math.max(18, rect.w * 0.055))
  const isBullet = block.type === 'bullets'
  const paragraphs = isBullet
    ? block.content
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => line.replace(/^\s*[-*•]\s+/, ''))
    : [block.content]
  const contentWidth = rect.w - padding * 2 - (isBullet ? 22 : 0)
  const preferred = Math.min(
    64,
    Math.max(
      18,
      block.style?.fontSize ??
        (block.type === 'callout' ? (rect.w > 650 ? 32 : 26) : rect.w > 700 ? 26 : 23),
    ),
  )
  const weight = block.style?.bold || block.type === 'callout' ? 700 : 400
  let size = preferred
  const measure = (fontSize: number) =>
    paragraphs.map((text) =>
      fit(text, contentWidth, Infinity, fontSize, fontSize, family, weight, 1.3),
    )
  let measured = measure(size)
  const gap = isBullet ? 10 : 0
  const totalHeight = () =>
    measured.reduce((sum, paragraph) => sum + paragraph.height, 0) +
    Math.max(0, measured.length - 1) * gap
  while (size > 18 && totalHeight() > rect.h - padding * 2) {
    size--
    measured = measure(size)
  }
  return {
    paragraphs: measured,
    size,
    height: totalHeight(),
    fits: totalHeight() <= rect.h - padding * 2 + 0.5,
    padding,
  }
}

function chartFrame(block: SlideBlock, rect: Rect, family = 'Arial, sans-serif') {
  const title = fit(block.content, rect.w - 48, 52, 18, 16, family, 700)
  const source = block.chart?.source
    ? wrap(`Fonte: ${block.chart.source}`, rect.w - 48, 12, family)
    : []
  const headingHeight = block.content ? title.height + 14 : 0
  const sourceHeight = source.length ? source.length * 15 + 10 : 0
  return {
    title,
    source,
    graph: {
      x: rect.x + 18,
      y: rect.y + 18 + headingHeight,
      w: rect.w - 36,
      h: rect.h - 36 - headingHeight - sourceHeight,
    },
  }
}

function chartWarnings(block: SlideBlock, rect: Rect, family = 'Arial, sans-serif'): string[] {
  const { title, source, graph } = chartFrame(block, rect, family)
  const warnings = getChartWarnings(
    block.chart ?? { type: 'bar', data: [], unit: '', source: '' },
    graph.w,
    graph.h,
    family,
  )
  if (title.lines.length > 2)
    warnings.push('O título do gráfico precisa ser mais curto ou ter um layout maior.')
  if (source.length > 2)
    warnings.push(
      'A fonte do gráfico ocupa mais de duas linhas. Encurte a referência ou amplie o bloco.',
    )
  return warnings
}

function makePlan(
  slide: Slide,
  theme: Theme,
  bodyFamily = 'Arial, sans-serif',
  brand?: BrandKit,
): Plan {
  const blocks = slide.blocks.map((block, index) => ({ block, index }))
  const images = blocks.filter(({ block }) => block.type === 'image')
  const other = blocks.filter(({ block }) => block.type !== 'image')
  const hero = ['cover', 'section', 'closing'].includes(slide.layout)
  const dense = blocks.length > 4
  const heroImage = hero && images.length > 0 && !dense
  const family = fontFamily(theme)
  const titleWeight =
    slide.titleStyle?.bold === false
      ? 400
      : (family.includes('Georgia') || family.includes('Liberation Serif')) &&
          slide.titleStyle?.bold === undefined
        ? 400
        : 700
  const titleRect: Rect = {
    x: 64,
    y: hero ? 111 : 86,
    w: heroImage ? 664 : 1152,
    h: hero ? 230 : 126,
  }
  const preferredTitle = Math.min(
    98,
    Math.max(
      32,
      slide.titleStyle?.fontSize ??
        (hero ? (other.length > 2 ? 64 : 76) : theme.id === 'editorial' ? 48 : 46),
    ),
  )
  const title = fit(
    slide.title,
    titleRect.w,
    titleRect.h,
    preferredTitle,
    hero ? 38 : 32,
    family,
    titleWeight,
    1.12,
  )
  const titleHeight = Math.min(title.height, titleRect.h)
  const bodyY = hero
    ? Math.max(287, titleRect.y + titleHeight + 28)
    : Math.max(191, titleRect.y + titleHeight + 28)
  const body: Rect = { x: 64, y: bodyY, w: heroImage ? 664 : 1152, h: 650 - bodyY }
  const placements: Placement[] = []

  if (dense) {
    // Dense slides need a balanced grid: preserve every block without squeezing
    // five independent text areas into a narrow vertical stack.
    distribute(blocks, body, placements, 3)
  } else if (heroImage) {
    distribute(images, { x: 786, y: 62, w: 430, h: 588 }, placements, 1)
    if (other.length > 2) distribute(other, body, placements, 2)
    else stack(other, body, placements, other.length <= 1)
  } else if (slide.layout === 'split' && images.length && other.length) {
    const left = { ...body, w: 650 }
    const right = { ...body, x: 744, w: 472 }
    if (other.length > 2) distribute(other, left, placements, 2)
    else stack(other, left, placements, other.length === 1)
    distribute(images, right, placements, 1)
  } else if (slide.layout === 'quote' && blocks.length > 1) {
    const primary = blocks.find(({ block }) => block.type === 'callout') ?? blocks[0]
    const secondary = blocks.filter((item) => item !== primary)
    placements.push({ ...primary, ...body, w: 716 })
    stack(secondary, { ...body, x: 802, w: 414 }, placements)
  } else if (
    slide.layout === 'chart' &&
    blocks.some(({ block }) => block.type === 'chart' || block.type === 'diagram') &&
    blocks.length > 1
  ) {
    const primary = blocks.find(({ block }) => block.type === 'chart' || block.type === 'diagram')!
    placements.push({ ...primary, ...body, w: 754 })
    stack(
      blocks.filter((item) => item !== primary),
      { ...body, x: 842, w: 374 },
      placements,
    )
  } else if (slide.layout === 'bullets' && images.length === 1 && other.length > 0) {
    if (other.length > 2) distribute(other, { ...body, w: 752 }, placements, 2)
    else stack(other, { ...body, w: 752 }, placements, other.length === 1)
    placements.push({ ...images[0], ...body, x: 840, w: 376 })
  } else if (slide.layout === 'columns') {
    distribute(blocks, body, placements, blocks.length === 4 ? 2 : Math.min(3, blocks.length))
  } else if (blocks.length === 3 && !hero) {
    placements.push({ ...blocks[0], ...body, w: 626 })
    stack(blocks.slice(1), { ...body, x: 714, w: 502 }, placements)
  } else {
    const columns = blocks.length <= 1 ? 1 : blocks.length <= 4 ? 2 : 3
    distribute(
      blocks,
      body,
      placements,
      columns,
      blocks.length === 1 && blocks[0]?.block.type === 'text',
    )
  }

  const warnings: string[] = []
  if (!title.fits)
    warnings.push(
      'O título não cabe na área disponível. Encurte o título ou divida a apresentação em mais slides.',
    )
  if (slide.blocks.length > 6)
    warnings.push(
      `Este slide tem ${slide.blocks.length} blocos; o limite de composição é 6. Distribua o conteúdo em mais slides.`,
    )
  if (new Set(slide.blocks.map((block) => block.id)).size !== slide.blocks.length)
    warnings.push('Há blocos com identificadores repetidos neste slide.')
  if (
    slide.eyebrow &&
    wrap(slide.eyebrow, heroImage ? 660 : 1100, 13, bodyFamily, 700, 1.5).length > 2
  )
    warnings.push('O rótulo acima do título é longo demais. Use até duas linhas curtas.')
  for (const placement of placements) {
    const block = placement.block
    if (
      ['text', 'bullets', 'callout'].includes(block.type) &&
      !textForBlock(block, placement, bodyFamily).fits
    )
      warnings.push(
        `O bloco ${placement.index + 1} tem mais texto do que o layout comporta. Encurte o conteúdo ou escolha outra composição.`,
      )
    if (block.type === 'chart') warnings.push(...chartWarnings(block, placement, bodyFamily))
    if (block.type === 'diagram')
      warnings.push(
        ...getDiagramWarnings(
          block.diagram ?? { type: 'process', items: [], source: '' },
          placement.w,
          placement.h,
          bodyFamily,
          block.content,
        ),
      )
    if (placement.h < 40 || placement.w < 60)
      warnings.push(`O bloco ${placement.index + 1} não tem espaço suficiente neste layout.`)
  }
  const footer = footerContent(slide, brand)
  if (footer && wrap(footer, brand?.logo ? 915 : 1015, 11, bodyFamily).length > 2)
    warnings.push('O rodapé não cabe em duas linhas. Encurte-o antes de exportar.')
  return { title, titleRect, placements, warnings: Array.from(new Set(warnings)), hero }
}

/** The editor and the PDF exporter share exactly the same layout checks. */
export function getSlideWarnings(
  slide: Slide,
  theme: Theme,
  brand?: BrandKit,
  portableFonts = false,
): string[] {
  const appearance = slideAppearance(slide, theme, theme.accent, brand, portableFonts)
  return makePlan(slide, appearance.theme, appearance.bodyFamily, appearance.brand).warnings
}

export function getBlockFrame(
  slide: Slide,
  theme: Theme,
  id: string,
  brand?: BrandKit,
): Rect | null {
  const appearance = slideAppearance(slide, theme, theme.accent, brand)
  const placement = makePlan(
    slide,
    appearance.theme,
    appearance.bodyFamily,
    appearance.brand,
  ).placements.find((item) => item.block.id === id)
  return placement ? { x: placement.x, y: placement.y, w: placement.w, h: placement.h } : null
}

export interface TextEditRect {
  x: number
  y: number
  width: number
  height: number
  fontSize: number
  lineHeight: number
  fontFamily: string
  fontWeight: number
  textAlign: 'left' | 'center' | 'right'
}

/** Text overlay coordinates use the same measured typography as the SVG. */
export function getTextEditRect(
  slide: Slide,
  theme: Theme,
  id: string,
  brand?: BrandKit,
): TextEditRect | null {
  const appearance = slideAppearance(slide, theme, theme.accent, brand)
  theme = appearance.theme
  const plan = makePlan(slide, theme, appearance.bodyFamily, appearance.brand)
  if (id === 'title') {
    const family = fontFamily(theme)
    return {
      x: plan.titleRect.x,
      y: plan.titleRect.y,
      width: plan.titleRect.w,
      height: Math.max(plan.title.height + 8, 56),
      fontSize: plan.title.size,
      lineHeight: plan.title.lineHeight,
      fontFamily: family,
      fontWeight:
        slide.titleStyle?.bold === false
          ? 400
          : (family.includes('Georgia') || family.includes('Liberation Serif')) &&
              slide.titleStyle?.bold === undefined
            ? 400
            : 700,
      textAlign: slide.titleStyle?.align ?? 'left',
    }
  }
  const placement = plan.placements.find((item) => item.block.id === id)
  if (!placement || !['text', 'bullets', 'callout'].includes(placement.block.type)) return null
  const measured = textForBlock(placement.block, placement, appearance.bodyFamily)
  const indent = placement.block.type === 'bullets' ? 22 : 0
  return {
    x: placement.x + measured.padding + indent,
    y: placement.y + Math.max(measured.padding, (placement.h - measured.height) / 2),
    width: placement.w - measured.padding * 2 - indent,
    height: Math.max(40, measured.height + 8),
    fontSize: measured.size,
    lineHeight: measured.size * 1.3,
    fontFamily: appearance.bodyFamily,
    fontWeight: placement.block.style?.bold || placement.block.type === 'callout' ? 700 : 400,
    textAlign:
      placement.block.style?.align ??
      (placement.block.type === 'callout' && placement.w > 600 ? 'center' : 'left'),
  }
}

function TextLines({
  layout,
  x,
  y,
  width,
  color,
  family = 'Arial, sans-serif',
  weight = 400,
  align = 'left',
}: {
  layout: TextLayout
  x: number
  y: number
  width: number
  color: string
  family?: string
  weight?: number
  align?: 'left' | 'center' | 'right'
}) {
  const anchor = align === 'center' ? 'middle' : align === 'right' ? 'end' : 'start'
  const textX = align === 'center' ? x + width / 2 : align === 'right' ? x + width : x
  return (
    <text
      fill={color}
      fontFamily={family}
      fontWeight={weight}
      fontSize={layout.size}
      textAnchor={anchor}
    >
      {layout.lines.map((line, i) => (
        <tspan key={i} x={textX} y={y + layout.size + i * layout.lineHeight}>
          {line || '\u00a0'}
        </tspan>
      ))}
    </text>
  )
}

function Artwork({
  kind,
  seed,
  rect,
  colors,
  id,
}: {
  kind: IllustrationKind
  seed: number
  rect: Rect
  colors: Colors
  id: string
}) {
  const { x, y, w, h } = rect
  const bright = mix(colors.accent, '#FFFFFF', 0.44)
  const deep = mix(colors.accent, '#10213B', 0.52)
  const pale = mix(colors.bg, colors.accent, 0.22)
  const sample = Math.sin((seed || 1) * 12.9898) * 43758.5453
  const variation = sample - Math.floor(sample)
  const turn = (variation - 0.5) * 28
  return (
    <svg
      x={x}
      y={y}
      width={w}
      height={h}
      viewBox="0 0 500 500"
      preserveAspectRatio="xMidYMid slice"
      aria-label="Ilustração abstrata"
      data-procedural-artwork="true"
    >
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor={pale} />
          <stop offset="1" stopColor={mix(colors.bg, colors.accent, 0.36)} />
        </linearGradient>
        <linearGradient id={`${id}-face`} x1="0" y1="0" x2="0.9" y2="1">
          <stop stopColor={bright} />
          <stop offset="0.57" stopColor={colors.accent} />
          <stop offset="1" stopColor={deep} />
        </linearGradient>
        <radialGradient id={`${id}-glow`}>
          <stop stopColor={bright} stopOpacity="0.9" />
          <stop offset="1" stopColor={bright} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-shade`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor={deep} />
          <stop offset="1" stopColor={colors.accent} />
        </linearGradient>
      </defs>
      <rect width="500" height="500" fill={`url(#${id}-bg)`} />
      <circle cx="385" cy="90" r="230" fill={`url(#${id}-glow)`} />
      {kind === 'orbit' && (
        <g transform={`rotate(${turn} 250 250)`}>
          {[145, 184, 226].map((r, i) => (
            <ellipse
              key={r}
              cx="250"
              cy="265"
              rx={r}
              ry={r * 0.57}
              transform={`rotate(${-37 + i * 4} 250 265)`}
              fill="none"
              stroke={deep}
              strokeOpacity={0.2 + i * 0.07}
              strokeWidth={i === 1 ? 2 : 1}
            />
          ))}
          <ellipse cx="260" cy="395" rx="112" ry="23" fill={deep} opacity="0.12" />
          <circle cx="250" cy="245" r="113" fill={`url(#${id}-face)`} />
          <circle cx="215" cy="205" r="72" fill={`url(#${id}-glow)`} />
          <ellipse
            cx="250"
            cy="265"
            rx="184"
            ry="105"
            transform="rotate(-33 250 265)"
            fill="none"
            stroke={bright}
            strokeWidth="3"
            strokeDasharray="360 630"
            strokeDashoffset="-40"
          />
          <circle cx="397" cy="169" r="20" fill={deep} />
          <circle cx="104" cy="358" r="12" fill={bright} />
          <circle cx={118 + variation * 16} cy="117" r="4" fill={deep} />
          <circle cx="367" cy="379" r="5" fill={colors.accent} />
          <path d="M75 82h27M88.5 68.5v27" stroke={deep} strokeOpacity="0.35" />
        </g>
      )}
      {kind === 'layers' && (
        <g transform={`translate(${(variation - 0.5) * 24} 0) rotate(${turn * 0.45} 250 250)`}>
          <ellipse cx="250" cy="400" rx="170" ry="24" fill={deep} opacity="0.1" />
          {[0, 1, 2, 3].map((n) => (
            <g key={n} transform={`translate(250 ${345 - n * 60})`}>
              <path
                d="M0-104 165-21Q179-12 162-3L17 82Q0 92-17 82L-162-3Q-179-12-165-21Z"
                fill={n === 3 ? `url(#${id}-face)` : mix(deep, bright, n * 0.22)}
                stroke={bright}
                strokeOpacity="0.55"
                strokeWidth="1.5"
              />
              <path d="M-132-12 0 57 133-12" fill="none" stroke={bright} strokeOpacity="0.35" />
            </g>
          ))}
          <ellipse cx="250" cy="155" rx="43" ry="24" fill={bright} opacity="0.75" />
          <path d="M250 101V61m-8 9 8-9 8 9" stroke={deep} strokeWidth="2" fill="none" />
          <circle cx="86" cy="144" r="6" fill={colors.accent} />
          <circle cx="416" cy="292" r="4" fill={deep} />
        </g>
      )}
      {kind === 'growth' && (
        <g transform={`translate(250 250) scale(${0.9 + variation * 0.18}) translate(-250 -250)`}>
          {[0, 1, 2, 3, 4].map((i) => (
            <path key={i} d={`M55 ${130 + i * 62}H445`} stroke={deep} opacity="0.08" />
          ))}
          {[85, 153, 236, 330].map((baseHeight, i) => {
            const height = baseHeight + (variation - 0.5) * (32 - i * 4)
            return (
              <g key={baseHeight}>
                <rect
                  x={74 + i * 88}
                  y={420 - height}
                  width="62"
                  height={height}
                  rx="15"
                  fill={i === 3 ? `url(#${id}-shade)` : mix(bright, colors.accent, 0.15 + i * 0.18)}
                />
                <rect
                  x={83 + i * 88}
                  y={430 - height}
                  width="6"
                  height={Math.max(8, height - 22)}
                  rx="3"
                  fill={bright}
                  opacity="0.4"
                />
              </g>
            )
          })}
          <path
            d="M78 291C170 289 212 200 277 178S365 90 407 63"
            fill="none"
            stroke={deep}
            strokeWidth="4"
            strokeLinecap="round"
          />
          <path
            d="m384 66 25-5-3 25"
            fill="none"
            stroke={deep}
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="278" cy="177" r="8" fill={bright} stroke={deep} strokeWidth="3" />
        </g>
      )}
      {kind === 'waves' && (
        <g transform={`rotate(${turn * 1.2} 250 250) translate(0 ${(variation - 0.5) * 50})`}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <path
              key={i}
              d={`M-80 ${135 + i * 62}C70 ${-45 + i * 62} 170 ${390 + i * 30} 355 ${149 + i * 50}S570 ${40 + i * 50} 620 ${90 + i * 58}`}
              stroke={mix(deep, bright, i / 6)}
              strokeWidth="51"
              fill="none"
              strokeLinecap="round"
            />
          ))}
          <path
            d="M-70 128C80-35 170 375 355 143S570 35 620 80"
            stroke={bright}
            strokeWidth="2"
            fill="none"
            opacity="0.7"
          />
          <circle cx="375" cy="84" r="32" fill={bright} opacity="0.8" />
        </g>
      )}
      {kind === 'grid' && (
        <g transform={`rotate(${Math.floor(variation * 4) * 90} 250 250)`}>
          {Array.from({ length: 16 }, (_, i) => {
            const cx = 62 + (i % 4) * 100,
              cy = 62 + Math.floor(i / 4) * 100
            const tone = [deep, colors.accent, bright, mix(colors.accent, colors.bg, 0.6)][
              (i + Math.floor(variation * 4)) % 4
            ]
            return (
              <g key={i} transform={`translate(${cx} ${cy})`}>
                {i % 4 === 0 ? (
                  <circle cx="38" cy="38" r="38" fill={tone} />
                ) : i % 4 === 1 ? (
                  <path d="M0 0h76v76H0Z" fill="none" stroke={tone} strokeWidth="14" />
                ) : i % 4 === 2 ? (
                  <path d="M0 76V0h76A76 76 0 0 1 0 76" fill={tone} />
                ) : (
                  <rect width="76" height="76" rx="22" fill={tone} />
                )}
                {i % 5 === 0 && <circle cx="38" cy="38" r="14" fill={pale} />}
              </g>
            )
          })}
        </g>
      )}
      <rect
        x="24"
        y="24"
        width="452"
        height="452"
        rx="4"
        fill="none"
        stroke={deep}
        strokeOpacity="0.08"
      />
    </svg>
  )
}

function Chart({
  placement,
  colors,
  id,
  animate = false,
  animationKey = 0,
  family,
}: {
  placement: Placement
  colors: Colors
  id: string
  animate?: boolean
  animationKey?: number
  family: string
}) {
  const [renderer, setRenderer] = useState(getLoadedChartRenderer)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    setError('')
    loadChartRenderer()
      .then((module) => {
        if (active) setRenderer(module)
      })
      .catch(() => {
        if (active) setError('Não foi possível preparar o gráfico. Tentar novamente.')
      })
    return () => {
      active = false
    }
  }, [attempt])
  const { block, x, y, w, h } = placement
  const chart = block.chart ?? { type: 'bar' as const, data: [], unit: '', source: '' }
  const bg = validColor(block.style?.background, colors.surface)
  const ink = readable(validColor(block.style?.color, colors.fg), bg)
  const muted = readable(colors.muted, bg)
  const { title, source, graph } = chartFrame(block, placement, family)
  const snapshot = renderer?.renderChartSvg(chart, {
    width: Math.max(1, graph.w),
    height: Math.max(1, graph.h),
    foreground: ink,
    muted,
    accent: colors.accent,
    background: bg,
    animate,
    fontFamily: family,
  })
  const animated = Boolean(
    animate && chart.animate !== false && snapshot?.svg.includes('@keyframes'),
  )
  const scope = `${id}-${animationKey}-${animated ? 'animated' : 'static'}`
  const href = snapshot
    ? animated
      ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(snapshot.svg.replace('<svg ', `<svg data-zetta-entry="${scope}" `))}`
      : snapshot.dataUrl
    : undefined
  return (
    <g
      data-chart-type={chart.type}
      data-chart-animated={String(animated)}
      data-chart-state={error ? 'error' : snapshot ? 'ready' : 'loading'}
    >
      <rect x={x} y={y} width={w} height={h} rx="20" fill={bg} />
      {block.content && (
        <TextLines
          layout={title}
          x={x + 24}
          y={y + 18}
          width={w - 48}
          color={ink}
          weight={700}
          family={family}
        />
      )}
      {snapshot ? (
        fontIdForFamily(family) ? (
          <InlineChartSvg
            key={scope}
            svg={snapshot.svg}
            scope={scope}
            x={graph.x}
            y={graph.y}
            width={Math.max(1, graph.w)}
            height={Math.max(1, graph.h)}
            type={chart.type}
            animated={animated}
          />
        ) : (
          <image
            key={scope}
            x={graph.x}
            y={graph.y}
            width={Math.max(1, graph.w)}
            height={Math.max(1, graph.h)}
            href={href}
            preserveAspectRatio="xMidYMid meet"
            data-chart-type={chart.type}
            data-chart-animated={String(animated)}
            aria-label={`${block.content || 'Gráfico'} · ${chart.data.length} categorias${chart.unit ? ` · ${chart.unit}` : ''}`}
          />
        )
      ) : (
        <g
          role={error ? 'button' : undefined}
          tabIndex={error ? 0 : undefined}
          onClick={
            error
              ? (event) => {
                  event.stopPropagation()
                  setAttempt((value) => value + 1)
                }
              : undefined
          }
          onKeyDown={
            error
              ? (event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    setAttempt((value) => value + 1)
                  }
                }
              : undefined
          }
          aria-label={error || 'Preparando gráfico'}
        >
          <rect
            x={graph.x}
            y={graph.y}
            width={Math.max(1, graph.w)}
            height={Math.max(1, graph.h)}
            fill="transparent"
          />
          <text
            x={graph.x + graph.w / 2}
            y={graph.y + graph.h / 2}
            textAnchor="middle"
            fill={muted}
            fontSize="16"
            fontFamily={family}
          >
            {error || 'Preparando gráfico…'}
          </text>
        </g>
      )}
      {source.map((line, index) => (
        <text
          key={index}
          x={x + 24}
          y={y + h - 14 - (source.length - index - 1) * 15}
          fill={muted}
          fontFamily={family}
          fontSize="12"
        >
          {line}
        </text>
      ))}
    </g>
  )
}

function TextBlock({
  placement,
  colors,
  family,
}: {
  placement: Placement
  colors: Colors
  family: string
}) {
  const { block, x, y, w, h, plain } = placement
  const measured = textForBlock(block, placement, family)
  const isCallout = block.type === 'callout'
  const bg = validColor(block.style?.background, isCallout ? colors.tint : colors.surface)
  const actualBg = plain && !block.style?.background ? colors.bg : bg
  const ink = readable(validColor(block.style?.color, colors.fg), actualBg)
  const weight = block.style?.bold || isCallout ? 700 : 400
  const innerW = w - measured.padding * 2 - (block.type === 'bullets' ? 22 : 0)
  let cursor = y + Math.max(measured.padding, (h - measured.height) / 2)
  return (
    <g>
      {(!plain || block.style?.background) && (
        <rect x={x} y={y} width={w} height={h} rx={isCallout ? 12 : 20} fill={bg} />
      )}
      {isCallout && (
        <rect
          x={x}
          y={y + 20}
          width="4"
          height={Math.max(10, h - 40)}
          rx="2"
          fill={colors.accent}
        />
      )}
      {measured.paragraphs.map((paragraph, i) => {
        const atY = cursor
        cursor += paragraph.height + (block.type === 'bullets' ? 10 : 0)
        const bullet = block.type === 'bullets'
        return (
          <g key={i}>
            {bullet && (
              <circle
                cx={x + measured.padding + 4}
                cy={atY + measured.size * 0.63}
                r="3.6"
                fill={readable(colors.accent, actualBg)}
              />
            )}
            <TextLines
              layout={paragraph}
              family={family}
              x={x + measured.padding + (bullet ? 22 : 0)}
              y={atY}
              width={innerW}
              color={ink}
              weight={weight}
              align={block.style?.align ?? (isCallout && w > 600 ? 'center' : 'left')}
            />
          </g>
        )
      })}
    </g>
  )
}

/** A self-contained, exportable SVG. It contains no foreignObject or HTML. */
export function SlideCanvas({
  slide,
  theme,
  accent,
  brand,
  portableFonts = false,
  selectedBlockId,
  onSelect,
  onEditText,
  className,
  slideNumber,
  totalSlides,
  animateCharts = false,
  animationKey = 0,
}: SlideCanvasProps) {
  const appearance = slideAppearance(slide, theme, accent, brand, portableFonts)
  theme = appearance.theme
  accent = appearance.accent
  brand = appearance.brand
  const bodyFamily = appearance.bodyFamily
  const reactId = useId()
  const [, updateImages] = useState(0)
  const imageSources = [
    ...slide.blocks
      .filter((block) => block.type === 'image' && block.image?.src)
      .map((block) => block.image!.src!),
    ...(brand?.logo?.src ? [brand.logo.src] : []),
  ].join('\n')
  const [, updateFonts] = useState(0)
  const [fontError, setFontError] = useState('')
  const [fontAttempt, setFontAttempt] = useState(0)
  const fontIds = [
    ...new Set(
      [fontIdForFamily(theme.fontFamily), fontIdForFamily(bodyFamily)].filter((id) => id !== null),
    ),
  ]
  const fontKey = fontIds.join(',')
  useEffect(() => {
    let active = true
    setFontError('')
    if (fontIds.length)
      Promise.all(fontIds.map(ensureBrandFonts))
        .then(() => {
          if (active) updateFonts((version) => version + 1)
        })
        .catch((error) => {
          if (active)
            setFontError(
              error instanceof Error ? error.message : 'Não foi possível carregar a fonte.',
            )
        })
    return () => {
      active = false
    }
  }, [fontKey, fontAttempt])
  useEffect(() => {
    let active = true
    for (const src of imageSources.split('\n').filter(Boolean)) {
      if (imageDimensions.has(src)) continue
      const image = new Image()
      image.onload = () => {
        registerImageDimensions(src, image.naturalWidth, image.naturalHeight)
        if (active) updateImages((version) => version + 1)
      }
      image.src = src
    }
    return () => {
      active = false
    }
  }, [imageSources])
  const prefix = `zetta-${reactId.replace(/[^\w-]/g, '')}-${slide.id.replace(/[^\w-]/g, '')}`
  const colors = colorsFor(slide, theme, accent)
  const plan = makePlan(slide, theme, bodyFamily, brand)
  const family = fontFamily(theme)
  const titleWeight =
    slide.titleStyle?.bold === false
      ? 400
      : (family.includes('Georgia') || family.includes('Liberation Serif')) &&
          slide.titleStyle?.bold === undefined
        ? 400
        : 700
  const keySelect = (event: KeyboardEvent<SVGGElement>, id: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onSelect?.(id)
    }
  }
  const interactive = (id: string, label: string, editable = true) =>
    onSelect
      ? {
          role: 'button' as const,
          tabIndex: 0,
          'aria-label': label,
          onClick: (event: MouseEvent<SVGGElement>) => {
            event.stopPropagation()
            onSelect(id)
          },
          onDoubleClick: (event: MouseEvent<SVGGElement>) => {
            event.stopPropagation()
            if (editable) onEditText?.(id)
          },
          onKeyDown: (event: KeyboardEvent<SVGGElement>) => keySelect(event, id),
          style: { cursor: 'pointer' },
        }
      : {}
  const eyebrowLines = wrap(
    slide.eyebrow.toLocaleUpperCase('pt-BR'),
    plan.titleRect.w - 34,
    13,
    bodyFamily,
    700,
    1.5,
  )

  if (fontError || fontIds.some((id) => !areBrandFontsReady(id)))
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox={`0 0 ${SLIDE_WIDTH} ${SLIDE_HEIGHT}`}
        width={SLIDE_WIDTH}
        height={SLIDE_HEIGHT}
        className={className}
        data-slide-id={slide.id}
        data-font-state={fontError ? 'error' : 'loading'}
        style={{ display: 'block', width: '100%', height: 'auto' }}
      >
        <rect width={SLIDE_WIDTH} height={SLIDE_HEIGHT} fill={colors.bg} />
        <text
          x="640"
          y="340"
          textAnchor="middle"
          fill={colors.fg}
          fontFamily="Arial, sans-serif"
          fontSize="22"
        >
          {fontError || 'Preparando a fonte da apresentação…'}
        </text>
        {fontError && (
          <g
            role="button"
            tabIndex={0}
            aria-label="Tentar carregar a fonte novamente"
            onClick={() => setFontAttempt((value) => value + 1)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                setFontAttempt((value) => value + 1)
              }
            }}
            style={{ cursor: 'pointer' }}
          >
            <rect x="500" y="374" width="280" height="48" rx="12" fill="#2563EB" />
            <text
              x="640"
              y="405"
              textAnchor="middle"
              fill="#FFFFFF"
              fontFamily="Arial, sans-serif"
              fontSize="18"
            >
              Tentar novamente
            </text>
          </g>
        )}
      </svg>
    )

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={SLIDE_WIDTH}
      height={SLIDE_HEIGHT}
      viewBox={`0 0 ${SLIDE_WIDTH} ${SLIDE_HEIGHT}`}
      className={className}
      role={onSelect ? 'group' : 'img'}
      aria-label={slide.title || 'Slide sem título'}
      style={{
        display: 'block',
        width: '100%',
        height: 'auto',
        fontFamily: bodyFamily,
        overflow: 'hidden',
      }}
      data-slide-id={slide.id}
      data-font-state="ready"
    >
      <title>{slide.title || 'Slide sem título'}</title>
      <rect width={SLIDE_WIDTH} height={SLIDE_HEIGHT} fill={colors.bg} />
      {theme.id === 'executive' && (
        <rect x="0" y="0" width="10" height={SLIDE_HEIGHT} fill={colors.accent} />
      )}
      {theme.id === 'bold' && <path d="M1106 0h174v174Z" fill={colors.accent} opacity="0.12" />}
      {theme.id === 'classroom' && (
        <>
          <circle cx="1240" cy="42" r="105" fill={colors.accent} opacity="0.1" />
          <path
            d="m1198 47 18 8-2 20-14-11-17 11 4-21-16-12 20-1 7-19Z"
            fill={colors.accent}
            opacity="0.4"
          />
        </>
      )}
      {theme.id === 'editorial' && (
        <line x1="64" y1="35" x2="1216" y2="35" stroke={colors.fg} strokeOpacity="0.25" />
      )}
      {theme.id === 'dark' && (
        <path d="M0 716 1280 330V720H0Z" fill={colors.accent} opacity="0.025" />
      )}
      {slide.eyebrow && (
        <g>
          <circle cx="69" cy="56" r="4" fill={colors.accent} />
          <text
            fill={colors.ink}
            fontFamily={bodyFamily}
            fontWeight="700"
            fontSize="13"
            letterSpacing="1.5"
          >
            {eyebrowLines.map((line, i) => (
              <tspan key={i} x="84" y={61 + i * 17}>
                {line}
              </tspan>
            ))}
          </text>
        </g>
      )}
      <g {...interactive('title', 'Selecionar título')} data-block-id="title">
        <rect
          x={plan.titleRect.x - 6}
          y={plan.titleRect.y - 5}
          width={plan.titleRect.w + 12}
          height={Math.max(50, plan.title.height + 10)}
          fill="transparent"
        />
        <TextLines
          layout={plan.title}
          x={plan.titleRect.x}
          y={plan.titleRect.y}
          width={plan.titleRect.w}
          family={family}
          weight={titleWeight}
          color={validColor(slide.titleStyle?.color, colors.fg)}
          align={slide.titleStyle?.align}
        />
        {selectedBlockId === 'title' && (
          <rect
            x={plan.titleRect.x - 7}
            y={plan.titleRect.y - 5}
            width={plan.titleRect.w + 14}
            height={Math.max(50, plan.title.height + 11)}
            rx="6"
            fill="none"
            stroke="#2563EB"
            strokeWidth="2.5"
          />
        )}
      </g>
      {plan.placements.map((placement) => {
        const { block, index, x, y, w, h } = placement
        const id = `${prefix}-block-${index}`
        const isImage = block.type === 'image'
        const image = block.image
        const natural = image?.src ? imageDimensions.get(image.src) : undefined
        const imageFrame =
          image && natural ? resolveImagePlacement(image, natural, placement) : placement
        return (
          <g
            key={`${block.id}-${index}`}
            {...interactive(
              block.id,
              `Selecionar ${block.type === 'image' ? 'imagem' : block.type === 'chart' ? 'gráfico' : block.type === 'diagram' ? 'diagrama' : 'bloco de texto'} ${index + 1}`,
              block.type !== 'image' && block.type !== 'chart' && block.type !== 'diagram',
            )}
            data-block-id={block.id}
          >
            {isImage ? (
              <>
                <defs>
                  <clipPath id={`${id}-clip`}>
                    <rect
                      x={x}
                      y={y}
                      width={Math.max(1, w)}
                      height={Math.max(1, h)}
                      rx={theme.id === 'editorial' ? 4 : theme.id === 'bold' ? 12 : 24}
                    />
                  </clipPath>
                </defs>
                <g clipPath={`url(#${id}-clip)`}>
                  <rect
                    x={x}
                    y={y}
                    width={Math.max(1, w)}
                    height={Math.max(1, h)}
                    fill={colors.surface}
                  />
                  {image?.src ? (
                    <image
                      href={image.src}
                      x={imageFrame.x}
                      y={imageFrame.y}
                      width={Math.max(1, imageFrame.w)}
                      height={Math.max(1, imageFrame.h)}
                      preserveAspectRatio={
                        natural
                          ? 'none'
                          : image.fit === 'contain'
                            ? 'xMidYMid meet'
                            : 'xMidYMid slice'
                      }
                      aria-label={image.alt || 'Imagem da apresentação'}
                    />
                  ) : (
                    <Artwork
                      kind={image?.illustration ?? 'orbit'}
                      seed={image?.seed ?? index + 1}
                      rect={placement}
                      colors={colors}
                      id={id}
                    />
                  )}
                </g>
              </>
            ) : block.type === 'chart' ? (
              <Chart
                placement={placement}
                colors={colors}
                id={id}
                animate={animateCharts}
                animationKey={animationKey}
                family={bodyFamily}
              />
            ) : block.type === 'diagram' ? (
              <DiagramBlock
                diagram={block.diagram ?? { type: 'process', items: [], source: '' }}
                title={block.content}
                rect={placement}
                family={bodyFamily}
                colors={colors}
              />
            ) : (
              <TextBlock placement={placement} colors={colors} family={bodyFamily} />
            )}
            {onSelect && !(block.type === 'chart' && !getLoadedChartRenderer()) && (
              <rect
                x={x}
                y={y}
                width={Math.max(1, w)}
                height={Math.max(1, h)}
                rx="16"
                fill="transparent"
              />
            )}
            {selectedBlockId === block.id && (
              <rect
                x={x - 3}
                y={y - 3}
                width={Math.max(1, w + 6)}
                height={Math.max(1, h + 6)}
                rx="19"
                fill="none"
                stroke="#2563EB"
                strokeWidth="3"
              />
            )}
          </g>
        )
      })}
      <line
        x1="64"
        y1="678"
        x2="1216"
        y2="678"
        stroke={colors.fg}
        strokeOpacity={theme.id === 'editorial' ? 0.26 : 0.1}
      />
      {brand?.logo ? (
        <image
          href={brand.logo.src}
          x="64"
          y="685"
          width="80"
          height="28"
          preserveAspectRatio="xMinYMid meet"
          aria-label={brand.logo.alt || brand.name}
        />
      ) : (
        <rect
          x="64"
          y="695"
          width={theme.id === 'editorial' ? 34 : 18}
          height="3"
          rx="1.5"
          fill={colors.accent}
        />
      )}
      {footerContent(slide, brand) && (
        <text fill={colors.muted} fontFamily={bodyFamily} fontSize="11">
          {wrap(footerContent(slide, brand), brand?.logo ? 915 : 1015, 11, bodyFamily).map(
            (line, index, lines) => (
              <tspan
                key={index}
                x={brand?.logo ? 160 : 105}
                y={lines.length === 1 ? 703 : 689 + index * 14}
              >
                {line}
              </tspan>
            ),
          )}
        </text>
      )}
      {slideNumber !== undefined && (
        <text
          x="1216"
          y="704"
          textAnchor="end"
          fill={colors.muted}
          fontFamily={bodyFamily}
          fontSize="12"
          letterSpacing="1"
        >
          {String(slideNumber).padStart(2, '0')}
          {totalSlides !== undefined ? ` / ${String(totalSlides).padStart(2, '0')}` : ''}
        </text>
      )}
    </svg>
  )
}

export default SlideCanvas
