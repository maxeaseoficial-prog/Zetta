import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Check,
  Download,
  FileText,
  FolderOpen,
  Info,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import type { Deck } from './types'
import type { CreationInput } from './lib/creation'
import { listDecks, saveDeck, deleteDeck } from './lib/storage'
import { createExampleDeck } from './lib/generator'
import { parseDeckImport } from './lib/validation'
import { downloadBackup } from './lib/files'
import { useDeckHistory } from './hooks/useDeckHistory'
import { Home } from './components/Home'
import { CreationWizard } from './components/CreationWizard'
import { Editor, type SaveStatus } from './components/Editor'
import { Presenter } from './components/Presenter'
import { Modal } from './components/Modal'
import { Brand } from './components/Brand'

export default function App() {
  const history = useDeckHistory()
  const { deck } = history
  const [decks, setDecks] = useState<Deck[]>([])
  const [loading, setLoading] = useState(true)
  const [creation, setCreation] = useState<CreationInput | null>(null)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved')
  const [presentation, setPresentation] = useState<number | null>(null)
  const [exportProgress, setExportProgress] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; error?: boolean } | null>(null)
  const [help, setHelp] = useState(false)
  const [deletion, setDeletion] = useState<Deck | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const leavingRef = useRef(false)
  const deckRef = useRef(deck)
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  const unsaved = useRef(false)
  deckRef.current = deck
  const notify = useCallback((message: string, error = false) => setToast({ message, error }), [])
  const refresh = useCallback(async () => {
    try {
      setDecks(await listDecks())
    } catch {
      notify(
        'Não foi possível abrir o armazenamento local. Você ainda pode criar e baixar um backup.',
        true,
      )
    } finally {
      setLoading(false)
    }
  }, [notify])
  useEffect(() => {
    void refresh()
  }, [refresh])
  const persist = useCallback((target: Deck) => {
    const job = queue.current.catch(() => undefined).then(() => saveDeck(target))
    queue.current = job
    return job
  }, [])
  useEffect(() => {
    if (!deck) return
    unsaved.current = true
    setSaveStatus('saving')
    const timeout = setTimeout(() => {
      void persist(deck)
        .then(() => {
          if (deckRef.current?.id === deck.id && deckRef.current?.updatedAt === deck.updatedAt) {
            setSaveStatus('saved')
            unsaved.current = false
          }
        })
        .catch(() => {
          setSaveStatus('error')
          notify(
            'Não foi possível salvar neste navegador. Baixe um backup editável para preservar seu trabalho.',
            true,
          )
        })
    }, 400)
    return () => clearTimeout(timeout)
  }, [deck, persist, notify])
  useEffect(() => {
    const onLeave = (e: BeforeUnloadEvent) => {
      if (unsaved.current) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', onLeave)
    return () => window.removeEventListener('beforeunload', onLeave)
  }, [])
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), toast.error ? 11000 : 4500)
    return () => clearTimeout(timer)
  }, [toast])
  function open(next: Deck) {
    setCreation(null)
    setPresentation(null)
    history.open(next)
  }
  async function back() {
    if (leavingRef.current) return
    leavingRef.current = true
    setLeaving(true)
    try {
      let latest = deckRef.current
      while (latest) {
        await persist(latest)
        if (deckRef.current === latest) break
        latest = deckRef.current
      }
      unsaved.current = false
      history.open(null)
      setCreation(null)
      void refresh()
    } catch {
      notify('O salvamento falhou. Baixe um backup antes de sair do editor.', true)
    } finally {
      leavingRef.current = false
      setLeaving(false)
    }
  }
  function backup(target: Deck) {
    try {
      downloadBackup(target)
      notify('Backup editável baixado. Guarde-o para reabrir em outro navegador.')
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Não foi possível baixar o backup.', true)
    }
  }
  async function importFile(file: File) {
    try {
      if (file.size > 32 * 1024 * 1024) throw new Error('O backup deve ter até 32 MB.')
      const imported = parseDeckImport(await file.text())
      imported.id = crypto.randomUUID()
      imported.createdAt = new Date().toISOString()
      imported.updatedAt = imported.createdAt
      await persist(imported)
      open(imported)
      notify('Backup importado. Sua apresentação está pronta para editar.')
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Não foi possível importar esse arquivo.', true)
    }
  }
  async function exportDeck() {
    if (!deck || exportProgress) return
    setExportProgress('Preparando…')
    try {
      const { exportPdf } = await import('./lib/exportPdf')
      await exportPdf(deck, (progress: number) =>
        setExportProgress('Exportando ' + Math.round(progress * 100) + '%'),
      )
      notify('PDF pronto. O download foi iniciado.')
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Não foi possível exportar. Tente novamente.', true)
    } finally {
      setExportProgress(null)
    }
  }
  const closePresentation = useCallback(() => {
    setPresentation(null)
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined)
  }, [])
  async function confirmDelete() {
    if (!deletion) return
    setDeleting(true)
    try {
      await deleteDeck(deletion.id)
      setDeletion(null)
      await refresh()
      notify('Apresentação excluída deste navegador.')
    } catch {
      notify('Não foi possível excluir. Tente novamente.', true)
    } finally {
      setDeleting(false)
    }
  }
  return (
    <>
      <div hidden={!!deck || !!creation}>
        <Home
          decks={decks}
          loading={loading}
          onContinue={setCreation}
          onOpen={open}
          onDelete={setDeletion}
          onImport={(file) => void importFile(file)}
          onExample={() => open(createExampleDeck())}
          onHelp={() => setHelp(true)}
        />
      </div>
      {creation && !deck && (
        <CreationWizard input={creation} onBack={() => setCreation(null)} onCreate={open} />
      )}
      {deck && (
        <div className="editor-host" inert={presentation !== null || leaving}>
          <Editor
            key={deck.id}
            deck={deck}
            change={history.change}
            canUndo={history.canUndo}
            canRedo={history.canRedo}
            onUndo={history.undo}
            onRedo={history.redo}
            onBack={() => void back()}
            onPresent={(index) => setPresentation(index)}
            onExport={() => void exportDeck()}
            onBackup={() => backup(deck)}
            saveStatus={saveStatus}
            exportProgress={exportProgress}
            presenting={presentation !== null}
          />
        </div>
      )}
      {leaving && (
        <div className="leaving-overlay" role="status">
          Salvando suas alterações…
        </div>
      )}
      {deck && presentation !== null && (
        <Presenter deck={deck} startIndex={presentation} onClose={closePresentation} />
      )}
      {toast && (
        <div
          className={'toast ' + (toast.error ? 'error' : '')}
          role={toast.error ? 'alert' : 'status'}
        >
          {toast.error ? <Info size={19} /> : <Check size={19} />}
          <span>{toast.message}</span>
          <button aria-label="Fechar aviso" onClick={() => setToast(null)}>
            <X size={16} />
          </button>
        </div>
      )}
      {help && (
        <Modal title="Seu espaço para boas ideias" onClose={() => setHelp(false)}>
          <div className="help-content">
            <Brand />
            <h3>
              Do conteúdo à apresentação.
              <br />
              Com você no controle.
            </h3>
            <p>
              O Zetta transforma o material que você já tem em slides organizados e editáveis, com
              modelos, ilustrações por código e gráficos com seus dados.
            </p>
            <div className="help-feature">
              <FileText />
              <div>
                <strong>Comece pelo que você sabe.</strong>
                <p>
                  Cole texto ou envie um PDF com texto selecionável. Arquivos escaneados precisam de
                  OCR antes da importação.
                </p>
              </div>
            </div>
            <div className="help-feature">
              <ShieldCheck />
              <div>
                <strong>Salvo neste navegador.</strong>
                <p>
                  As apresentações ficam no seu dispositivo. Limpar os dados do navegador pode
                  apagá-las. Baixe um backup editável para guardar ou transferir.
                </p>
              </div>
            </div>
            <div className="help-feature">
              <Sparkles />
              <div>
                <strong>IA local, se você quiser.</strong>
                <p>
                  A revisão por IA é opcional e experimental. Requer navegador compatível com WebGPU
                  e download de um modelo. O fluxo básico funciona sem isso.
                </p>
              </div>
            </div>
            <div className="help-feature">
              <Download />
              <div>
                <strong>Pronto para compartilhar.</strong>
                <p>
                  Apresente diretamente no Zetta ou baixe um PDF. Use o arquivo .zetta.json quando
                  precisar continuar editando em outro dispositivo.
                </p>
              </div>
            </div>
            <button className="button primary full-width" onClick={() => setHelp(false)}>
              Vamos criar <Check size={16} />
            </button>
          </div>
        </Modal>
      )}
      {deletion && (
        <Modal title="Excluir apresentação?" onClose={() => !deleting && setDeletion(null)}>
          <div className="delete-confirm">
            <span className="delete-icon">
              <Trash2 size={24} />
            </span>
            <p>
              <strong>{deletion.title}</strong> será removida deste navegador. Você pode baixar um
              backup antes de excluir.
            </p>
            <div>
              <button className="button secondary" onClick={() => backup(deletion)}>
                <Download size={15} /> Baixar backup
              </button>
              <button
                className="button danger-button"
                disabled={deleting}
                onClick={() => void confirmDelete()}
              >
                {deleting ? 'Excluindo…' : 'Excluir apresentação'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
