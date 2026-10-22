import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { GenerationOptions, PresentationBrief } from '../src/types'
import {
  createContentBaseline,
  isContentEdited,
  isOutlineEdited,
  planNarrative,
  suggestedSlideCount,
} from '../src/lib/creation'
import { buildOutline, createBlankSlide, generateDeck } from '../src/lib/generator'
import { validateDeck } from '../src/lib/validation'
import { SourcePanel } from '../src/components/SourcePanel'

const options: GenerationOptions = {
  slideCount: 8,
  themeId: 'minimal',
  accent: '#2563eb',
  density: 'balanced',
  composition: 'simple',
  sourceName: 'Material fornecido',
}
const text = [
  'Próximos passos\nA equipe vai revisar a proposta.',
  'Resultados\nForam concluídas 2 etapas.',
  'Conceitos\nO material define o serviço de revisão.',
  'Problema\nA documentação precisa de revisão.',
  'Proposta\nA entrega é um roteiro revisado.',
  'Metodologia\nConferir o texto com a fonte original.',
].join('\n\n')

describe('briefing, narrative and provenance', () => {
  it('reorders supplied content for each purpose and preserves every original paragraph exactly once', () => {
    const originalUnits = text.split('\n\n').map((text) => ({ text }))
    const report = planNarrative(originalUnits, { purpose: 'report', audience: 'general' })
    const lesson = planNarrative(originalUnits, { purpose: 'lesson', audience: 'general' })
    const proposal = planNarrative(originalUnits, { purpose: 'proposal', audience: 'general' })
    expect(report.units[0].text).toMatch(/^Resultados/)
    expect(lesson.units[0].text).toMatch(/^Conceitos/)
    expect(proposal.units[0].text).toMatch(/^Problema/)
    for (const plan of [report, lesson, proposal]) {
      expect(plan.units.map((unit) => unit.text).sort()).toEqual(
        originalUnits.map((unit) => unit.text).sort(),
      )
      expect(plan.units).toHaveLength(originalUnits.length)
    }
    expect(planNarrative(originalUnits).units).toEqual(originalUnits)
  })

  it('uses the audience and duration to change the actual outline, while leaving unsupported facts as questions', () => {
    const executive = buildOutline(text, {
      ...options,
      brief: { purpose: 'general', audience: 'decision-makers' },
    })
    const technical = buildOutline(text, {
      ...options,
      brief: { purpose: 'general', audience: 'technical' },
    })
    expect(executive[0].title).toBe('Resultados')
    expect(technical[0].title).toBe('Metodologia')
    const brief: PresentationBrief = {
      purpose: 'institutional',
      audience: 'general',
      durationMinutes: 2,
    }
    const short = buildOutline(text, { ...options, brief })
    expect(short).toHaveLength(2)
    const deck = generateDeck(text, short, { ...options, brief })
    expect(deck.settings.brief).toEqual(brief)
    expect(deck.source.text).toBe(text)
    for (const paragraph of text.split('\n\n'))
      expect(deck.slides.map((slide) => slide.notes).join('\n')).toContain(paragraph)
    const questions = short.flatMap((item) => item.requirements ?? [])
    expect(questions.some((question) => question.includes('missão'))).toBe(true)
    expect(
      deck.slides.some((slide) =>
        slide.blocks.some((block) =>
          questions.some((question) => block.content.includes(question)),
        ),
      ),
    ).toBe(false)
    expect(deck.slides[0].notes).toContain('Duração pretendida: 2 min')
    expect(() => validateDeck(deck)).not.toThrow()
    expect(() => suggestedSlideCount({ ...brief, durationMinutes: 1.5 })).toThrow(/inteiro/)
  })

  it('keeps PDF references when intact paragraphs are reordered, and records original refs separately after editing', () => {
    const pages = text.split('\n\n').map((text, index) => ({ page: index + 1, text }))
    const pdfOptions: GenerationOptions = {
      ...options,
      slideCount: 4,
      pages,
      sourceKind: 'pdf',
      sourceName: 'Fonte.pdf',
      brief: { purpose: 'report', audience: 'general' },
    }
    const outline = buildOutline(text, pdfOptions)
    const pristine = generateDeck(text, outline, pdfOptions)
    expect(
      pristine.slides
        .slice(1, -1)
        .every((slide) => slide.sourcePages.length > 0 && isContentEdited(slide) === false),
    ).toBe(true)
    const originalExcerpt = outline[0].content
    const originPages = [...outline[0].sourcePages]
    outline[0].content += '\nComentário manual que não está no PDF.'
    outline[0].title = 'Roteiro revisado'
    expect(isOutlineEdited(outline[0])).toBe(true)
    const revised = generateDeck(text, outline, pdfOptions)
    expect(revised.slides[1].sourcePages).toEqual([])
    expect(revised.slides[1].origin?.pages).toEqual(originPages)
    expect(revised.slides[1].origin?.excerpt).toBe(originalExcerpt)
    expect(isContentEdited(revised.slides[1])).toBe(true)
    expect(revised.slides[1].notes).toContain('Comentário manual')
    expect(() => validateDeck(revised)).not.toThrow()
  })

  it('detects factual edits in a long source without duplicating its text in the baseline', () => {
    const longText = 'Informação fornecida pelo usuário. '.repeat(3500)
    const outline = buildOutline(longText, { ...options, slideCount: 3 })
    const deck = generateDeck(longText, outline, { ...options, slideCount: 3 })
    const slide = deck.slides[1]
    expect(slide.origin!.baseline!.length).toBeLessThan(100)
    expect(slide.origin?.excerpt).toContain('Informação fornecida')
    expect(isContentEdited(slide)).toBe(false)
    slide.blocks[0].content += ' Revisão manual.'
    expect(isContentEdited(slide)).toBe(true)
    expect(() => validateDeck(deck)).not.toThrow()
  })

  it('ignores styling and format changes but detects precise chart/diagram values, text and notes', () => {
    const slide = createBlankSlide()
    slide.blocks = [
      {
        id: 'chart',
        type: 'chart',
        content: '',
        chart: {
          type: 'bar',
          data: [
            { label: 'Zero', value: 0 },
            { label: 'Pequeno', value: 1e-22 },
          ],
          unit: '%',
          source: 'Fonte',
          seriesName: 'Medição',
          additionalSeries: [{ name: 'Revisão', values: [1, -2] }],
        },
      },
      {
        id: 'diagram',
        type: 'diagram',
        content: '',
        diagram: {
          type: 'process',
          source: 'Plano',
          items: [{ id: 'node', title: 'Etapa', description: 'Ação fornecida', value: '12' }],
        },
      },
    ]
    slide.origin!.baseline = createContentBaseline(slide)
    slide.layout = 'columns'
    slide.background = '#000000'
    slide.blocks[0].chart!.type = 'horizontalBar'
    slide.blocks[0].chart!.showValues = false
    slide.blocks[1].diagram!.type = 'comparison'
    expect(isContentEdited(slide)).toBe(false)
    const changed = structuredClone(slide)
    changed.blocks[0].chart!.data[1].value = 0
    expect(isContentEdited(changed)).toBe(true)
    changed.blocks[0].chart!.data[1].value = 1e-22
    changed.blocks[1].diagram!.items[0].description = 'Outra ação'
    expect(isContentEdited(changed)).toBe(true)
    changed.blocks[1].diagram!.items[0].description = 'Ação fornecida'
    changed.notes = 'Comentário manual'
    expect(isContentEdited(changed)).toBe(true)
    expect(createBlankSlide().origin?.kind).toBe('manual')
    expect(isContentEdited(createBlankSlide())).toBe(false)
  })

  it('shows exact current data, questions and unverified legacy origin in the source panel', () => {
    const deck = generateDeck(
      'Conferir os dados fornecidos.',
      buildOutline('Conferir os dados fornecidos.', options),
      options,
    )
    const slide = deck.slides[1]
    slide.blocks = [
      {
        id: 'chart',
        type: 'chart',
        content: '',
        chart: {
          type: 'bar',
          data: [
            { label: 'Zero', value: 0 },
            { label: 'Precisão', value: -1e-22 },
          ],
          unit: '',
          source: 'Planilha fornecida',
          additionalSeries: [{ name: 'Outra série', values: [12.3456789, 7] }],
        },
      },
    ]
    slide.requirements = ['Qual período foi medido?']
    delete slide.origin
    const html = renderToStaticMarkup(createElement(SourcePanel, { slide, deck }))
    expect(html).toContain('Origem individual não registrada')
    expect(html).toContain('Qual período foi medido?')
    expect(html).toContain('-1e-22')
    expect(html).toContain('12,3456789')
    expect(html).toContain('Outra série')
    expect(html).toContain('Fonte geral da apresentação')
  })
})
