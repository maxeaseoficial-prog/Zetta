import { describe, expect, it } from 'vitest'
import type { ChartConfig } from '../src/types'
import { createChartsDemoDeck } from '../src/lib/chartDemo'
import { createExampleDeck } from '../src/lib/generator'
import { parseDeckImport, serializeDeck, validateDeck } from '../src/lib/validation'
import { getSlideWarnings } from '../src/components/SlideCanvas'
import { THEMES } from '../src/lib/themes'

describe('editable chart documents', () => {
  it('opens legacy version-one documents without new chart properties', () => {
    const deck = createExampleDeck()
    const copy = parseDeckImport(serializeDeck(deck))
    expect(copy.slides).toEqual(deck.slides)
    expect(copy.schemaVersion).toBe(1)
  })

  it('preserves all six chart types, multiple series, exact values and motion preferences in backups', () => {
    const deck = createChartsDemoDeck()
    const charts = deck.slides
      .flatMap((slide) => slide.blocks)
      .flatMap((block) => (block.chart ? [block.chart] : []))
    expect(charts.map((chart) => chart.type)).toEqual([
      'bar',
      'horizontalBar',
      'line',
      'area',
      'pie',
      'donut',
    ])
    charts[0].animate = false
    const copy = parseDeckImport(serializeDeck(deck))
    expect(copy).toEqual(deck)
    expect(copy.source.kind).toBe('example')
    expect(copy.source.name).toMatch(/fictícios/)
    expect(charts[0].additionalSeries).toHaveLength(2)
    expect(
      charts.find((chart) => chart.type === 'area')?.data.some((datum) => datum.value < 0),
    ).toBe(true)
  })

  it('rejects a series with missing values instead of inserting zeros', () => {
    const deck = createChartsDemoDeck()
    const chart = deck.slides[1].blocks[0].chart!
    chart.additionalSeries![0].values.pop()
    expect(() => validateDeck(deck)).toThrow(/série|categoria/i)
  })

  it('rejects duplicate series names and nonfinite values', () => {
    const deck = createChartsDemoDeck()
    const chart = deck.slides[1].blocks[0].chart!
    chart.additionalSeries![0].name = chart.seriesName!.toLowerCase()
    expect(() => validateDeck(deck)).toThrow(/nomes|séries/i)
    chart.additionalSeries![0].name = 'Despesas'
    chart.additionalSeries![0].values[0] = Number.NaN
    expect(() => validateDeck(deck)).toThrow()
  })

  it('preserves invalid-for-pie data as a saved draft and blocks its PDF export', () => {
    const deck = createChartsDemoDeck()
    const slide = deck.slides[4]
    const chart = slide.blocks[0].chart as ChartConfig
    chart.type = 'donut'
    expect(validateDeck(deck).slides[4].blocks[0].chart?.data).toEqual(chart.data)
    expect(getSlideWarnings(slide, THEMES[0]).join(' ')).toMatch(/negativ/i)
  })

  it('keeps the complete chart laboratory exportable in every theme', () => {
    const deck = createChartsDemoDeck()
    for (const theme of THEMES) {
      for (const slide of deck.slides) {
        expect(getSlideWarnings(slide, theme), theme.id + ': ' + slide.title).toEqual([])
      }
    }
  })
})
