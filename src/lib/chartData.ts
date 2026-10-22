import type { ChartConfig, ChartDatum, ChartSeries } from '../types'

export type ChartNumberFormat = 'pt-BR' | 'en-US'

export interface ParsedChartInput {
  data: ChartDatum[]
  unit: string
  seriesName?: string
  additionalSeries?: ChartSeries[]
}

type ErrorCode = 'invalid-input' | 'category-limit' | 'series-limit'

export class ChartInputError extends Error {
  constructor(
    message: string,
    readonly line: number,
    readonly column: number,
    readonly code: ErrorCode = 'invalid-input',
  ) {
    super(`Linha ${line}, coluna ${column}: ${message}`)
    this.name = 'ChartInputError'
  }
}

interface Cell {
  value: string
  quoted: boolean
  line: number
  column: number
}

interface Row {
  cells: Cell[]
  line: number
}

interface ParseOptions {
  maxCategories: number
  maxSeries: number
  legacy?: boolean
}

function fail(cell: Pick<Cell, 'line' | 'column'>, message: string, code?: ErrorCode): never {
  throw new ChartInputError(message, cell.line, cell.column, code)
}

/** CSV fields use doubled quotes; quoted newlines and surrounding spaces are preserved. */
function readRows(input: string, delimiter: string): Row[] {
  const rows: Row[] = []
  let cells: Cell[] = []
  let value = ''
  let quoted = false
  let inQuotes = false
  let closedQuote = false
  let line = 1
  let fieldLine = 1
  let rowLine = 1
  const finishField = () => {
    cells.push({
      value: quoted ? value : value.trim(),
      quoted,
      line: fieldLine,
      column: cells.length + 1,
    })
    value = ''
    quoted = false
    closedQuote = false
    fieldLine = line
  }
  const finishRow = () => {
    finishField()
    if (cells.length !== 1 || cells[0].quoted || cells[0].value.trim())
      rows.push({ cells, line: rowLine })
    cells = []
  }
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index]
    if (inQuotes) {
      if (character === '"' && input[index + 1] === '"') {
        value += '"'
        index += 1
      } else if (character === '"') {
        inQuotes = false
        closedQuote = true
      } else {
        value += character
        if (character === '\n' || (character === '\r' && input[index + 1] !== '\n')) line += 1
      }
    } else if (character === delimiter) {
      finishField()
    } else if (character === '\n' || character === '\r') {
      finishRow()
      if (character === '\r' && input[index + 1] === '\n') index += 1
      line += 1
      fieldLine = line
      rowLine = line
    } else if (character === '"') {
      if (value.trim() || closedQuote)
        fail(
          { line, column: cells.length + 1 },
          'Aspas inválidas. Envolva a célula inteira em aspas e use duas aspas para uma aspa literal.',
        )
      value = ''
      quoted = true
      inQuotes = true
    } else if (closedQuote) {
      if (!/\s/.test(character))
        fail(
          { line, column: cells.length + 1 },
          'Há texto após o fechamento das aspas. Separe a próxima célula com o delimitador da tabela.',
        )
    } else value += character
  }
  if (inQuotes)
    fail({ line: fieldLine, column: cells.length + 1 }, 'A célula entre aspas não foi fechada.')
  if (value || cells.length || quoted || closedQuote) finishRow()
  return rows
}

function delimiterFor(text: string, legacy: boolean): string {
  // In a Markdown table, punctuation inside a cell is not a CSV delimiter.
  if (text.trimStart().startsWith('|')) return '|'
  const counts = new Map<string, number>()
  let quoted = false
  let started = false
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]
    if (character === '"') {
      if (quoted && text[index + 1] === '"') index += 1
      else quoted = !quoted
    } else if (!quoted) {
      if (character === '\n' || character === '\r') {
        if (started) break
      } else {
        if (character.trim()) started = true
        if ('\t;|,:'.includes(character)) counts.set(character, (counts.get(character) ?? 0) + 1)
      }
    }
  }
  for (const delimiter of ['\t', ';', '|', ...(legacy ? [':'] : []), ',']) {
    if (counts.get(delimiter)) return delimiter
  }
  throw new ChartInputError(
    'Use uma tabela com rótulo e valor, separados por ponto e vírgula, tabulação ou vírgula.',
    1,
    2,
  )
}

/** Expand Number.toString without Intl rounding, including very small finite values. */
function plainDecimal(value: number): string {
  if (Object.is(value, -0)) return '0'
  const text = String(value)
  if (!/[eE]/.test(text)) return text
  const [coefficient, exponentText] = text.split(/[eE]/)
  const sign = coefficient.startsWith('-') ? '-' : ''
  const unsigned = coefficient.replace(/^-/, '')
  const [integer, fraction = ''] = unsigned.split('.')
  const digits = integer + fraction
  const point = integer.length + Number(exponentText)
  if (point <= 0) return `${sign}0.${'0'.repeat(-point)}${digits}`
  if (point >= digits.length) return sign + digits + '0'.repeat(point - digits.length)
  return `${sign}${digits.slice(0, point)}.${digits.slice(point)}`
}

function canonicalDecimal(unsigned: string): string {
  const [integer, fraction = ''] = unsigned.replace(/^[+-]/, '').split('.')
  const significantFraction = fraction.replace(/0+$/, '')
  return integer.replace(/^0+(?=\d)/, '') + (significantFraction ? `.${significantFraction}` : '')
}

function readNumber(
  cell: Cell,
  format: ChartNumberFormat,
  legacy: boolean,
): { value: number; unit: string } {
  let input = cell.value.trim().replace(/\u2212/g, '-')
  let unit = ''
  if (/^R\$\s*/i.test(input)) {
    unit = 'R$'
    input = input.replace(/^R\$\s*/i, '')
  }
  if (/%$/.test(input)) {
    if (unit) fail(cell, 'Uma célula não pode misturar R$ e %.')
    unit = '%'
    input = input.slice(0, -1).trim()
  }
  const parentheses = /^\(.*\)$/.test(input)
  if (parentheses) input = input.slice(1, -1).trim()
  if (parentheses && /^[+-]/.test(input))
    fail(cell, 'Use parênteses ou um sinal para o valor negativo, não ambos.')
  const expression =
    format === 'pt-BR'
      ? /^[+-]?(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d+)?$/
      : /^[+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?$/
  if (!expression.test(input))
    fail(
      cell,
      `Valor numérico inválido para ${format === 'pt-BR' ? 'Brasil (ex.: 1.234,56)' : 'Internacional (ex.: 1,234.56)'}. Preencha cada valor; zeros são aceitos. Em CSV, coloque números que contêm vírgula entre aspas.`,
    )
  const decimal =
    format === 'pt-BR' ? input.replace(/\./g, '').replace(',', '.') : input.replace(/,/g, '')
  if (legacy && (decimal.split('.')[1]?.length ?? 0) > 8)
    fail(cell, 'A leitura legada aceita até oito casas decimais.')
  const value = Number(decimal) * (parentheses ? -1 : 1)
  if (!Number.isFinite(value) || Math.abs(value) > 1e12)
    fail(cell, 'O valor deve estar entre -1 trilhão e 1 trilhão.')
  if (plainDecimal(Math.abs(value)) !== canonicalDecimal(decimal))
    fail(
      cell,
      'Esse número perderia precisão ao ser armazenado. Reduza a precisão explicitamente no material de origem antes de aplicar.',
    )
  return { value: Object.is(value, -0) ? 0 : value, unit }
}

const categoryHeader =
  /^(categoria|category|rótulo|rotulo|label|nome|name|mês|mes|month|período|periodo|period|item|data|date|produto|product|região|regiao|region|trimestre|quarter|ano|year|dia|day|equipe|team|cidade|city|estado|state|país|pais|country|canal|channel|indicador|indicator|etapa|stage|grupo|group|segmento|segment|setor|sector)$/i
const numericLooking = /^[+\-−(]?\s*(?:\d|R\$)/i

function parseTable(
  text: string,
  format: ChartNumberFormat,
  options: ParseOptions,
): ParsedChartInput {
  if (format !== 'pt-BR' && format !== 'en-US')
    throw new ChartInputError('Escolha o formato Brasil ou Internacional para os números.', 1, 1)
  if (text.length > 100_000)
    throw new ChartInputError(
      'A tabela é muito longa. Divida os dados em gráficos menores; nenhum dado foi aplicado.',
      1,
      1,
    )
  const input = text.replace(/^\uFEFF/, '')
  if (!input.trim())
    throw new ChartInputError('Adicione pelo menos uma categoria e seu valor.', 1, 1)
  if (input.includes('\u0000'))
    throw new ChartInputError('Use texto ou um arquivo CSV/TSV em UTF-8.', 1, 1)
  const delimiter = delimiterFor(input, Boolean(options.legacy))
  const rows = readRows(input, delimiter)
  if (delimiter === '|') {
    for (const row of rows) {
      if (row.cells[0]?.value === '' && !row.cells[0].quoted) row.cells.shift()
      if (row.cells.at(-1)?.value === '' && !row.cells.at(-1)!.quoted) row.cells.pop()
      row.cells.forEach((cell, index) => {
        cell.column = index + 1
      })
    }
  }
  const first = rows[0]
  if (!first || first.cells.length < 2)
    throw new ChartInputError(
      'Cada linha precisa de um rótulo e pelo menos um valor.',
      first?.line ?? 1,
      2,
    )
  const width = first.cells.length
  if (width - 1 > options.maxSeries)
    fail(
      first.cells[options.maxSeries + 1],
      `Use no máximo ${options.maxSeries} ${options.maxSeries === 1 ? 'série' : 'séries'} por gráfico. Nenhuma coluna foi descartada.`,
      'series-limit',
    )
  for (const row of rows) {
    if (row.cells.length !== width)
      fail(
        { line: row.line, column: Math.min(row.cells.length + 1, width + 1) },
        `A linha tem ${row.cells.length} colunas; o esperado é ${width}. Confira o delimitador, as aspas e as células vazias. Nenhuma linha foi descartada.`,
      )
  }
  const markdownHeader =
    delimiter === '|' &&
    rows[1]?.cells.every((cell) => !cell.quoted && /^:?-{3,}:?$/.test(cell.value.trim()))
  const namedHeader =
    categoryHeader.test(first.cells[0].value.trim()) &&
    first.cells
      .slice(1)
      .every((cell) => cell.value.trim() && !numericLooking.test(cell.value.trim()))
  const hasHeader = Boolean(markdownHeader || namedHeader)
  if (
    !options.legacy &&
    !hasHeader &&
    categoryHeader.test(first.cells[0].value.trim()) &&
    first.cells.slice(1).some((cell) => numericLooking.test(cell.value.trim()))
  ) {
    fail(
      first.cells[1],
      'O início da tabela é ambíguo: pode ser um cabeçalho numérico ou uma categoria. Adicione um cabeçalho como Categoria;Valores para dados sem cabeçalho. Para nomes de série numéricos, use uma tabela Markdown com a linha --- abaixo dos nomes, ou um nome como Receita 2025. Nenhuma linha foi descartada.',
    )
  }
  const names = hasHeader
    ? first.cells.slice(1).map((cell) => cell.value)
    : first.cells.slice(1).map((_, index) => (index ? `Série ${index + 1}` : 'Valores'))
  const seenNames = new Set<string>()
  names.forEach((name, index) => {
    if (!name.trim() || name.length > 60)
      fail(first.cells[index + 1], 'Cada série precisa de um nome de 1 a 60 caracteres.')
    const key = name.trim().toLocaleLowerCase('pt-BR')
    if (seenNames.has(key))
      fail(
        first.cells[index + 1],
        'Use nomes diferentes para as séries, sem repetir maiúsculas/minúsculas.',
      )
    seenNames.add(key)
  })
  const values: number[][] = names.map(() => [])
  const data: ChartDatum[] = []
  const seenLabels = new Set<string>()
  let unit: string | undefined
  const dataRows = rows.slice(hasHeader ? (markdownHeader ? 2 : 1) : 0)
  if (!dataRows.length)
    throw new ChartInputError(
      'O cabeçalho precisa ser seguido por pelo menos uma categoria com valores.',
      first.line + 1,
      1,
    )
  for (const row of dataRows) {
    if (data.length >= options.maxCategories)
      fail(
        row.cells[0],
        `Use no máximo ${options.maxCategories} categorias por gráfico. Divida a tabela em mais gráficos; nenhum dado foi aplicado ou descartado.`,
        'category-limit',
      )
    const label = row.cells[0].value
    if (!label.trim() || label.length > 120)
      fail(row.cells[0], 'O rótulo precisa ter de 1 a 120 caracteres.')
    const key = label.trim().toLocaleLowerCase('pt-BR')
    if (seenLabels.has(key))
      fail(
        row.cells[0],
        'Rótulo duplicado. Use uma categoria distinta por linha; valores não são somados automaticamente.',
      )
    seenLabels.add(key)
    row.cells.slice(1).forEach((cell, index) => {
      const parsed = readNumber(cell, format, Boolean(options.legacy))
      if (unit !== undefined && parsed.unit !== unit)
        fail(
          cell,
          'Use a mesma unidade em todos os valores. Não misture números sem unidade, R$ e %.',
        )
      unit = parsed.unit
      values[index].push(parsed.value)
    })
    data.push({ label, value: values[0].at(-1)! })
  }
  return {
    data,
    unit: unit ?? '',
    seriesName: names[0],
    ...(names.length > 1
      ? {
          additionalSeries: names
            .slice(1)
            .map((name, index) => ({ name, values: values[index + 1] })),
        }
      : {}),
  }
}

/** Explicit locale, at most twelve categories and three series; no partial result on error. */
export function parseChartInput(
  text: string,
  numberFormat: ChartNumberFormat = 'pt-BR',
): ParsedChartInput {
  return parseTable(text, numberFormat, { maxCategories: 12, maxSeries: 3 })
}

/** Compatibility for the existing two-column, PT-BR reader; old saved charts may have 50 rows. */
export function parseLegacyChartInput(text: string): ParsedChartInput | null {
  try {
    return parseTable(text, 'pt-BR', { maxCategories: 50, maxSeries: 1, legacy: true })
  } catch {
    return null
  }
}

type SerializableChart = Pick<ChartConfig, 'data' | 'unit' | 'seriesName' | 'additionalSeries'>

/** Unit stays in its own editor field. Never reintroduce a stale R$/% unit into the table. */
export function serializeChartInput(
  chart: SerializableChart,
  numberFormat: ChartNumberFormat = 'pt-BR',
): string {
  const series = [
    {
      name: chart.seriesName?.trim() ? chart.seriesName : 'Valores',
      values: chart.data.map((datum) => datum.value),
    },
    ...(chart.additionalSeries ?? []),
  ]
  const quote = (value: string) => `"${value.replace(/"/g, '""')}"`
  const number = (value: number) =>
    numberFormat === 'pt-BR' ? plainDecimal(value).replace('.', ',') : plainDecimal(value)
  // Markdown's separator makes numeric series names unambiguous without treating a data row as a header.
  const markdown = series.some((item) => numericLooking.test(item.name.trim()))
  const delimiter = markdown ? '|' : ';'
  const row = (fields: string[]) =>
    markdown ? `|${fields.join(delimiter)}|` : fields.join(delimiter)
  const lines = [row([quote('Categoria'), ...series.map((item) => quote(item.name))])]
  if (markdown) lines.push(row(['---', ...series.map(() => '---')]))
  chart.data.forEach((datum, index) =>
    lines.push(row([quote(datum.label), ...series.map((item) => number(item.values[index]))])),
  )
  return lines.join('\n')
}

export interface ChartTablePreview {
  columns: string[]
  rows: string[][]
}

/** Bounded, literal preview. No numeric conversion or column removal until explicit mapping. */
export function readChartTable(text: string, hasHeader: boolean): ChartTablePreview {
  if (!text.trim()) throw new Error('Cole ou importe uma tabela antes de mapear as colunas.')
  if (text.length > 100_000 || text.includes('\u0000'))
    throw new Error('Use uma tabela UTF-8 com até 100 mil caracteres.')
  const input = text.replace(/^\uFEFF/, '')
  const delimiter = delimiterFor(input, false)
  const source = readRows(input, delimiter)
  if (delimiter === '|')
    for (const row of source) {
      if (row.cells[0]?.value === '' && !row.cells[0].quoted) row.cells.shift()
      if (row.cells.at(-1)?.value === '' && !row.cells.at(-1)!.quoted) row.cells.pop()
    }
  const width = source[0]?.cells.length ?? 0
  if (width < 2 || width > 16)
    throw new Error('A prévia aceita de 2 a 16 colunas. Selecione até três séries ao mapear.')
  if (source.some((row) => row.cells.length !== width))
    throw new Error(
      'Todas as linhas precisam ter a mesma quantidade de colunas. Confira separadores, aspas e campos vazios.',
    )
  const markdownHeader =
    delimiter === '|' &&
    source[1]?.cells.every((cell) => !cell.quoted && /^:?-{3,}:?$/.test(cell.value.trim()))
  if (markdownHeader && !hasHeader)
    throw new Error(
      'Esta tabela Markdown tem um cabeçalho. Marque a opção de primeira linha como cabeçalho.',
    )
  const rows = source
    .slice(hasHeader ? (markdownHeader ? 2 : 1) : 0)
    .map((row) => row.cells.map((cell) => cell.value))
  if (!rows.length || rows.length > 12)
    throw new Error(
      'Use entre 1 e 12 linhas de dados. Nenhuma linha foi descartada; divida tabelas maiores antes de importar.',
    )
  return {
    columns: hasHeader
      ? source[0].cells.map((cell) => cell.value)
      : Array.from({ length: width }, (_, index) => `Coluna ${index + 1}`),
    rows,
  }
}

/** Explicit selection can omit columns; it cannot omit rows, fill blanks or round values. */
export function mapChartTable(
  table: ChartTablePreview,
  category: number,
  values: number[],
  numberFormat: ChartNumberFormat,
): { text: string; parsed: ParsedChartInput } {
  const chosen = [category, ...values]
  if (!values.length || values.length > 3)
    throw new Error('Escolha de uma a três colunas de valores.')
  if (
    new Set(chosen).size !== chosen.length ||
    chosen.some((index) => !Number.isInteger(index) || index < 0 || index >= table.columns.length)
  )
    throw new Error('Escolha colunas diferentes para categorias e valores.')
  const quote = (value: string) => `"${value.replace(/"/g, '""')}"`
  const row = (cells: string[]) => `|${cells.join('|')}|`
  const text = [
    row([quote('Categoria'), ...values.map((index) => quote(table.columns[index]))]),
    row(chosen.map(() => '---')),
    ...table.rows.map((cells) => row(chosen.map((index) => quote(cells[index] ?? '')))),
  ].join('\n')
  return { text, parsed: parseChartInput(text, numberFormat) }
}
