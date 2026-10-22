import type { Layout, Slide, SlideBlock } from '../types'
import { createContentBaseline, isContentEdited } from './creation'

export type CompositionAction =
  | { type: 'split' }
  | { type: 'layout'; layout: Layout }
  | { type: 'focus-chart'; blockId: string }
  | { type: 'compare' }
  | { type: 'emphasize'; blockId: string }

export type CompositionResult =
  | { ok: true; label: string; description: string; slides: Slide[] }
  | { ok: false; reason: string }

export interface CompositionContext {
  slideCount: number
  makeId: () => string
}

const textTypes = new Set(['text', 'bullets', 'callout'])

function canSplitText(block: SlideBlock): boolean {
  return textTypes.has(block.type) && block.content.trim().length >= 80
}

/** Split at an existing boundary. Concatenating the two parts must reproduce every character. */
function divideText(block: SlideBlock): [string, string] | null {
  if (!canSplitText(block)) return null
  const text = block.content
  const midpoint = text.length / 2
  const minimum = Math.max(20, text.length * 0.2)
  const maximum = text.length - minimum
  const boundaries: number[] = []
  const pattern = block.type === 'bullets' ? /\r?\n/g : /\n\s*\n|[.!?](?:\s+)|\s+/g
  for (const match of text.matchAll(pattern)) {
    const position = match.index! + match[0].length
    if (position >= minimum && position <= maximum) boundaries.push(position)
  }
  const boundary = boundaries.sort((a, b) => Math.abs(a - midpoint) - Math.abs(b - midpoint))[0]
  return boundary === undefined ? null : [text.slice(0, boundary), text.slice(boundary)]
}

function layoutFor(blocks: SlideBlock[], fallback: Layout): Layout {
  if (blocks.length === 1) {
    if (blocks[0].type === 'chart') return 'chart'
    if (blocks[0].type === 'bullets') return 'bullets'
    return 'section'
  }
  return fallback === 'cover' || fallback === 'closing' || fallback === 'quote' ? 'split' : fallback
}

function refreshPreservedBaseline(original: Slide, slides: Slide[]): void {
  // A known lossless rearrangement may establish a baseline per part. Never erase prior edits.
  if (isContentEdited(original) !== false) return
  for (const slide of slides) if (slide.origin) slide.origin.baseline = createContentBaseline(slide)
}

function unavailable(reason: string): CompositionResult {
  return { ok: false, reason }
}

/** Cheap eligibility check for menus: it never clones embedded images or generates preview IDs. */
export function compositionUnavailableReason(
  slide: Slide,
  action: CompositionAction,
  context: Pick<CompositionContext, 'slideCount'>,
): string | null {
  if (action.type === 'layout') {
    if (slide.layout === action.layout) return 'Este já é o modelo atual do slide.'
    if (action.layout === 'columns' && slide.blocks.length < 2)
      return 'A composição em colunas precisa de pelo menos dois blocos. Nenhum conteúdo será criado para preencher a segunda coluna.'
    if (action.layout === 'chart' && !slide.blocks.some((block) => block.type === 'chart'))
      return 'Adicione um gráfico antes de escolher o modelo de dados.'
    if (
      action.layout === 'quote' &&
      (slide.blocks.length !== 1 || !textTypes.has(slide.blocks[0].type))
    )
      return 'O modelo de destaque requer um único bloco de texto. Divida os outros objetos antes de aplicá-lo.'
    return null
  }
  if (action.type === 'compare') {
    if (slide.blocks.length !== 2 || slide.blocks.some((block) => !textTypes.has(block.type)))
      return 'A comparação exige exatamente dois blocos de texto, lista ou destaque. Crie os dois lados com conteúdo fornecido por você.'
    return slide.layout === 'columns' ? 'Os dois blocos já estão lado a lado.' : null
  }
  if (action.type === 'emphasize') {
    const block = slide.blocks.find((item) => item.id === action.blockId)
    if (!block || !textTypes.has(block.type)) return 'Escolha um bloco de texto, lista ou destaque.'
    return block.type === 'callout' && block.style?.bold ? 'Este bloco já está destacado.' : null
  }
  if (action.type === 'focus-chart') {
    const block = slide.blocks.find((item) => item.id === action.blockId)
    if (!block || block.type !== 'chart' || !block.chart)
      return 'Escolha um gráfico existente para ampliar.'
    if (slide.blocks.length === 1)
      return slide.layout === 'chart' ? 'O gráfico já ocupa um slide exclusivo.' : null
  } else {
    if (!slide.blocks.length) return 'Adicione conteúdo ao slide antes de dividi-lo.'
    if (slide.blocks.length === 1 && !divideText(slide.blocks[0]))
      return slide.blocks[0].type === 'chart' || slide.blocks[0].type === 'diagram'
        ? 'Um gráfico ou diagrama único é mantido inteiro. Dividi-lo exige escolher explicitamente quais dados pertencem a cada parte.'
        : 'Este bloco não tem um limite de texto adequado para divisão. Adicione outro bloco ou separe o conteúdo manualmente.'
  }
  return context.slideCount >= 50
    ? 'A apresentação já atingiu o limite de 50 slides. Remova um slide antes de dividir.'
    : null
}

/** Pure preview plan. It never mutates input, summarizes text, or slices chart/diagram datasets. */
export function planComposition(
  slide: Slide,
  action: CompositionAction,
  context: CompositionContext,
): CompositionResult {
  const reason = compositionUnavailableReason(slide, action, context)
  if (reason) return unavailable(reason)
  const copy = structuredClone(slide)
  const finish = (label: string, description: string, slides: Slide[]): CompositionResult => {
    if (context.slideCount - 1 + slides.length > 50)
      return unavailable(
        'A apresentação já atingiu o limite de 50 slides. Remova um slide antes de dividir.',
      )
    refreshPreservedBaseline(slide, slides)
    return { ok: true, label, description, slides }
  }

  if (action.type === 'layout') {
    copy.layout = action.layout
    return finish(
      'Trocar composição',
      'Todos os blocos, textos e dados são mantidos. Confira a leitura no preview.',
      [copy],
    )
  }

  if (action.type === 'compare') {
    copy.layout = 'columns'
    return finish(
      'Comparar lado a lado',
      'Os dois blocos são colocados em colunas na ordem atual, sem reescrever seu conteúdo.',
      [copy],
    )
  }

  if (action.type === 'emphasize') {
    const block = copy.blocks.find((item) => item.id === action.blockId)!
    block.type = 'callout'
    block.style = { ...block.style, bold: true }
    if (copy.blocks.length === 1) copy.layout = 'quote'
    return finish(
      'Destacar texto',
      'O texto completo ganha destaque visual; nenhuma frase é resumida ou acrescentada.',
      [copy],
    )
  }

  if (action.type === 'focus-chart') {
    const block = copy.blocks.find((item) => item.id === action.blockId)!
    const remaining = copy.blocks.filter((item) => item.id !== block.id)
    if (!remaining.length) {
      copy.layout = 'chart'
      return finish('Ampliar gráfico', 'O gráfico conserva suas categorias, séries e valores.', [
        copy,
      ])
    }
    const next = {
      ...structuredClone(copy),
      id: context.makeId(),
      blocks: remaining,
      layout: layoutFor(remaining, slide.layout),
    }
    copy.blocks = [block]
    copy.layout = 'chart'
    return finish(
      'Ampliar gráfico em um slide',
      'O gráfico fica no primeiro slide. Todos os outros blocos seguem em um slide de continuação; as notas e a origem acompanham as duas partes.',
      [copy, next],
    )
  }

  if (!copy.blocks.length) return unavailable('Adicione conteúdo ao slide antes de dividi-lo.')
  // A dominant long text must be divided itself; moving only its decorative image would not help.
  const splittable = copy.blocks
    .map((block, index) => ({ block, index, parts: divideText(block) }))
    .filter((entry): entry is typeof entry & { parts: [string, string] } => entry.parts !== null)
    .sort((a, b) => b.block.content.length - a.block.content.length)
  const dominant =
    splittable.find(({ block }) => block.content.length >= 500) ??
    (copy.blocks.length === 1 ? splittable[0] : undefined)
  let first: SlideBlock[]
  let second: SlideBlock[]
  if (dominant) {
    const left = { ...structuredClone(dominant.block), content: dominant.parts[0] }
    const right = {
      ...structuredClone(dominant.block),
      id: context.makeId(),
      content: dominant.parts[1],
    }
    first = [...copy.blocks.slice(0, dominant.index), left]
    second = [right, ...copy.blocks.slice(dominant.index + 1)]
  } else if (copy.blocks.length >= 2) {
    const middle = Math.ceil(copy.blocks.length / 2)
    first = copy.blocks.slice(0, middle)
    second = copy.blocks.slice(middle)
  } else {
    return unavailable(
      copy.blocks[0].type === 'chart' || copy.blocks[0].type === 'diagram'
        ? 'Um gráfico ou diagrama único é mantido inteiro. Dividi-lo exige escolher explicitamente quais dados pertencem a cada parte.'
        : 'Este bloco não tem um limite de texto adequado para divisão. Adicione outro bloco ou separe o conteúdo manualmente.',
    )
  }
  const next: Slide = {
    ...structuredClone(copy),
    id: context.makeId(),
    blocks: second,
    layout: layoutFor(second, slide.layout),
  }
  copy.blocks = first
  copy.layout = layoutFor(first, slide.layout)
  return finish(
    'Dividir em dois slides',
    'O conteúdo é distribuído em duas partes sem cortes. As notas, referências e identidade visual são preservadas. Textos muito extensos podem precisar de novas divisões.',
    [copy, next],
  )
}
