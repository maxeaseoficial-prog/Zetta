import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import type { DiagramConfig, DiagramType, SlideBlock } from '../types'
import './DiagramEditor.css'

export const diagramLabels: Record<DiagramType, string> = {
  process: 'Processo',
  timeline: 'Linha do tempo',
  comparison: 'Comparação',
  metrics: 'Indicadores',
}

export function createDiagramBlock(type: DiagramType): SlideBlock {
  const title = type === 'comparison' ? 'Opção' : type === 'metrics' ? 'Indicador' : 'Etapa'
  return {
    id: crypto.randomUUID(),
    type: 'diagram',
    content: diagramLabels[type],
    diagram: {
      type,
      source: '',
      items: [1, 2].map((index) => ({
        id: crypto.randomUUID(),
        title: `${title} ${index}`,
        description: 'Preencha com as informações da sua fonte.',
        ...(type === 'timeline' ? { label: 'Data a definir' } : {}),
        ...(type === 'metrics' ? { value: '—' } : {}),
      })),
    },
  }
}

export function DiagramEditor({
  block,
  onChange,
  onTitleChange,
}: {
  block: SlideBlock
  onChange: (diagram: DiagramConfig) => void
  onTitleChange: (title: string) => void
}) {
  const diagram = block.diagram!
  function updateItem(
    index: number,
    field: 'title' | 'description' | 'label' | 'value',
    value: string,
  ) {
    onChange({
      ...diagram,
      items: diagram.items.map((item, at) => (at === index ? { ...item, [field]: value } : item)),
    })
  }
  function move(index: number, delta: number) {
    const items = [...diagram.items]
    ;[items[index], items[index + delta]] = [items[index + delta], items[index]]
    onChange({ ...diagram, items })
  }
  const recommended = diagram.type === 'comparison' ? 2 : diagram.type === 'metrics' ? 4 : 6
  return (
    <div className="diagram-editor">
      <label className="field-label">
        FORMATO
        <select
          aria-label="Formato do diagrama"
          value={diagram.type}
          onChange={(event) => onChange({ ...diagram, type: event.target.value as DiagramType })}
        >
          {Object.entries(diagramLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="field-label">
        TÍTULO DO BLOCO
        <input
          aria-label="Título do diagrama"
          maxLength={300}
          value={block.content}
          onChange={(event) => onTitleChange(event.target.value)}
        />
      </label>
      <p className="property-tip">
        Edite os campos com informações da sua fonte. A ordem é manual; datas e indicadores não são
        calculados automaticamente.
      </p>
      {diagram.items.length > recommended && (
        <p className="inline-error" role="status">
          Este formato comporta melhor até {recommended} itens. Todos continuam guardados; escolha
          outro formato ou distribua o conteúdo.
        </p>
      )}
      {diagram.items.map((item, index) => (
        <fieldset className="diagram-item-editor" key={item.id}>
          <legend>Item {index + 1}</legend>
          <label>
            Título
            <input
              aria-label={`Título do item ${index + 1}`}
              value={item.title}
              maxLength={300}
              onChange={(event) => updateItem(index, 'title', event.target.value)}
            />
          </label>
          <label>
            Descrição
            <textarea
              aria-label={`Descrição do item ${index + 1}`}
              value={item.description}
              rows={3}
              maxLength={5000}
              onChange={(event) => updateItem(index, 'description', event.target.value)}
            />
          </label>
          <label>
            Data ou rótulo
            <input
              aria-label={`Rótulo do item ${index + 1}`}
              value={item.label ?? ''}
              maxLength={120}
              placeholder={diagram.type === 'timeline' ? 'Ex.: 22/10/2026' : 'Opcional'}
              onChange={(event) => updateItem(index, 'label', event.target.value)}
            />
          </label>
          <label>
            Valor literal
            <input
              aria-label={`Valor do item ${index + 1}`}
              value={item.value ?? ''}
              maxLength={120}
              placeholder="Ex.: R$ 1.250,75 ou 18%"
              onChange={(event) => updateItem(index, 'value', event.target.value)}
            />
          </label>
          <div className="diagram-item-actions">
            <button
              className="icon-button"
              aria-label={`Subir item ${index + 1}`}
              disabled={index === 0}
              onClick={() => move(index, -1)}
            >
              <ArrowUp size={15} />
            </button>
            <button
              className="icon-button"
              aria-label={`Descer item ${index + 1}`}
              disabled={index === diagram.items.length - 1}
              onClick={() => move(index, 1)}
            >
              <ArrowDown size={15} />
            </button>
            <button
              className="text-button danger"
              onClick={() =>
                onChange({ ...diagram, items: diagram.items.filter((_, at) => at !== index) })
              }
            >
              <Trash2 size={14} /> Remover item {index + 1}
            </button>
          </div>
        </fieldset>
      ))}
      <button
        className="button secondary full-width"
        disabled={diagram.items.length >= 6}
        onClick={() =>
          onChange({
            ...diagram,
            items: [
              ...diagram.items,
              { id: crypto.randomUUID(), title: 'Novo item', description: '' },
            ],
          })
        }
      >
        <Plus size={15} /> Adicionar item
      </button>
      <label className="field-label">
        FONTE
        <textarea
          aria-label="Fonte do diagrama"
          value={diagram.source}
          maxLength={5000}
          rows={2}
          onChange={(event) => onChange({ ...diagram, source: event.target.value })}
        />
      </label>
      <p className="property-tip">
        Trocar o formato preserva todos os campos. Conteúdo que não couber gera um aviso no slide.
      </p>
    </div>
  )
}
