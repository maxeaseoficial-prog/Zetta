import { useEffect, useRef, useState } from 'react'
import { Check, Plus, Save, Trash2, Upload } from 'lucide-react'
import type { BrandKit, Deck } from '../types'
import { applyBrandToDeck, resolveAppearance, type BrandApplyMode } from '../lib/brand'
import { readImage } from '../lib/files'
import { ensureBrandFonts } from '../lib/fonts'
import { getTheme } from '../lib/themes'
import { validateBrandKit } from '../lib/validation'
import {
  deleteBrandProfile,
  getBrandProfile,
  getLibraryStats,
  listBrandProfiles,
  saveBrandProfile,
  type BrandProfileSummary,
  type LibraryStats,
} from '../lib/storage'
import { Modal } from './Modal'
import { SlideCanvas } from './SlideCanvas'
import './brand-tools.css'

export interface BrandPanelProps {
  deck: Deck
  onApply: (kit: BrandKit, mode: BrandApplyMode) => void
  onRemove?: () => void
  onClose: () => void
}

const errorMessage = (value: unknown) =>
  value instanceof Error ? value.message : 'Não foi possível concluir. Tente novamente.'
const inputColor = (value: string) =>
  value.length === 4
    ? '#' + [...value.slice(1)].map((char) => char + char).join('')
    : value.slice(0, 7)

function newBrand(deck: Deck): BrandKit {
  const { theme, accent } = resolveAppearance({}, getTheme(deck.themeId), deck.accent, deck.brand)
  return {
    id: crypto.randomUUID(),
    name: 'Minha marca',
    colors: { accent, background: theme.background, foreground: theme.foreground },
    font: deck.brand?.font ?? 'sans',
    footer: '',
  }
}

export function BrandPanel({ deck, onApply, onRemove, onClose }: BrandPanelProps) {
  const [draft, setDraft] = useState<BrandKit>(() => structuredClone(deck.brand ?? newBrand(deck)))
  const baseline = useRef(JSON.stringify(draft))
  const alive = useRef(true)
  const [profiles, setProfiles] = useState<BrandProfileSummary[]>([])
  const [stats, setStats] = useState<LibraryStats | null>(null)
  const [mode, setMode] = useState<BrandApplyMode>('preserve')
  const [busy, setBusy] = useState('')
  const [loading, setLoading] = useState(true)
  const [fontReady, setFontReady] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const upload = useRef<HTMLInputElement>(null)
  const dirty = JSON.stringify(draft) !== baseline.current

  async function refresh() {
    const [items, usage] = await Promise.all([listBrandProfiles(), getLibraryStats()])
    if (alive.current) {
      setProfiles(items)
      setStats(usage)
    }
  }
  useEffect(() => {
    alive.current = true
    void refresh()
      .catch((reason) => {
        if (alive.current) setError(errorMessage(reason))
      })
      .finally(() => {
        if (alive.current) setLoading(false)
      })
    return () => {
      alive.current = false
    }
  }, [])
  useEffect(() => {
    let active = true
    setFontReady(false)
    void ensureBrandFonts(draft.font)
      .then(() => {
        if (active) setFontReady(true)
      })
      .catch((reason) => {
        if (active) setError(errorMessage(reason))
      })
    return () => {
      active = false
    }
  }, [draft.font])

  function request(action: () => void) {
    if (busy) return
    if (dirty) setPendingAction(() => action)
    else action()
  }
  function replaceDraft(kit: BrandKit) {
    baseline.current = JSON.stringify(kit)
    setDraft(kit)
    setError('')
    setNotice('')
    setDeleting(null)
  }
  async function loadProfile(id: string) {
    setBusy('Abrindo perfil…')
    setError('')
    try {
      const kit = await getBrandProfile(id)
      if (!kit) throw new Error('Este perfil já foi removido. Atualize a lista para continuar.')
      if (alive.current) replaceDraft(kit)
    } catch (reason) {
      if (alive.current) setError(errorMessage(reason))
    } finally {
      if (alive.current) setBusy('')
    }
  }
  async function save() {
    setBusy('Salvando perfil…')
    setError('')
    setNotice('')
    try {
      const kit = validateBrandKit(draft)
      await saveBrandProfile(kit)
      if (!alive.current) return
      baseline.current = JSON.stringify(kit)
      setDraft(kit)
      await refresh()
      if (alive.current)
        setNotice('Perfil salvo neste navegador. Você pode aplicá-lo em outras apresentações.')
    } catch (reason) {
      if (alive.current) setError(errorMessage(reason))
    } finally {
      if (alive.current) setBusy('')
    }
  }
  async function removeProfile(id: string) {
    setBusy('Excluindo perfil…')
    setError('')
    try {
      await deleteBrandProfile(id)
      await refresh()
      if (alive.current) {
        setDeleting(null)
        setNotice(
          'Perfil removido da biblioteca. As marcas já aplicadas permanecem nas apresentações.',
        )
      }
    } catch (reason) {
      if (alive.current) setError(errorMessage(reason))
    } finally {
      if (alive.current) setBusy('')
    }
  }
  async function importLogo(file?: File) {
    if (!file) return
    setBusy('Preparando logo…')
    setError('')
    setNotice('')
    try {
      const src = await readImage(file)
      if (alive.current)
        setDraft((value) => ({ ...value, logo: { src, alt: `Logo de ${value.name || 'marca'}` } }))
    } catch (reason) {
      if (alive.current) setError(errorMessage(reason))
    } finally {
      if (alive.current) setBusy('')
    }
  }
  function apply() {
    setError('')
    try {
      const kit = validateBrandKit(draft)
      applyBrandToDeck(deck, kit, mode) // Check the full document budget before calling the editor.
      onApply(kit, mode)
      baseline.current = JSON.stringify(kit)
      setNotice(
        'Marca aplicada à apresentação. Salve o perfil se quiser reutilizá-lo em outros documentos.',
      )
    } catch (reason) {
      setError(errorMessage(reason))
    }
  }

  const preview = structuredClone(deck.slides[0])
  if (mode === 'reset-colors') {
    delete preview.appearance
    delete preview.background
    if (preview.titleStyle) {
      delete preview.titleStyle.color
      delete preview.titleStyle.background
    }
    for (const block of preview.blocks)
      if (block.style) {
        delete block.style.color
        delete block.style.background
      }
  }

  return (
    <Modal
      title="Kit de marca"
      wide
      onClose={() => (pendingAction ? setPendingAction(null) : request(onClose))}
    >
      {pendingAction ? (
        <div className="brand-confirm" role="alert">
          <h3>Há alterações no perfil ainda não salvas.</h3>
          <p>Volte para salvar o perfil ou descarte este rascunho.</p>
          <div className="brand-actions">
            <button className="button primary" autoFocus onClick={() => setPendingAction(null)}>
              Continuar editando
            </button>
            <button
              className="button secondary"
              onClick={() => {
                const action = pendingAction
                setPendingAction(null)
                action()
              }}
            >
              Descartar rascunho
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="brand-intro">
            Uma identidade para seus slides. Os perfis ficam neste navegador e a marca aplicada
            acompanha o backup.
          </p>
          <div className="brand-panel-grid">
            <aside className="brand-profile-list" aria-label="Perfis de marca salvos">
              <div className="brand-section-heading">
                <h3>Suas marcas</h3>
                <button
                  className="icon-button"
                  aria-label="Criar novo perfil de marca"
                  disabled={Boolean(busy)}
                  onClick={() => request(() => replaceDraft(newBrand(deck)))}
                >
                  <Plus size={18} />
                </button>
              </div>
              {loading ? (
                <p className="brand-small" role="status">
                  Abrindo biblioteca…
                </p>
              ) : profiles.length ? (
                profiles.map((item) => (
                  <div className="brand-profile-row" key={item.id}>
                    <button
                      className={'brand-profile-select ' + (item.id === draft.id ? 'active' : '')}
                      aria-pressed={item.id === draft.id}
                      disabled={Boolean(busy)}
                      onClick={() =>
                        request(() => {
                          void loadProfile(item.id)
                        })
                      }
                    >
                      {item.name}
                    </button>
                    <button
                      className="icon-button"
                      aria-label={`Excluir perfil ${item.name}`}
                      disabled={Boolean(busy)}
                      onClick={() => setDeleting(item.id)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))
              ) : (
                <p className="brand-small">Salve seu primeiro perfil para reutilizar a marca.</p>
              )}
              {deleting && (
                <div className="brand-delete-confirm" role="alert">
                  <p>
                    Excluir este perfil da biblioteca? As apresentações existentes permanecem
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
                      onClick={() => void removeProfile(deleting)}
                    >
                      Excluir perfil
                    </button>
                  </div>
                </div>
              )}
              {stats && (
                <p className="brand-small brand-quota">
                  {stats.brands}/20 marcas ·{' '}
                  {(stats.bytes / 1024 / 1024).toFixed(1).replace('.', ',')}/64 MB na biblioteca
                </p>
              )}
            </aside>
            <div className="brand-main">
              <fieldset className="brand-form" disabled={Boolean(busy)}>
                <label className="field-label">
                  NOME DO PERFIL
                  <input
                    aria-label="Nome do perfil de marca"
                    value={draft.name}
                    maxLength={100}
                    onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                  />
                </label>
                <div className="brand-logo-row">
                  <div className="brand-logo-preview">
                    {draft.logo ? (
                      <img src={draft.logo.src} alt={draft.logo.alt} />
                    ) : (
                      <span>Logo</span>
                    )}
                  </div>
                  <div className="brand-logo-controls">
                    <button className="button secondary" onClick={() => upload.current?.click()}>
                      <Upload size={15} />
                      {draft.logo ? 'Trocar logo' : 'Enviar logo'}
                    </button>
                    <span className="brand-small">PNG, JPG ou WebP. Processamento local.</span>
                    {draft.logo && (
                      <button
                        className="text-button"
                        onClick={() => setDraft(({ logo: _logo, ...value }) => value)}
                      >
                        Remover logo
                      </button>
                    )}
                  </div>
                </div>
                <input
                  ref={upload}
                  type="file"
                  hidden
                  accept="image/png,image/jpeg,image/webp"
                  aria-label="Arquivo do logo"
                  onChange={(event) => {
                    void importLogo(event.target.files?.[0])
                    event.target.value = ''
                  }}
                />
                {draft.logo && (
                  <label className="field-label">
                    DESCRIÇÃO DO LOGO
                    <input
                      aria-label="Descrição do logo"
                      value={draft.logo.alt}
                      maxLength={1000}
                      onChange={(event) =>
                        setDraft({ ...draft, logo: { ...draft.logo!, alt: event.target.value } })
                      }
                    />
                  </label>
                )}
                <div className="brand-color-grid">
                  {(
                    [
                      { key: 'accent', label: 'Destaque' },
                      { key: 'background', label: 'Fundo' },
                      { key: 'foreground', label: 'Texto' },
                    ] as const
                  ).map(({ key, label }) => (
                    <label className="brand-color-control" key={key}>
                      <span>{label}</span>
                      <input
                        type="color"
                        aria-label={`Cor de ${label.toLowerCase()} da marca`}
                        value={inputColor(draft.colors[key])}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            colors: { ...draft.colors, [key]: event.target.value },
                          })
                        }
                      />
                      <small>{draft.colors[key].toUpperCase()}</small>
                    </label>
                  ))}
                </div>
                <label className="field-label">
                  TIPOGRAFIA
                  <select
                    aria-label="Tipografia da marca"
                    value={draft.font}
                    onChange={(event) =>
                      setDraft({ ...draft, font: event.target.value as BrandKit['font'] })
                    }
                  >
                    <option value="sans">Liberation Sans · sem serifa</option>
                    <option value="serif">Liberation Serif · com serifa</option>
                  </select>
                </label>
                <label className="field-label">
                  RODAPÉ OPCIONAL
                  <input
                    aria-label="Rodapé da marca"
                    value={draft.footer}
                    maxLength={160}
                    placeholder="Ex.: Sua empresa · Material institucional"
                    onChange={(event) => setDraft({ ...draft, footer: event.target.value })}
                  />
                </label>
                <fieldset className="brand-apply-options">
                  <legend>Ao aplicar nesta apresentação</legend>
                  <label>
                    <input
                      type="radio"
                      name="brand-apply-mode"
                      checked={mode === 'preserve'}
                      onChange={() => setMode('preserve')}
                    />
                    <span>Preservar cores personalizadas e visual dos slides reutilizados</span>
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="brand-apply-mode"
                      checked={mode === 'reset-colors'}
                      onChange={() => setMode('reset-colors')}
                    />
                    <span>
                      Reaplicar a marca e remover essas personalizações de cor e aparência
                    </span>
                  </label>
                </fieldset>
              </fieldset>
              <div className="brand-preview-heading">
                <span>Prévia do primeiro slide</span>
                {!fontReady && <span role="status">Preparando fonte…</span>}
              </div>
              <div className="brand-slide-preview">
                {fontReady && (
                  <SlideCanvas
                    slide={preview}
                    theme={getTheme(deck.themeId)}
                    accent={deck.accent}
                    brand={draft}
                  />
                )}
              </div>
            </div>
          </div>
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
            {deck.brand && onRemove && (
              <button
                className="text-button"
                disabled={Boolean(busy)}
                onClick={() => request(onRemove)}
              >
                Retirar marca desta apresentação
              </button>
            )}
            <button
              className="button secondary"
              disabled={Boolean(busy)}
              onClick={() => void save()}
            >
              <Save size={16} />
              Salvar perfil
            </button>
            <button
              className="button primary"
              disabled={Boolean(busy) || !fontReady}
              onClick={apply}
            >
              <Check size={16} />
              Aplicar marca
            </button>
          </div>
        </>
      )}
    </Modal>
  )
}

export default BrandPanel
