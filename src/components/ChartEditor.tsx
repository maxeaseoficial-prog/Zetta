import { useEffect, useRef, useState } from 'react'
import {
  ChartArea,
  ChartBar,
  ChartNoAxesColumnIncreasing,
  ChartNoAxesCombined,
  ChartPie,
  Circle,
  Check,
  Play,
  Upload,
} from 'lucide-react'
import type { ChartConfig, ChartType, SlideBlock } from '../types'
import { parseChartInput, serializeChartInput } from '../lib/chartData'
import { formatChartValue } from '../lib/chartRenderer'

const chartTypes: { type: ChartType; name: string; purpose: string; icon: typeof ChartBar }[] = [
  {
    type: 'bar',
    name: 'Colunas',
    purpose: 'Compare categorias',
    icon: ChartNoAxesColumnIncreasing,
  },
  { type: 'horizontalBar', name: 'Barras', purpose: 'Compare rótulos longos', icon: ChartBar },
  { type: 'line', name: 'Linhas', purpose: 'Mostre a evolução', icon: ChartNoAxesCombined },
  { type: 'area', name: 'Área', purpose: 'Destaque uma tendência', icon: ChartArea },
  { type: 'pie', name: 'Pizza', purpose: 'Partes de um total', icon: ChartPie },
  { type: 'donut', name: 'Rosca', purpose: 'Partes de um total', icon: Circle },
]

export interface ChartInputDraft {
  text: string
  numberFormat: 'pt-BR' | 'en-US'
  sourceName?: string
}

function typeError(type: ChartType, chart: ChartConfig): string {
  if (type !== 'pie' && type !== 'donut') return ''
  if (chart.additionalSeries?.length)
    return 'Pizza e rosca usam uma única série. Use colunas, barras, linhas ou área para comparar séries.'
  if (chart.data.some((datum) => datum.value < 0))
    return 'Pizza e rosca não representam valores negativos. Use barras, colunas, linhas ou área.'
  if (chart.data.length && !chart.data.some((datum) => datum.value > 0))
    return 'Pizza e rosca precisam de um total maior que zero.'
  return ''
}

export function ChartEditor({
  block,
  onChange,
  onPreview,
  drafts,
  onDraftChange,
}: {
  block: SlideBlock
  onChange: (chart: ChartConfig) => void
  onPreview: () => void
  drafts: Map<string, ChartInputDraft>
  onDraftChange: () => void
}) {
  const chart = block.chart ?? { type: 'bar', data: [], unit: '', source: '' }
  const [numberFormat, setNumberFormat] = useState<'pt-BR' | 'en-US'>(
    () => drafts.get(block.id)?.numberFormat ?? 'pt-BR',
  )
  const [raw, setRaw] = useState(() => drafts.get(block.id)?.text ?? serializeChartInput(chart))
  const [error, setError] = useState('')
  const [fileNotice, setFileNotice] = useState('')
  const [pendingFileName, setPendingFileName] = useState(
    () => drafts.get(block.id)?.sourceName ?? '',
  )
  const [reading, setReading] = useState(false)
  const upload = useRef<HTMLInputElement>(null)
  const current = useRef({ chart, numberFormat })
  current.current = { chart, numberFormat }
  const savedText = serializeChartInput(chart, numberFormat)
  const dataKey = JSON.stringify([chart.data, chart.seriesName, chart.additionalSeries])
  useEffect(() => {
    const pending = drafts.get(block.id)
    setRaw(
      pending?.text ?? serializeChartInput(current.current.chart, current.current.numberFormat),
    )
    setError('')
  }, [dataKey, drafts, block.id])
  const isDirty = raw.trim() !== savedText.trim()
  const series = [
    { name: chart.seriesName || 'Valores', values: chart.data.map((datum) => datum.value) },
    ...(chart.additionalSeries ?? []),
  ]
  function rememberDraft(text: string, format = numberFormat, sourceName = '') {
    if (text.trim() === serializeChartInput(chart, format).trim() && !sourceName)
      drafts.delete(block.id)
    else drafts.set(block.id, { text, numberFormat: format, sourceName })
    onDraftChange()
  }

  function selectType(type: ChartType) {
    const message = typeError(type, chart)
    if (message) {
      setError(message)
      return
    }
    setError('')
    onChange({ ...chart, type })
  }
  function apply() {
    try {
      const parsed = parseChartInput(raw, numberFormat)
      const next: ChartConfig = {
        ...chart,
        data: parsed.data,
        seriesName: parsed.seriesName,
        additionalSeries: parsed.additionalSeries,
        unit: parsed.unit || chart.unit,
        source: pendingFileName || chart.source,
      }
      const message = typeError(next.type, next)
      if (message) throw new Error(message + ' Troque o tipo antes de aplicar estes dados.')
      onChange(next)
      drafts.delete(block.id)
      onDraftChange()
      setRaw(serializeChartInput(next, numberFormat))
      setError('')
      setFileNotice('')
      setPendingFileName('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Confira os valores informados.')
    }
  }
  async function importFile(file?: File) {
    if (!file) return
    setError('')
    setPendingFileName('')
    setReading(true)
    try {
      if (file.size > 1024 * 1024) throw new Error('Use um arquivo CSV ou TSV de até 1 MB.')
      if (!/\.(csv|tsv|txt)$/i.test(file.name))
        throw new Error('Escolha um arquivo .csv, .tsv ou .txt com uma tabela.')
      const text = (await file.text()).replace(/^\uFEFF/, '')
      if (text.includes('\u0000'))
        throw new Error('Salve a tabela como CSV UTF-8 antes de importar.')
      if (text.length > 100_000)
        throw new Error(
          'A tabela é muito longa. Separe até 12 categorias e três séries por gráfico.',
        )
      setRaw(text)
      setPendingFileName(file.name.slice(0, 160))
      rememberDraft(text, numberFormat, file.name.slice(0, 160))
      setFileNotice(
        file.name + ' carregado. Confira o formato dos números e clique em Aplicar dados.',
      )
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível ler a tabela.')
    } finally {
      setReading(false)
    }
  }
  return (
    <>
      <label className="field-label">TIPO DE GRÁFICO</label>
      <div className="chart-type-grid" role="group" aria-label="Tipo de gráfico">
        {chartTypes.map(({ type, name, purpose, icon: Icon }) => (
          <button
            key={type}
            className={chart.type === type ? 'active' : ''}
            onClick={() => selectType(type)}
            aria-pressed={chart.type === type}
            title={purpose}
          >
            <Icon size={21} />
            <span>{name}</span>
          </button>
        ))}
      </div>
      <p className="property-tip">
        {chartTypes.find((item) => item.type === chart.type)?.purpose}. Os dados continuam editáveis
        ao trocar o visual.
      </p>
      <div className="chart-data-heading">
        <span className="field-label">DADOS DO GRÁFICO</span>
        <button className="text-button" disabled={reading} onClick={() => upload.current?.click()}>
          <Upload size={13} />
          {reading ? 'Lendo…' : 'Importar CSV'}
        </button>
      </div>
      <input
        ref={upload}
        hidden
        type="file"
        aria-label="Arquivo de dados CSV"
        accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values"
        onChange={(event) => {
          void importFile(event.target.files?.[0])
          event.target.value = ''
        }}
      />
      <label className="field-label chart-format-label">
        FORMATO DOS NÚMEROS
        <select
          aria-label="Formato dos números"
          disabled={reading}
          value={numberFormat}
          onChange={(event) => {
            const next = event.target.value as 'pt-BR' | 'en-US'
            const nextText = isDirty ? raw : serializeChartInput(chart, next)
            setRaw(nextText)
            rememberDraft(nextText, next, pendingFileName)
            setNumberFormat(next)
            setError('')
          }}
        >
          <option value="pt-BR">Brasil · 1.234,56</option>
          <option value="en-US">Internacional · 1,234.56</option>
        </select>
      </label>
      <textarea
        className="chart-data-input"
        aria-label="Dados do gráfico"
        disabled={reading}
        rows={7}
        maxLength={100000}
        value={raw}
        onChange={(event) => {
          setRaw(event.target.value)
          rememberDraft(event.target.value)
          setError('')
          setFileNotice('')
          setPendingFileName('')
        }}
        placeholder={'Mês; Receita; Despesa\nJaneiro; 12000; 8500\nFevereiro; 14500; 9200'}
      />
      <p className="property-tip">
        Cole uma tabela do Excel ou use uma linha por categoria. Até 12 categorias e três séries.
        Comece o cabeçalho com Categoria, Mês ou Produto.
      </p>
      {fileNotice && (
        <p className="chart-file-notice" role="status">
          {fileNotice}
        </p>
      )}
      {isDirty && !fileNotice && (
        <p className="chart-pending" role="status">
          Alterações nos dados ainda não aplicadas. Rascunho mantido nesta sessão de edição.
        </p>
      )}
      <button className="button secondary full-width" onClick={apply} disabled={reading}>
        <Check size={15} />
        Aplicar dados
      </button>
      {error && (
        <p role="alert" className="inline-error">
          {error}
        </p>
      )}
      {chart.data.length > 0 && (
        <details className="chart-data-details">
          <summary>
            Conferir dados aplicados{' '}
            <span>
              {chart.data.length} categorias · {series.length}{' '}
              {series.length === 1 ? 'série' : 'séries'}
            </span>
          </summary>
          <div className="chart-table-scroll">
            <table aria-label="Dados aplicados ao gráfico">
              <thead>
                <tr>
                  <th>Categoria</th>
                  {series.map((item) => (
                    <th key={item.name}>{item.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {chart.data.map((datum, index) => (
                  <tr key={datum.label}>
                    <th scope="row">{datum.label}</th>
                    {series.map((item) => (
                      <td key={item.name}>{formatChartValue(item.values[index])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {chart.unit && <small>Unidade: {chart.unit}</small>}
        </details>
      )}
      <label className="field-label">
        UNIDADE
        <input
          aria-label="Unidade do gráfico"
          value={chart.unit}
          maxLength={30}
          placeholder="Ex.: R$, %, unidades"
          onChange={(event) => onChange({ ...chart, unit: event.target.value })}
        />
      </label>
      <label className="field-label">
        FONTE DOS DADOS
        <input
          aria-label="Fonte dos dados do gráfico"
          value={chart.source}
          maxLength={160}
          placeholder="Ex.: relatório de vendas"
          onChange={(event) => onChange({ ...chart, source: event.target.value })}
        />
      </label>
      <div className="chart-display-options">
        <label>
          <input
            type="checkbox"
            checked={chart.showValues !== false}
            onChange={(event) => onChange({ ...chart, showValues: event.target.checked })}
          />
          <span>Mostrar valores no gráfico</span>
        </label>
        <label>
          <input
            type="checkbox"
            checked={chart.animate !== false}
            onChange={(event) => onChange({ ...chart, animate: event.target.checked })}
          />
          <span>Animar ao apresentar</span>
        </label>
      </div>
      <button className="button secondary full-width" onClick={onPreview}>
        <Play size={15} />
        Testar apresentação
      </button>
      <p className="property-tip">
        A animação aparece ao apresentar. O PDF recebe o gráfico completo e estático.
      </p>
    </>
  )
}
