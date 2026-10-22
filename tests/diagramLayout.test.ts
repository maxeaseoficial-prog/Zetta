import { describe, expect, it } from 'vitest'
import type { DiagramConfig, DiagramType } from '../src/types'
import { buildDiagramLayout, getDiagramWarnings, wrapDiagramText } from '../src/lib/diagramLayout'

function diagram(type: DiagramType, count = 2): DiagramConfig {
  return {
    type,
    source: 'Dados fictícios · revisão em português',
    items: Array.from({ length: count }, (_, index) => ({
      id: `item-${index}`,
      title: `Ação ${index + 1}`,
      label: '22/10/2026',
      value: index === 0 ? 'R$ 1.250,75' : '−8,5%',
      description: 'Texto da fonte. Sem cálculo automático.',
    })),
  }
}

describe('editable diagram layout', () => {
  it.each<DiagramType>(['process', 'timeline', 'comparison', 'metrics'])(
    'preserves every field of %s, including literal values',
    (type) => {
      const input = diagram(type)
      const saved = JSON.stringify(input)
      const plan = buildDiagramLayout(input, 1136, 420, 'Liberation Sans', 'Contexto do bloco')
      expect(plan.warnings).toEqual([])
      expect(plan.cards).toHaveLength(2)
      for (const [index, card] of plan.cards.entries()) {
        expect(card.item).toEqual(input.items[index])
        for (const kind of ['title', 'label', 'value', 'description'] as const) {
          expect(card.texts.find((text) => text.kind === kind)?.lines.join(' ')).toBe(
            input.items[index][kind],
          )
        }
        expect(card.x).toBeGreaterThanOrEqual(0)
        expect(card.x + card.w).toBeLessThanOrEqual(1136)
        expect(card.y + card.h).toBeLessThanOrEqual(420)
      }
      expect(plan.source?.lines.join(' ')).toBe(`Fonte: ${input.source}`)
      expect(plan.heading?.lines).toEqual(['Contexto do bloco'])
      expect(JSON.stringify(input)).toBe(saved)
    },
  )
  it('does not silently hide excessive items or dense contents', () => {
    const input = diagram('metrics', 7)
    input.items[6].description = 'Descrição extensa. '.repeat(60)
    const plan = buildDiagramLayout(input, 500, 220)
    expect(plan.cards).toHaveLength(7)
    expect(plan.warnings.join(' ')).toMatch(/quatro indicadores/)
    expect(plan.warnings.join(' ')).toMatch(/item 7.*não cabe/)
    expect(plan.cards[6].texts.find((text) => text.kind === 'description')?.lines.join(' ')).toBe(
      input.items[6].description.trim(),
    )
  })
  it('flags invalid comparison and empty data explicitly', () => {
    expect(getDiagramWarnings(diagram('comparison', 3), 1000, 420).join(' ')).toMatch(/dois itens/)
    expect(getDiagramWarnings(diagram('process', 0), 1000, 420).join(' ')).toMatch(
      /pelo menos um item/,
    )
  })
  it('wraps long tokens and paragraph breaks without ellipsis or character loss', () => {
    const word = 'AÇÃO-1234567890'.repeat(8)
    const lines = wrapDiagramText(word, 80, 16, 'Liberation Sans')
    expect(lines.length).toBeGreaterThan(3)
    expect(lines.join('')).toBe(word)
    expect(wrapDiagramText('Primeiro\n\nSegundo', 400, 16, 'Liberation Sans')).toEqual([
      'Primeiro',
      '',
      'Segundo',
    ])
  })
})
