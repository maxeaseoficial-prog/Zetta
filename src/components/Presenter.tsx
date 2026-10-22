import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Maximize, Minimize, RotateCcw, Sparkles, X } from 'lucide-react'
import type { Deck } from '../types'
import { getTheme } from '../lib/themes'
import { SlideCanvas } from './SlideCanvas'
import { Brand } from './Brand'

export function Presenter({
  deck,
  startIndex,
  onClose,
}: {
  deck: Deck
  startIndex: number
  onClose: () => void
}) {
  const [index, setIndex] = useState(Math.min(startIndex, deck.slides.length - 1))
  const [fullscreen, setFullscreen] = useState(!!document.fullscreenElement)
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [motionEnabled, setMotionEnabled] = useState(true)
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  const [animationKey, setAnimationKey] = useState(0)
  const hasChart = deck.slides[index].blocks.some((block) => block.type === 'chart')
  const animatedCharts = motionEnabled && !reducedMotion
  const container = useRef<HTMLDivElement>(null)
  const next = () => setIndex((i) => Math.min(deck.slides.length - 1, i + 1))
  const previous = () => setIndex((i) => Math.max(0, i - 1))
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(preference.matches)
    preference.addEventListener('change', update)
    return () => preference.removeEventListener('change', update)
  }, [])
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null
    container.current?.focus()
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        const buttons = Array.from(
          container.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') ?? [],
        ).filter((button) => button.offsetParent !== null)
        const first = buttons[0],
          last = buttons.at(-1)
        if (
          e.shiftKey &&
          (document.activeElement === first || document.activeElement === container.current)
        ) {
          e.preventDefault()
          last?.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first?.focus()
        }
        return
      }
      if (['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(e.key)) {
        if (e.key === ' ' && (e.target as HTMLElement).closest('button')) return
        e.preventDefault()
        next()
      }
      if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key)) {
        e.preventDefault()
        previous()
      }
      if (e.key === 'Home') {
        e.preventDefault()
        setIndex(0)
      }
      if (e.key === 'End') {
        e.preventDefault()
        setIndex(deck.slides.length - 1)
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    const fs = () => setFullscreen(!!document.fullscreenElement)
    document.addEventListener('keydown', handler)
    document.addEventListener('fullscreenchange', fs)
    return () => {
      document.removeEventListener('keydown', handler)
      document.removeEventListener('fullscreenchange', fs)
      before?.focus()
    }
  }, [deck.slides.length, onClose])
  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await document.documentElement.requestFullscreen()
    } catch {
      /* The player also works without fullscreen support. */
    }
  }
  return (
    <div
      ref={container}
      className="presenter"
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
      aria-label="Modo apresentação"
      onTouchStart={(e) => setTouchStart(e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchStart === null) return
        const delta = e.changedTouches[0].clientX - touchStart
        if (delta < -40) next()
        if (delta > 40) previous()
        setTouchStart(null)
      }}
    >
      <header>
        <Brand small />
        <span>{deck.title}</span>
        <button className="presenter-icon" aria-label="Voltar ao editor" onClick={onClose}>
          <X size={22} />
        </button>
      </header>
      <main>
        <button
          className="presenter-arrow"
          aria-label="Slide anterior"
          disabled={index === 0}
          onClick={previous}
        >
          <ChevronLeft size={28} />
        </button>
        <div className="presenter-slide" aria-live="polite">
          <SlideCanvas
            key={deck.slides[index].id + '-' + animationKey}
            slide={deck.slides[index]}
            theme={getTheme(deck.themeId)}
            accent={deck.accent}
            slideNumber={index + 1}
            totalSlides={deck.slides.length}
            animateCharts={animatedCharts}
            animationKey={animationKey}
          />
        </div>
        <button
          className="presenter-arrow"
          aria-label="Próximo slide"
          disabled={index === deck.slides.length - 1}
          onClick={next}
        >
          <ChevronRight size={28} />
        </button>
      </main>
      <footer>
        <div className="presenter-motion-controls">
          {hasChart ? (
            <>
              <button
                className="presenter-motion-button"
                aria-label="Animar gráficos"
                aria-pressed={animatedCharts}
                disabled={reducedMotion}
                title={
                  reducedMotion
                    ? 'Movimento reduzido ativado no dispositivo'
                    : 'Ativar ou desativar as animações dos gráficos'
                }
                onClick={() => setMotionEnabled((value) => !value)}
              >
                <Sparkles size={16} />
                <span>
                  {reducedMotion
                    ? 'Movimento reduzido'
                    : animatedCharts
                      ? 'Animação ligada'
                      : 'Animação desligada'}
                </span>
              </button>
              <button
                className="presenter-icon"
                aria-label="Repetir animação"
                title="Repetir animação"
                disabled={!animatedCharts}
                onClick={() => setAnimationKey((value) => value + 1)}
              >
                <RotateCcw size={18} />
              </button>
            </>
          ) : (
            <span>Use as setas do teclado para navegar.</span>
          )}
        </div>
        <div>
          <button
            className="presenter-icon"
            aria-label="Slide anterior"
            disabled={index === 0}
            onClick={previous}
          >
            <ChevronLeft size={20} />
          </button>
          <strong>
            {index + 1}
            <span> / {deck.slides.length}</span>
          </strong>
          <button
            className="presenter-icon"
            aria-label="Próximo slide"
            disabled={index === deck.slides.length - 1}
            onClick={next}
          >
            <ChevronRight size={20} />
          </button>
        </div>
        <button
          className="presenter-icon"
          aria-label={fullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
          onClick={() => void toggleFullscreen()}
        >
          {fullscreen ? <Minimize size={19} /> : <Maximize size={19} />}
        </button>
      </footer>
      <div className="presenter-progress">
        <i style={{ width: ((index + 1) / deck.slides.length) * 100 + '%' }} />
      </div>
    </div>
  )
}
