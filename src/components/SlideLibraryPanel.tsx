import { useEffect, useRef, useState } from 'react'
import { Check, Save, Trash2 } from 'lucide-react'
import type { Deck, ReusableSlide } from '../types'
import { createReusableSlide, type ReuseAppearanceMode } from '../lib/brand'
import { ensureBrandFonts } from '../lib/fonts'
import {
  deleteReusableSlide,
  getLibraryStats,
  getReusableSlide,
  listReusableSlides,
  saveReusableSlide,
  type LibraryStats,
  type ReusableSlideSummary,
} from '../lib/storage'
import { getTheme } from '../lib/themes'
import { Modal } from './Modal'
import { SlideCanvas } from './SlideCanvas'
import './brand-tools.css'

export interface SlideLibraryPanelProps {
  deck: Deck
  slideId: string
  onInsert: (item: ReusableSlide, mode: ReuseAppearanceMode) => void
  onClose: () => void
}

export function SlideLibraryPanel({ deck, slideId, onInsert, onClose }: SlideLibraryPanelProps) {
  const currentSlide = deck.slides.find((slide) => slide.id === slideId)
  const [name, setName] = useState(currentSlide?.title.slice(0, 100) || 'Slide aprovado')
  const [items, setItems] = useState<ReusableSlideSummary[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [selected, setSelected] = useState<ReusableSlide | null>(null)
  const [stats, setStats] = useState<LibraryStats | null>(null)
  const [mode, setMode] = useState<ReuseAppearanceMode>('preserve')
  const [loading, setLoading] = useState(true)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)
  const alive = useRef(true)
  const requestNumber = useRef(0)
  const message = (reason: unknown) =>
    reason instanceof Error ? reason.message : 'Não foi possível concluir. Tente novamente.'

  async function refresh() {
    const [list, usage] = await Promise.all([listReusableSlides(), getLibraryStats()])
    if (alive.current) {
      setItems(list)
      setStats(usage)
    }
    return list
  }
  useEffect(() => {
    alive.current = true
    void refresh()
      .then((list) => {
        if (alive.current && list.length) setSelectedId(list[0].id)
      })
      .catch((reason) => {
        if (alive.current) setError(message(reason))
      })
      .finally(() => {
        if (alive.current) setLoading(false)
      })
    return () => {
      alive.current = false
      requestNumber.current += 1
    }
  }, [])
  useEffect(() => {
    const request = ++requestNumber.current
    setSelected(null)
    if (!selectedId) {
      setPreviewLoading(false)
      return
    }
    setPreviewLoading(true)
    void getReusableSlide(selectedId)
      .then(async (item) => {
        if (!item) throw new Error('Este slide já foi removido da biblioteca.')
        if (item.slide.appearance?.brand) await ensureBrandFonts(item.slide.appearance.brand.font)
        if (alive.current && request === requestNumber.current) {
          setSelected(item)
          setError('')
        }
      })
      .catch((reason) => {
        if (alive.current && request === requestNumber.current) setError(message(reason))
      })
      .finally(() => {
        if (alive.current && request === requestNumber.current) setPreviewLoading(false)
      })
    return () => {
      requestNumber.current += 1
    }
  }, [selectedId])
  useEffect(() => {
    if (mode === 'adapt' && deck.brand)
      void ensureBrandFonts(deck.brand.font).catch((reason) => {
        if (alive.current) setError(message(reason))
      })
  }, [mode, deck.brand?.font])

  async function saveCurrent() {
    setBusy('Salvando slide…')
    setError('')
    setNotice('')
    try {
      const item = createReusableSlide(deck, slideId, name)
      await saveReusableSlide(item)
      await refresh()
      if (alive.current) {
        setSelectedId(item.id)
        setNotice('Slide salvo com conteúdo, imagens, aparência e origem incorporados.')
      }
    } catch (reason) {
      if (alive.current) setError(message(reason))
    } finally {
      if (alive.current) setBusy('')
    }
  }
  async function remove(id: string) {
    setBusy('Excluindo slide…')
    setError('')
    try {
      await deleteReusableSlide(id)
      const list = await refresh()
      if (alive.current) {
        if (id === selectedId) setSelectedId(list[0]?.id ?? '')
        setDeleting(null)
        setNotice(
          'Item removido da biblioteca. Os slides já inseridos nas apresentações permanecem iguais.',
        )
      }
    } catch (reason) {
      if (alive.current) setError(message(reason))
    } finally {
      if (alive.current) setBusy('')
    }
  }
  function insert() {
    if (!selected) return
    try {
      onInsert(selected, mode)
    } catch (reason) {
      setError(message(reason))
    }
  }
  const preview = selected ? structuredClone(selected.slide) : null
  if (preview && mode === 'adapt') delete preview.appearance

  return (
    <Modal title="Biblioteca de slides" wide onClose={onClose}>
      <p className="brand-intro">
        Guarde slides aprovados e use-os em outras apresentações. Cada cópia continua editável e
        independente.
      </p>
      <div className="shelf-save-current">
        <label className="field-label">
          SALVAR O SLIDE ATUAL
          <input
            aria-label="Nome do slide na biblioteca"
            value={name}
            maxLength={100}
            disabled={Boolean(busy)}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <button
          className="button secondary"
          disabled={Boolean(busy) || !currentSlide || !name.trim()}
          onClick={() => void saveCurrent()}
        >
          <Save size={16} />
          Salvar na biblioteca
        </button>
      </div>
      <div className="shelf-grid">
        <aside className="shelf-list" aria-label="Slides salvos">
          {loading ? (
            <p className="brand-small" role="status">
              Abrindo biblioteca…
            </p>
          ) : items.length ? (
            items.map((item) => (
              <div className="shelf-row" key={item.id}>
                <button
                  className={'shelf-select ' + (item.id === selectedId ? 'active' : '')}
                  disabled={Boolean(busy)}
                  aria-pressed={item.id === selectedId}
                  onClick={() => {
                    setSelectedId(item.id)
                    setDeleting(null)
                  }}
                >
                  <strong>{item.name}</strong>
                  <span>{new Date(item.createdAt).toLocaleDateString('pt-BR')}</span>
                </button>
                <button
                  className="icon-button"
                  disabled={Boolean(busy)}
                  aria-label={`Excluir slide salvo ${item.name}`}
                  onClick={() => setDeleting(item.id)}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))
          ) : (
            <div className="shelf-empty">
              <Save size={24} />
              <h3>Seu primeiro slide aprovado.</h3>
              <p>Salve o slide atual para começar sua coleção.</p>
            </div>
          )}
        </aside>
        <div className="shelf-detail">
          {previewLoading ? (
            <p className="brand-small" role="status">
              Preparando prévia…
            </p>
          ) : preview && selected ? (
            <>
              <div className="brand-slide-preview">
                <SlideCanvas
                  slide={preview}
                  theme={getTheme(deck.themeId)}
                  accent={deck.accent}
                  brand={deck.brand}
                />
              </div>
              <h3>{selected.name}</h3>
              <fieldset className="brand-apply-options">
                <legend>Aparência ao inserir</legend>
                <label>
                  <input
                    type="radio"
                    name="shelf-appearance"
                    checked={mode === 'preserve'}
                    onChange={() => setMode('preserve')}
                  />
                  <span>Preservar a aparência do slide salvo</span>
                </label>
                <label>
                  <input
                    type="radio"
                    name="shelf-appearance"
                    checked={mode === 'adapt'}
                    onChange={() => setMode('adapt')}
                  />
                  <span>Usar tema e marca desta apresentação</span>
                </label>
              </fieldset>
              <p className="brand-small">
                Cores definidas em elementos individuais são preservadas. A cópia entra depois do
                slide atual.
              </p>
              {selected.slide.origin && (
                <details className="shelf-origin">
                  <summary>Conferir origem preservada</summary>
                  <p>
                    <strong>
                      {selected.slide.origin.sourceName || 'Material da apresentação de origem'}
                    </strong>
                    {selected.slide.origin.pages.length
                      ? ` · p. ${selected.slide.origin.pages.join(', ')}`
                      : ''}
                  </p>
                  <p className="brand-small">
                    O trecho e a referência acompanham o slide. Não há link para um PDF original.
                  </p>
                  <textarea
                    readOnly
                    aria-label="Trecho de origem do slide salvo"
                    value={selected.slide.origin.excerpt}
                    rows={5}
                  />
                </details>
              )}
            </>
          ) : (
            <p className="shelf-placeholder">Selecione um slide para conferir antes de inserir.</p>
          )}
        </div>
      </div>
      {deleting && (
        <div className="brand-delete-confirm" role="alert">
          <p>
            Excluir este item da biblioteca? As apresentações onde ele já foi usado permanecem
            iguais.
          </p>
          <div className="brand-actions">
            <button
              className="button secondary"
              disabled={Boolean(busy)}
              onClick={() => setDeleting(null)}
            >
              Cancelar
            </button>
            <button
              className="button danger"
              disabled={Boolean(busy)}
              onClick={() => void remove(deleting)}
            >
              Excluir item
            </button>
          </div>
        </div>
      )}
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      {(notice || busy) && (
        <p className="brand-status" role="status">
          {busy || notice}
        </p>
      )}
      <div className="brand-footer-actions">
        {stats && (
          <span className="brand-small shelf-quota">
            {stats.slides}/50 slides · {(stats.bytes / 1024 / 1024).toFixed(1).replace('.', ',')}/64
            MB na biblioteca
          </span>
        )}
        <button className="button secondary" onClick={onClose}>
          Fechar
        </button>
        <button
          className="button primary"
          disabled={!selected || Boolean(busy) || previewLoading || deck.slides.length >= 50}
          onClick={insert}
        >
          <Check size={16} />
          Inserir slide
        </button>
      </div>
      {deck.slides.length >= 50 && (
        <p className="inline-error" role="alert">
          Esta apresentação já tem 50 slides. Remova um slide antes de inserir outro.
        </p>
      )}
    </Modal>
  )
}

export default SlideLibraryPanel
