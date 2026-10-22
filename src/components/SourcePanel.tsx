import type { Deck, Slide } from '../types'
import { isContentEdited } from '../lib/creation'
import './composition.css'

export interface SourcePanelProps {
  slide: Slide
  deck: Deck
}

const KIND_LABELS = {
  source: 'Trecho do material informado',
  manual: 'Conteúdo adicionado manualmente',
  editorial: 'Sugestão editorial do Zetta',
  reused: 'Slide reutilizado de outra apresentação',
}
const SOURCE_LABELS = { text: 'Texto', pdf: 'PDF', example: 'Exemplo', manual: 'Editor' }

/** Keep all significant digits; a display formatter must not turn a small nonzero datum into zero. */
function exactValue(value: number): string {
  return String(value).replace('.', ',')
}

export function SourcePanel({ slide, deck }: SourcePanelProps) {
  const origin = slide.origin
  const edited = isContentEdited(slide)
  const charts = slide.blocks.filter((block) => block.chart)
  const diagrams = slide.blocks.filter((block) => block.diagram)
  return (
    <section className="source-panel" aria-label="Origem e conferência do conteúdo">
      <div className="source-status">
        <strong>{origin ? KIND_LABELS[origin.kind] : 'Origem individual não registrada'}</strong>
        <p>
          {origin
            ? `${SOURCE_LABELS[origin.sourceKind]} · ${origin.sourceName}`
            : 'Esta apresentação não tem um registro de origem para este slide. A fonte geral continua disponível abaixo.'}
        </p>
        {origin?.pages.length ? (
          <span className="source-chip">Páginas de origem: {origin.pages.join(', ')}</span>
        ) : null}
        {origin && (
          <span className={`source-edit-state ${edited ? 'edited' : ''}`}>
            {edited === true
              ? 'Texto ou dados editados desde o registro de origem'
              : edited === false
                ? 'Sem alteração de texto ou dados desde o registro'
                : 'Sem versão inicial para comparar alterações'}
          </span>
        )}
        <small>
          A comparação considera texto, notas e dados. Mudanças de cores, modelo e recorte de
          imagens não contam como edição de conteúdo. Este registro não verifica a veracidade das
          informações.
        </small>
      </div>
      {slide.requirements?.length ? (
        <div className="source-questions">
          <h3>Perguntas a resolver</h3>
          <p>São sugestões editoriais para sua revisão, separadas dos fatos da fonte.</p>
          <ul>
            {slide.requirements.map((question, index) => (
              <li key={index}>{question}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <details open className="source-detail">
        <summary>{origin ? 'Trecho original registrado' : 'Fonte geral da apresentação'}</summary>
        {(origin ? origin.excerpt : deck.source.text) ? (
          <pre>{origin ? origin.excerpt : deck.source.text}</pre>
        ) : (
          <p>
            {origin?.kind === 'manual'
              ? 'Este conteúdo começou no editor, sem um trecho de texto ou PDF associado.'
              : 'Nenhum trecho textual foi registrado.'}
          </p>
        )}
        {origin?.sourceKind === 'pdf' && (
          <p className="source-footnote">
            O registro contém texto extraído e referências de página. Confira imagens, tabelas e
            contexto no PDF original.
          </p>
        )}
      </details>
      {charts.map((block, index) => {
        const chart = block.chart!
        return (
          <section className="source-data" key={block.id}>
            <h3>Dados atuais · gráfico {index + 1}</h3>
            <p>
              {chart.source || 'Fonte específica do gráfico não informada.'}
              {chart.unit ? ` Unidade: ${chart.unit}.` : ''}
            </p>
            {chart.data.length ? (
              <div className="source-table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Categoria</th>
                      <th scope="col">{chart.seriesName ?? 'Valores'}</th>
                      {chart.additionalSeries?.map((series) => (
                        <th key={series.name} scope="col">
                          {series.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {chart.data.map((datum, row) => (
                      <tr key={`${row}-${datum.label}`}>
                        <th scope="row">{datum.label}</th>
                        <td>{exactValue(datum.value)}</td>
                        {chart.additionalSeries?.map((series) => (
                          <td key={series.name}>
                            {series.values[row] === undefined
                              ? 'Ausente'
                              : exactValue(series.values[row])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>Este gráfico ainda não tem dados.</p>
            )}
          </section>
        )
      })}
      {diagrams.map((block, index) => (
        <section className="source-data" key={block.id}>
          <h3>Conteúdo atual · diagrama {index + 1}</h3>
          <p>{block.diagram!.source || 'Fonte específica do diagrama não informada.'}</p>
          <ol>
            {block.diagram!.items.map((item) => (
              <li key={item.id}>
                <strong>{item.title}</strong>
                {item.label && <span> · {item.label}</span>}
                {item.value !== undefined && <span> · {item.value}</span>}
                <p>{item.description}</p>
              </li>
            ))}
          </ol>
        </section>
      ))}
      <details className="source-detail">
        <summary>Notas atuais do slide</summary>
        <pre>{slide.notes || 'Este slide não tem notas.'}</pre>
      </details>
      {origin && (
        <details className="source-detail">
          <summary>Fonte geral desta apresentação · {deck.source.name}</summary>
          <pre>{deck.source.text || 'Nenhum texto de fonte associado à apresentação.'}</pre>
        </details>
      )}
    </section>
  )
}
