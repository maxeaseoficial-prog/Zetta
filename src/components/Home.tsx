import { useRef, useState, type DragEvent } from 'react'
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  CircleHelp,
  FileText,
  FolderOpen,
  Home as HomeIcon,
  LayoutGrid,
  LoaderCircle,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import type { Deck, GenerationOptions, PdfExtraction, ThemeId } from '../types'
import type { CreationInput } from '../lib/creation'
import { EXAMPLE_TEXT } from '../lib/generator'
import { getTheme } from '../lib/themes'
import { Brand } from './Brand'
import { SlideCanvas } from './SlideCanvas'
import { ThemePicker } from './ThemePicker'

interface Props {
  decks: Deck[]
  loading: boolean
  onContinue: (input: CreationInput) => void
  onOpen: (deck: Deck) => void
  onDelete: (deck: Deck) => void
  onImport: (file: File) => void
  onExample: () => void
  onHelp: () => void
}
export function Home({
  decks,
  loading,
  onContinue,
  onOpen,
  onDelete,
  onImport,
  onExample,
  onHelp,
}: Props) {
  const [section, setSection] = useState<'home' | 'library' | 'templates'>('home')
  const [mode, setMode] = useState<'text' | 'pdf'>('text')
  const [text, setText] = useState('')
  const [pdf, setPdf] = useState<PdfExtraction | null>(null)
  const [reading, setReading] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const [slideCount, setSlideCount] = useState(8)
  const [themeId, setThemeId] = useState<ThemeId>('minimal')
  const [search, setSearch] = useState('')
  const upload = useRef<HTMLInputElement>(null)
  const backup = useRef<HTMLInputElement>(null)
  const textArea = useRef<HTMLTextAreaElement>(null)
  const inputText = mode === 'pdf' ? (pdf?.text ?? '') : text
  const filtered = decks.filter((deck) =>
    deck.title.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')),
  )

  async function readPdf(file?: File) {
    if (!file) return
    setError('')
    setPdf(null)
    setReading(true)
    setMode('pdf')
    setProgress('Abrindo seu PDF…')
    try {
      const { extractPdf } = await import('../lib/pdfImport')
      const result = await extractPdf(file, (current: number, total?: number) =>
        setProgress(total ? 'Lendo página ' + current + ' de ' + total : 'Lendo seu PDF…'),
      )
      setPdf(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível ler o PDF. Tente colar o texto.')
    } finally {
      setReading(false)
    }
  }
  function drop(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
    if (!reading) void readPdf(e.dataTransfer.files[0])
  }
  function continueCreation() {
    if (inputText.trim().length < 40 || reading) return
    const options: GenerationOptions = {
      slideCount,
      themeId,
      accent: getTheme(themeId).accent,
      composition: 'rich',
      density: 'balanced',
    }
    onContinue({
      text: inputText,
      pages: mode === 'pdf' ? pdf?.pages : undefined,
      warnings: mode === 'pdf' ? (pdf?.warnings ?? []) : [],
      sourceKind: mode,
      sourceName: mode === 'pdf' ? (pdf?.name ?? 'Documento.pdf') : 'Texto colado',
      options,
    })
  }
  function chooseTemplate(id: ThemeId) {
    setThemeId(id)
    setSection('home')
    requestAnimationFrame(() => textArea.current?.focus())
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button
          className="brand-button"
          onClick={() => setSection('home')}
          aria-label="Página inicial"
        >
          <Brand />
        </button>
        <div className="workspace-label">
          <span className="workspace-avatar">P</span>
          <span>
            Meu espaço<small>Pessoal</small>
          </span>
        </div>
        <button
          className="new-deck-button"
          onClick={() => {
            setSection('home')
            setTimeout(() => textArea.current?.focus(), 50)
          }}
        >
          <Plus size={19} /> Nova apresentação
        </button>
        <nav className="side-nav" aria-label="Navegação principal">
          <button className={section === 'home' ? 'active' : ''} onClick={() => setSection('home')}>
            <HomeIcon size={18} /> Início
          </button>
          <button
            className={section === 'library' ? 'active' : ''}
            onClick={() => setSection('library')}
          >
            <FolderOpen size={18} /> Apresentações
            {decks.length > 0 && <span className="nav-count">{decks.length}</span>}
          </button>
          <button
            className={section === 'templates' ? 'active' : ''}
            onClick={() => setSection('templates')}
          >
            <LayoutGrid size={18} /> Modelos
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="local-note">
            <span className="local-icon">
              <ShieldCheck size={19} />
            </span>
            <strong>Seu conteúdo, seu espaço.</strong>
            <p>As apresentações ficam salvas neste navegador.</p>
            <button onClick={() => backup.current?.click()}>
              Importar backup <ArrowUpRight size={14} />
            </button>
          </div>
          <button className="help-button" onClick={onHelp}>
            <CircleHelp size={18} /> Conheça o Zetta <span>↗</span>
          </button>
          <div className="sidebar-signature">Feito para dar forma às suas ideias.</div>
        </div>
      </aside>
      <div className="home-main">
        <header className="home-topbar">
          <span>
            {section === 'home'
              ? 'Seu próximo grande começo'
              : section === 'library'
                ? 'Seu trabalho, em um só lugar'
                : 'Um bom design faz a diferença'}
          </span>
          <div>
            <span className="local-badge">
              <i /> Espaço local
            </span>
            <button className="icon-button" onClick={onHelp} aria-label="Ajuda">
              <CircleHelp size={18} />
            </button>
            <span className="profile-circle">P</span>
          </div>
        </header>
        <main className="home-content">
          {section === 'home' && (
            <>
              <section className="creation-hero">
                <span className="eyebrow-label">
                  <span className="tiny-spark">✦</span> DA IDEIA À APRESENTAÇÃO
                </span>
                <h1>
                  Suas ideias.
                  <br />
                  <span>Em boa forma.</span>
                </h1>
                <p>
                  Um texto, um PDF, um novo ponto de partida.
                  <br className="mobile-break" /> O próximo passo é dar vida à sua apresentação.
                </p>
                <div
                  className={'composer' + (dragging ? ' is-dragging' : '')}
                  onDragOver={(e) => {
                    e.preventDefault()
                    setDragging(true)
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={drop}
                >
                  <div className="composer-tabs" role="tablist" aria-label="Tipo de conteúdo">
                    <button
                      role="tab"
                      aria-selected={mode === 'text'}
                      className={mode === 'text' ? 'active' : ''}
                      onClick={() => setMode('text')}
                    >
                      <FileText size={16} /> Colar texto
                    </button>
                    <button
                      role="tab"
                      aria-selected={mode === 'pdf'}
                      className={mode === 'pdf' ? 'active' : ''}
                      onClick={() => setMode('pdf')}
                    >
                      <Upload size={16} /> Enviar PDF
                    </button>
                    <span>Todo grande trabalho começa com uma ideia.</span>
                  </div>
                  {mode === 'text' ? (
                    <textarea
                      ref={textArea}
                      aria-label="Conteúdo da apresentação"
                      placeholder="Cole seu conteúdo aqui. Pode ser uma proposta, uma aula, um relatório ou aquela ideia que merece ser apresentada…"
                      value={text}
                      maxLength={150000}
                      onChange={(e) => {
                        setText(e.target.value)
                        setError('')
                      }}
                    />
                  ) : (
                    <div className="pdf-dropzone">
                      {reading ? (
                        <>
                          <LoaderCircle className="spin" size={26} />
                          <strong>{progress}</strong>
                          <span>O arquivo está sendo lido no seu navegador.</span>
                        </>
                      ) : pdf ? (
                        <>
                          <div className="file-success">
                            <FileText size={23} />
                            <div>
                              <strong>{pdf.name}</strong>
                              <span>
                                {pdf.pages.length} páginas · conteúdo pronto para organizar
                              </span>
                            </div>
                            <button
                              className="icon-button"
                              aria-label="Remover PDF"
                              onClick={() => setPdf(null)}
                            >
                              <X size={18} />
                            </button>
                          </div>
                          {pdf.warnings.length > 0 && (
                            <p className="pdf-warning">{pdf.warnings.join(' ')}</p>
                          )}
                          <button className="text-button" onClick={() => upload.current?.click()}>
                            Trocar arquivo
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="upload-circle">
                            <Upload size={23} />
                          </span>
                          <strong>Arraste um PDF para cá</strong>
                          <button className="text-button" onClick={() => upload.current?.click()}>
                            ou escolha um arquivo
                          </button>
                          <span>PDF com texto selecionável · até 20 MB</span>
                        </>
                      )}
                    </div>
                  )}
                  {inputText.length > 0 && inputText.trim().length < 40 && !reading && (
                    <p className="composer-helper">
                      Adicione pelo menos 40 caracteres de conteúdo para organizar sua apresentação.
                    </p>
                  )}
                  {error && (
                    <div role="alert" className="inline-error">
                      {error}
                    </div>
                  )}
                  <div className="composer-footer">
                    <div className="composer-options">
                      <label>
                        <LayoutGrid size={15} />
                        <select
                          aria-label="Quantidade de slides"
                          value={slideCount}
                          onChange={(e) => setSlideCount(Number(e.target.value))}
                        >
                          {[4, 6, 8, 10, 12, 16, 20].map((n) => (
                            <option key={n} value={n}>
                              {n} slides
                            </option>
                          ))}
                        </select>
                        <ChevronDown size={13} />
                      </label>
                      <span className="language-label">PT-BR</span>
                    </div>
                    <button
                      className="button primary create-button"
                      onClick={continueCreation}
                      disabled={inputText.trim().length < 40 || reading}
                    >
                      Criar apresentação <ArrowRight size={17} />
                    </button>
                  </div>
                </div>
                <div className="composer-below">
                  <span>
                    <ShieldCheck size={13} /> Seu conteúdo permanece neste dispositivo.
                  </span>
                  <button
                    onClick={() => {
                      setMode('text')
                      setText(EXAMPLE_TEXT)
                      setError('')
                    }}
                  >
                    Experimentar com um texto <ArrowUpRight size={13} />
                  </button>
                </div>
              </section>
              <section className="home-section templates-section">
                <div className="section-heading">
                  <div>
                    <h2>O seu conteúdo. O seu estilo.</h2>
                    <p>Escolha um ponto de partida e deixe com a sua cara.</p>
                  </div>
                  <button className="text-button" onClick={() => setSection('templates')}>
                    Explorar modelos <ArrowRight size={16} />
                  </button>
                </div>
                <ThemePicker value={themeId} onChange={setThemeId} />
              </section>
              <section className="home-section">
                <div className="section-heading">
                  <div>
                    <h2>Continue de onde parou</h2>
                    <p>Suas apresentações mais recentes.</p>
                  </div>
                  {decks.length > 0 && (
                    <button className="text-button" onClick={() => setSection('library')}>
                      Ver todas <ArrowRight size={16} />
                    </button>
                  )}
                </div>
                {loading ? (
                  <div className="loading-state">
                    <LoaderCircle className="spin" /> Abrindo seu espaço…
                  </div>
                ) : decks.length ? (
                  <div className="deck-grid">
                    {decks.slice(0, 3).map((deck) => (
                      <DeckCard key={deck.id} deck={deck} onOpen={onOpen} onDelete={onDelete} />
                    ))}
                  </div>
                ) : (
                  <div className="empty-recent">
                    <span className="empty-icon">
                      <FolderOpen size={25} />
                    </span>
                    <div>
                      <h3>Uma página em branco. Muitas possibilidades.</h3>
                      <p>Sua primeira apresentação vai aparecer aqui.</p>
                    </div>
                    <button className="button secondary" onClick={onExample}>
                      Conhecer o editor <ArrowRight size={16} />
                    </button>
                  </div>
                )}
              </section>
            </>
          )}
          {section === 'library' && (
            <section className="library-page">
              <div className="page-heading">
                <span className="eyebrow-label">FEITO POR VOCÊ</span>
                <h1>
                  Suas apresentações<span>.</span>
                </h1>
                <p>Ideias que já ganharam forma. Prontas para o próximo capítulo.</p>
              </div>
              <div className="library-toolbar">
                <label className="search-field">
                  <Search size={18} />
                  <input
                    aria-label="Buscar apresentações"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar apresentação…"
                  />
                </label>
                <button className="button secondary" onClick={() => backup.current?.click()}>
                  <ArrowDownToLine size={16} /> Importar backup
                </button>
                <button className="button primary" onClick={() => setSection('home')}>
                  <Plus size={16} /> Criar nova
                </button>
              </div>
              {filtered.length ? (
                <div className="deck-grid">
                  {filtered.map((deck) => (
                    <DeckCard key={deck.id} deck={deck} onOpen={onOpen} onDelete={onDelete} />
                  ))}
                </div>
              ) : (
                <div className="empty-library">
                  <FolderOpen size={42} />
                  <h2>
                    {search
                      ? 'Nenhuma apresentação encontrada.'
                      : 'Seu próximo projeto começa aqui.'}
                  </h2>
                  <p>
                    {search
                      ? 'Tente buscar por outro nome.'
                      : 'Crie uma apresentação ou importe um arquivo .zetta.json.'}
                  </p>
                  <button className="button primary" onClick={() => setSection('home')}>
                    Criar apresentação <ArrowRight size={16} />
                  </button>
                </div>
              )}
            </section>
          )}
          {section === 'templates' && (
            <section className="templates-page">
              <div className="page-heading">
                <span className="eyebrow-label">UM ESTILO PARA CADA IDEIA</span>
                <h1>
                  Comece com um bom design<span>.</span>
                </h1>
                <p>Seis direções visuais. Infinitas possibilidades de deixar do seu jeito.</p>
              </div>
              <div className="template-filter">
                <span className="pill active">
                  <Check size={14} /> Todos os modelos
                </span>
                <span className="muted">Cores e conteúdo sempre editáveis</span>
              </div>
              <ThemePicker value={themeId} onChange={chooseTemplate} />
              <div className="templates-tip">
                <Sparkles size={21} />
                <div>
                  <strong>Design que acompanha o conteúdo.</strong>
                  <p>Altere modelos e cores no editor sem reescrever a apresentação.</p>
                </div>
              </div>
            </section>
          )}
          <footer className="home-footer">
            <Brand small />
            <span>Menos tempo formatando. Mais espaço para suas ideias.</span>
          </footer>
        </main>
      </div>
      <input
        ref={upload}
        className="sr-only"
        type="file"
        accept=".pdf,application/pdf"
        onChange={(e) => {
          void readPdf(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      <input
        ref={backup}
        className="sr-only"
        type="file"
        accept=".json,.zetta"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onImport(file)
          e.target.value = ''
        }}
      />
    </div>
  )
}

function DeckCard({
  deck,
  onOpen,
  onDelete,
}: {
  deck: Deck
  onOpen: (deck: Deck) => void
  onDelete: (deck: Deck) => void
}) {
  const date = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(
    new Date(deck.updatedAt),
  )
  return (
    <article className="deck-card">
      <button
        className="deck-preview"
        onClick={() => onOpen(deck)}
        aria-label={'Abrir ' + deck.title}
      >
        <SlideCanvas slide={deck.slides[0]} theme={getTheme(deck.themeId)} accent={deck.accent} />
        <span className="deck-open">
          Abrir apresentação <ArrowUpRight size={15} />
        </span>
      </button>
      <div className="deck-info">
        <button onClick={() => onOpen(deck)}>
          <h3>{deck.title}</h3>
          <span>
            {deck.slides.length} slides <i /> Editado em {date}
          </span>
        </button>
        <button
          className="icon-button delete-deck"
          onClick={() => onDelete(deck)}
          aria-label={'Excluir ' + deck.title}
        >
          <Trash2 size={16} />
        </button>
      </div>
    </article>
  )
}
