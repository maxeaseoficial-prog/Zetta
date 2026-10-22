import { useMemo, useState } from 'react'
import {
  ArrowRight,
  Check,
  Columns2,
  Focus,
  Highlighter,
  LayoutTemplate,
  Split,
} from 'lucide-react'
import type { BrandKit, Layout, Slide, Theme } from '../types'
import {
  compositionUnavailableReason,
  planComposition,
  type CompositionAction,
} from '../lib/composition'
import { createId } from '../lib/generator'
import { SlideCanvas, getSlideWarnings } from './SlideCanvas'
import './composition.css'

export interface CompositionPanelProps {
  slide: Slide
  theme: Theme
  accent: string
  brand?: BrandKit
  slideCount: number
  onApply: (slides: Slide[]) => void
}

const LAYOUTS: Array<[Layout, string]> = [
  ['section', 'Conteúdo em destaque'],
  ['split', 'Composição dividida'],
  ['columns', 'Colunas'],
  ['bullets', 'Lista de tópicos'],
  ['quote', 'Mensagem em destaque'],
  ['chart', 'Dados'],
  ['cover', 'Capa'],
  ['closing', 'Encerramento'],
]

export function CompositionPanel({
  slide,
  theme,
  accent,
  brand,
  slideCount,
  onApply,
}: CompositionPanelProps) {
  const [action, setAction] = useState<CompositionAction>({ type: 'split' })
  const [error, setError] = useState('')
  const context = useMemo(
    () => ({ slideCount, makeId: () => createId('composition') }),
    [slideCount],
  )
  const plan = useMemo(() => planComposition(slide, action, context), [slide, action, context])
  const previews = useMemo(
    () =>
      plan.ok
        ? plan.slides.map((item) => ({
            slide: item,
            warnings: getSlideWarnings(item, theme, brand),
          }))
        : [],
    [plan, theme, brand],
  )
  const textBlocks = slide.blocks.filter((block) =>
    ['text', 'bullets', 'callout'].includes(block.type),
  )
  const chartBlocks = slide.blocks.filter((block) => block.type === 'chart' && block.chart)
  const defaultTextBlock =
    textBlocks.find((block) => block.type !== 'callout' || !block.style?.bold) ?? textBlocks[0]
  const alternatives: Array<{ label: string; action: CompositionAction; Icon: typeof Split }> = [
    { label: 'Dividir slide', action: { type: 'split' }, Icon: Split },
    {
      label: 'Ampliar gráfico',
      action: { type: 'focus-chart', blockId: chartBlocks[0]?.id ?? '' },
      Icon: Focus,
    },
    { label: 'Comparar dois blocos', action: { type: 'compare' }, Icon: Columns2 },
    {
      label: 'Destacar texto',
      action: { type: 'emphasize', blockId: defaultTextBlock?.id ?? '' },
      Icon: Highlighter,
    },
  ]
  function select(next: CompositionAction) {
    setAction(next)
    setError('')
  }
  function apply() {
    if (!plan.ok) return
    setError('')
    try {
      onApply(plan.slides)
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Não foi possível aplicar. O slide original foi mantido; revise a composição.',
      )
    }
  }
  return (
    <section className="composition-panel" aria-label="Assistente de composição">
      <p className="composition-intro">
        Escolha uma mudança e confira o resultado antes de aplicar. Textos, dados e notas acompanham
        a composição.
      </p>
      <div className="composition-action-grid">
        {alternatives.map(({ label, action: candidate, Icon }) => {
          const unavailable = compositionUnavailableReason(slide, candidate, context)
          return (
            <div className="composition-action-option" key={candidate.type}>
              <button
                type="button"
                className={`composition-action ${action.type === candidate.type ? 'active' : ''}`}
                disabled={Boolean(unavailable)}
                aria-pressed={action.type === candidate.type}
                onClick={() => select(candidate)}
              >
                <Icon size={17} />
                <span>{label}</span>
              </button>
              {unavailable && <small>{unavailable}</small>}
            </div>
          )
        })}
      </div>
      <label className="field-label composition-layout-label">
        <span>
          <LayoutTemplate size={15} /> Trocar modelo
        </span>
        <select
          aria-label="Modelo da composição"
          value={action.type === 'layout' ? action.layout : ''}
          onChange={(event) => select({ type: 'layout', layout: event.target.value as Layout })}
        >
          <option value="" disabled>
            Escolha um modelo para comparar
          </option>
          {LAYOUTS.map(([layout, label]) => {
            const unavailable = compositionUnavailableReason(
              slide,
              { type: 'layout', layout },
              context,
            )
            return (
              <option value={layout} key={layout} disabled={Boolean(unavailable)}>
                {label}
                {unavailable
                  ? ` — ${layout === slide.layout ? 'atual' : 'indisponível para estes blocos'}`
                  : ''}
              </option>
            )
          })}
        </select>
      </label>
      {action.type === 'emphasize' && textBlocks.length > 1 && (
        <label className="field-label">
          Texto a destacar
          <select
            value={action.blockId}
            onChange={(event) => select({ type: 'emphasize', blockId: event.target.value })}
          >
            {textBlocks.map((block, index) => (
              <option key={block.id} value={block.id}>
                Bloco {index + 1} · {block.content.slice(0, 65) || 'Texto vazio'}
              </option>
            ))}
          </select>
        </label>
      )}
      {action.type === 'focus-chart' && chartBlocks.length > 1 && (
        <label className="field-label">
          Gráfico a ampliar
          <select
            value={action.blockId}
            onChange={(event) => select({ type: 'focus-chart', blockId: event.target.value })}
          >
            {chartBlocks.map((block, index) => (
              <option key={block.id} value={block.id}>
                Gráfico {index + 1} · {block.content || block.chart?.seriesName || 'Valores'}
              </option>
            ))}
          </select>
        </label>
      )}
      {plan.ok ? (
        <div className="composition-preview" aria-live="polite">
          <h3>{plan.label}</h3>
          <p>{plan.description}</p>
          <div className={`composition-preview-grid ${previews.length > 1 ? 'multiple' : ''}`}>
            {previews.map(({ slide: preview, warnings }, index) => (
              <figure key={preview.id}>
                <figcaption>
                  {previews.length > 1
                    ? `Parte ${index + 1} de ${previews.length}`
                    : 'Depois da mudança'}
                </figcaption>
                <div className="composition-preview-canvas">
                  <SlideCanvas slide={preview} theme={theme} accent={accent} brand={brand} />
                </div>
                {warnings.length > 0 && (
                  <div className="composition-warning">
                    <strong>Ainda precisa de ajustes</strong>
                    <ul>
                      {warnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </figure>
            ))}
          </div>
          {previews.some(({ warnings }) => warnings.length > 0) && (
            <p className="composition-caution">
              Você pode aplicar esta etapa e continuar dividindo ou ajustando o conteúdo. Resolva os
              avisos de leitura antes de exportar.
            </p>
          )}
          <div className="composition-apply-row">
            <span>
              <Check size={15} /> Você pode desfazer no editor.
            </span>
            <button type="button" className="button primary" onClick={apply}>
              Aplicar composição <ArrowRight size={16} />
            </button>
          </div>
        </div>
      ) : (
        <p className="composition-unavailable" role="status">
          {plan.reason}
        </p>
      )}
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}
