import type { GenerationOptions, OutlineItem, PresentationBrief, Slide, SourcePage } from '../types'
export interface CreationInput {
  text: string
  sourceName: string
  sourceKind: 'text' | 'pdf'
  pages?: SourcePage[]
  warnings: string[]
  options: GenerationOptions
}

export const DEFAULT_BRIEF: PresentationBrief = { purpose: 'general', audience: 'general' }
export const PURPOSE_LABELS: Record<PresentationBrief['purpose'], string> = {
  general: 'Apresentação geral',
  proposal: 'Proposta',
  report: 'Relatório de resultados',
  lesson: 'Aula ou treinamento',
  institutional: 'Apresentação institucional',
}
export const AUDIENCE_LABELS: Record<PresentationBrief['audience'], string> = {
  general: 'Público geral',
  'decision-makers': 'Pessoas que tomarão uma decisão',
  technical: 'Público técnico',
  students: 'Estudantes ou participantes de um treinamento',
}

export function normalizeBrief(brief?: PresentationBrief): PresentationBrief {
  const value = brief ?? DEFAULT_BRIEF
  if (
    !Object.hasOwn(PURPOSE_LABELS, value.purpose) ||
    !Object.hasOwn(AUDIENCE_LABELS, value.audience)
  )
    throw new Error('Escolha um objetivo e um público válidos para o roteiro.')
  if (
    value.durationMinutes !== undefined &&
    (!Number.isInteger(value.durationMinutes) ||
      value.durationMinutes < 1 ||
      value.durationMinutes > 180)
  )
    throw new Error('A duração deve ser um número inteiro entre 1 e 180 minutos.')
  return { ...value }
}

/** A pacing suggestion, not a claim about actual speaking time. */
export function suggestedSlideCount(brief?: PresentationBrief): number | undefined {
  const { durationMinutes } = normalizeBrief(brief)
  return durationMinutes === undefined ? undefined : Math.max(3, Math.min(20, durationMinutes + 2))
}

/** Compact change fingerprint. It is deliberately not a signature or a fact-check. */
function fingerprint(value: unknown): string {
  const input = JSON.stringify(value)
  let first = 2166136261
  let second = 5381
  for (let index = 0; index < input.length; index += 1) {
    const code = input.charCodeAt(index)
    first = Math.imul(first ^ code, 16777619)
    second = Math.imul(second, 33) ^ code
  }
  return `${input.length.toString(36)}-${(first >>> 0).toString(36)}-${(second >>> 0).toString(36)}`
}

/** IDs, layout, colors, typography, chart presentation and image bytes/crops are visual metadata. */
export function createContentBaseline(slide: Slide): string {
  return `content-v1:${fingerprint({
    title: slide.title,
    eyebrow: slide.eyebrow,
    notes: slide.notes,
    blocks: slide.blocks.map((block) => ({
      kind: ['text', 'callout', 'bullets'].includes(block.type) ? 'text' : block.type,
      content: block.content,
      ...(block.image ? { alt: block.image.alt } : {}),
      ...(block.chart
        ? {
            chart: {
              data: block.chart.data.map(({ label, value }) => ({ label, value })),
              unit: block.chart.unit,
              source: block.chart.source,
              seriesName: block.chart.seriesName ?? 'Valores',
              additionalSeries:
                block.chart.additionalSeries?.map(({ name, values }) => ({ name, values })) ?? [],
            },
          }
        : {}),
      ...(block.diagram
        ? {
            diagram: {
              source: block.diagram.source,
              items: block.diagram.items.map(({ title, description, label, value }) => ({
                title,
                description,
                label,
                value,
              })),
            },
          }
        : {}),
    })),
  })}`
}

export function isContentEdited(slide: Slide): boolean | null {
  if (!slide.origin?.baseline?.startsWith('content-v1:')) return null
  return slide.origin.baseline !== createContentBaseline(slide)
}

/** The original title allows generation to retain edit status after a manual outline revision. */
export function createOutlineBaseline(item: Pick<OutlineItem, 'title' | 'content'>): string {
  return `outline-v1:${JSON.stringify({ title: item.title, content: fingerprint(item.content) })}`
}

export function originalOutlineTitle(item: OutlineItem): string | null {
  if (!item.origin?.baseline?.startsWith('outline-v1:')) return null
  try {
    const value = JSON.parse(item.origin.baseline.slice('outline-v1:'.length)) as {
      title?: unknown
    }
    return typeof value.title === 'string' ? value.title : null
  } catch {
    return null
  }
}

export function isOutlineEdited(item: OutlineItem): boolean | null {
  if (originalOutlineTitle(item) === null) return null
  return item.origin!.baseline !== createOutlineBaseline(item)
}

type NarrativeRole =
  | 'context'
  | 'problem'
  | 'solution'
  | 'results'
  | 'process'
  | 'concept'
  | 'example'
  | 'next'
  | 'identity'
  | 'other'

function roleOf(text: string): NarrativeRole {
  // Headings receive priority so a passing mention in the body does not rename its subject.
  const plain = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
  const heading = plain(text.split('\n').find((line) => line.trim()) ?? '')
  const patterns: Array<[NarrativeRole, RegExp]> = [
    [
      'next',
      /\b(proxim[oa]s? passos?|decisao|encerramento|contato|conclusao|revisao|recomendac(?:ao|oes))\b/,
    ],
    ['problem', /\b(desafios?|problemas?|necessidades?|riscos?)\b/],
    [
      'results',
      /\b(resultados?|evidencias?|indicadores?|receita|custos?|investimento|vendas|impacto)\b/,
    ],
    ['process', /\b(metodologia|metodo|processo|etapas?|cronograma|implementacao|como funciona)\b/],
    ['example', /\b(exemplos?|exercicios?|casos?|pratica)\b/],
    ['concept', /\b(conceitos?|definicao|fundamentos?|introducao|o que e)\b/],
    ['identity', /\b(quem somos|historia|missao|visao|valores|equipe|institucional)\b/],
    ['solution', /\b(proposta|soluc(?:ao|oes)|escopo|entregas?|servicos?|produtos?|oferta)\b/],
    ['context', /\b(contexto|objetivos?|cenario|periodo|situacao|resumo)\b/],
  ]
  return patterns.find(([, pattern]) => pattern.test(heading))?.[0] ?? 'other'
}

const PURPOSE_ORDER: Record<PresentationBrief['purpose'], NarrativeRole[]> = {
  general: [],
  proposal: [
    'context',
    'problem',
    'solution',
    'process',
    'results',
    'example',
    'identity',
    'concept',
    'other',
    'next',
  ],
  report: [
    'results',
    'context',
    'problem',
    'process',
    'solution',
    'example',
    'identity',
    'concept',
    'other',
    'next',
  ],
  lesson: [
    'concept',
    'context',
    'process',
    'example',
    'problem',
    'solution',
    'results',
    'identity',
    'other',
    'next',
  ],
  institutional: [
    'identity',
    'context',
    'solution',
    'process',
    'results',
    'example',
    'concept',
    'problem',
    'other',
    'next',
  ],
}
const REQUIRED_ROLES: Record<PresentationBrief['purpose'], Array<[NarrativeRole, string]>> = {
  general: [],
  proposal: [
    ['problem', 'Qual necessidade ou problema esta proposta pretende resolver?'],
    ['solution', 'Quais entregas e limites de escopo precisam constar na proposta?'],
    ['next', 'Qual decisão ou próximo passo você espera do público?'],
  ],
  report: [
    ['results', 'Quais resultados e evidências verificáveis sustentam o relatório?'],
    ['context', 'Qual período e contexto devem acompanhar os resultados?'],
    ['next', 'Quais próximos passos foram definidos a partir dos resultados?'],
  ],
  lesson: [
    ['concept', 'Qual conceito ou fundamento o público precisa compreender primeiro?'],
    ['example', 'Qual exemplo ou exercício pode demonstrar o conteúdo?'],
    ['next', 'Como você pretende revisar ou verificar o aprendizado?'],
  ],
  institutional: [
    ['identity', 'Como você deseja apresentar a identidade e a missão da organização?'],
    ['solution', 'Quais serviços, produtos ou atividades devem ser apresentados?'],
    ['next', 'Qual contato ou próximo passo deve encerrar a apresentação?'],
  ],
}

/** Stable, heading-based ordering. Every source unit is retained exactly once; gaps remain questions. */
export function planNarrative<T extends { text: string }>(
  units: readonly T[],
  requestedBrief?: PresentationBrief,
): { units: T[]; requirements: string[] } {
  const brief = normalizeBrief(requestedBrief)
  const classified = units.map((unit, index) => ({ unit, index, role: roleOf(unit.text) }))
  const available = new Set(classified.map(({ role }) => role))
  const baseOrder = PURPOSE_ORDER[brief.purpose]
  const priority: NarrativeRole[] =
    brief.audience === 'decision-makers'
      ? ['results', 'problem', 'solution']
      : brief.audience === 'technical'
        ? ['process', 'results']
        : brief.audience === 'students'
          ? ['concept', 'context', 'example']
          : []
  const order = [...new Set([...priority, ...baseOrder])]
  if (order.length)
    classified.sort((a, b) => {
      const rank = (role: NarrativeRole) =>
        order.indexOf(role) < 0 ? order.length : order.indexOf(role)
      return rank(a.role) - rank(b.role) || a.index - b.index
    })
  const requirements = REQUIRED_ROLES[brief.purpose]
    .filter(([role]) => !available.has(role))
    .map(([, question]) => question)
  if (brief.audience === 'technical' && !available.has('process'))
    requirements.push(
      'Quais métodos, premissas e limites precisam ser explicados ao público técnico?',
    )
  if (brief.audience === 'students' && !available.has('example') && brief.purpose !== 'lesson')
    requirements.push('Qual exemplo pode ajudar o público a compreender o conteúdo?')
  if (
    brief.audience === 'decision-makers' &&
    !available.has('next') &&
    !requirements.some((question) => question.includes('decisão'))
  )
    requirements.push('Qual decisão você quer que o público tome ao final?')
  return { units: classified.map(({ unit }) => unit), requirements }
}
