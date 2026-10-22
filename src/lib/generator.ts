import type {
  ChartDatum,
  ChartConfig,
  ChartType,
  Deck,
  GenerationOptions,
  IllustrationKind,
  OutlineItem,
  Slide,
  SlideBlock,
  SourcePage,
  ThemeId,
} from '../types'
import {
  ChartInputError,
  parseChartInput,
  parseLegacyChartInput,
  type ParsedChartInput,
} from './chartData'
import { getChartWarnings } from './chartLayout'
import {
  AUDIENCE_LABELS,
  PURPOSE_LABELS,
  createContentBaseline,
  createOutlineBaseline,
  isOutlineEdited,
  normalizeBrief,
  originalOutlineTitle,
  planNarrative,
  suggestedSlideCount,
} from './creation'

/** The first engine is deterministic: it selects source excerpts and layouts, not AI-written facts. */
export const MAX_SOURCE_CHARACTERS = 500_000
export const EXAMPLE_TEXT = `Do conteúdo à apresentação
Uma boa apresentação começa com uma ideia clara. O Zetta organiza seu material em um roteiro visual que você pode revisar, apresentar e continuar editando.

Comece com o que você já sabe
Cole suas anotações ou importe o texto de um PDF. O conteúdo original permanece disponível para consulta. Documentos digitalizados precisam de texto extraível para este primeiro fluxo.

Um roteiro antes do visual
Organize a sequência, ajuste os títulos e escolha o que merece destaque. Cada slide deve ajudar o público a compreender uma mensagem.

Uma identidade que acompanha a ideia
Escolha um tema, defina sua cor e combine textos com imagens ou ilustrações. Composição, respiro e contraste ajudam a tornar o conteúdo legível.

Liberdade para dar seu toque
Revise o texto, substitua imagens, mude as cores e reorganize os slides. O material continua sendo um documento editável.

Pronto para a próxima conversa
Apresente na própria tela ou exporte em PDF. Antes de compartilhar, revise o conteúdo e confira se ele expressa o que você quer dizer.`

export function createId(prefix = 'item'): string {
  const random = globalThis.crypto?.randomUUID?.()
  return `${prefix}-${random ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`}`
}

function assertText(text: string): void {
  if (!text.trim())
    throw new Error('Adicione um texto ou um PDF com texto antes de criar a apresentação.')
  if (text.length > MAX_SOURCE_CHARACTERS)
    throw new Error(
      'O material excede 500 mil caracteres. Divida o documento em partes menores; nenhum trecho foi descartado.',
    )
}

function requestedCount(options: GenerationOptions): number {
  return Math.max(
    3,
    Math.min(20, Number.isFinite(options.slideCount) ? Math.round(options.slideCount) : 8),
  )
}

function normalized(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function splitLongText(text: string, maximum = 1_200): string[] {
  const parts: string[] = []
  let remainder = text.trim()
  while (remainder.length > maximum) {
    const prefix = remainder.slice(0, maximum)
    const sentenceEnd = Math.max(
      prefix.lastIndexOf('. '),
      prefix.lastIndexOf('? '),
      prefix.lastIndexOf('! '),
    )
    const whitespace = Math.max(prefix.lastIndexOf(' '), prefix.lastIndexOf('\n'))
    const end =
      sentenceEnd > maximum / 2 ? sentenceEnd + 1 : whitespace > maximum / 2 ? whitespace : maximum
    parts.push(remainder.slice(0, end).trim())
    remainder = remainder.slice(end).trim()
  }
  if (remainder) parts.push(remainder)
  return parts
}

interface SourceUnit {
  text: string
  pages: number[]
}

function tabularLine(line: string): boolean {
  return /[;|\t]/.test(line) || /,\s*"?(?:[+\-(]?\d|R\$)/.test(line)
}

/** Keep an apparent table intact: splitting it mid-row could chart only part of the supplied data. */
function looksTabular(text: string): boolean {
  const lines = text
    .trim()
    .split(/\r?\n/)
    .filter((line) => line.trim())
  return (
    lines.length >= 2 &&
    ((tabularLine(lines[0]) && tabularLine(lines[1])) ||
      (lines.length >= 3 && tabularLine(lines[1]) && tabularLine(lines[2])))
  )
}

function sourceUnits(text: string, pages?: SourcePage[]): SourceUnit[] {
  const matchedPages =
    pages?.length && normalized(pages.map((page) => page.text).join('\n\n')) === normalized(text)
  const material = matchedPages
    ? pages!.map((page) => ({ text: page.text, pages: [page.page] }))
    : [{ text, pages: [] as number[] }]
  return material.flatMap((source) =>
    source.text
      .split(/\n\s*\n/)
      .filter((part) => part.trim())
      .flatMap((part) =>
        (looksTabular(part) ? [part.trim()] : splitLongText(part)).map((chunk) => ({
          text: chunk,
          pages: source.pages.length
            ? [...source.pages]
            : (pages
                ?.filter((page) => normalized(page.text).includes(normalized(chunk)))
                .map((page) => page.page) ?? []),
        })),
      ),
  )
}

function plainHeading(value: string): string {
  return value
    .replace(/^\s*#{1,6}\s+/, '')
    .replace(/^\s*\d+[.)]\s+/, '')
    .replace(/\*\*/g, '')
    .trim()
}

function titleFor(text: string, index: number): string {
  const rawFirstLine = text.split('\n').find((line) => line.trim()) ?? ''
  const firstLine = plainHeading(rawFirstLine)
  if (
    firstLine.length >= 3 &&
    firstLine.length <= 90 &&
    !/^\s*(?:[-•*]|\d+[.)])\s/.test(rawFirstLine) &&
    !/[;|\t]/.test(firstLine) &&
    !/[:,].*\d/.test(firstLine) &&
    !(firstLine.includes(',') && looksTabular(text))
  )
    return firstLine.replace(/:$/, '')
  const thematic: Array<[RegExp, string]> = [
    [/\b(objetivo|propósito|missão|missao|objetivos)\b/i, 'Objetivos e propósito'],
    [/\b(proposta|escopo|entregas|serviços|servicos)\b/i, 'A proposta em foco'],
    [/\b(resultado|resultados|receita|lucro|custos|vendas)\b/i, 'Resultados e informações'],
    [/\b(etapa|etapas|cronograma|processo|passos)\b/i, 'Etapas e próximos passos'],
    [/\b(cliente|clientes|público|publico|equipe)\b/i, 'Pessoas e contexto'],
    [/\b(desafio|desafios|problema|problemas)\b/i, 'Desafios apresentados'],
  ]
  return thematic.find(([pattern]) => pattern.test(text))?.[1] ?? `Ponto ${index + 1}`
}

/** Outline items are content slides; generateDeck adds one cover and one closing slide. */
export function buildOutline(text: string, options: GenerationOptions): OutlineItem[] {
  assertText(text)
  const { units, requirements } = planNarrative(sourceUnits(text, options.pages), options.brief)
  const pacedCount = suggestedSlideCount(options.brief)
  const count = Math.min(Math.min(requestedCount(options), pacedCount ?? 20) - 2, units.length)
  const groups: SourceUnit[][] = []
  let cursor = 0
  let remainingWeight = units.reduce((sum, unit) => sum + unit.text.length, 0)
  for (let groupIndex = 0; groupIndex < count; groupIndex += 1) {
    const remainingGroups = count - groupIndex
    const desiredWeight = remainingWeight / remainingGroups
    const group: SourceUnit[] = []
    let weight = 0
    do {
      const unit = units[cursor++]
      group.push(unit)
      weight += unit.text.length
      const canTakeAnother = cursor < units.length - (remainingGroups - 1)
      if (!canTakeAnother || (remainingGroups > 1 && weight >= desiredWeight)) break
    } while (cursor < units.length)
    remainingWeight -= weight
    groups.push(group)
  }
  return groups.map((group, index) => {
    const content = group.map((unit) => unit.text).join('\n\n')
    const item: OutlineItem = {
      id: createId('outline'),
      title: titleFor(content, index),
      content,
      sourcePages: [...new Set(group.flatMap((unit) => unit.pages))].sort((a, b) => a - b),
    }
    item.origin = {
      kind: 'source',
      sourceName:
        options.sourceName ?? (options.sourceKind === 'pdf' ? 'Documento PDF' : 'Texto informado'),
      sourceKind: options.sourceKind ?? 'text',
      excerpt: content,
      pages: [...item.sourcePages],
      baseline: createOutlineBaseline(item),
    }
    if (index === groups.length - 1 && requirements.length) item.requirements = requirements
    return item
  })
}

export function getGenerationWarnings(
  text: string,
  outline: OutlineItem[],
  options: GenerationOptions,
): string[] {
  const warnings = [
    'O modo por regras seleciona trechos do material; ele não pesquisa nem acrescenta fatos. O texto integral permanece na fonte e nas notas dos tópicos.',
  ]
  if (options.brief) {
    const brief = normalizeBrief(options.brief)
    warnings.push(
      `Roteiro orientado para ${PURPOSE_LABELS[brief.purpose].toLocaleLowerCase('pt-BR')} e ${AUDIENCE_LABELS[brief.audience].toLocaleLowerCase('pt-BR')}. A ordem usa palavras dos títulos; confira se ela representa sua intenção. Perguntas pendentes são sugestões editoriais, não fatos do material.`,
    )
    if (brief.durationMinutes !== undefined)
      warnings.push(
        `Duração pretendida: ${brief.durationMinutes} min. A divisão usa até um tópico por minuto, mais capa e encerramento, limitada ao pedido de slides. É uma referência de ritmo; a duração real depende da apresentação e precisa ser ensaiada.`,
      )
  }
  if (outline.some((item) => item.requirements?.length))
    warnings.push(
      'Há perguntas a resolver no roteiro. Elas ficam separadas do conteúdo e permanecem disponíveis nas notas e no painel de origem.',
    )
  const desired = requestedCount(options)
  const actual = outline.length + 2
  const pacingLimit = suggestedSlideCount(options.brief)
  if (desired !== options.slideCount)
    warnings.push(
      `O pedido foi ajustado para ${desired} slides: o intervalo inicial é de 3 a 20, incluindo capa e encerramento.`,
    )
  if (actual !== desired)
    warnings.push(
      actual < desired
        ? pacingLimit !== undefined && pacingLimit < desired && actual === pacingLimit
          ? `Para o ritmo pretendido, o material foi reunido em ${outline.length} tópicos. Serão ${actual} slides, incluindo capa e encerramento, em vez dos ${desired} pedidos. O conteúdo integral continua na fonte e nas notas.`
          : `O material tem ${outline.length} tópicos nesta divisão. Serão ${actual} slides, incluindo capa e encerramento, para evitar repetir conteúdo apenas para preencher o pedido de ${desired}.`
        : `O roteiro revisado tem ${outline.length} tópicos. Serão ${actual} slides, incluindo capa e encerramento, em vez dos ${desired} pedidos inicialmente.`,
    )
  if (options.pages?.some((page) => !page.text.trim()))
    warnings.push(
      'Algumas páginas do PDF não têm texto extraível. Elas permanecem identificadas na fonte; confira o arquivo original antes de apresentar.',
    )
  if (
    options.pages?.length &&
    normalized(options.pages.map((page) => page.text).join('\n\n')) !== normalized(text)
  )
    warnings.push(
      'O texto foi alterado após a leitura do PDF. Referências de página só são mantidas para trechos que ainda correspondem ao material extraído.',
    )
  if (outline.some((item) => item.content.length > 2_000))
    warnings.push(
      'Há tópicos extensos: o slide mostrará um trecho selecionado. Revise a síntese ou divida o tópico; o conteúdo completo está nas notas.',
    )
  if (
    outline.some((item) => {
      const { table, categoryLimit } = chartTableForGeneration(contentWithoutHeading(item))
      return categoryLimit || (table && table.data.length >= 2 && !chartFitsDefaultLayout(table))
    })
  )
    warnings.push(
      'Há tabelas com muitas categorias, rótulos longos ou valores largos. Elas serão exibidas como trechos de texto para manter a leitura. Divida os dados em mais tópicos para gerar gráficos; a tabela completa permanece nas notas e na fonte.',
    )
  const title = titleOfDeck(text, options)
  if (
    displayTitle(title, options.composition === 'rich' ? 80 : 120) !== title ||
    outline.some((item) => displayTitle(item.title, 96) !== item.title.trim())
  )
    warnings.push(
      'Títulos extensos serão abreviados na composição. Os títulos completos permanecem nas notas e no nome da apresentação.',
    )
  if (
    options.pages?.length &&
    outline.some((item) => item.sourcePages.length && !verifiedSourcePages(item, options).length)
  )
    warnings.push(
      'Há tópicos revisados que já não correspondem integralmente ao texto das páginas indicadas. A referência de página desses tópicos será removida; o PDF extraído permanece salvo na fonte.',
    )
  return warnings
}

function excerpt(text: string, maximum: number): string {
  const clean = text
    .replace(/\*\*/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .trim()
  if (clean.length <= maximum) return clean
  const prefix = clean.slice(0, maximum - 1)
  const sentenceEnd = Math.max(
    prefix.lastIndexOf('. '),
    prefix.lastIndexOf('? '),
    prefix.lastIndexOf('! '),
  )
  const whitespace = prefix.lastIndexOf(' ')
  const end =
    sentenceEnd > maximum * 0.45 ? sentenceEnd + 1 : whitespace > 0 ? whitespace : prefix.length
  return `${prefix.slice(0, end).trimEnd()}…`
}

/** Bound the visible title independently of the complete, editable source title. */
function displayTitle(title: string, maximum: number): string {
  const lines = title
    .trim()
    .split(/\r?\n/)
    .filter((line) => line.trim())
  const readable =
    lines.length <= 2
      ? lines.map((line) => line.trim().replace(/[^\S\n]+/g, ' ')).join('\n')
      : normalized(title)
  return excerpt(readable, maximum)
}

function visibleBullets(lines: string[], options: GenerationOptions): string {
  const maximumItems = { short: 3, balanced: 5, detailed: 6 }[options.density]
  const perItem = options.composition === 'rich' ? 60 : 100
  const selected = lines
    .slice(0, maximumItems)
    .map((line) => excerpt(line.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, ''), perItem))
  if (lines.length > selected.length && selected.length && !selected.at(-1)!.endsWith('…'))
    selected[selected.length - 1] += '…'
  return selected.join('\n')
}

function chartTableForGeneration(text: string): {
  table: ParsedChartInput | null
  categoryLimit: boolean
} {
  try {
    return { table: parseChartInput(text), categoryLimit: false }
  } catch (error) {
    // Legacy syntax (including label:value) is retained, but generation still applies the 12-category limit.
    return {
      table: /:\s*(?:R\$\s*)?[+(−-]?\d/.test(text) ? parseLegacyChartInput(text) : null,
      categoryLimit: error instanceof ChartInputError && error.code === 'category-limit',
    }
  }
}

function temporalPosition(label: string): { kind: string; value: number } | null {
  const month = label.trim().toLocaleLowerCase('pt-BR').replace(/\.$/, '')
  const months = [
    'jan|janeiro|january',
    'fev|fevereiro|feb|february',
    'mar|março|marco|march',
    'abr|abril|apr|april',
    'mai|maio|may',
    'jun|junho|june',
    'jul|julho|july',
    'ago|agosto|aug|august',
    'set|setembro|sep|sept|september',
    'out|outubro|oct|october',
    'nov|novembro|november',
    'dez|dezembro|dec|december',
  ]
  const index = months.findIndex((names) => names.split('|').includes(month))
  if (index >= 0) return { kind: 'month', value: index }
  const iso = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(month)
  const brazilian = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(month)
  if (!iso && !brazilian) return null
  const year = Number(iso?.[1] ?? brazilian![3])
  const monthNumber = Number(iso?.[2] ?? brazilian![2])
  const day = Number(iso ? (iso[3] ?? 1) : brazilian![1])
  const date = new Date(Date.UTC(year, monthNumber - 1, day))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== monthNumber - 1 ||
    date.getUTCDate() !== day
  )
    return null
  return { kind: 'date', value: date.getTime() }
}

/** Source order is never changed: lines require strictly increasing explicit months/dates. */
function inferredChartType(table: ParsedChartInput): ChartType {
  const positions = table.data.map((datum) => temporalPosition(datum.label))
  if (
    positions.length > 1 &&
    positions.every(
      (position, index) =>
        position &&
        position.kind === positions[0]?.kind &&
        (index === 0 || position.value > positions[index - 1]!.value),
    )
  )
    return 'line'
  // Horizontal bars make category labels over 22 characters easier to read; the renderer checks the final fit.
  return table.data.some((datum) => Array.from(datum.label).length > 22) ? 'horizontalBar' : 'bar'
}

function chartConfig(table: ParsedChartInput): ChartConfig {
  return {
    ...table,
    type: inferredChartType(table),
    source: '',
    showValues: !table.additionalSeries?.length,
  }
}

/** Reuse the actual renderer checks within a conservative full-width chart area. */
function chartFitsDefaultLayout(table: ParsedChartInput): boolean {
  if (table.data.length < 2 || table.data.length > 12) return false
  return getChartWarnings(chartConfig(table), 900, 300).length === 0
}

function illustration(index: number): SlideBlock {
  const kinds: IllustrationKind[] = ['orbit', 'layers', 'waves', 'grid', 'growth']
  return {
    id: createId('block'),
    type: 'image',
    content: '',
    image: {
      alt: 'Ilustração abstrata decorativa criada por código; não representa dados.',
      illustration: kinds[index % kinds.length],
      fit: 'cover',
      position: 50,
      seed: index + 1,
    },
  }
}

function titleOfDeck(text: string, options: GenerationOptions): string {
  if (options.title?.trim()) {
    if (options.title.trim().length > 240)
      throw new Error('O título deve ter até 240 caracteres. Ajuste-o antes de gerar.')
    return options.title.trim()
  }
  const firstLine = plainHeading(text.split('\n').find((line) => line.trim()) ?? '')
  if (looksTabular(text) && (tabularLine(firstLine) || firstLine.includes(',')))
    return 'Dados para apresentar'
  return firstLine.length <= 120 ? firstLine : 'Uma ideia para apresentar'
}

function contentWithoutHeading(item: OutlineItem): string {
  const lines = item.content.trim().split('\n')
  const first = lines[0] ?? ''
  return !/^\s*(?:[-*•]|\d+[.)])\s/.test(first) &&
    !tabularLine(first) &&
    !(first.includes(',') && looksTabular(item.content)) &&
    plainHeading(first) === item.title &&
    lines.length > 1
    ? lines.slice(1).join('\n').trim()
    : item.content.trim()
}

function sourceNotes(item: OutlineItem): string {
  const pages = item.sourcePages.length
    ? `\nPáginas de origem: ${item.sourcePages.join(', ')}.\n`
    : '\n'
  const questions = item.requirements?.length
    ? `\n\nPerguntas editoriais pendentes (não são fatos da fonte):\n${item.requirements.map((question) => `• ${question}`).join('\n')}`
    : ''
  return `Título completo do tópico: ${item.title}\n\nTrecho integral deste tópico. O conteúdo visível é uma seleção por regras, não uma verificação dos fatos.${pages}\n${item.content}${questions}`
}

function verifiedSourcePages(item: OutlineItem, options: GenerationOptions): number[] {
  if (!options.pages?.length || !item.sourcePages.length) return []
  const pages = [...new Set(item.sourcePages)].sort((a, b) => a - b)
  if (pages.some((page) => !options.pages!.some((source) => source.page === page))) return []
  const original = pages
    .map((page) => options.pages!.find((source) => source.page === page)?.text ?? '')
    .join('\n\n')
  if (normalized(original).includes(normalized(item.content))) return pages
  // A narrative can reorder intact paragraphs from the same pages. Never grant refs to edited text.
  if (isOutlineEdited(item) === false && item.origin?.excerpt === item.content) {
    const chunks = item.content.split(/\n\s*\n/).filter((chunk) => chunk.trim())
    if (chunks.every((chunk) => normalized(original).includes(normalized(chunk)))) return pages
  }
  return []
}

function contentSlide(item: OutlineItem, index: number, options: GenerationOptions): Slide {
  const limit = { short: 220, balanced: 390, detailed: 480 }[options.density]
  const rich = options.composition === 'rich'
  const body = contentWithoutHeading(item)
  const { table } = chartTableForGeneration(body)
  const isChart = Boolean(table && chartFitsDefaultLayout(table))
  const pages = verifiedSourcePages(item, options)
  const bulletLines = body.split('\n').filter((line) => /^\s*(?:[-*•]|\d+[.)])\s+/.test(line))
  const isBullets =
    bulletLines.length >= 2 &&
    bulletLines.length === body.split('\n').filter((line) => line.trim()).length
  const blocks: SlideBlock[] = isChart
    ? [
        {
          id: createId('block'),
          type: 'chart',
          content: '',
          chart: {
            ...chartConfig(table!),
            source: pages.length
              ? `Material informado · p. ${pages.join(', ')}`
              : 'Dados informados no material de origem',
          },
        },
      ]
    : [
        {
          id: createId('block'),
          type: isBullets ? 'bullets' : 'text',
          content: isBullets
            ? visibleBullets(bulletLines, options)
            : excerpt(normalized(body), limit),
        },
        ...(rich ? [illustration(index + 1)] : []),
      ]
  return {
    id: createId('slide'),
    title: displayTitle(item.title, 96),
    eyebrow: isChart ? 'Dados do material de origem' : 'Trecho selecionado · íntegra nas notas',
    layout: isChart ? 'chart' : rich ? 'split' : isBullets ? 'bullets' : 'section',
    blocks,
    notes: sourceNotes({ ...item, sourcePages: pages }),
    sourcePages: pages,
    ...(item.requirements?.length ? { requirements: [...item.requirements] } : {}),
  }
}

export function generateDeck(
  text: string,
  outline: OutlineItem[],
  options: GenerationOptions,
): Deck {
  assertText(text)
  if (!outline.length) throw new Error('Adicione pelo menos um tópico ao roteiro.')
  if (outline.length > 48)
    throw new Error(
      'O roteiro excede 48 tópicos. O máximo é de 50 slides com capa e encerramento; nenhum tópico foi descartado.',
    )
  if (outline.some((item) => !item.title.trim() || !item.content.trim()))
    throw new Error(
      'Cada tópico precisa de título e conteúdo. Preencha os tópicos vazios antes de gerar.',
    )
  if (
    outline.some((item) => item.title.length > 240 || item.content.length > MAX_SOURCE_CHARACTERS)
  )
    throw new Error(
      'Há um tópico acima do limite de tamanho. Divida-o antes de gerar; nenhum trecho foi descartado.',
    )
  const now = new Date().toISOString()
  const title = titleOfDeck(text, options)
  const rich = options.composition === 'rich'
  const warnings = getGenerationWarnings(text, outline, options)
  const slides: Slide[] = [
    {
      id: createId('slide'),
      title: displayTitle(title, rich ? 80 : 120),
      eyebrow:
        options.sourceKind === 'example'
          ? 'Um exemplo feito no Zetta'
          : 'Apresentação criada no Zetta',
      layout: 'cover',
      blocks: [
        {
          id: createId('block'),
          type: 'text',
          content: `${outline.length} ${outline.length === 1 ? 'tópico para explorar' : 'tópicos para explorar'}`,
        },
        ...(rich ? [illustration(0)] : []),
      ],
      notes: `Título completo da apresentação: ${title}\n\nComposição por regras.\n\n${warnings.join('\n\n')}\n\nMaterial de origem: ${options.sourceName ?? 'Texto informado'}. O material integral está salvo na fonte da apresentação.`,
      sourcePages: [],
    },
  ]
  outline.forEach((item, index) => {
    const slide = contentSlide(item, index, options)
    const belongsToSource = normalized(text).includes(normalized(item.content))
    slide.origin = item.origin
      ? structuredClone(item.origin)
      : {
          kind: belongsToSource ? 'source' : 'manual',
          sourceName: belongsToSource
            ? (options.sourceName ?? 'Texto informado')
            : 'Adicionado ao roteiro',
          sourceKind: belongsToSource ? (options.sourceKind ?? 'text') : 'manual',
          excerpt: item.content,
          pages: [...slide.sourcePages],
        }
    const originalTitle = originalOutlineTitle(item)
    if (originalTitle !== null && isOutlineEdited(item) === true) {
      const originalItem = {
        ...item,
        title: originalTitle,
        content: item.origin!.excerpt,
        sourcePages: [...item.origin!.pages],
      }
      slide.origin.baseline = createContentBaseline(contentSlide(originalItem, index, options))
    } else {
      slide.origin.baseline = createContentBaseline(slide)
    }
    slides.push(slide)
  })
  slides.push({
    id: createId('slide'),
    title: 'Vamos continuar\nessa conversa?',
    eyebrow: 'Encerramento',
    layout: 'closing',
    blocks: [
      {
        id: createId('block'),
        type: 'text',
        content: 'Retome os pontos principais e defina o próximo passo com o seu público.',
      },
    ],
    notes:
      'Texto editorial de encerramento sugerido pelo Zetta. Personalize a chamada final; ela não foi extraída do material de origem.',
    sourcePages: [],
  })
  for (const slide of [slides[0], slides.at(-1)!]) {
    slide.origin = {
      kind: 'editorial',
      sourceName: 'Composição editorial do Zetta',
      sourceKind: 'manual',
      excerpt: slide.notes,
      pages: [],
      baseline: createContentBaseline(slide),
    }
  }
  return {
    schemaVersion: 1,
    id: createId('deck'),
    title,
    createdAt: now,
    updatedAt: now,
    themeId: options.themeId,
    accent: options.accent,
    slides,
    source: {
      text,
      name:
        options.sourceName ?? (options.sourceKind === 'pdf' ? 'Documento PDF' : 'Texto informado'),
      kind: options.sourceKind ?? 'text',
      ...(options.pages ? { pages: options.pages.map((page) => ({ ...page })) } : {}),
    },
    settings: {
      density: options.density,
      composition: options.composition,
      ...(options.brief ? { brief: normalizeBrief(options.brief) } : {}),
    },
  }
}

export function createBlankSlide(): Slide {
  const slide: Slide = {
    id: createId('slide'),
    title: 'Novo slide',
    eyebrow: '',
    layout: 'section',
    blocks: [{ id: createId('block'), type: 'text', content: '' }],
    notes: '',
    sourcePages: [],
  }
  slide.origin = {
    kind: 'manual',
    sourceName: 'Criado no editor',
    sourceKind: 'manual',
    excerpt: '',
    pages: [],
    baseline: createContentBaseline(slide),
  }
  return slide
}

export function createExampleDeck(themeId: ThemeId = 'minimal'): Deck {
  const options: GenerationOptions = {
    title: 'Boas ideias merecem\numa grande apresentação.',
    slideCount: 8,
    themeId,
    accent: '#2563EB',
    density: 'balanced',
    composition: 'rich',
    sourceName: 'Conheça o Zetta — exemplo',
    sourceKind: 'example',
  }
  return generateDeck(EXAMPLE_TEXT, buildOutline(EXAMPLE_TEXT, options), options)
}

/** Backward-compatible reader: strict two-column PT-BR input, up to 50 categories. */
export function parseChartData(text: string): ChartDatum[] {
  return parseLegacyChartInput(text)?.data ?? []
}
