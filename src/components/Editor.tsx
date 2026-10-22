import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Bold,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Columns2,
  Copy,
  Download,
  FileText,
  GripVertical,
  ImagePlus,
  Layers,
  LayoutTemplate,
  List,
  LoaderCircle,
  Maximize2,
  MessageSquareQuote,
  MoreHorizontal,
  Palette,
  PanelRightClose,
  Play,
  Plus,
  Redo2,
  RotateCw,
  Save,
  Sparkles,
  Trash2,
  Type,
  Undo2,
  Upload,
  X,
  ChartNoAxesColumnIncreasing,
} from 'lucide-react'
import type { BlockType, Deck, IllustrationKind, Layout, Slide, SlideBlock } from '../types'
import { getTheme } from '../lib/themes'
import { createBlankSlide, parseChartData } from '../lib/generator'
import { readImage } from '../lib/files'
import { validateDeck } from '../lib/validation'
import { Brand } from './Brand'
import { ColorPicker, ThemePicker } from './ThemePicker'
import { SlideCanvas, getSlideWarnings, getTextEditRect } from './SlideCanvas'
import { Modal } from './Modal'

const LocalAiPanel = lazy(() => import('./LocalAiPanel').then((m) => ({ default: m.LocalAiPanel })))
export type SaveStatus = 'saving' | 'saved' | 'error'
interface Props {
  deck: Deck
  change: (update: (draft: Deck) => void, key?: string) => void
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  onBack: () => void
  onPresent: (index: number) => void
  onExport: () => void
  onBackup: () => void
  saveStatus: SaveStatus
  exportProgress: string | null
  presenting?: boolean
}
const layouts: { id: Layout; label: string; icon: typeof Type }[] = [
  { id: 'cover', label: 'Capa', icon: LayoutTemplate },
  { id: 'split', label: 'Texto + visual', icon: Columns2 },
  { id: 'bullets', label: 'Lista', icon: List },
  { id: 'columns', label: 'Colunas', icon: Columns2 },
  { id: 'quote', label: 'Destaque', icon: MessageSquareQuote },
  { id: 'chart', label: 'Dados', icon: ChartNoAxesColumnIncreasing },
  { id: 'section', label: 'Seção', icon: Type },
  { id: 'closing', label: 'Encerramento', icon: Maximize2 },
]
const blockLabels: Record<BlockType, string> = {
  text: 'Texto',
  bullets: 'Lista',
  image: 'Imagem',
  callout: 'Destaque',
  chart: 'Gráfico',
}
export function Editor({
  deck,
  change,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onBack,
  onPresent,
  onExport,
  onBackup,
  saveStatus,
  exportProgress,
  presenting = false,
}: Props) {
  const [titleDraft, setTitleDraft] = useState(deck.title)
  const [slideId, setSlideId] = useState(deck.slides[0].id)
  const [selected, setSelected] = useState<string | null>(null)
  const [tab, setTab] = useState<'properties' | 'design'>('properties')
  const [showAdd, setShowAdd] = useState(false)
  const [showSource, setShowSource] = useState(false)
  const [showNotes, setShowNotes] = useState(false)
  const [showAi, setShowAi] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [inlineRect, setInlineRect] = useState<{
    x: number
    y: number
    width: number
    height: number
  } | null>(null)
  const [error, setError] = useState('')
  const [rightOpen, setRightOpen] = useState(() => window.innerWidth >= 768)
  const [zoom, setZoom] = useState(100)
  const imageInput = useRef<HTMLInputElement>(null)
  const inlineInput = useRef<HTMLTextAreaElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const activeIndex = Math.max(
    0,
    deck.slides.findIndex((s) => s.id === slideId),
  )
  const slide = deck.slides[activeIndex]
  const block = slide.blocks.find((b) => b.id === selected)
  const theme = getTheme(deck.themeId)
  useEffect(() => setTitleDraft(deck.title), [deck.title])
  const warnings = getSlideWarnings(slide, theme)
  const activeText = selected === 'title' ? slide.title : (block?.content ?? '')
  useEffect(() => {
    if (!deck.slides.some((s) => s.id === slideId)) {
      setSlideId(deck.slides[0].id)
      setSelected(null)
    }
  }, [deck.slides, slideId])
  useEffect(() => {
    if (selected && selected !== 'title' && !slide.blocks.some((b) => b.id === selected))
      setSelected(null)
  }, [slide, selected])
  useEffect(() => {
    if (editing) {
      inlineInput.current?.focus()
      inlineInput.current?.select()
    }
  }, [editing])
  function selectSlide(id: string) {
    setSlideId(id)
    setSelected(null)
    setEditing(null)
    setShowAi(false)
    setError('')
  }
  function updateSlide(fn: (draft: Slide) => void, key = '') {
    change((d) => {
      const target = d.slides.find((s) => s.id === slide.id)
      if (target) fn(target)
    }, key)
  }
  function updateBlock(fn: (draft: SlideBlock) => void, key = '') {
    updateSlide((s) => {
      const b = s.blocks.find((v) => v.id === selected)
      if (b) fn(b)
    }, key)
  }
  function updateText(value: string) {
    if (selected === 'title')
      updateSlide((s) => {
        s.title = value
      }, slide.id + 'title')
    else
      updateBlock((b) => {
        b.content = value
      }, selected + 'content')
  }
  function style(
    key: 'color' | 'background' | 'fontSize' | 'bold' | 'align',
    value: string | number | boolean,
  ) {
    if (selected === 'title')
      updateSlide((s) => {
        s.titleStyle = { ...s.titleStyle, [key]: value }
      }, 'style-title-' + key)
    else
      updateBlock(
        (b) => {
          b.style = { ...b.style, [key]: value }
        },
        'style-' + selected + '-' + key,
      )
  }
  function addSlide() {
    if (deck.slides.length >= 50) return
    const next = createBlankSlide()
    change((d) => {
      d.slides.splice(activeIndex + 1, 0, next)
    })
    selectSlide(next.id)
  }
  function duplicateSlide() {
    if (deck.slides.length >= 50) return
    const next = structuredClone(slide)
    next.id = crypto.randomUUID()
    next.blocks = next.blocks.map((b) => ({ ...b, id: crypto.randomUUID() }))
    try {
      change((d) => {
        d.slides.splice(activeIndex + 1, 0, next)
        validateDeck(d)
      })
      selectSlide(next.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível duplicar este slide.')
    }
  }
  function deleteSlide() {
    if (deck.slides.length < 2) return
    change((d) => {
      d.slides.splice(activeIndex, 1)
    })
    selectSlide(deck.slides[Math.max(0, activeIndex - 1)].id)
  }
  function moveSlide(from: number, to: number) {
    if (to < 0 || to >= deck.slides.length) return
    change((d) => {
      const [s] = d.slides.splice(from, 1)
      d.slides.splice(to, 0, s)
    })
  }
  function removeBlock() {
    if (!selected || selected === 'title') return
    updateSlide((s) => {
      s.blocks = s.blocks.filter((b) => b.id !== selected)
    })
    setSelected(null)
  }
  function addBlock(type: BlockType) {
    if (slide.blocks.length >= 6) {
      setError(
        'Este slide já tem 6 elementos. Use um novo slide para manter a leitura confortável.',
      )
      return
    }
    const id = crypto.randomUUID()
    const next: SlideBlock = {
      id,
      type,
      content:
        type === 'text'
          ? 'Escreva sua ideia aqui.'
          : type === 'bullets'
            ? 'Primeiro ponto\nSegundo ponto\nTerceiro ponto'
            : type === 'callout'
              ? 'Uma ideia que merece destaque.'
              : '',
    }
    if (type === 'image')
      next.image = {
        alt: 'Ilustração geométrica',
        illustration: 'orbit',
        fit: 'cover',
        position: 50,
        seed: Date.now() % 10000,
      }
    if (type === 'chart') next.chart = { type: 'bar', data: [], unit: '', source: '' }
    updateSlide((s) => {
      s.blocks.push(next)
    })
    setSelected(id)
    setTab('properties')
    setShowAdd(false)
    setRightOpen(true)
  }
  async function replaceImage(file?: File) {
    if (!file || !block?.image) return
    const targetDeckId = deck.id
    const targetSlideId = slide.id
    const targetBlockId = block.id
    setError('')
    try {
      const src = await readImage(file)
      change((d) => {
        if (d.id !== targetDeckId) return
        const target = d.slides
          .find((s) => s.id === targetSlideId)
          ?.blocks.find((b) => b.id === targetBlockId)
        if (!target?.image) return
        target.image.src = src
        target.image.alt = file.name.replace(/\.[^.]+$/, '').slice(0, 300)
        validateDeck(d)
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível abrir a imagem.')
    }
  }
  function startEditing(
    id: string,
    rect?: { x: number; y: number; width: number; height: number },
  ) {
    setSelected(id)
    setEditing(id)
    setEditValue(
      id === 'title' ? slide.title : (slide.blocks.find((b) => b.id === id)?.content ?? ''),
    )
    setInlineRect(rect ?? getTextEditRect(slide, theme, id))
    setShowAdd(false)
  }
  function finishEditing() {
    const id = editing
    if (id === 'title')
      updateSlide((s) => {
        s.title = editValue
      }, slide.id + 'title')
    else if (id)
      updateSlide((s) => {
        const b = s.blocks.find((b) => b.id === id)
        if (b) b.content = editValue
      }, id + 'content')
    setEditing(null)
  }
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (
        presenting ||
        target.closest('input,textarea,select,[contenteditable="true"],[role="dialog"]') ||
        showAi
      )
        return
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) onRedo()
        else onUndo()
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        onRedo()
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        duplicateSlide()
      }
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault()
        if (activeIndex < deck.slides.length - 1) selectSlide(deck.slides[activeIndex + 1].id)
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault()
        if (activeIndex > 0) selectSlide(deck.slides[activeIndex - 1].id)
      }
      if (e.key === 'Escape') {
        setSelected(null)
        setShowAdd(false)
      }
      if (e.key === 'Delete' && selected && selected !== 'title') {
        e.preventDefault()
        removeBlock()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  })
  return (
    <div className="editor">
      <header className="editor-header">
        <div className="editor-heading-left">
          <button className="icon-button" aria-label="Voltar às apresentações" onClick={onBack}>
            <ArrowLeft size={18} />
          </button>
          <button className="brand-button" onClick={onBack}>
            <Brand small />
          </button>
          <span className="header-divider" />
          <input
            className="deck-title-input"
            value={titleDraft}
            maxLength={140}
            aria-label="Nome da apresentação"
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={() =>
              change((d) => {
                d.title = titleDraft.trim() || 'Apresentação sem título'
              }, 'deck-title')
            }
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
            }}
          />
          <span className={'save-indicator ' + saveStatus} role="status">
            {saveStatus === 'saving' ? (
              <LoaderCircle size={12} className="spin" />
            ) : saveStatus === 'saved' ? (
              <Check size={13} />
            ) : (
              <span>!</span>
            )}
            {saveStatus === 'saved'
              ? 'Salvo neste navegador'
              : saveStatus === 'saving'
                ? 'Salvando…'
                : 'Erro ao salvar'}
          </span>
        </div>
        <div className="editor-heading-actions">
          <button
            className="icon-button"
            onClick={onBackup}
            title="Baixar backup editável"
            aria-label="Baixar backup editável"
          >
            <Save size={18} />
          </button>
          <button
            className={
              'button secondary theme-toggle ' + (tab === 'design' && rightOpen ? 'active' : '')
            }
            onClick={() => {
              setTab('design')
              setRightOpen(true)
            }}
          >
            <Palette size={16} />
            <span>Tema e cores</span>
          </button>
          <button className="button secondary" onClick={() => onPresent(activeIndex)}>
            <Play size={16} />
            <span>Apresentar</span>
          </button>
          <button className="button primary" disabled={!!exportProgress} onClick={onExport}>
            {exportProgress ? <LoaderCircle className="spin" size={16} /> : <Download size={16} />}
            <span>{exportProgress ?? 'Baixar PDF'}</span>
          </button>
        </div>
      </header>
      <div className={'editor-body ' + (!rightOpen ? 'right-closed' : '')}>
        <aside className="slides-sidebar">
          <div className="slides-heading">
            <strong>
              Slides <span>{deck.slides.length}</span>
            </strong>
            <button className="icon-button" onClick={addSlide} aria-label="Adicionar slide">
              <Plus size={17} />
            </button>
          </div>
          <div className="slides-scroll">
            {deck.slides.map((item, index) => (
              <div
                className={'thumbnail-row ' + (item.id === slide.id ? 'selected' : '')}
                key={item.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/zetta-slide', item.id)
                  e.dataTransfer.effectAllowed = 'move'
                }}
                onDragOver={(e) => {
                  if (e.dataTransfer.types.includes('text/zetta-slide')) e.preventDefault()
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  const from = deck.slides.findIndex(
                    (s) => s.id === e.dataTransfer.getData('text/zetta-slide'),
                  )
                  if (from >= 0) moveSlide(from, index)
                }}
              >
                <span className="thumbnail-number">{String(index + 1).padStart(2, '0')}</span>
                <button
                  className="slide-thumbnail"
                  onClick={() => selectSlide(item.id)}
                  aria-label={'Slide ' + (index + 1) + ': ' + item.title}
                  aria-current={item.id === slide.id ? 'true' : undefined}
                >
                  <SlideCanvas
                    slide={item}
                    theme={theme}
                    accent={deck.accent}
                    slideNumber={index + 1}
                    totalSlides={deck.slides.length}
                  />
                </button>
                <span className="thumbnail-label">{item.title || 'Sem título'}</span>
              </div>
            ))}
          </div>
          <div className="slides-bottom">
            <button
              className="button secondary"
              onClick={addSlide}
              disabled={deck.slides.length >= 50}
            >
              <Plus size={16} /> Novo slide
            </button>
            <span>Arraste para reorganizar</span>
          </div>
        </aside>
        <main className="editor-stage">
          <div className="editor-toolbar">
            <div className="toolbar-group">
              <button
                className="icon-button"
                disabled={!canUndo}
                aria-label="Desfazer"
                title="Desfazer (⌘/Ctrl Z)"
                onClick={onUndo}
              >
                <Undo2 size={18} />
              </button>
              <button
                className="icon-button"
                disabled={!canRedo}
                aria-label="Refazer"
                title="Refazer (⌘/Ctrl Shift Z)"
                onClick={onRedo}
              >
                <Redo2 size={18} />
              </button>
              <span className="toolbar-divider" />
              <div className="add-menu-anchor">
                <button
                  className="button small secondary"
                  onClick={() => setShowAdd(!showAdd)}
                  aria-expanded={showAdd}
                >
                  <Plus size={15} /> Adicionar <ChevronDown size={13} />
                </button>
                {showAdd && (
                  <div className="add-menu" role="menu">
                    {(
                      [
                        { type: 'text', icon: Type },
                        { type: 'bullets', icon: List },
                        { type: 'callout', icon: MessageSquareQuote },
                        { type: 'image', icon: ImagePlus },
                        { type: 'chart', icon: ChartNoAxesColumnIncreasing },
                      ] as const
                    ).map(({ type, icon: Icon }) => (
                      <button key={type} role="menuitem" onClick={() => addBlock(type)}>
                        <Icon size={17} />
                        <span>{blockLabels[type]}</span>
                        <Plus size={13} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="toolbar-group">
              <span className="toolbar-hint">
                {selected
                  ? 'Elemento selecionado'
                  : 'Clique para selecionar · dois cliques para editar'}
              </span>
              <button
                className="icon-button"
                aria-label={rightOpen ? 'Ocultar propriedades' : 'Mostrar propriedades'}
                onClick={() => setRightOpen(!rightOpen)}
              >
                <PanelRightClose size={18} />
              </button>
            </div>
          </div>
          <div
            className="canvas-area"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setSelected(null)
                setShowAdd(false)
              }
            }}
          >
            <div className="canvas-scroll">
              <div
                ref={stageRef}
                className="slide-canvas-frame"
                style={{
                  width: zoom === 100 ? '100%' : zoom + '%',
                  maxWidth: zoom === 100 ? '1280px' : 'none',
                }}
              >
                <SlideCanvas
                  slide={slide}
                  theme={theme}
                  accent={deck.accent}
                  selectedBlockId={selected ?? undefined}
                  onSelect={(id) => {
                    setSelected(id)
                    setTab('properties')
                    setRightOpen(true)
                    setShowAdd(false)
                  }}
                  onEditText={startEditing}
                  slideNumber={activeIndex + 1}
                  totalSlides={deck.slides.length}
                />
                {editing && (
                  <div
                    className={'inline-edit-overlay ' + (inlineRect ? 'positioned' : '')}
                    style={
                      inlineRect
                        ? {
                            left: (inlineRect.x / 1280) * 100 + '%',
                            top: (inlineRect.y / 720) * 100 + '%',
                            width: (inlineRect.width / 1280) * 100 + '%',
                            minHeight: (inlineRect.height / 720) * 100 + '%',
                          }
                        : undefined
                    }
                  >
                    <textarea
                      ref={inlineInput}
                      aria-label="Editar texto no slide"
                      value={editValue}
                      maxLength={editing === 'title' ? 180 : 3000}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={(e) => {
                        if (
                          !(e.relatedTarget as HTMLElement | null)?.closest('.inline-edit-overlay')
                        )
                          finishEditing()
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          e.stopPropagation()
                          setEditing(null)
                        }
                        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                          e.preventDefault()
                          finishEditing()
                        }
                      }}
                    />
                    <div className="inline-edit-actions">
                      <span>⌘ / Ctrl + Enter para aplicar</span>
                      <button onClick={() => setEditing(null)}>Cancelar</button>
                      <button className="apply" onClick={finishEditing}>
                        <Check size={13} /> Aplicar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            {warnings.length > 0 && (
              <div className="slide-warning" role="status">
                <InfoIcon />
                <span>{warnings[0]}</span>
              </div>
            )}
          </div>
          <div className="stage-footer">
            <div>
              <button className="text-button" onClick={() => setShowNotes(!showNotes)}>
                <FileText size={15} /> Notas
              </button>
              <button className="text-button" onClick={() => setShowSource(true)}>
                Fonte original
              </button>
            </div>
            <div>
              <span>
                {activeIndex + 1} / {deck.slides.length}
              </span>
              <button
                className="icon-button"
                onClick={() => activeIndex > 0 && selectSlide(deck.slides[activeIndex - 1].id)}
                disabled={activeIndex === 0}
                aria-label="Slide anterior"
              >
                <ChevronLeft size={17} />
              </button>
              <button
                className="icon-button"
                onClick={() =>
                  activeIndex < deck.slides.length - 1 &&
                  selectSlide(deck.slides[activeIndex + 1].id)
                }
                disabled={activeIndex === deck.slides.length - 1}
                aria-label="Próximo slide"
              >
                <ChevronRight size={17} />
              </button>
              <select
                aria-label="Zoom do editor"
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
              >
                <option value={75}>75%</option>
                <option value={100}>Ajustar</option>
                <option value={125}>125%</option>
                <option value={150}>150%</option>
              </select>
            </div>
          </div>
          {showNotes && (
            <div className="notes-panel">
              <div>
                <strong>Notas do slide</strong>
                <span>Visíveis só no editor</span>
                <button
                  className="icon-button"
                  onClick={() => setShowNotes(false)}
                  aria-label="Fechar notas"
                >
                  <X size={16} />
                </button>
              </div>
              <textarea
                aria-label="Notas do slide"
                value={slide.notes}
                onChange={(e) =>
                  updateSlide((s) => {
                    s.notes = e.target.value
                  }, slide.id + 'notes')
                }
                placeholder="Adicione sua fala, referências ou lembretes…"
                maxLength={150000}
              />
            </div>
          )}
        </main>
        {rightOpen && (
          <aside className="properties-panel">
            <div className="properties-tabs">
              <button
                className={tab === 'properties' ? 'active' : ''}
                onClick={() => setTab('properties')}
              >
                <Layers size={15} /> Propriedades
              </button>
              <button className={tab === 'design' ? 'active' : ''} onClick={() => setTab('design')}>
                <Palette size={15} /> Design
              </button>
            </div>
            <div className="properties-scroll">
              {tab === 'design' ? (
                <>
                  <div className="property-title">
                    <h3>Um visual que combina.</h3>
                    <p>Estas escolhas se aplicam à apresentação inteira.</p>
                  </div>
                  <label className="field-label">MODELO</label>
                  <ThemePicker
                    compact
                    value={deck.themeId}
                    onChange={(themeId) =>
                      change((d) => {
                        d.themeId = themeId
                        d.accent = getTheme(themeId).accent
                      })
                    }
                  />
                  <label className="field-label">COR PRINCIPAL</label>
                  <ColorPicker
                    value={deck.accent}
                    onChange={(accent) =>
                      change((d) => {
                        d.accent = accent
                      }, 'accent')
                    }
                  />
                  <p className="property-tip">
                    O conteúdo permanece igual ao trocar de modelo. Cores definidas em um elemento
                    são preservadas.
                  </p>
                </>
              ) : !selected ? (
                <>
                  <div className="property-title">
                    <h3>Seu slide, do seu jeito.</h3>
                    <p>Escolha uma composição ou selecione um elemento para editar.</p>
                  </div>
                  <label className="field-label">COMPOSIÇÃO DO SLIDE</label>
                  <div className="layout-grid">
                    {layouts.map(({ id, label, icon: Icon }) => (
                      <button
                        key={id}
                        className={slide.layout === id ? 'active' : ''}
                        onClick={() =>
                          updateSlide((s) => {
                            s.layout = id
                          })
                        }
                      >
                        <Icon size={22} />
                        <span>{label}</span>
                      </button>
                    ))}
                  </div>
                  <label className="field-label">
                    TÍTULO
                    <input
                      value={slide.title}
                      aria-label="Título do slide"
                      onChange={(e) =>
                        updateSlide((s) => {
                          s.title = e.target.value
                        }, slide.id + 'title')
                      }
                      maxLength={180}
                    />
                  </label>
                  <label className="field-label">
                    SOBRETÍTULO
                    <input
                      value={slide.eyebrow}
                      onChange={(e) =>
                        updateSlide((s) => {
                          s.eyebrow = e.target.value
                        }, slide.id + 'eyebrow')
                      }
                      maxLength={80}
                    />
                  </label>
                  <label className="field-label">
                    FUNDO DO SLIDE
                    <div className="color-field">
                      <input
                        type="color"
                        value={slide.background ?? theme.background}
                        onChange={(e) =>
                          updateSlide((s) => {
                            s.background = e.target.value
                          }, slide.id + 'background')
                        }
                      />
                      <span>{slide.background ?? theme.background}</span>
                      <button
                        className="icon-button"
                        aria-label="Restaurar fundo do tema"
                        onClick={() =>
                          updateSlide((s) => {
                            delete s.background
                          })
                        }
                      >
                        <RotateCw size={14} />
                      </button>
                    </div>
                  </label>
                  <div className="property-separator" />
                  <div className="slide-actions">
                    <button className="button secondary" onClick={duplicateSlide}>
                      <Copy size={15} /> Duplicar slide
                    </button>
                    <div>
                      <button
                        className="button secondary"
                        disabled={activeIndex === 0}
                        onClick={() => moveSlide(activeIndex, activeIndex - 1)}
                      >
                        <ArrowUp size={14} /> Subir
                      </button>
                      <button
                        className="button secondary"
                        disabled={activeIndex === deck.slides.length - 1}
                        onClick={() => moveSlide(activeIndex, activeIndex + 1)}
                      >
                        <ArrowDown size={14} /> Descer
                      </button>
                    </div>
                    <button
                      className="text-button danger"
                      disabled={deck.slides.length < 2}
                      onClick={deleteSlide}
                    >
                      <Trash2 size={15} /> Excluir slide
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="property-title selected-property">
                    <div>
                      <span className="selected-kicker">ELEMENTO SELECIONADO</span>
                      <h3>
                        {selected === 'title'
                          ? 'Título do slide'
                          : block
                            ? blockLabels[block.type]
                            : 'Elemento'}
                      </h3>
                    </div>
                    <button
                      className="icon-button"
                      onClick={() => setSelected(null)}
                      aria-label="Desmarcar elemento"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  {(selected === 'title' ||
                    block?.type === 'text' ||
                    block?.type === 'callout' ||
                    block?.type === 'bullets') && (
                    <>
                      <label className="field-label">
                        CONTEÚDO
                        <textarea
                          aria-label="Texto do elemento"
                          value={activeText}
                          onChange={(e) => updateText(e.target.value)}
                          maxLength={selected === 'title' ? 180 : 3000}
                          rows={selected === 'title' ? 3 : 6}
                        />
                      </label>
                      {block?.type === 'bullets' && (
                        <p className="property-tip">Um tópico por linha.</p>
                      )}
                      <button className="text-button" onClick={() => startEditing(selected)}>
                        <Type size={14} /> Editar no slide
                      </button>
                      <label className="field-label">TIPOGRAFIA</label>
                      <div className="text-format-row">
                        <label>
                          <input
                            type="number"
                            aria-label="Tamanho do texto"
                            min={16}
                            max={selected === 'title' ? 88 : 56}
                            value={
                              (selected === 'title' ? slide.titleStyle : block?.style)?.fontSize ??
                              (selected === 'title' ? 56 : 28)
                            }
                            onChange={(e) => {
                              const value = Number(e.target.value)
                              if (value >= 16 && value <= 88) style('fontSize', value)
                            }}
                          />
                          <span>px</span>
                        </label>
                        <button
                          className={
                            'icon-button ' +
                            ((selected === 'title' ? slide.titleStyle : block?.style)?.bold
                              ? 'active'
                              : '')
                          }
                          onClick={() =>
                            style(
                              'bold',
                              !(selected === 'title' ? slide.titleStyle : block?.style)?.bold,
                            )
                          }
                          aria-label="Negrito"
                        >
                          <Bold size={17} />
                        </button>
                      </div>
                      <label className="field-label">ALINHAMENTO</label>
                      <div className="align-buttons">
                        {(
                          [
                            { id: 'left', icon: AlignLeft, label: 'Esquerda' },
                            { id: 'center', icon: AlignCenter, label: 'Centro' },
                            { id: 'right', icon: AlignRight, label: 'Direita' },
                          ] as const
                        ).map(({ id, icon: Icon, label }) => (
                          <button
                            key={id}
                            className={
                              ((selected === 'title' ? slide.titleStyle : block?.style)?.align ??
                                'left') === id
                                ? 'active'
                                : ''
                            }
                            aria-label={label}
                            onClick={() => style('align', id)}
                          >
                            <Icon size={17} />
                          </button>
                        ))}
                      </div>
                      <label className="field-label">
                        COR DO TEXTO
                        <div className="color-field">
                          <input
                            type="color"
                            aria-label="Cor do texto"
                            value={
                              (selected === 'title' ? slide.titleStyle : block?.style)?.color ??
                              theme.foreground
                            }
                            onChange={(e) => style('color', e.target.value)}
                          />
                          <span>
                            {(selected === 'title' ? slide.titleStyle : block?.style)?.color ??
                              theme.foreground}
                          </span>
                        </div>
                      </label>
                      {block?.type === 'callout' && (
                        <label className="field-label">
                          FUNDO DO DESTAQUE
                          <input
                            type="color"
                            aria-label="Fundo do destaque"
                            value={block.style?.background ?? theme.surface}
                            onChange={(e) => style('background', e.target.value)}
                          />
                        </label>
                      )}
                      <button className="local-ai-button" onClick={() => setShowAi(true)}>
                        <Sparkles size={17} />
                        <span>
                          Revisar com IA local<small>Opcional · executada no dispositivo</small>
                        </span>
                        <ChevronRight size={16} />
                      </button>
                    </>
                  )}
                  {block?.type === 'image' && block.image && (
                    <>
                      <div className="image-property-preview">
                        <SlideCanvas
                          slide={{
                            ...slide,
                            title: '',
                            eyebrow: '',
                            layout: 'split',
                            blocks: [block],
                          }}
                          theme={theme}
                          accent={deck.accent}
                        />
                      </div>
                      <button
                        className="button secondary full-width"
                        onClick={() => imageInput.current?.click()}
                      >
                        <Upload size={15} />{' '}
                        {block.image.src ? 'Trocar imagem' : 'Enviar minha imagem'}
                      </button>
                      <label className="field-label">
                        ILUSTRAÇÃO POR CÓDIGO
                        <select
                          value={block.image.illustration}
                          onChange={(e) =>
                            updateBlock((b) => {
                              if (b.image) {
                                b.image.illustration = e.target.value as IllustrationKind
                                delete b.image.src
                              }
                            })
                          }
                        >
                          <option value="orbit">Órbitas</option>
                          <option value="layers">Camadas</option>
                          <option value="growth">Crescimento</option>
                          <option value="waves">Ondas</option>
                          <option value="grid">Arquitetura</option>
                        </select>
                      </label>
                      <button
                        className="text-button"
                        onClick={() =>
                          updateBlock((b) => {
                            if (b.image) {
                              b.image.seed += 1
                              delete b.image.src
                            }
                          })
                        }
                      >
                        <RotateCw size={14} /> Variar ilustração
                      </button>
                      <label className="field-label">
                        ENQUADRAMENTO
                        <select
                          value={block.image.fit}
                          onChange={(e) =>
                            updateBlock((b) => {
                              if (b.image) b.image.fit = e.target.value as 'cover' | 'contain'
                            })
                          }
                        >
                          <option value="cover">Preencher área</option>
                          <option value="contain">Imagem inteira</option>
                        </select>
                      </label>
                      <label className="field-label">
                        POSIÇÃO
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={block.image.position}
                          onChange={(e) =>
                            updateBlock((b) => {
                              if (b.image) b.image.position = Number(e.target.value)
                            }, block.id + 'position')
                          }
                        />
                      </label>
                      <label className="field-label">
                        DESCRIÇÃO DA IMAGEM
                        <input
                          value={block.image.alt}
                          maxLength={300}
                          onChange={(e) =>
                            updateBlock((b) => {
                              if (b.image) b.image.alt = e.target.value
                            }, block.id + 'alt')
                          }
                        />
                      </label>
                      <p className="property-tip">
                        Ilustrações são composições geométricas feitas por código. Você também pode
                        usar suas próprias fotos.
                      </p>
                    </>
                  )}
                  {block?.type === 'chart' && (
                    <ChartEditor
                      key={block.id}
                      block={block}
                      onChange={(value) =>
                        updateBlock((b) => {
                          b.chart = value
                        })
                      }
                    />
                  )}
                  {block && (
                    <>
                      <div className="property-separator" />
                      <div className="element-order">
                        <button
                          className="button secondary small"
                          disabled={slide.blocks[0].id === block.id}
                          onClick={() =>
                            updateSlide((s) => {
                              const i = s.blocks.findIndex((b) => b.id === block.id)
                              if (i > 0)
                                [s.blocks[i], s.blocks[i - 1]] = [s.blocks[i - 1], s.blocks[i]]
                            })
                          }
                        >
                          <ArrowUp size={14} /> Antes
                        </button>
                        <button
                          className="button secondary small"
                          disabled={slide.blocks.at(-1)?.id === block.id}
                          onClick={() =>
                            updateSlide((s) => {
                              const i = s.blocks.findIndex((b) => b.id === block.id)
                              if (i < s.blocks.length - 1)
                                [s.blocks[i], s.blocks[i + 1]] = [s.blocks[i + 1], s.blocks[i]]
                            })
                          }
                        >
                          <ArrowDown size={14} /> Depois
                        </button>
                      </div>
                      <button className="text-button danger" onClick={removeBlock}>
                        <Trash2 size={15} /> Remover elemento
                      </button>
                    </>
                  )}
                </>
              )}
              {error && (
                <div className="inline-error" role="alert">
                  {error}
                </div>
              )}
            </div>
            <div className="properties-footer">
              <span className="tiny-spark">✦</span> Uma ideia por slide. Um slide por vez.
            </div>
          </aside>
        )}
      </div>
      <input
        ref={imageInput}
        className="sr-only"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={(e) => {
          void replaceImage(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      {showSource && (
        <Modal title="Seu conteúdo original" onClose={() => setShowSource(false)} wide>
          <div className="source-modal">
            <div className="source-meta">
              <FileText size={18} />
              <span>{deck.source.name}</span>
            </div>
            <p className="muted">
              O conteúdo de entrada é preservado aqui. A apresentação é uma síntese editável.
            </p>
            {deck.source.pages?.length ? (
              deck.source.pages.map((page) => (
                <section key={page.page}>
                  <h3>Página {page.page}</h3>
                  <p>{page.text || 'Página sem texto extraído.'}</p>
                </section>
              ))
            ) : (
              <p className="source-text">{deck.source.text}</p>
            )}
          </div>
        </Modal>
      )}
      {showAi && (
        <Suspense
          fallback={
            <div className="modal-backdrop">
              <div className="loading-state">
                <LoaderCircle className="spin" /> Abrindo IA local…
              </div>
            </div>
          }
        >
          <LocalAiPanel
            maxLength={selected === 'title' ? 180 : 3000}
            text={activeText}
            onApply={(value) => {
              updateText(value)
              setShowAi(false)
            }}
            onClose={() => setShowAi(false)}
          />
        </Suspense>
      )}
    </div>
  )
}
function InfoIcon() {
  return <span className="warning-symbol">!</span>
}
function ChartEditor({
  block,
  onChange,
}: {
  block: SlideBlock
  onChange: (value: NonNullable<SlideBlock['chart']>) => void
}) {
  const chart = block.chart ?? { type: 'bar' as const, data: [], unit: '', source: '' }
  const serialize = () =>
    chart.data.map((d) => d.label + '; ' + String(d.value).replace('.', ',')).join('\n')
  const [raw, setRaw] = useState(serialize)
  const [error, setError] = useState('')
  useEffect(() => {
    setRaw(serialize())
  }, [JSON.stringify(chart.data)])
  function apply() {
    try {
      const data = parseChartData(raw)
      if (!data.length) throw new Error('Adicione pelo menos um rótulo e valor.')
      onChange({ ...chart, data })
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Confira os valores informados.')
    }
  }
  return (
    <>
      <label className="field-label">
        TIPO DE GRÁFICO
        <select
          value={chart.type}
          onChange={(e) => onChange({ ...chart, type: e.target.value as 'bar' | 'line' })}
        >
          <option value="bar">Barras</option>
          <option value="line">Linhas</option>
        </select>
      </label>
      <label className="field-label">
        DADOS
        <textarea
          aria-label="Dados do gráfico"
          rows={7}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder={'Janeiro; 120\nFevereiro; 95,5\nMarço; 140'}
        />
      </label>
      <p className="property-tip">
        Uma linha por valor: rótulo; número. Use vírgula para decimais. Até 12 categorias.
      </p>
      <button className="button secondary full-width" onClick={apply}>
        <Check size={15} /> Aplicar dados
      </button>
      {error && (
        <p role="alert" className="inline-error">
          {error}
        </p>
      )}
      <label className="field-label">
        UNIDADE
        <input
          value={chart.unit}
          maxLength={30}
          placeholder="Ex.: R$, %, unidades"
          onChange={(e) => onChange({ ...chart, unit: e.target.value })}
        />
      </label>
      <label className="field-label">
        FONTE DOS DADOS
        <input
          value={chart.source}
          maxLength={160}
          placeholder="Ex.: relatório de vendas"
          onChange={(e) => onChange({ ...chart, source: e.target.value })}
        />
      </label>
    </>
  )
}
