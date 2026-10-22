import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import {
  AlignLeft,
  ArrowDownWideNarrow,
  Check,
  Cpu,
  Download,
  Info,
  List,
  LoaderCircle,
  Sparkles,
  X,
} from 'lucide-react'
import {
  checkLocalAiSupport,
  getNumericChanges,
  isLocalAiCancellation,
  LOCAL_AI_INPUT_LIMIT,
  LOCAL_AI_MODEL_NAME,
  LOCAL_AI_OUTPUT_LIMIT,
  localAiErrorMessage,
  LocalAiSession,
  type LocalAiProgress,
  type RewriteAction,
} from '../lib/localAi'
import './local-ai.css'

export interface LocalAiPanelProps {
  text: string
  /** Limit for the destination field. A longer suggestion stays visible for review. */
  maxLength?: number
  onApply: (text: string) => void
  onClose: () => void
}

type Phase = 'checking' | 'unsupported' | 'idle' | 'loading' | 'ready' | 'generating' | 'error'

const ACTION_OPTIONS = [
  {
    id: 'shorten' as const,
    name: 'Encurtar',
    description: 'Mais direto',
    Icon: ArrowDownWideNarrow,
  },
  { id: 'clarify' as const, name: 'Clarear', description: 'Mais fácil de ler', Icon: AlignLeft },
  { id: 'bullets' as const, name: 'Criar tópicos', description: 'Uma ideia por linha', Icon: List },
]

export function LocalAiPanel({
  text,
  maxLength = LOCAL_AI_OUTPUT_LIMIT,
  onApply,
  onClose,
}: LocalAiPanelProps) {
  const headingId = useId()
  const actionsId = useId()
  const previewId = useId()
  const descriptionId = useId()
  const panelRef = useRef<HTMLElement>(null)
  const sessionRef = useRef<LocalAiSession | null>(null)
  const requestId = useRef(0)
  const operationKind = useRef<'load' | 'rewrite' | null>(null)
  const previousText = useRef(text)
  const [phase, setPhase] = useState<Phase>('checking')
  const [action, setAction] = useState<RewriteAction>('shorten')
  const [progress, setProgress] = useState<LocalAiProgress | null>(null)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [preview, setPreview] = useState('')
  const [completedSource, setCompletedSource] = useState<string | null>(null)
  const busy = phase === 'loading' || phase === 'generating'
  const sourceLength = text.trim().length
  const sourceIsValid = sourceLength > 0 && sourceLength <= LOCAL_AI_INPUT_LIMIT
  const applyLimit = Number.isFinite(maxLength)
    ? Math.max(1, Math.min(LOCAL_AI_OUTPUT_LIMIT, Math.floor(maxLength)))
    : LOCAL_AI_OUTPUT_LIMIT
  const previewLength = preview.trim().length
  const previewTooLong = previewLength > applyLimit
  const canApply =
    phase === 'ready' && completedSource === text && previewLength > 0 && !previewTooLong
  const numericChanges = useMemo(
    () => (completedSource === text && preview ? getNumericChanges(text, preview) : []),
    [text, preview, completedSource],
  )

  useEffect(() => {
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    const session = new LocalAiSession()
    sessionRef.current = session
    let mounted = true
    panelRef.current?.focus()

    void checkLocalAiSupport().then((capability) => {
      if (!mounted) return
      setPhase(capability.supported ? 'idle' : 'unsupported')
      if (!capability.supported)
        setNotice(capability.reason ?? 'Este dispositivo não está pronto para IA local.')
    })

    return () => {
      mounted = false
      requestId.current += 1
      operationKind.current = null
      session.dispose()
      if (sessionRef.current === session) sessionRef.current = null
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [])

  useEffect(() => {
    if (previousText.current === text) return
    previousText.current = text
    setPreview('')
    setCompletedSource(null)
    setError('')
    if (operationKind.current === 'rewrite') {
      requestId.current += 1
      operationKind.current = null
      sessionRef.current?.cancel()
      setPhase('idle')
      setNotice('O texto selecionado mudou. Ative a IA novamente para revisar a nova seleção.')
    }
  }, [text])

  function closePanel() {
    requestId.current += 1
    sessionRef.current?.dispose()
    onClose()
  }

  function cancelOperation() {
    const wasLoading = operationKind.current === 'load'
    requestId.current += 1
    operationKind.current = null
    sessionRef.current?.cancel()
    setPhase('idle')
    setProgress(null)
    setPreview('')
    setCompletedSource(null)
    setError('')
    setNotice(
      wasLoading
        ? 'Carregamento cancelado. Arquivos já baixados podem ser reutilizados na próxima ativação.'
        : 'Revisão interrompida. O texto original foi preservado. Ative a IA novamente para continuar.',
    )
  }

  async function activate() {
    const session = sessionRef.current
    if (!session || !sourceIsValid || busy) return
    const id = ++requestId.current
    operationKind.current = 'load'
    setPhase('loading')
    setError('')
    setNotice('')
    setProgress(null)
    try {
      await session.activate((report) => {
        if (requestId.current === id) setProgress(report)
      })
      if (requestId.current !== id) return
      setPhase('ready')
      setNotice('IA pronta neste dispositivo. Escolha como quer revisar o trecho.')
    } catch (cause) {
      if (requestId.current !== id) return
      setPhase(isLocalAiCancellation(cause) ? 'idle' : 'error')
      if (!isLocalAiCancellation(cause)) setError(localAiErrorMessage(cause))
    } finally {
      if (requestId.current === id) operationKind.current = null
    }
  }

  async function generate() {
    const session = sessionRef.current
    if (!session || phase !== 'ready' || !sourceIsValid) return
    const id = ++requestId.current
    const source = text
    operationKind.current = 'rewrite'
    setPhase('generating')
    setPreview('')
    setCompletedSource(null)
    setError('')
    setNotice('')
    try {
      const result = await session.rewrite(source, action, (partial) => {
        if (requestId.current === id) setPreview(partial)
      })
      if (requestId.current !== id) return
      setPreview(result)
      setCompletedSource(source)
      setPhase('ready')
    } catch (cause) {
      if (requestId.current !== id) return
      setPreview('')
      setCompletedSource(null)
      setPhase(isLocalAiCancellation(cause) ? 'idle' : 'error')
      if (!isLocalAiCancellation(cause)) setError(localAiErrorMessage(cause))
    } finally {
      if (requestId.current === id) operationKind.current = null
    }
  }

  function onDialogKeyDown(event: KeyboardEvent<HTMLElement>) {
    // Editor shortcuts must not run while a user is typing in this modal.
    event.stopPropagation()
    if (event.key === 'Escape') {
      event.preventDefault()
      closePanel()
    }
    if (event.key !== 'Tab' || !panelRef.current) return
    const controls = Array.from(
      panelRef.current.querySelectorAll<HTMLElement>(
        'button:not(:disabled), textarea:not(:disabled), a[href], summary, [tabindex="0"]',
      ),
    ).filter((element) => element.getClientRects().length > 0)
    const first = controls[0]
    const last = controls.at(-1)
    if (!first || !last) {
      event.preventDefault()
      return
    }
    if (
      event.shiftKey &&
      (document.activeElement === first || document.activeElement === panelRef.current)
    ) {
      event.preventDefault()
      last.focus()
    } else if (
      !event.shiftKey &&
      (document.activeElement === last || document.activeElement === panelRef.current)
    ) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <div
      className="ai-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closePanel()
      }}
    >
      <section
        ref={panelRef}
        className="ai-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        onKeyDown={onDialogKeyDown}
      >
        <header className="ai-header">
          <div className="ai-heading-icon">
            <Sparkles size={21} aria-hidden="true" />
          </div>
          <div className="ai-heading-copy">
            <div className="ai-title-row">
              <h2 id={headingId}>Refinar com IA local</h2>
              <span className="ai-badge">Experimental</span>
            </div>
            <p id={descriptionId}>Uma nova versão, só para o texto selecionado.</p>
          </div>
          <button
            className="ai-close"
            type="button"
            onClick={closePanel}
            aria-label="Fechar painel de IA local"
          >
            <X size={20} />
          </button>
        </header>

        <div className="ai-body">
          <div className="ai-local-card">
            <Cpu size={20} aria-hidden="true" />
            <div>
              <strong>Roda no seu dispositivo</strong>
              <p>
                O primeiro uso baixa um modelo de centenas de MB. A revisão usa a memória e o
                processamento deste dispositivo, sem enviar o texto para um servidor de IA.
              </p>
              <span>
                {LOCAL_AI_MODEL_NAME} <span aria-hidden="true">·</span> Sem cobrança por pedido
              </span>
            </div>
          </div>

          {phase === 'checking' && (
            <p className="ai-inline-status" role="status">
              <LoaderCircle className="ai-spin" size={17} />
              Verificando compatibilidade...
            </p>
          )}
          {phase === 'unsupported' && (
            <div className="ai-info" role="status">
              <Info size={18} />
              <div>
                <strong>IA local indisponível aqui</strong>
                <p>{notice}</p>
                <p>Você pode continuar editando e exportando sua apresentação normalmente.</p>
              </div>
            </div>
          )}

          <details className="ai-source" open>
            <summary>
              <span>Texto selecionado</span>
              <span
                className={
                  sourceLength > LOCAL_AI_INPUT_LIMIT ? 'ai-count ai-count-error' : 'ai-count'
                }
              >
                {sourceLength.toLocaleString('pt-BR')} /{' '}
                {LOCAL_AI_INPUT_LIMIT.toLocaleString('pt-BR')}
              </span>
            </summary>
            <p>{text || 'Nenhum texto selecionado.'}</p>
          </details>

          {!sourceIsValid && (
            <p className="ai-error" role="alert">
              {sourceLength === 0
                ? 'Selecione um trecho de texto no editor para usar a revisão.'
                : `Selecione um trecho menor, com até ${LOCAL_AI_INPUT_LIMIT.toLocaleString('pt-BR')} caracteres.`}
            </p>
          )}

          {(phase === 'idle' || phase === 'error') && (
            <div className="ai-activation">
              <button
                className="ai-button ai-button-primary ai-button-wide"
                type="button"
                onClick={() => void activate()}
                disabled={!sourceIsValid}
              >
                <Download size={17} />
                {phase === 'error' ? 'Tentar ativar novamente' : 'Baixar e ativar IA local'}
              </button>
              <p>
                Download opcional. Os arquivos podem ficar em cache no navegador para os próximos
                usos.
              </p>
            </div>
          )}

          {phase === 'loading' && (
            <div className="ai-loading" role="status" aria-live="polite">
              <div className="ai-loading-label">
                <span>
                  <LoaderCircle className="ai-spin" size={16} />
                  Preparando a IA local
                </span>
                <strong>{progress ? `${Math.round(progress.fraction * 100)}%` : '...'}</strong>
              </div>
              <progress
                aria-label="Progresso do carregamento do modelo"
                max={1}
                value={progress?.fraction}
              />
              <div className="ai-loading-footer">
                <p>O primeiro download pode levar alguns minutos.</p>
                <button className="ai-text-button" type="button" onClick={cancelOperation}>
                  Cancelar download
                </button>
              </div>
            </div>
          )}

          {error && (
            <p className="ai-error" role="alert">
              <Info size={17} />
              {error}
            </p>
          )}
          {notice && phase !== 'unsupported' && (
            <p className="ai-notice" role="status">
              {phase === 'ready' && <Check size={16} />}
              {notice}
            </p>
          )}

          {(phase === 'ready' || phase === 'generating') && (
            <>
              <div className="ai-section-heading" id={actionsId}>
                Como quer melhorar?
              </div>
              <div className="ai-actions" role="group" aria-labelledby={actionsId}>
                {ACTION_OPTIONS.map(({ id, name, description, Icon }) => (
                  <button
                    key={id}
                    type="button"
                    className={`ai-action${action === id ? ' ai-action-selected' : ''}`}
                    aria-pressed={action === id}
                    disabled={busy}
                    onClick={() => setAction(id)}
                  >
                    <Icon size={18} aria-hidden="true" />
                    <strong>{name}</strong>
                    <span>{description}</span>
                  </button>
                ))}
              </div>
              <div className="ai-generate-row">
                {phase === 'generating' ? (
                  <>
                    <span className="ai-inline-status" role="status">
                      <LoaderCircle className="ai-spin" size={16} />
                      Revisando neste dispositivo...
                    </span>
                    <button
                      type="button"
                      className="ai-button ai-button-secondary"
                      onClick={cancelOperation}
                    >
                      Interromper
                    </button>
                  </>
                ) : (
                  <button
                    className="ai-button ai-button-primary"
                    type="button"
                    disabled={!sourceIsValid}
                    onClick={() => void generate()}
                  >
                    <Sparkles size={16} />
                    {preview ? 'Gerar outra versão' : 'Gerar sugestão'}
                  </button>
                )}
              </div>
            </>
          )}

          {(preview || phase === 'generating') && (
            <div className="ai-preview">
              <div className="ai-preview-heading">
                <label htmlFor={previewId}>Sugestão</label>
                <span>
                  {phase === 'generating' ? 'Gerando...' : 'Pode ajustar antes de aplicar'}
                </span>
              </div>
              <textarea
                id={previewId}
                value={preview}
                maxLength={LOCAL_AI_OUTPUT_LIMIT}
                readOnly={phase === 'generating'}
                onChange={(event) => setPreview(event.target.value)}
                placeholder="A sugestão aparecerá aqui..."
                spellCheck
                lang="pt-BR"
              />
              <div className={`ai-preview-limit${previewTooLong ? ' ai-preview-limit-error' : ''}`}>
                <span>Limite do elemento selecionado</span>
                <span>
                  {previewLength.toLocaleString('pt-BR')} / {applyLimit.toLocaleString('pt-BR')}{' '}
                  caracteres
                </span>
              </div>
              {previewTooLong && phase !== 'generating' && (
                <p className="ai-error" role="alert">
                  A sugestão ultrapassa o limite deste elemento. Encurte o texto acima para até{' '}
                  {applyLimit.toLocaleString('pt-BR')} caracteres antes de aplicar.
                </p>
              )}
              {numericChanges.length > 0 && (
                <p className="ai-review-note">
                  <Info size={16} />
                  Há números diferentes ou ausentes na sugestão. Confira antes de aplicar.
                </p>
              )}
              <p className="ai-review-reminder">
                Revise nomes, números e sentido. A IA pode errar.
              </p>
            </div>
          )}
        </div>

        <footer className="ai-footer">
          <span>Seu original só muda quando você aplicar.</span>
          <div>
            <button type="button" className="ai-button ai-button-secondary" onClick={closePanel}>
              Fechar
            </button>
            <button
              type="button"
              className="ai-button ai-button-primary"
              disabled={!canApply}
              onClick={() => {
                if (!canApply) return
                onApply(preview.trim())
                closePanel()
              }}
            >
              <Check size={16} />
              Aplicar ao texto
            </button>
          </div>
        </footer>
      </section>
    </div>
  )
}

export default LocalAiPanel
