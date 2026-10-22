import { afterEach, describe, expect, it } from 'vitest'
import type { ChartConfig, ChartType } from '../src/types'
import {
  buildChartOption,
  clearChartCache,
  formatChartValue,
  getChartCacheStats,
  getChartWarnings,
  renderChartSvg,
} from '../src/lib/chartRenderer'

const style = {
  width: 1000,
  height: 410,
  foreground: '#0F172A',
  muted: '#64748B',
  accent: '#2563EB',
  background: '#EFF6FF',
}
const chart = (type: ChartType = 'bar'): ChartConfig => ({
  type,
  data: [
    { label: 'Janeiro', value: 12.5 },
    { label: 'Fevereiro', value: 24 },
    { label: 'Março', value: 8 },
    { label: 'Abril', value: 32 },
  ],
  unit: 'R$',
  source: 'Dados fictícios para teste',
})
const option = (config: ChartConfig) =>
  buildChartOption(config, style) as {
    animation: boolean
    xAxis?: { type: string; min?: number; max?: number; inverse?: boolean; data?: string[] }
    yAxis?: { type: string; min?: number; max?: number; inverse?: boolean }
    series: {
      name: string
      type: string
      smooth?: boolean
      stack?: string
      areaStyle?: { origin: number }
      data: { value: number }[]
    }[]
  }

afterEach(clearChartCache)

describe('gráficos reais e compatibilidade', () => {
  it.each<ChartType>(['bar', 'horizontalBar', 'line', 'area', 'pie', 'donut'])(
    'renderiza %s com todos os dados e rótulos',
    (type) => {
      const config = chart(type)
      const result = renderChartSvg(config, style)
      expect(result.warnings).toEqual([])
      expect(result.svg).toContain('<svg')
      expect(result.svg).not.toContain('<foreignObject')
      expect(result.svg).not.toContain('@keyframes')
      for (const datum of config.data) {
        expect(result.svg).toContain(datum.label)
        expect(result.svg).toContain(formatChartValue(datum.value, config.unit))
      }
      expect(decodeURIComponent(result.dataUrl.split(',').slice(1).join(','))).toBe(result.svg)
    },
  )

  it('mantém a estrutura antiga como primeira série sem alterar números', () => {
    const legacy = chart('line')
    const original = structuredClone(legacy)
    const result = option(legacy)
    expect(result.series).toHaveLength(1)
    expect(result.series[0].data.map((datum) => datum.value)).toEqual([12.5, 24, 8, 32])
    expect(legacy).toEqual(original)
  })

  it('usa o domínio de todas as séries, inclui zero e preserva negativos', () => {
    const config = chart()
    config.additionalSeries = [{ name: 'Outra série', values: [-80, 0, 200, 12] }]
    const result = option(config)
    expect(result.yAxis?.min).toBeLessThanOrEqual(-80)
    expect(result.yAxis?.max).toBeGreaterThanOrEqual(200)
    expect(result.series[1].data.map((datum) => datum.value)).toEqual([-80, 0, 200, 12])
    expect(getChartWarnings(config, style.width, style.height)).toEqual([])
    const zero = chart()
    zero.data.forEach((datum) => {
      datum.value = 0
    })
    expect(getChartWarnings(zero, style.width, style.height)).toEqual([])
    expect(option(zero).yAxis?.min).toBe(0)
    expect(option(zero).yAxis?.max).toBeGreaterThan(0)
  })

  it('troca os eixos nas barras horizontais sem reordenar categorias', () => {
    const result = option(chart('horizontalBar'))
    expect(result.xAxis?.type).toBe('value')
    expect(result.yAxis?.type).toBe('category')
    expect(result.yAxis?.inverse).toBe(true)
    expect(result.series[0].data.map((datum) => datum.value)).toEqual([12.5, 24, 8, 32])
  })

  it('não empilha nem suaviza séries de área implicitamente', () => {
    const config = chart('area')
    config.additionalSeries = [{ name: 'Comparação', values: [15, 20, -5, 45] }]
    const result = option(config)
    for (const series of result.series) {
      expect(series.stack).toBeUndefined()
      expect(series.smooth).toBe(false)
      expect(series.areaStyle?.origin).toBe(0)
    }
  })

  it('não arredonda valores pequenos para zero nem elimina casas dos dados', () => {
    expect(formatChartValue(0.000000001, '%')).toBe('1e-9%')
    expect(formatChartValue(12.123456789, 'R$')).toBe('R$ 12,123456789')
    expect(formatChartValue(-4.5, 'unidades')).toBe('-4,5 unidades')
    const boundary = 1.2345678901234568e-6
    expect(formatChartValue(boundary)).toBe(boundary.toString().replace('.', ','))
    expect(formatChartValue(0.10000000000000002)).toBe('0,10000000000000002')
  })

  it.each<ChartType>(['line', 'area'])(
    'separa valores coincidentes entre três séries de %s sem esconder rótulos',
    (type) => {
      const config = chart(type)
      config.unit = ''
      config.data.forEach((datum) => {
        datum.value = 10
      })
      config.additionalSeries = [
        { name: 'Comparação A', values: [10, 10, 10, 10] },
        { name: 'Comparação B', values: [10, 10, 10, 10] },
      ]
      const result = buildChartOption(config, style) as {
        series: {
          label: { show: boolean }
          labelLayout: (params: { dataIndex: number }) => {
            x: number
            y: number
            hideOverlap: boolean
          }
        }[]
      }
      for (let dataIndex = 0; dataIndex < config.data.length; dataIndex++) {
        const positions = result.series
          .map((series) => {
            expect(series.label.show).toBe(true)
            const position = series.labelLayout({ dataIndex })
            expect(position.hideOverlap).toBe(false)
            expect(position.y).toBeGreaterThan(15)
            expect(position.y).toBeLessThan(style.height - 15)
            return position
          })
          .sort((first, second) => first.y - second.y)
        expect(new Set(positions.map((position) => position.x)).size).toBe(1)
        expect(positions[1].y - positions[0].y).toBeGreaterThanOrEqual(20)
        expect(positions[2].y - positions[1].y).toBeGreaterThanOrEqual(20)
      }
      expect(renderChartSvg(config, style).warnings).toEqual([])
    },
  )
})

describe('dados inválidos e leitura', () => {
  it.each<ChartType>(['pie', 'donut'])(
    'recusa %s negativo, total zero e séries extras sem transformar dados',
    (type) => {
      const negative = chart(type)
      negative.data[0].value = -12.5
      expect(getChartWarnings(negative, 1000, 410).join(' ')).toContain('negativos')
      expect(renderChartSvg(negative, style).svg).not.toContain('ecmeta_data_index')
      const zero = chart(type)
      zero.data.forEach((datum) => {
        datum.value = 0
      })
      expect(getChartWarnings(zero, 1000, 410).join(' ')).toContain('total positivo')
      const extra = chart(type)
      extra.additionalSeries = [{ name: 'Comparação', values: [1, 2, 3, 4] }]
      expect(getChartWarnings(extra, 1000, 410).join(' ')).toContain('única série')
      expect(extra.additionalSeries[0].values).toEqual([1, 2, 3, 4])
    },
  )

  it('aceita zeros individuais em pizza sem inventar fatias de valor positivo', () => {
    const config = chart('pie')
    config.data[0].value = 0
    expect(getChartWarnings(config, 1000, 410)).toEqual([])
    expect(option(config).series[0].data[0].value).toBe(0)
  })

  it('avisa sobre categorias excessivas, nomes longos e área pequena', () => {
    const many = chart()
    many.data = Array.from({ length: 13 }, (_, index) => ({
      label: `Categoria ${index + 1}`,
      value: index,
    }))
    expect(getChartWarnings(many, 1000, 410).join(' ')).toContain('12 categorias')
    const long = chart()
    long.data[0].label =
      'Um nome de categoria muito longo que precisa de espaço para ser legível '.repeat(3)
    expect(getChartWarnings(long, 340, 150).join(' ')).toContain('rótulos longos')
    expect(getChartWarnings(chart(), 180, 90).join(' ')).toContain('pequeno demais')
  })

  it('recusa séries desalinhadas, números não finitos e nomes duplicados', () => {
    const config = chart()
    config.additionalSeries = [{ name: 'Valores', values: [1, 2] }]
    const warnings = getChartWarnings(config, 1000, 410).join(' ')
    expect(warnings).toContain('cada categoria')
    expect(warnings).toContain('nomes das séries')
    config.data[0].value = Number.NaN
    expect(getChartWarnings(config, 1000, 410).join(' ')).toContain('numérico inválido')
  })

  it('escapa texto de usuário no SVG e nunca aceita HTML como rótulo', () => {
    const config = chart('pie')
    config.data[0].label = '<script>alert("x")</script>'
    const result = renderChartSvg(config, style)
    expect(result.svg).not.toContain('<script>')
    expect(result.svg).toContain('&lt;script&gt;')
  })
})

describe('animação e recursos', () => {
  it.each<ChartType>(['bar', 'horizontalBar', 'line', 'area', 'pie', 'donut'])(
    'gera CSS de entrada somente na versão animada de %s',
    (type) => {
      const config = chart(type)
      expect(renderChartSvg(config, { ...style, animate: true }).svg).toContain('@keyframes')
      expect(renderChartSvg(config, style).svg).not.toContain('@keyframes')
      config.animate = false
      expect(renderChartSvg(config, { ...style, animate: true }).svg).not.toContain('@keyframes')
    },
  )

  it('compartilha snapshots estáticos e limita o cache de um deck longo', () => {
    const config = chart()
    const first = renderChartSvg(config, style)
    expect(renderChartSvg(structuredClone(config), style)).toBe(first)
    for (let index = 0; index < 110; index++) {
      const next = chart()
      next.data[0].value = index + 1
      renderChartSvg(next, style)
    }
    const stats = getChartCacheStats()
    expect(stats.entries).toBeLessThanOrEqual(stats.maxEntries)
    expect(stats.bytes).toBeLessThanOrEqual(stats.maxBytes)
  })
})
