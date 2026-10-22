import { describe, expect, it } from 'vitest'
import { mapChartTable, readChartTable } from '../src/lib/chartData'

describe('explicit chart column mapping', () => {
  it('maps a category from the middle and selects series in the chosen order', () => {
    const table = readChartTable(
      'Receita;Equipe;Despesa;Observação\n1.250,75;Azul;0;Conferido\n0;Verde;-12,5;Pendente',
      true,
    )
    const result = mapChartTable(table, 1, [2, 0], 'pt-BR')
    expect(result.parsed.data).toEqual([
      { label: 'Azul', value: 0 },
      { label: 'Verde', value: -12.5 },
    ])
    expect(result.parsed.additionalSeries).toEqual([{ name: 'Receita', values: [1250.75, 0] }])
    expect(table.columns).toHaveLength(4)
    expect(table.rows[1][3]).toBe('Pendente')
  })
  it('keeps units, literal quoted labels, numeric headers and all rows', () => {
    const table = readChartTable('2025;Categoria\n"R$ 1.250,75";"A; B"\nR$ 0;Zero', true)
    const { parsed } = mapChartTable(table, 1, [0], 'pt-BR')
    expect(parsed.unit).toBe('R$')
    expect(parsed.seriesName).toBe('2025')
    expect(parsed.data).toEqual([
      { label: 'A; B', value: 1250.75 },
      { label: 'Zero', value: 0 },
    ])
  })
  it('does not discard the first data row when no header is selected', () => {
    const result = mapChartTable(readChartTable('Azul\t12,50\nVerde\t0', false), 0, [1], 'pt-BR')
    expect(result.parsed.data).toEqual([
      { label: 'Azul', value: 12.5 },
      { label: 'Verde', value: 0 },
    ])
  })
  it('rejects blanks, ambiguous values and precision loss without filling or rounding', () => {
    for (const input of [
      'Equipe;Valor\nA;',
      'Equipe;Valor\nA;1,234.56',
      'Equipe;Valor\nA;0,123456789012345678901',
    ])
      expect(() => mapChartTable(readChartTable(input, true), 0, [1], 'pt-BR')).toThrow()
  })
  it('rejects row and selection limits instead of clipping', () => {
    expect(() =>
      readChartTable(
        'Categoria;Valor\n' + Array.from({ length: 13 }, (_, index) => `${index};1`).join('\n'),
        true,
      ),
    ).toThrow(/Nenhuma linha/)
    const table = readChartTable('A;B;C;D;E\na;1;2;3;4', true)
    expect(() => mapChartTable(table, 0, [1, 2, 3, 4], 'pt-BR')).toThrow(/três/)
    expect(() => mapChartTable(table, 0, [0], 'pt-BR')).toThrow(/diferentes/)
    expect(() => mapChartTable(table, 0, [1, 1], 'pt-BR')).toThrow(/diferentes/)
  })
})
