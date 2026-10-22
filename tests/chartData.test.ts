import { describe, expect, it } from 'vitest'
import type { ChartConfig } from '../src/types'
import {
  ChartInputError,
  parseChartInput,
  parseLegacyChartInput,
  serializeChartInput,
} from '../src/lib/chartData'

describe('chart table input', () => {
  it('preserves named series, decimals, negatives and real zeroes in a PT-BR table', () => {
    expect(
      parseChartInput(
        'Mês;Receita;Custo;Saldo\nJaneiro;1.234,56;100;0\nFevereiro;0;(25,50);-25,50',
      ),
    ).toEqual({
      data: [
        { label: 'Janeiro', value: 1234.56 },
        { label: 'Fevereiro', value: 0 },
      ],
      unit: '',
      seriesName: 'Receita',
      additionalSeries: [
        { name: 'Custo', values: [100, -25.5] },
        { name: 'Saldo', values: [0, -25.5] },
      ],
    })
  })

  it('uses the explicit number format, not a guess based on punctuation', () => {
    expect(parseChartInput('A;1.234\nB;0').data[0].value).toBe(1234)
    expect(parseChartInput('A;1.234\nB;0', 'en-US').data[0].value).toBe(1.234)
    expect(
      parseChartInput('Category,Revenue,Cost\nNorth,"1,234.56",-20.5\nSouth,0,10', 'en-US'),
    ).toMatchObject({
      data: [
        { label: 'North', value: 1234.56 },
        { label: 'South', value: 0 },
      ],
      seriesName: 'Revenue',
      additionalSeries: [{ name: 'Cost', values: [-20.5, 10] }],
    })
    expect(() => parseChartInput('A;1.25')).toThrow(/Linha 1, coluna 2.*Brasil/)
    expect(() => parseChartInput('A;1,25', 'en-US')).toThrow(/Internacional/)
  })

  it.each([
    ['Mês\tReceita\tDespesa\nJan\t10\t5\nFev\t0\t-2', 'Receita'],
    [
      '| Mês | Receita | Despesa |\n| --- | ---: | :---: |\n| Jan | 10 | 5 |\n| Fev | 0 | -2 |',
      'Receita',
    ],
    ['Categoria,Receita,Despesa\nJan,10,5\nFev,0,-2', 'Receita'],
  ])('accepts TSV, Markdown and CSV without dropping columns', (text, name) => {
    const result = parseChartInput(text)
    expect(result.data.map((datum) => datum.value)).toEqual([10, 0])
    expect(result.seriesName).toBe(name)
    expect(result.additionalSeries).toEqual([{ name: 'Despesa', values: [5, -2] }])
  })

  it('handles proper quotes, delimiters, literal double quotes and multiline labels', () => {
    const input =
      '\uFEFF"Categoria";"Receita; líquida"\r\n"  Sul; \"\"Interior\"\"  ";"10,50"\r\n"Norte\r\nLitoral";0\r\n'
    expect(parseChartInput(input)).toEqual({
      data: [
        { label: '  Sul; "Interior"  ', value: 10.5 },
        { label: 'Norte\r\nLitoral', value: 0 },
      ],
      unit: '',
      seriesName: 'Receita; líquida',
    })
    expect(parseChartInput('"Primeiro, trimestre","10,50"\nSegundo,0').data).toEqual([
      { label: 'Primeiro, trimestre', value: 10.5 },
      { label: 'Segundo', value: 0 },
    ])
    expect(
      parseChartInput('| Categoria | Valor |\n| --- | --- |\n| "A|B" | 10 |').data[0].label,
    ).toBe('A|B')
    expect(
      parseChartInput('| Categoria | Receita; líquida |\n| --- | --- |\n| A; Sul | 10 |')
        .seriesName,
    ).toBe('Receita; líquida')
  })

  it('uses predictable default names when no header was supplied', () => {
    expect(parseChartInput('A;0;2\nB;-1;4')).toEqual({
      data: [
        { label: 'A', value: 0 },
        { label: 'B', value: -1 },
      ],
      unit: '',
      seriesName: 'Valores',
      additionalSeries: [{ name: 'Série 2', values: [2, 4] }],
    })
    // Reserved first-column names with numeric headers must not silently consume or invent a data row.
    expect(() => parseChartInput('Mês;10\nOutro;20')).toThrow(
      /ambíguo.*Nenhuma linha foi descartada/,
    )
    expect(() => parseChartInput('"Categoria";"2025";"2026"\nNorte;10;20')).toThrow(
      /cabeçalho numérico/,
    )
    expect(parseChartInput('Categoria;Valores\nMês;10\nOutro;20').data).toHaveLength(2)
  })

  it('reads consistent R$/% cells without inventing a unit from a label or header', () => {
    expect(parseChartInput('A;R$ 0\nB;R$ (12,50)')).toMatchObject({
      unit: 'R$',
      data: [
        { label: 'A', value: 0 },
        { label: 'B', value: -12.5 },
      ],
    })
    expect(parseChartInput('A;0%\nB;12,5%').unit).toBe('%')
    expect(parseChartInput('Categoria;Receita R$\nTaxa %;0\nPreço R$;10').unit).toBe('')
    expect(() => parseChartInput('A;R$ 0\nB;10')).toThrow(/Linha 2, coluna 2.*mesma unidade/)
    expect(() => parseChartInput('Categoria;Receita;Custo\nA;R$ 1;2%')).toThrow(
      /Linha 2, coluna 3.*mesma unidade/,
    )
  })

  it('rejects missing, malformed, duplicate and extra data atomically with locations', () => {
    const cases: Array<[string, RegExp]> = [
      ['Mês;Receita;Custo\nJan;0;10\nFev;;20', /Linha 3, coluna 2/],
      ['Mês;Receita;Custo\nJan;0', /Linha 2, coluna 3/],
      ['Mês;Receita;Custo\nJan;0;1;2', /Linha 2, coluna 4/],
      ['Mês;Receita; receita \nJan;1;2', /Linha 1, coluna 3.*nomes diferentes/],
      ['A;10\n" a ";20', /Linha 2, coluna 1.*duplicado/],
      ['"A"extra;1', /Linha 1, coluna 1.*aspas/],
      ['A"B";1', /Linha 1, coluna 1.*Aspas/],
      ['A;10\n"B;2', /Linha 2, coluna 1.*fechada/],
      ['A;10\n;20', /Linha 2, coluna 1.*rótulo/],
      ['Categoria;Valor\nA;10\n---;---\nB;20', /Linha 3, coluna 2/],
      ['A;10\nB;=2+3', /Linha 2, coluna 2/],
      ['Mês;12abc\nB;20', /Linha 1, coluna 2/],
    ]
    for (const [input, message] of cases)
      expect(() => parseChartInput(input), input).toThrow(message)
  })

  it('rejects excess categories and series instead of slicing a partial chart', () => {
    const twelve = Array.from({ length: 12 }, (_, index) => `Categoria ${index};${index}`).join(
      '\n',
    )
    expect(parseChartInput(twelve).data).toHaveLength(12)
    try {
      parseChartInput(twelve + '\nCategoria 12;12')
      expect.fail('Thirteen categories must fail')
    } catch (error) {
      expect(error).toBeInstanceOf(ChartInputError)
      expect(error).toMatchObject({ line: 13, column: 1, code: 'category-limit' })
      expect((error as Error).message).toMatch(/Divida.*nenhum dado/)
    }
    expect(() => parseChartInput('Categoria;A;B;C;D\nUma;1;2;3;4')).toThrow(
      /Linha 1, coluna 5.*Nenhuma coluna foi descartada/,
    )
  })

  it('preserves representable precision and refuses rounding, overflow and underflow', () => {
    expect(
      parseChartInput('A;0,000000000001\nB;0,30000000000000004\nC;1000000000000').data.map(
        (datum) => datum.value,
      ),
    ).toEqual([1e-12, 0.30000000000000004, 1e12])
    for (const raw of [
      '999999999999,12345678',
      '0,30000000000000000001',
      '0,' + '0'.repeat(324) + '1',
    ]) {
      expect(() => parseChartInput(`A;${raw}`)).toThrow(/precisão/)
    }
    for (const raw of ['1000000000001', 'Infinity', 'NaN', '1e3', '1.00.000', '1,2,3', '(+12)']) {
      expect(() => parseChartInput(`A;${raw}`)).toThrow()
    }
  })
})

describe('lossless editable table serialization', () => {
  it.each(['pt-BR', 'en-US'] as const)(
    'round-trips labels, series names and numbers in %s without retaining units',
    (format) => {
      const chart: ChartConfig = {
        type: 'line',
        unit: 'R$',
        source: 'Source stays outside the table',
        seriesName: 'Receita; "líquida"',
        data: [
          { label: '  Sul; litoral  ', value: 0.30000000000000004 },
          { label: 'Norte\nInterior', value: 1e-100 },
          { label: 'A|B, C', value: -999999999999.5 },
          { label: 'Zero', value: 0 },
        ],
        additionalSeries: [
          { name: 'Custo\nprevisto', values: [0, 1e-8, -12.5, 1000] },
          { name: 'Saldo', values: [1, -2, 3.123456789012345, 0] },
        ],
      }
      const text = serializeChartInput(chart, format)
      const parsed = parseChartInput(text, format)
      expect(parsed).toEqual({
        data: chart.data,
        unit: '',
        seriesName: chart.seriesName,
        additionalSeries: chart.additionalSeries,
      })
      expect(text).not.toContain('R$')
      expect(text).not.toContain('e-100')
      expect(serializeChartInput({ ...chart, unit: '%' }, format)).toBe(text)
    },
  )

  it('marks numeric series headers explicitly so they cannot consume a real first data row', () => {
    const chart: ChartConfig = {
      type: 'bar',
      unit: '',
      source: '',
      seriesName: '2025',
      data: [
        { label: 'A', value: 1 },
        { label: 'B', value: 2 },
      ],
      additionalSeries: [{ name: '2026', values: [3, 4] }],
    }
    const text = serializeChartInput(chart)
    expect(text).toContain('|---|---|---|')
    expect(parseChartInput(text)).toEqual({
      data: chart.data,
      unit: '',
      seriesName: '2025',
      additionalSeries: chart.additionalSeries,
    })
  })

  it('serializes empty drafts and all legacy rows without inserting invented values', () => {
    expect(serializeChartInput({ data: [], unit: '' })).toBe('"Categoria";"Valores"')
    const data = Array.from({ length: 50 }, (_, index) => ({
      label: `Item ${index}`,
      value: index,
    }))
    const text = serializeChartInput({ data, unit: '' })
    expect(text.split('\n')).toHaveLength(51)
    expect(parseLegacyChartInput(text)?.data).toEqual(data)
    expect(() => parseChartInput(text)).toThrow(/12 categorias/)
  })
})
