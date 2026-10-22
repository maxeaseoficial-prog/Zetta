import type { DiagramConfig, DiagramItem } from '../types'

export interface DiagramText {
  lines: string[]
  size: number
  lineHeight: number
  x: number
  y: number
  width: number
  weight: 400 | 700
  kind: 'label' | 'title' | 'value' | 'description' | 'source' | 'heading'
}
export interface DiagramCard {
  item: DiagramItem
  index: number
  x: number
  y: number
  w: number
  h: number
  texts: DiagramText[]
}
export interface DiagramPlan {
  cards: DiagramCard[]
  heading: DiagramText | null
  source: DiagramText | null
  warnings: string[]
  columns: number
}

let context: CanvasRenderingContext2D | null | undefined

function measure(text: string, size: number, family: string, weight: number): number {
  if (context === undefined && typeof document !== 'undefined')
    context = document.createElement('canvas').getContext('2d')
  if (context) {
    context.font = `${weight} ${size}px ${family}`
    return context.measureText(text).width
  }
  return (
    Array.from(text).reduce(
      (sum, character) =>
        sum +
        (/\s/.test(character)
          ? 0.28
          : /[ilI.,:;!'|]/.test(character)
            ? 0.27
            : /[MW@%]/.test(character)
              ? 0.88
              : 0.55),
      0,
    ) * size
  )
}

/** All characters and paragraph breaks remain represented; there is no ellipsis. */
export function wrapDiagramText(
  text: string,
  width: number,
  size: number,
  family: string,
  weight = 400,
): string[] {
  const lines: string[] = []
  for (const paragraph of text.replace(/\r\n?/g, '\n').split('\n')) {
    if (!paragraph.trim()) {
      lines.push('')
      continue
    }
    let line = ''
    for (const word of paragraph.trim().split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word
      if (measure(candidate, size, family, weight) <= Math.max(10, width)) {
        line = candidate
        continue
      }
      if (line) lines.push(line)
      line = ''
      for (const character of Array.from(word)) {
        if (line && measure(line + character, size, family, weight) > Math.max(10, width)) {
          lines.push(line)
          line = ''
        }
        line += character
      }
    }
    if (line) lines.push(line)
  }
  return lines
}

export function buildDiagramLayout(
  diagram: DiagramConfig,
  width: number,
  height: number,
  family = 'Arial, sans-serif',
  title = '',
): DiagramPlan {
  const warnings: string[] = []
  const padding = 20
  const text = (
    content: string,
    x: number,
    y: number,
    w: number,
    size: number,
    weight: 400 | 700,
    kind: DiagramText['kind'],
  ): DiagramText => ({
    lines: wrapDiagramText(content, w, size, family, weight),
    size,
    lineHeight: size * 1.28,
    x,
    y,
    width: w,
    weight,
    kind,
  })
  const heading = title
    ? text(title, padding, padding, width - padding * 2, 19, 700, 'heading')
    : null
  const source = diagram.source
    ? text(`Fonte: ${diagram.source}`, padding, 0, width - padding * 2, 12, 400, 'source')
    : null
  const headingH = heading ? heading.lines.length * heading.lineHeight + 16 : 0
  const sourceH = source ? source.lines.length * source.lineHeight + 14 : 0
  const top = padding + headingH
  const availableH = height - top - padding - sourceH
  if (source) source.y = height - padding - source.lines.length * source.lineHeight
  if (heading && heading.lines.length > 2)
    warnings.push('O título do diagrama ocupa muitas linhas. Amplie o bloco ou encurte o título.')
  if (source && source.lines.length > 2)
    warnings.push(
      'A fonte do diagrama ocupa muitas linhas. Amplie o bloco ou simplifique a referência.',
    )
  const count = diagram.items.length
  if (!count) warnings.push('Adicione pelo menos um item ao diagrama.')
  if (count > 6) warnings.push('O diagrama tem mais de seis itens. Divida-o em mais slides.')
  if (diagram.type === 'comparison' && count !== 2)
    warnings.push('A comparação precisa de dois itens. Reorganize os itens em dois lados.')
  if (diagram.type === 'metrics' && count > 4)
    warnings.push('Use até quatro indicadores por bloco. Divida os demais em outro slide.')
  if (width < 280 || availableH < 110)
    warnings.push('O diagrama precisa de mais espaço. Escolha um layout maior ou divida o slide.')

  let columns: number
  if (diagram.type === 'comparison') columns = 2
  else if (diagram.type === 'metrics')
    columns = width >= 850 ? Math.min(4, count) : Math.min(2, count)
  else if (width >= 950) columns = count <= 4 ? count : 3
  else columns = width >= 560 ? Math.min(2, count) : 1
  columns = Math.max(1, columns)
  const rows = Math.max(1, Math.ceil(count / columns))
  const gap = 18
  const cardWidth = (width - padding * 2 - gap * (columns - 1)) / columns
  const cardHeight = (availableH - gap * (rows - 1)) / rows
  const cards = diagram.items.map((item, index): DiagramCard => {
    const x = padding + (index % columns) * (cardWidth + gap)
    const y = top + Math.floor(index / columns) * (cardHeight + gap)
    const inset = cardWidth >= 210 ? 18 : 14
    const contentWidth = Math.max(15, cardWidth - inset * 2)
    const hasMarker = diagram.type === 'process' || diagram.type === 'timeline'
    const texts: DiagramText[] = []
    let cursor = y + inset + (hasMarker ? 42 : 0)
    const push = (
      content: string | undefined,
      size: number,
      weight: 400 | 700,
      kind: DiagramText['kind'],
      after = 8,
    ) => {
      if (!content) return
      const field = text(content, x + inset, cursor, contentWidth, size, weight, kind)
      texts.push(field)
      cursor += field.lines.length * field.lineHeight + after
    }
    push(item.label, 13, 700, 'label')
    if (diagram.type === 'metrics') push(item.value, cardWidth >= 235 ? 38 : 30, 700, 'value', 12)
    push(item.title, cardWidth >= 235 ? 22 : 19, 700, 'title', 10)
    if (diagram.type !== 'metrics') push(item.value, 23, 700, 'value', 10)
    push(item.description, 16, 400, 'description', 0)
    if (!item.title.trim() && !item.value?.trim())
      warnings.push(`O item ${index + 1} precisa de título ou valor.`)
    if (cursor > y + cardHeight - inset + 0.5)
      warnings.push(
        `O item ${index + 1} do diagrama não cabe. Amplie o bloco, reorganize ou divida os itens.`,
      )
    return { item, index, x, y, w: cardWidth, h: cardHeight, texts }
  })
  return { cards, heading, source, warnings: [...new Set(warnings)], columns }
}

export function getDiagramWarnings(
  diagram: DiagramConfig,
  width: number,
  height: number,
  family = 'Arial, sans-serif',
  title = '',
): string[] {
  return buildDiagramLayout(diagram, width, height, family, title).warnings
}
