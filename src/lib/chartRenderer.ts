import { init, use, type EChartsCoreOption } from 'echarts/core'
import { BarChart, LineChart, PieChart } from 'echarts/charts'
import { GridComponent, LegendComponent } from 'echarts/components'
import { LabelLayout } from 'echarts/features'
import { SVGRenderer } from 'echarts/renderers'
import type { ChartConfig } from '../types'

// SVG SSR runs locally in the browser as well as in tests. No server is involved.
use([BarChart, LineChart, PieChart, GridComponent, LegendComponent, LabelLayout, SVGRenderer])

export interface ChartRenderOptions {
  width: number
  height: number
  foreground: string
  muted: string
  accent: string
  background: string
  animate?: boolean
}

export interface ChartSnapshot {
  svg: string
  dataUrl: string
  warnings: string[]
}

interface Series {
  name: string
  values: number[]
}

interface ChartModel {
  series: Series[]
  warnings: string[]
  invalid: boolean
  radial: boolean
  horizontal: boolean
  width: number
  height: number
  labels: string[][]
  legendLabels: string[][]
  legendHeight: number
  legendWidth: number
  legendTop: number
  grid: { left: number; top: number; width: number; height: number }
  domain: { min: number; max: number; interval: number; ticks: number[] }
  categoryMargin: number
  valueWidth: number
  fontSize: number
  axisFontSize: number
  lineHeight: number
  lineLabelY: number[][]
}

const FONT = 'Arial, sans-serif'
const MAX_CATEGORIES = 12
const MAX_CACHE_ENTRIES = 96
const MAX_CACHE_BYTES = 6 * 1024 * 1024
const cache = new Map<string, { snapshot: ChartSnapshot; bytes: number }>()
let cacheBytes = 0
let measurement: CanvasRenderingContext2D | null | undefined

function textWidth(text: string, size = 12, bold = false): number {
  if (measurement === undefined && typeof document !== 'undefined') {
    try {
      measurement = document.createElement('canvas').getContext('2d')
    } catch {
      measurement = null
    }
  }
  if (measurement) {
    measurement.font = `${bold ? 700 : 400} ${size}px ${FONT}`
    return measurement.measureText(text).width
  }
  return (
    Array.from(text).reduce(
      (total, character) =>
        total +
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

function wrapLabel(text: string, width: number, size = 12): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of text.trim().split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word
    if (textWidth(candidate, size) <= width) {
      line = candidate
      continue
    }
    if (line) lines.push(line)
    line = ''
    for (const character of Array.from(word)) {
      if (line && textWidth(line + character, size) > width) {
        lines.push(line)
        line = ''
      }
      line += character
    }
  }
  if (line) lines.push(line)
  return lines.length ? lines : ['']
}

/** Data labels preserve the supplied number; tiny numbers use explicit notation. */
export function formatChartValue(value: number, unit = ''): string {
  const normalizedUnit = unit.trim()
  const magnitude = Math.abs(value)
  const number =
    magnitude > 0 && magnitude < 0.000001
      ? value.toString().replace('.', ',')
      : new Intl.NumberFormat('pt-BR', { maximumSignificantDigits: 21 }).format(value)
  return normalizedUnit === '%'
    ? `${number}%`
    : normalizedUnit === 'R$'
      ? `R$ ${number}`
      : `${number}${normalizedUnit ? ` ${normalizedUnit}` : ''}`
}

function formatTick(value: number, unit: string): string {
  // Rounding the calculated axis ticks removes floating-point arithmetic noise.
  // Data labels above deliberately do not use this rounding.
  return formatChartValue(Number(value.toPrecision(12)), unit)
}

function domainFor(values: number[]) {
  const low = Math.min(0, ...values)
  const high = Math.max(0, ...values)
  const span = high - low || 1
  const rough = span / 4
  const power = 10 ** Math.floor(Math.log10(rough))
  const fraction = rough / power
  const step =
    (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10) * power
  const interval = Number.isFinite(step) && step > 0 ? step : span
  const min = Math.floor(low / interval) * interval
  const max = Math.ceil(high / interval) * interval || interval
  const count = Math.min(10, Math.round((max - min) / interval))
  const ticks = Array.from({ length: count + 1 }, (_, index) =>
    Number((min + index * interval).toPrecision(12)),
  )
  return { min, max, interval, ticks }
}

function modelFor(chart: ChartConfig, rawWidth: number, rawHeight: number): ChartModel {
  const width = Math.max(1, Number.isFinite(rawWidth) ? rawWidth : 1)
  const height = Math.max(1, Number.isFinite(rawHeight) ? rawHeight : 1)
  const warnings: string[] = []
  let invalid = false
  const issue = (message: string, fatal = false) => {
    warnings.push(message)
    invalid ||= fatal
  }
  const radial = chart.type === 'pie' || chart.type === 'donut'
  const horizontal = chart.type === 'horizontalBar'
  const series: Series[] = [
    { name: chart.seriesName?.trim() || 'Valores', values: chart.data.map((datum) => datum.value) },
    ...(chart.additionalSeries ?? []).map((item) => ({
      name: item.name.trim(),
      values: [...item.values],
    })),
  ]
  if (!chart.data.length) issue('O gráfico precisa de dados antes de exportar.', true)
  if (chart.data.some((datum) => !datum.label.trim()))
    issue('Toda categoria do gráfico precisa de um nome.', true)
  if (
    new Set(chart.data.map((datum) => datum.label.trim().toLocaleLowerCase('pt-BR'))).size !==
    chart.data.length
  )
    issue('Há categorias repetidas no gráfico. Use nomes distintos.', true)
  if (chart.data.length > MAX_CATEGORIES)
    issue(
      'O gráfico tem mais de 12 categorias. Divida os dados em mais slides para manter a leitura.',
    )
  if (series.length > 3)
    issue('O gráfico aceita no máximo três séries. Divida as séries em mais slides.', true)
  if (series.some((item) => item.values.length !== chart.data.length))
    issue('Todas as séries precisam ter um valor para cada categoria.', true)
  if (series.some((item) => !item.name)) issue('Todas as séries precisam de um nome.', true)
  if (new Set(series.map((item) => item.name.toLocaleLowerCase('pt-BR'))).size !== series.length)
    issue('Os nomes das séries precisam ser distintos.', true)
  const values = series.flatMap((item) => item.values)
  if (values.some((value) => !Number.isFinite(value)))
    issue('O gráfico contém um valor numérico inválido.', true)
  const finiteValues = values.filter(Number.isFinite)
  const span = Math.max(0, ...finiteValues) - Math.min(0, ...finiteValues)
  if (!Number.isFinite(span) || (span > 0 && span < 1e-300))
    issue(
      'A amplitude dos valores excede uma escala numérica confiável. Ajuste a unidade dos dados.',
      true,
    )
  if (radial) {
    if (series.length > 1)
      issue(
        'Pizza e rosca precisam de uma única série. Use barras ou linhas para comparar séries.',
        true,
      )
    if (finiteValues.some((value) => value < 0))
      issue('Pizza e rosca não representam valores negativos. Escolha barras ou linhas.', true)
    const total = chart.data.reduce((sum, datum) => sum + datum.value, 0)
    if (!Number.isFinite(total) || total <= 0)
      issue('Pizza e rosca precisam de um total positivo.', true)
  }
  if (width < 220 || height < 145)
    issue('O gráfico está pequeno demais. Escolha uma composição com mais espaço.')
  const domain = domainFor(finiteValues.length && !invalid ? finiteValues : [0])
  const showValues = chart.showValues !== false
  const fontSize = width >= 700 && chart.data.length <= 8 ? 15 : 12
  const axisFontSize = fontSize > 12 ? 13 : 12
  const lineHeight = Math.ceil(fontSize * 1.3)
  const valueWidth = Math.max(
    0,
    ...finiteValues.map((value) => textWidth(formatChartValue(value, chart.unit), fontSize, true)),
  )
  const showLegend = series.length > 1 || Boolean(chart.seriesName?.trim())
  const legendCell = Math.max(30, (width - (series.length - 1) * 18) / series.length - 26)
  const legendLabels = showLegend
    ? series.map((item) => wrapLabel(item.name, legendCell, fontSize))
    : []
  const legendHeight = legendLabels.length
    ? Math.max(...legendLabels.map((lines) => lines.length)) * lineHeight + 10
    : 0
  if (legendHeight > 58)
    issue('Os nomes das séries ocupam muitas linhas. Encurte-os ou amplie o gráfico.')
  let labels: string[][] = []
  let grid = { left: 0, top: 0, width, height }
  let legendWidth = 0
  let legendTop = 0
  let categoryMargin = 12
  const lineLabelY: number[][] = series.map(() => [])

  if (radial) {
    legendWidth = Math.max(130, width * 0.51)
    const labelWidth = Math.max(28, legendWidth - 30)
    labels = chart.data.map((datum) => [
      ...wrapLabel(datum.label, labelWidth, fontSize),
      ...(showValues
        ? wrapLabel(formatChartValue(datum.value, chart.unit), labelWidth, fontSize)
        : []),
    ])
    const radialLegendHeight = labels.reduce(
      (sum, lines) => sum + lines.length * lineHeight + 10,
      0,
    )
    legendTop = Math.max(6, (height - radialLegendHeight) / 2)
    grid = { left: 6, top: 6, width: Math.max(30, width - legendWidth - 18), height: height - 12 }
    if (grid.width < 110 || grid.height < 110)
      issue('Pizza e rosca precisam de mais espaço para o desenho e a legenda.')
    if (radialLegendHeight > height - 10)
      issue('A legenda da pizza ou rosca não cabe. Reduza as categorias ou use barras horizontais.')
    if (labels.some((lines) => lines.length > (showValues ? 4 : 3)))
      issue('Há rótulos longos na pizza ou rosca. Amplie o gráfico ou use barras horizontais.')
  } else if (horizontal) {
    const labelWidth = Math.min(220, width * 0.28)
    labels = chart.data.map((datum) => wrapLabel(datum.label, labelWidth, fontSize))
    const longest = Math.max(0, ...labels.flat().map((line) => textWidth(line, fontSize)))
    categoryMargin = showValues && finiteValues.some((value) => value < 0) ? valueWidth + 18 : 12
    const left = longest + categoryMargin + 8
    const right = showValues ? valueWidth + 18 : 14
    grid = {
      left,
      top: legendHeight + 10,
      width: width - left - right,
      height: height - legendHeight - 52,
    }
    const rowHeight = grid.height / Math.max(1, chart.data.length)
    if (labels.some((lines) => lines.length * lineHeight + 6 > rowHeight))
      issue(
        'Os rótulos das barras horizontais precisam de mais altura. Amplie o gráfico ou divida as categorias.',
      )
    if (showValues && rowHeight / series.length < fontSize + 4)
      issue(
        'Há muitos valores próximos nas barras horizontais. Amplie o gráfico, reduza as categorias ou desative os valores visíveis.',
      )
    const tickWidth = Math.max(
      ...domain.ticks.map((tick) => textWidth(formatTick(tick, chart.unit), axisFontSize)),
    )
    if (tickWidth + 8 > grid.width / Math.max(1, domain.ticks.length - 1))
      issue(
        'Os números do eixo precisam de mais largura. Amplie o gráfico ou ajuste a unidade dos dados.',
      )
  } else {
    const left =
      Math.max(
        26,
        ...domain.ticks.map((tick) => textWidth(formatTick(tick, chart.unit), axisFontSize)),
      ) + 14
    const right = 16
    const plotWidth = width - left - right
    const categoryWidth = plotWidth / Math.max(1, chart.data.length)
    labels = chart.data.map((datum) =>
      wrapLabel(datum.label, Math.max(12, categoryWidth - 8), fontSize),
    )
    const labelLines = Math.max(1, ...labels.map((lines) => lines.length))
    categoryMargin =
      showValues && chart.type === 'bar' && finiteValues.some((value) => value < 0)
        ? fontSize * 2 + 10
        : 14
    const top = legendHeight + (showValues ? fontSize + 14 : 12)
    grid = {
      left,
      top,
      width: plotWidth,
      height: height - top - labelLines * lineHeight - categoryMargin - 10,
    }
    if (labelLines > 3)
      issue(
        'Há rótulos longos no eixo. Use barras horizontais, amplie o gráfico ou divida as categorias.',
      )
    const valueSpace = chart.type === 'bar' ? categoryWidth / series.length : categoryWidth
    if (showValues && valueWidth + 6 > valueSpace)
      issue(
        'Os valores precisam de mais espaço. Amplie o gráfico, reduza as categorias ou desative os valores visíveis.',
      )
  }
  if (!radial && (grid.width < 120 || grid.height < 64))
    issue('O gráfico precisa de mais espaço para exibir eixos, nomes e valores sem sobreposição.')
  if (
    !invalid &&
    showValues &&
    series.length > 1 &&
    (chart.type === 'line' || chart.type === 'area')
  ) {
    // ECharts' shiftY layout can leave labels from distinct series on top of
    // one another. Place each category's labels together, keeping value order
    // and a full text-height gap without dropping a single number.
    const gap = fontSize + 8
    const minCenter = legendHeight + fontSize / 2 + 4
    const maxCenter = grid.top + grid.height - fontSize / 2 - 2
    if (maxCenter - minCenter < gap * (series.length - 1))
      issue(
        'Os valores das séries precisam de mais altura. Amplie o gráfico ou desative os valores visíveis.',
      )
    for (let dataIndex = 0; dataIndex < chart.data.length; dataIndex++) {
      const positions = series
        .map((item, seriesIndex) => ({
          seriesIndex,
          y:
            grid.top +
            ((domain.max - item.values[dataIndex]) / (domain.max - domain.min)) * grid.height -
            fontSize / 2 -
            10,
        }))
        .sort((first, second) => first.y - second.y || first.seriesIndex - second.seriesIndex)
      for (let index = 0; index < positions.length; index++) {
        positions[index].y = Math.max(
          positions[index].y,
          index ? positions[index - 1].y + gap : minCenter,
        )
      }
      for (let index = positions.length - 1; index >= 0; index--) {
        positions[index].y = Math.min(
          positions[index].y,
          index < positions.length - 1 ? positions[index + 1].y - gap : maxCenter,
        )
      }
      for (const position of positions) lineLabelY[position.seriesIndex][dataIndex] = position.y
    }
  }
  return {
    series,
    warnings: [...new Set(warnings)],
    invalid,
    radial,
    horizontal,
    width,
    height,
    labels,
    legendLabels,
    legendHeight,
    legendWidth,
    legendTop,
    grid,
    domain,
    categoryMargin,
    valueWidth,
    fontSize,
    axisFontSize,
    lineHeight,
    lineLabelY,
  }
}

export function getChartWarnings(chart: ChartConfig, width: number, height: number): string[] {
  return modelFor(chart, width, height).warnings
}

function safeColor(color: string, fallback: string): string {
  return /^#[\da-f]{3}(?:[\da-f]{3})?$/i.test(color) ? color : fallback
}

function isDark(hex: string): boolean {
  const text =
    hex.length === 4
      ? hex
          .slice(1)
          .split('')
          .map((character) => character + character)
          .join('')
      : hex.slice(1)
  const channels = [0, 2, 4].map((index) => parseInt(text.slice(index, index + 2), 16))
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722 < 135
}

function paletteFor(options: ChartRenderOptions): string[] {
  const dark = isDark(safeColor(options.background, '#FFFFFF'))
  return [
    safeColor(options.accent, '#2563EB'),
    ...(dark
      ? [
          '#5EEAD4',
          '#FCD34D',
          '#FDA4AF',
          '#C4B5FD',
          '#7DD3FC',
          '#BEF264',
          '#FDBA74',
          '#F0ABFC',
          '#A5B4FC',
          '#67E8F9',
          '#D4D4D8',
        ]
      : [
          '#0D9488',
          '#D97706',
          '#E05268',
          '#8B5CC7',
          '#0284C7',
          '#659C35',
          '#EA7B36',
          '#B85AA8',
          '#6366B9',
          '#0891A5',
          '#727C8C',
        ]),
  ]
}

/** One option builder owns scales, series, label formatting and animation settings. */
export function buildChartOption(
  chart: ChartConfig,
  options: ChartRenderOptions,
): EChartsCoreOption {
  const model = modelFor(chart, options.width, options.height)
  const foreground = safeColor(options.foreground, '#0F172A')
  const muted = safeColor(options.muted, '#64748B')
  const background = safeColor(options.background, '#FFFFFF')
  const colors = paletteFor(options)
  const animate = Boolean(options.animate) && chart.animate !== false
  const shared: EChartsCoreOption = {
    animation: animate,
    animationDuration: 800,
    animationDurationUpdate: 0,
    animationEasing: 'cubicOut',
    backgroundColor: 'transparent',
    color: colors,
    textStyle: { fontFamily: FONT, fontSize: 12, color: foreground },
  }
  if (model.invalid) return shared
  const showValues = chart.showValues !== false
  if (model.radial) {
    const radius = Math.max(12, Math.min(model.grid.width, model.grid.height) / 2 - 8)
    return {
      ...shared,
      legend: {
        orient: 'vertical',
        left: model.width - model.legendWidth,
        top: model.legendTop,
        width: model.legendWidth,
        padding: 0,
        itemWidth: 10,
        itemHeight: 10,
        itemGap: 10,
        selectedMode: false,
        icon: 'roundRect',
        data: chart.data.map((datum) => datum.label),
        formatter: (name: string) =>
          model.labels[chart.data.findIndex((datum) => datum.label === name)]?.join('\n') ?? name,
        textStyle: {
          color: foreground,
          fontSize: model.fontSize,
          fontFamily: FONT,
          lineHeight: model.lineHeight,
        },
      },
      series: [
        {
          name: chart.seriesName?.trim() || 'Composição',
          type: 'pie',
          center: [model.grid.left + model.grid.width / 2, model.height / 2],
          radius: chart.type === 'donut' ? [radius * 0.6, radius] : radius,
          clockwise: true,
          startAngle: 90,
          stillShowZeroSum: false,
          animationType: 'scale',
          animationDelay: 0,
          label: { show: false },
          labelLine: { show: false },
          selectedMode: false,
          silent: true,
          emphasis: { disabled: true },
          itemStyle: { borderColor: background, borderWidth: 2 },
          data: chart.data.map((datum) => ({ name: datum.label, value: datum.value })),
        },
      ],
    }
  }
  const valueAxis = {
    type: 'value',
    min: model.domain.min,
    max: model.domain.max,
    interval: model.domain.interval,
    scale: false,
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: {
      color: muted,
      fontSize: model.axisFontSize,
      fontFamily: FONT,
      hideOverlap: false,
      margin: 10,
      formatter: (value: number) => formatTick(value, chart.unit),
    },
    splitLine: { show: true, lineStyle: { color: foreground, opacity: 0.12, width: 1 } },
  }
  const categoryAxis = {
    type: 'category',
    data: chart.data.map((datum) => datum.label),
    boundaryGap: true,
    inverse: model.horizontal,
    axisLine: { show: true, onZero: false, lineStyle: { color: foreground, opacity: 0.22 } },
    axisTick: { show: false },
    axisLabel: {
      color: muted,
      fontSize: model.fontSize,
      fontFamily: FONT,
      lineHeight: model.lineHeight,
      interval: 0,
      hideOverlap: false,
      margin: model.categoryMargin,
      formatter: (_value: string, index: number) => model.labels[index]?.join('\n') ?? _value,
    },
    splitLine: { show: false },
  }
  const bar = chart.type === 'bar' || model.horizontal
  const arrangeLineLabels = !bar && model.series.length > 1 && showValues
  return {
    ...shared,
    grid: { ...model.grid, containLabel: false, outerBoundsMode: 'none' },
    legend: {
      show: model.legendLabels.length > 0,
      top: 0,
      left: 0,
      width: model.width,
      padding: 0,
      itemWidth: 14,
      itemHeight: 5,
      itemGap: 18,
      selectedMode: false,
      data: model.series.map((item) => item.name),
      formatter: (name: string) =>
        model.legendLabels[model.series.findIndex((item) => item.name === name)]?.join('\n') ??
        name,
      textStyle: {
        color: foreground,
        fontSize: model.fontSize,
        fontFamily: FONT,
        lineHeight: model.lineHeight,
      },
    },
    xAxis: model.horizontal ? valueAxis : categoryAxis,
    yAxis: model.horizontal ? categoryAxis : valueAxis,
    series: model.series.map((item, seriesIndex) => ({
      id: `series-${seriesIndex}`,
      name: item.name,
      type: bar ? 'bar' : 'line',
      silent: true,
      emphasis: { disabled: true },
      animationDelay: (dataIndex: number) => Math.min(180, dataIndex * 24),
      ...(bar
        ? {
            barMaxWidth: model.horizontal ? 32 : 58,
            barCategoryGap: '32%',
            barGap: '22%',
            // Rounded zero-height paths change their command count and prevent the
            // SVG SSR engine from producing a reliable CSS entry animation.
            itemStyle: { color: colors[seriesIndex] },
          }
        : {
            smooth: false,
            connectNulls: false,
            showSymbol: true,
            showAllSymbol: true,
            symbol: ['circle', 'diamond', 'rect'][seriesIndex],
            symbolSize: 7,
            lineStyle: { color: colors[seriesIndex], width: 3 },
            itemStyle: { color: colors[seriesIndex], borderColor: background, borderWidth: 1.5 },
            ...(chart.type === 'area'
              ? { areaStyle: { color: colors[seriesIndex], opacity: 0.16, origin: 0 } }
              : {}),
          }),
      label: {
        show: showValues,
        color: arrangeLineLabels ? colors[seriesIndex] : foreground,
        fontFamily: FONT,
        fontSize: model.fontSize,
        fontWeight: 700,
        ...(arrangeLineLabels ? { textBorderColor: background, textBorderWidth: 3 } : {}),
        position: 'top',
        distance: 7,
        formatter: (params: { value: number }) =>
          formatChartValue(Number(params.value), chart.unit),
      },
      ...(arrangeLineLabels
        ? {
            labelLine: {
              show: true,
              lineStyle: { color: colors[seriesIndex], width: 1, opacity: 0.55 },
            },
          }
        : {}),
      labelLayout: arrangeLineLabels
        ? (params: { dataIndex?: number }) => ({
            x:
              model.grid.left +
              (((params.dataIndex ?? 0) + 0.5) * model.grid.width) / chart.data.length,
            y: model.lineLabelY[seriesIndex][params.dataIndex ?? 0],
            align: 'center' as const,
            verticalAlign: 'middle' as const,
            hideOverlap: false,
          })
        : { hideOverlap: false },
      data: item.values.map((value) => ({
        value,
        label: {
          position: model.horizontal
            ? value < 0
              ? 'left'
              : 'right'
            : bar && value < 0
              ? 'bottom'
              : seriesIndex % 2 && !bar
                ? 'bottom'
                : 'top',
        },
      })),
    })),
  }
}

function escapeXml(text: string): string {
  return text.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]!,
  )
}

function placeholder(model: ChartModel, color: string): string {
  const lines = wrapLabel(
    model.warnings[0] ?? 'Adicione dados ao gráfico.',
    Math.max(30, model.width - 24),
    14,
  )
  const y = Math.max(18, (model.height - lines.length * 20) / 2)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${model.width}" height="${model.height}" viewBox="0 0 ${model.width} ${model.height}"><text fill="${safeColor(color, '#64748B')}" font-family="Arial,sans-serif" font-size="14" text-anchor="middle">${lines.map((line, index) => `<tspan x="${model.width / 2}" y="${y + 16 + index * 20}">${escapeXml(line)}</tspan>`).join('')}</text></svg>`
}

function snapshotKey(chart: ChartConfig, options: ChartRenderOptions): string {
  return JSON.stringify([
    chart.type,
    chart.data,
    chart.unit,
    chart.seriesName,
    chart.additionalSeries,
    chart.showValues !== false,
    Boolean(options.animate) && chart.animate !== false,
    options.width,
    options.height,
    options.foreground,
    options.muted,
    options.accent,
    options.background,
  ])
}

export function clearChartCache(): void {
  cache.clear()
  cacheBytes = 0
}

export function getChartCacheStats() {
  return {
    entries: cache.size,
    bytes: cacheBytes,
    maxEntries: MAX_CACHE_ENTRIES,
    maxBytes: MAX_CACHE_BYTES,
  }
}

/** SVGs are self-contained and placed in image elements, never injected as HTML. */
export function renderChartSvg(chart: ChartConfig, options: ChartRenderOptions): ChartSnapshot {
  const key = snapshotKey(chart, options)
  const hit = cache.get(key)
  if (hit) {
    cache.delete(key)
    cache.set(key, hit)
    return hit.snapshot
  }
  const model = modelFor(chart, options.width, options.height)
  let svg: string
  if (model.invalid) {
    svg = placeholder(model, options.muted)
  } else {
    const instance = init(null, null, {
      renderer: 'svg',
      ssr: true,
      width: model.width,
      height: model.height,
    })
    try {
      instance.setOption(buildChartOption(chart, options), { notMerge: true })
      svg = instance.renderToSVGString()
    } finally {
      instance.dispose()
    }
  }
  const snapshot: ChartSnapshot = {
    svg,
    dataUrl: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
    warnings: model.warnings,
  }
  const bytes = (svg.length + snapshot.dataUrl.length + key.length) * 2
  if (bytes <= MAX_CACHE_BYTES) {
    while (cache.size >= MAX_CACHE_ENTRIES || cacheBytes + bytes > MAX_CACHE_BYTES) {
      const first = cache.keys().next().value
      if (first === undefined) break
      cacheBytes -= cache.get(first)!.bytes
      cache.delete(first)
    }
    cache.set(key, { snapshot, bytes })
    cacheBytes += bytes
  }
  return snapshot
}
