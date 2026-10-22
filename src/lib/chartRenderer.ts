import { init, use, type EChartsCoreOption } from 'echarts/core'
import { BarChart, LineChart, PieChart } from 'echarts/charts'
import { GridComponent, LegendComponent } from 'echarts/components'
import { LabelLayout } from 'echarts/features'
import { SVGRenderer } from 'echarts/renderers'
import type { ChartConfig } from '../types'

import {
  buildChartModel as modelFor,
  formatChartValue,
  formatTick,
  wrapLabel,
  DEFAULT_CHART_FONT,
  type ChartModel,
  type ChartRenderOptions,
  type ChartSnapshot,
} from './chartLayout'
export { getChartWarnings, formatChartValue } from './chartLayout'
export type { ChartRenderOptions, ChartSnapshot } from './chartLayout'

// SVG SSR runs locally in the browser as well as in tests. No server is involved.
use([BarChart, LineChart, PieChart, GridComponent, LegendComponent, LabelLayout, SVGRenderer])

const MAX_CACHE_ENTRIES = 96
const MAX_CACHE_BYTES = 6 * 1024 * 1024
const cache = new Map<string, { snapshot: ChartSnapshot; bytes: number }>()
let cacheBytes = 0

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
  const model = modelFor(chart, options.width, options.height, options.fontFamily)
  const FONT = options.fontFamily ?? DEFAULT_CHART_FONT
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
    options.fontFamily ?? DEFAULT_CHART_FONT,
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

/** One SVG snapshot serves images and the restricted React SVG tree; never raw HTML. */
export function renderChartSvg(chart: ChartConfig, options: ChartRenderOptions): ChartSnapshot {
  const key = snapshotKey(chart, options)
  const hit = cache.get(key)
  if (hit) {
    cache.delete(key)
    cache.set(key, hit)
    return hit.snapshot
  }
  const model = modelFor(chart, options.width, options.height, options.fontFamily)
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
