import { useMemo, useRef, useState } from 'react'
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  ChevronRight,
  FileText,
  GripVertical,
  Info,
  LoaderCircle,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
} from 'lucide-react'
import type { Deck, GenerationOptions, OutlineItem, PresentationBrief } from '../types'
import {
  AUDIENCE_LABELS,
  DEFAULT_BRIEF,
  PURPOSE_LABELS,
  isOutlineEdited,
  normalizeBrief,
  type CreationInput,
} from '../lib/creation'
import { buildOutline, createId, generateDeck, getGenerationWarnings } from '../lib/generator'
import { getTheme } from '../lib/themes'
import { Brand } from './Brand'
import { ColorPicker, ThemePicker } from './ThemePicker'
import './creation.css'

export function CreationWizard({
  input,
  onBack,
  onCreate,
}: {
  input: CreationInput
  onBack: () => void
  onCreate: (deck: Deck) => void
}) {
  const [options, setOptions] = useState<GenerationOptions>(input.options)
  const [outline, setOutline] = useState<OutlineItem[]>(() =>
    buildOutline(input.text, {
      ...input.options,
      pages: input.pages,
      sourceName: input.sourceName,
      sourceKind: input.sourceKind,
    }),
  )
  const [title, setTitle] = useState(() =>
    input.sourceKind === 'pdf'
      ? input.sourceName.replace(/\.pdf$/i, '')
      : (buildOutline(input.text, input.options)[0]?.title ?? 'Minha apresentação'),
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [briefDraft, setBriefDraft] = useState<PresentationBrief>(() => ({
    ...(input.options.brief ?? DEFAULT_BRIEF),
  }))
  const [rebuildPreview, setRebuildPreview] = useState<{
    outline: OutlineItem[]
    brief: PresentationBrief
  } | null>(null)
  const [rebuildError, setRebuildError] = useState('')
  const rebuildPreviewRef = useRef<HTMLDivElement>(null)
  const appliedBrief = options.brief ?? DEFAULT_BRIEF
  const briefPending =
    briefDraft.purpose !== appliedBrief.purpose ||
    briefDraft.audience !== appliedBrief.audience ||
    briefDraft.durationMinutes !== appliedBrief.durationMinutes
  const warnings = useMemo(
    () => [
      ...input.warnings,
      ...getGenerationWarnings(input.text, outline, {
        ...options,
        pages: input.pages,
        sourceName: input.sourceName,
        sourceKind: input.sourceKind,
      }),
    ],
    [input, outline, options],
  )
  function updateBrief(patch: Partial<PresentationBrief>) {
    setBriefDraft((current) => ({ ...current, ...patch }))
    setRebuildPreview(null)
    setRebuildError('')
  }
  function previewRebuild() {
    setRebuildError('')
    try {
      const brief = normalizeBrief(briefDraft)
      setRebuildPreview({
        brief,
        outline: buildOutline(input.text, {
          ...options,
          brief,
          pages: input.pages,
          sourceName: input.sourceName,
          sourceKind: input.sourceKind,
        }),
      })
      requestAnimationFrame(() =>
        rebuildPreviewRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }),
      )
    } catch (cause) {
      setRebuildError(
        cause instanceof Error
          ? cause.message
          : 'Não foi possível preparar o roteiro. Confira os campos.',
      )
    }
  }
  function updateItem(index: number, key: 'title' | 'content', value: string) {
    setOutline((items) => items.map((item, i) => (i === index ? { ...item, [key]: value } : item)))
  }
  function move(index: number, delta: number) {
    setOutline((items) => {
      const next = [...items]
      const target = index + delta
      if (target < 0 || target >= next.length) return items
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }
  async function create() {
    setBusy(true)
    setError('')
    try {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      const result = generateDeck(input.text, outline, {
        ...options,
        title,
        sourceName: input.sourceName,
        sourceKind: input.sourceKind,
        pages: input.pages,
      })
      onCreate(result)
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Não foi possível criar. Revise o conteúdo e tente novamente.',
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="wizard">
      <header className="wizard-header">
        <button className="brand-button" onClick={onBack}>
          <Brand small />
        </button>
        <div className="steps">
          <span className="complete">
            <Check size={13} /> Conteúdo
          </span>
          <ChevronRight size={13} />
          <span className="current">
            <i>2</i> Roteiro e estilo
          </span>
          <ChevronRight size={13} />
          <span>
            <i>3</i> Sua apresentação
          </span>
        </div>
        <button className="button secondary" onClick={onBack}>
          <ArrowLeft size={15} /> Voltar
        </button>
      </header>
      <main className="wizard-main">
        <div className="wizard-heading">
          <span className="eyebrow-label">UM POUCO DE DIREÇÃO. MUITA POSSIBILIDADE.</span>
          <h1>
            Uma boa história
            <br />
            começa pelo roteiro<span>.</span>
          </h1>
          <p>Revise a sequência, escolha o visual e deixe o restante com o Zetta.</p>
        </div>
        <div className="wizard-columns">
          <section className="outline-panel">
            <div className="panel-title">
              <div>
                <span className="step-number">01</span>
                <h2>Organize suas ideias</h2>
              </div>
              <span className="pill">{outline.length + 2} slides</span>
            </div>
            <div className="outline-intro">
              <FileText size={17} />
              <span>
                {input.sourceName} · {input.text.length.toLocaleString('pt-BR')} caracteres
              </span>
            </div>
            <section className="narrative-brief" aria-label="Direção do roteiro">
              <h3>Para quem e para quê?</h3>
              <p>
                O objetivo e o público orientam a ordem dos tópicos. Informações que faltam aparecem
                como perguntas para você resolver.
              </p>
              <div className="narrative-brief-fields">
                <label className="field-label">
                  Objetivo
                  <select
                    aria-label="Objetivo da apresentação"
                    value={briefDraft.purpose}
                    onChange={(event) =>
                      updateBrief({ purpose: event.target.value as PresentationBrief['purpose'] })
                    }
                  >
                    {Object.entries(PURPOSE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field-label">
                  Público
                  <select
                    aria-label="Público da apresentação"
                    value={briefDraft.audience}
                    onChange={(event) =>
                      updateBrief({ audience: event.target.value as PresentationBrief['audience'] })
                    }
                  >
                    {Object.entries(AUDIENCE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field-label">
                  Duração desejada · minutos
                  <input
                    aria-label="Duração da apresentação em minutos"
                    type="number"
                    min={1}
                    max={180}
                    step={1}
                    value={briefDraft.durationMinutes ?? ''}
                    placeholder="Opcional"
                    onChange={(event) =>
                      updateBrief({
                        durationMinutes:
                          event.target.value === '' ? undefined : Number(event.target.value),
                      })
                    }
                  />
                </label>
              </div>
              <div className="narrative-brief-actions">
                <button type="button" className="button secondary" onClick={previewRebuild}>
                  <RotateCcw size={14} /> Ver roteiro sugerido
                </button>
                {briefPending && (
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => {
                      setBriefDraft({ ...appliedBrief })
                      setRebuildPreview(null)
                      setRebuildError('')
                    }}
                  >
                    Manter direção atual
                  </button>
                )}
              </div>
              {briefPending && (
                <p className="narrative-pending">
                  As opções acima ainda não foram aplicadas. Confira a sugestão antes de substituir
                  seu roteiro.
                </p>
              )}
              {rebuildError && (
                <p className="inline-error" role="alert">
                  {rebuildError}
                </p>
              )}
              {rebuildPreview && (
                <div
                  ref={rebuildPreviewRef}
                  className="narrative-preview"
                  aria-label="Prévia do novo roteiro"
                >
                  <h4>Roteiro sugerido · {rebuildPreview.outline.length + 2} slides</h4>
                  <p>
                    {PURPOSE_LABELS[rebuildPreview.brief.purpose]} ·{' '}
                    {AUDIENCE_LABELS[rebuildPreview.brief.audience]}
                    {rebuildPreview.brief.durationMinutes
                      ? ` · cerca de ${rebuildPreview.brief.durationMinutes} min pretendidos`
                      : ''}
                  </p>
                  <ol>
                    {rebuildPreview.outline.map((item) => (
                      <li key={item.id}>
                        <strong>{item.title}</strong>
                        <details>
                          <summary>Conferir conteúdo do tópico</summary>
                          <pre>{item.content}</pre>
                        </details>
                      </li>
                    ))}
                  </ol>
                  {rebuildPreview.outline.some((item) => item.requirements?.length) && (
                    <div className="narrative-questions">
                      <strong>Perguntas que merecem revisão</strong>
                      <ul>
                        {rebuildPreview.outline
                          .flatMap((item) => item.requirements ?? [])
                          .map((question) => (
                            <li key={question}>{question}</li>
                          ))}
                      </ul>
                    </div>
                  )}
                  <p>
                    Aplicar substitui os tópicos e suas edições pelo roteiro acima. A fonte original
                    permanece intacta. A duração é uma referência para o ritmo, não uma estimativa
                    de leitura medida.
                  </p>
                  <div className="narrative-brief-actions">
                    <button
                      type="button"
                      className="button primary"
                      onClick={() => {
                        setOutline(rebuildPreview.outline)
                        setOptions((current) => ({ ...current, brief: rebuildPreview.brief }))
                        setRebuildPreview(null)
                        setError('')
                      }}
                    >
                      <Check size={14} /> Aplicar este roteiro
                    </button>
                    <button
                      type="button"
                      className="button secondary"
                      onClick={() => setRebuildPreview(null)}
                    >
                      Cancelar prévia
                    </button>
                  </div>
                </div>
              )}
            </section>
            <label className="field-label title-field">
              NOME DA APRESENTAÇÃO
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={140}
                placeholder="Dê um nome à sua apresentação"
                aria-label="Nome da apresentação"
              />
            </label>
            <div className="cover-outline">
              <span className="outline-number">01</span>
              <div>
                <strong>Sua capa</strong>
                <span>O título e a abertura da apresentação.</span>
              </div>
              <span className="auto-label">Automático</span>
            </div>
            <div className="outline-list">
              {outline.map((item, index) => (
                <article className="outline-item" key={item.id}>
                  <div className="outline-item-top">
                    <GripVertical size={15} className="muted" />
                    <span className="outline-number">{String(index + 2).padStart(2, '0')}</span>
                    <input
                      aria-label={'Título do tópico ' + (index + 1)}
                      value={item.title}
                      onChange={(e) => updateItem(index, 'title', e.target.value)}
                      maxLength={140}
                    />
                    <div className="outline-actions">
                      <button
                        className="icon-button"
                        aria-label={'Subir tópico ' + (index + 1)}
                        disabled={index === 0}
                        onClick={() => move(index, -1)}
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        className="icon-button"
                        aria-label={'Descer tópico ' + (index + 1)}
                        disabled={index === outline.length - 1}
                        onClick={() => move(index, 1)}
                      >
                        <ArrowDown size={14} />
                      </button>
                      <button
                        className="icon-button"
                        aria-label={'Excluir tópico ' + (index + 1)}
                        disabled={outline.length <= 1}
                        onClick={() => setOutline((items) => items.filter((x) => x.id !== item.id))}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <textarea
                    aria-label={'Conteúdo do tópico ' + (index + 1)}
                    value={item.content}
                    onChange={(e) => updateItem(index, 'content', e.target.value)}
                    rows={3}
                    maxLength={60000}
                  />
                  {item.sourcePages.length > 0 && (
                    <span className="source-chip">
                      PDF · página{item.sourcePages.length > 1 ? 's' : ''}{' '}
                      {item.sourcePages.join(', ')}
                    </span>
                  )}
                  {isOutlineEdited(item) === true && (
                    <details className="outline-origin-review">
                      <summary>Conteúdo editado · consultar trecho original</summary>
                      <pre>{item.origin?.excerpt}</pre>
                    </details>
                  )}
                  {item.requirements?.length ? (
                    <div className="narrative-questions">
                      <strong>Perguntas a resolver · não são fatos da fonte</strong>
                      <ul>
                        {item.requirements.map((question, questionIndex) => (
                          <li key={`${questionIndex}-${question}`}>
                            <span>{question}</span>
                            <button
                              type="button"
                              className="text-button"
                              aria-label={`Marcar como resolvida: ${question}`}
                              onClick={() =>
                                setOutline((items) =>
                                  items.map((entry) =>
                                    entry.id === item.id
                                      ? {
                                          ...entry,
                                          requirements: entry.requirements?.filter(
                                            (_, position) => position !== questionIndex,
                                          ),
                                        }
                                      : entry,
                                  ),
                                )
                              }
                            >
                              Resolvido
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
            <button
              className="add-outline"
              disabled={outline.length >= 18}
              onClick={() =>
                setOutline((items) => [
                  ...items,
                  {
                    id: createId('outline'),
                    title: 'Novo tópico',
                    content: '',
                    sourcePages: [],
                    origin: {
                      kind: 'manual',
                      sourceName: 'Adicionado ao roteiro',
                      sourceKind: 'manual',
                      excerpt: '',
                      pages: [],
                    },
                  },
                ])
              }
            >
              <Plus size={16} /> Adicionar tópico
            </button>
            <div className="cover-outline closing-outline">
              <span className="outline-number">{String(outline.length + 2).padStart(2, '0')}</span>
              <div>
                <strong>Um bom encerramento</strong>
                <span>Feche a apresentação com uma mensagem clara.</span>
              </div>
              <span className="auto-label">Automático</span>
            </div>
            <div className="generation-note">
              <Info size={17} />
              <p>
                O Zetta organiza e sintetiza o material por regras. O texto original permanece na
                fonte e nas notas para consulta. Revise a síntese antes de apresentar.
              </p>
            </div>
            {warnings.length > 0 && (
              <details className="warnings-detail">
                <summary>
                  {warnings.length} {warnings.length > 1 ? 'observações' : 'observação'} sobre o
                  conteúdo
                </summary>
                {warnings.map((warning, i) => (
                  <p key={i}>{warning}</p>
                ))}
              </details>
            )}
          </section>
          <aside className="style-panel">
            <div className="panel-title">
              <div>
                <span className="step-number">02</span>
                <h2>Encontre seu estilo</h2>
              </div>
              <Sparkles size={18} />
            </div>
            <label className="field-label">MODELO</label>
            <ThemePicker
              compact
              value={options.themeId}
              onChange={(themeId) =>
                setOptions((v) => ({ ...v, themeId, accent: getTheme(themeId).accent }))
              }
            />
            <label className="field-label">COR DE DESTAQUE</label>
            <ColorPicker
              value={options.accent}
              onChange={(accent) => setOptions((v) => ({ ...v, accent }))}
            />
            <label className="field-label">COMPOSIÇÃO</label>
            <div className="composition-options">
              <button
                className={options.composition === 'simple' ? 'active' : ''}
                onClick={() => setOptions((v) => ({ ...v, composition: 'simple' }))}
              >
                <span className="composition-icon simple">
                  <i />
                  <i />
                  <i />
                </span>
                <strong>Essencial</strong>
                <small>Texto em primeiro plano</small>
              </button>
              <button
                className={options.composition === 'rich' ? 'active' : ''}
                onClick={() => setOptions((v) => ({ ...v, composition: 'rich' }))}
              >
                <span className="composition-icon rich">
                  <i />
                  <i />
                  <i />
                  <b />
                </span>
                <strong>Visual</strong>
                <small>Mais ritmo e ilustrações</small>
              </button>
            </div>
            <label className="field-label">
              QUANTIDADE DE TEXTO
              <select
                value={options.density}
                onChange={(e) =>
                  setOptions((v) => ({
                    ...v,
                    density: e.target.value as GenerationOptions['density'],
                  }))
                }
              >
                <option value="short">Curto · direto ao ponto</option>
                <option value="balanced">Equilibrado · na medida</option>
                <option value="detailed">Detalhado · mais contexto</option>
              </select>
            </label>
            <div className="outline-rebuild">
              <label className="field-label">
                REORGANIZAR EM
                <select
                  aria-label="Nova quantidade de slides"
                  value={options.slideCount}
                  onChange={(e) => {
                    setOptions((v) => ({ ...v, slideCount: Number(e.target.value) }))
                    setRebuildPreview(null)
                  }}
                >
                  {[3, 4, 5, 6, 8, 10, 12, 16, 20].map((n) => (
                    <option value={n} key={n}>
                      {n} slides, incluindo capa e fim
                    </option>
                  ))}
                </select>
              </label>
              <button className="text-button" onClick={previewRebuild}>
                <RotateCcw size={13} /> Refazer roteiro a partir da fonte
              </button>
              <small>Abra a prévia e confira antes de substituir suas edições.</small>
            </div>
            <div className="style-panel-footer">
              <span>
                <Check size={15} /> Tudo continua editável depois.
              </span>
              <button
                className="button primary"
                disabled={
                  busy ||
                  briefPending ||
                  !title.trim() ||
                  outline.some((item) => !item.title.trim() || !item.content.trim())
                }
                onClick={() => void create()}
              >
                {busy ? <LoaderCircle size={18} className="spin" /> : <Sparkles size={18} />}{' '}
                {busy ? 'Montando apresentação…' : 'Criar minha apresentação'}{' '}
                {!busy && <ArrowRight size={17} />}
              </button>
              {briefPending && (
                <p className="narrative-pending">
                  Aplique o roteiro sugerido ou mantenha a direção atual para continuar.
                </p>
              )}
              {error && (
                <p role="alert" className="inline-error">
                  {error}
                </p>
              )}
            </div>
          </aside>
        </div>
      </main>
    </div>
  )
}
