import { describe, expect, it } from 'vitest'
import type { Slide, SlideBlock } from '../src/types'
import { planComposition, type CompositionResult } from '../src/lib/composition'
import { createContentBaseline, isContentEdited } from '../src/lib/creation'
import { validateSlide } from '../src/lib/validation'

const png =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aGPIAAAAASUVORK5CYII='
let sequence = 0
const context = (slideCount = 8) => ({ slideCount, makeId: () => `new-${++sequence}` })
const chart: SlideBlock = {
  id: 'chart',
  type: 'chart',
  content: 'Dados fornecidos',
  chart: {
    type: 'line',
    unit: 'R$',
    source: 'Relatório · página 2',
    seriesName: 'Real',
    data: [
      { label: 'Janeiro', value: 0 },
      { label: 'Fevereiro', value: -1.23456789 },
    ],
    additionalSeries: [{ name: 'Plano', values: [2.3456789, -10] }],
    animate: true,
    showValues: true,
  },
}
const diagram: SlideBlock = {
  id: 'diagram',
  type: 'diagram',
  content: 'Etapas informadas',
  diagram: {
    type: 'timeline',
    source: 'Plano original',
    items: [
      {
        id: 'step-1',
        title: 'Pesquisar',
        description: 'Consultar o material completo.',
        label: 'Fase 1',
        value: 'Sem prazo informado',
      },
      { id: 'step-2', title: 'Revisar', description: 'Conferir com a equipe.' },
    ],
  },
}
const image: SlideBlock = {
  id: 'image',
  type: 'image',
  content: 'Legenda fornecida',
  image: {
    src: png,
    alt: 'Imagem do cliente',
    illustration: 'waves',
    fit: 'cover',
    position: 74,
    seed: 9,
    crop: { x: 0.2, y: 0.7, zoom: 1.8 },
  },
}
function makeSlide(blocks: SlideBlock[]): Slide {
  const slide: Slide = {
    id: 'slide-original',
    title: 'Título completo',
    eyebrow: 'Referência fornecida',
    layout: 'split',
    blocks: structuredClone(blocks),
    notes: 'Notas integrais com informações que não aparecem no slide.',
    sourcePages: [2, 4],
    background: '#eff6ff',
    titleStyle: { color: '#1d4ed8', align: 'left', bold: true },
    appearance: {
      themeId: 'editorial',
      accent: '#2563eb',
      brand: {
        id: 'brand-1',
        name: 'Marca original',
        colors: { accent: '#2563eb', background: '#ffffff', foreground: '#0f172a' },
        font: 'serif',
        footer: 'Documento de trabalho',
        logo: { src: png, alt: 'Marca' },
      },
    },
    requirements: ['Qual é a próxima decisão?'],
    origin: {
      kind: 'source',
      sourceKind: 'pdf',
      sourceName: 'Relatório original.pdf',
      excerpt: 'Trecho integral da fonte.',
      pages: [2, 4],
    },
  }
  slide.origin!.baseline = createContentBaseline(slide)
  return slide
}
function requirePlan(result: CompositionResult): Slide[] {
  if (!result.ok) throw new Error(result.reason)
  return result.slides
}

describe('composition plans preserve document content', () => {
  it('splits a long text at an existing boundary without losing a single character or metadata', () => {
    const content = `  Abertura com espaços.\r\n\r\n${'Conteúdo original com valor 1.234,56 e precisão. '.repeat(32)}\nConclusão final.  `
    const original = makeSlide([
      { id: 'text', type: 'text', content, style: { bold: true, color: '#123456' } },
      image,
    ])
    const before = structuredClone(original)
    const slides = requirePlan(planComposition(original, { type: 'split' }, context()))
    expect(slides).toHaveLength(2)
    expect(
      slides
        .flatMap((slide) => slide.blocks)
        .filter((block) => block.type === 'text')
        .map((block) => block.content)
        .join(''),
    ).toBe(content)
    expect(slides.flatMap((slide) => slide.blocks).find((block) => block.type === 'image')).toEqual(
      image,
    )
    expect(
      new Set(slides.flatMap((slide) => [slide.id, ...slide.blocks.map((block) => block.id)])).size,
    ).toBe(5)
    for (const slide of slides) {
      expect(slide.notes).toBe(original.notes)
      expect(slide.sourcePages).toEqual(original.sourcePages)
      expect(slide.appearance).toEqual(original.appearance)
      expect(slide.titleStyle).toEqual(original.titleStyle)
      expect(slide.requirements).toEqual(original.requirements)
      expect(slide.origin?.excerpt).toBe(original.origin?.excerpt)
      expect(isContentEdited(slide)).toBe(false)
      expect(() => validateSlide(slide)).not.toThrow()
    }
    expect(original).toEqual(before)
  })

  it('moves whole chart, diagram and image objects without changing series, precision, item order or crop', () => {
    const slide = makeSlide([chart, diagram, image])
    const parts = requirePlan(planComposition(slide, { type: 'split' }, context()))
    expect(parts.flatMap((part) => part.blocks)).toEqual(slide.blocks)
    const focus = requirePlan(
      planComposition(slide, { type: 'focus-chart', blockId: 'chart' }, context()),
    )
    expect(focus[0].blocks).toEqual([chart])
    expect(focus[0].layout).toBe('chart')
    expect(focus[1].blocks).toEqual([diagram, image])
    expect(focus.every((part) => part.notes === slide.notes)).toBe(true)
  })

  it('does not claim to split one indivisible graph/diagram or fabricate another comparison side', () => {
    for (const block of [chart, diagram]) {
      const result = planComposition(makeSlide([block]), { type: 'split' }, context())
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.reason).toContain('mantido inteiro')
    }
    expect(planComposition(makeSlide([image]), { type: 'compare' }, context()).ok).toBe(false)
    expect(planComposition(makeSlide([chart, diagram]), { type: 'compare' }, context()).ok).toBe(
      false,
    )
  })

  it('preserves existing edits and missing provenance instead of silently declaring them original', () => {
    const original = makeSlide([
      { id: 'text', type: 'text', content: 'Informação original.' },
      image,
    ])
    const baseline = original.origin!.baseline
    original.blocks[0].content = 'Informação alterada pelo usuário.'
    const parts = requirePlan(planComposition(original, { type: 'split' }, context()))
    expect(
      parts.every((part) => part.origin?.baseline === baseline && isContentEdited(part) === true),
    ).toBe(true)
    delete original.origin
    const legacy = requirePlan(planComposition(original, { type: 'split' }, context()))
    expect(legacy.every((part) => !part.origin && isContentEdited(part) === null)).toBe(true)
  })

  it('allows reversible styling at the slide limit but rejects a split that would exceed it', () => {
    const slide = makeSlide([
      { id: 'a', type: 'text', content: 'Primeiro lado.' },
      { id: 'b', type: 'bullets', content: 'Segundo lado.\nOutro ponto.' },
    ])
    const divided = planComposition(slide, { type: 'split' }, context(50))
    expect(divided.ok).toBe(false)
    if (!divided.ok) expect(divided.reason).toContain('50 slides')
    const compared = requirePlan(planComposition(slide, { type: 'compare' }, context(50)))[0]
    expect(compared.layout).toBe('columns')
    expect(compared.blocks).toEqual(slide.blocks)
    expect(isContentEdited(compared)).toBe(false)
    const emphasized = requirePlan(
      planComposition(slide, { type: 'emphasize', blockId: 'b' }, context(50)),
    )[0]
    expect(emphasized.blocks[1].content).toBe(slide.blocks[1].content)
    expect(emphasized.blocks[1].type).toBe('callout')
  })

  it('keeps bullet rows intact and declines an unsafe split within one long unbroken token', () => {
    const content = Array.from(
      { length: 12 },
      (_, index) => `Item ${index}: ${'informação '.repeat(8)}`,
    ).join('\r\n')
    const parts = requirePlan(
      planComposition(
        makeSlide([{ id: 'list', type: 'bullets', content }]),
        { type: 'split' },
        context(),
      ),
    )
    expect(
      parts
        .flatMap((part) => part.blocks)
        .map((block) => block.content)
        .join(''),
    ).toBe(content)
    expect(parts[0].blocks[0].content).toMatch(/\r\n$/)
    expect(
      planComposition(
        makeSlide([{ id: 'token', type: 'text', content: 'X'.repeat(1000) }]),
        { type: 'split' },
        context(),
      ).ok,
    ).toBe(false)
  })
})
