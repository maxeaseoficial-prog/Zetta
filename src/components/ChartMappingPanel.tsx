import { useId, useMemo, useState } from 'react'
import { Modal } from './Modal'
import { mapChartTable, readChartTable, type ChartNumberFormat } from '../lib/chartData'
import { formatChartValue } from '../lib/chartLayout'
import './ChartMappingPanel.css'

export function ChartMappingPanel({
  text,
  format,
  onApply,
  onClose,
}: {
  text: string
  format: ChartNumberFormat
  onApply: (text: string) => void
  onClose: () => void
}) {
  const [header, setHeader] = useState<boolean | null>(null)
  const headerChoiceId = useId()
  const [category, setCategory] = useState(0)
  const [values, setValues] = useState<number[]>([1])
  const [error, setError] = useState('')
  const preview = useMemo(() => {
    if (header === null) return { table: null, error: '' }
    try {
      return { table: readChartTable(text, header), error: '' }
    } catch (reason) {
      return { table: null, error: reason instanceof Error ? reason.message : 'Confira a tabela.' }
    }
  }, [text, header])
  const mapped = useMemo(() => {
    if (!preview.table) return { result: null, error: '' }
    try {
      return { result: mapChartTable(preview.table, category, values, format), error: '' }
    } catch (reason) {
      return {
        result: null,
        error: reason instanceof Error ? reason.message : 'Confira as colunas.',
      }
    }
  }, [preview.table, category, values, format])
  const table = preview.table
  const parsed = mapped.result?.parsed
  const unused =
    table?.columns.filter((_, index) => index !== category && !values.includes(index)) ?? []
  return (
    <Modal title="Mapear colunas do gráfico" onClose={onClose} wide>
      <div className="chart-mapping">
        <p>
          Indique o que a primeira linha representa e escolha as colunas. Todas as linhas de dados
          serão preservadas. Formato dos números:{' '}
          <strong>{format === 'pt-BR' ? 'Brasil' : 'Internacional'}</strong>.
        </p>
        <fieldset className="mapping-header-choice">
          <legend>Como interpretar a primeira linha?</legend>
          <label className="mapping-header-option">
            <input
              type="radio"
              name={headerChoiceId}
              checked={header === true}
              onChange={() => {
                setHeader(true)
                setError('')
              }}
            />
            A primeira linha é cabeçalho
          </label>
          <label className="mapping-header-option">
            <input
              type="radio"
              name={headerChoiceId}
              checked={header === false}
              onChange={() => {
                setHeader(false)
                setError('')
              }}
            />
            A primeira linha contém dados
          </label>
        </fieldset>
        {!table && (
          <div className="mapping-unclassified">
            {header === null && (
              <p role="status">
                Escolha uma opção acima antes de mapear e aplicar. A primeira linha ainda faz parte
                do conteúdo original abaixo.
              </p>
            )}
            <pre aria-label="Conteúdo original da tabela">{text}</pre>
          </div>
        )}
        {table && (
          <>
            <div className="chart-table-scroll">
              <table aria-label="Tabela original para mapear">
                <thead>
                  <tr>
                    {table.columns.map((name, index) => (
                      <th key={index}>{name || `Coluna ${index + 1}`}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {table.rows.map((row, index) => (
                    <tr key={index}>
                      {row.map((cell, column) => (
                        <td key={column}>{cell || <em>Vazio</em>}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mapping-controls">
              <label className="field-label">
                COLUNA DAS CATEGORIAS
                <select
                  aria-label="Coluna das categorias"
                  value={category}
                  onChange={(event) => {
                    const next = Number(event.target.value)
                    setCategory(next)
                    setValues(values.filter((value) => value !== next))
                  }}
                >
                  {table.columns.map((name, index) => (
                    <option key={index} value={index}>
                      {name || `Coluna ${index + 1}`}
                    </option>
                  ))}
                </select>
              </label>
              <fieldset>
                <legend>Colunas de valores · até 3</legend>
                {table.columns.map((name, index) => (
                  <label key={index}>
                    <input
                      type="checkbox"
                      aria-label={`Usar valores de ${name || `Coluna ${index + 1}`}`}
                      checked={values.includes(index)}
                      disabled={
                        index === category || (!values.includes(index) && values.length >= 3)
                      }
                      onChange={(event) =>
                        setValues(
                          event.target.checked
                            ? [...values, index]
                            : values.filter((value) => value !== index),
                        )
                      }
                    />
                    {name || `Coluna ${index + 1}`}
                  </label>
                ))}
              </fieldset>
            </div>
            <p className="property-tip">
              {unused.length
                ? `Colunas que ficarão de fora por esta seleção: ${unused.join(', ')}.`
                : 'Todas as colunas estão selecionadas.'}
            </p>
          </>
        )}
        {parsed && (
          <div className="mapping-result">
            <h3>Prévia dos valores que serão aplicados</h3>
            <div className="chart-table-scroll">
              <table aria-label="Prévia dos dados mapeados">
                <thead>
                  <tr>
                    <th>Categoria</th>
                    <th>{parsed.seriesName}</th>
                    {parsed.additionalSeries?.map((series) => (
                      <th key={series.name}>{series.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parsed.data.map((datum, index) => (
                    <tr key={datum.label}>
                      <th>{datum.label}</th>
                      <td>{formatChartValue(datum.value)}</td>
                      {parsed.additionalSeries?.map((series) => (
                        <td key={series.name}>{formatChartValue(series.values[index])}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>Unidade na tabela: {parsed.unit || 'nenhuma; mantém a unidade atual do gráfico'}.</p>
          </div>
        )}
        {(preview.error || mapped.error || error) && (
          <p className="inline-error" role="alert">
            {preview.error || mapped.error || error}
          </p>
        )}
        <div className="mapping-actions">
          <button className="button secondary" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="button primary"
            disabled={header === null || !mapped.result}
            onClick={() => {
              try {
                if (header !== null && mapped.result) onApply(mapped.result.text)
              } catch (reason) {
                setError(
                  reason instanceof Error ? reason.message : 'Não foi possível aplicar os dados.',
                )
              }
            }}
          >
            Aplicar dados mapeados
          </button>
        </div>
      </div>
    </Modal>
  )
}
