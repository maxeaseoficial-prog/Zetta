import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

export function Modal({
  title,
  children,
  onClose,
  wide = false,
  padded = true,
}: {
  title: string
  children: ReactNode
  onClose: () => void
  wide?: boolean
  padded?: boolean
}) {
  const id = useId()
  const panel = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null
    const old = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panel.current?.focus()
    function keys(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        closeRef.current()
      }
      if (e.key !== 'Tab') return
      const items = Array.from(
        panel.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),a[href],[tabindex="0"]',
        ) ?? [],
      ).filter((el) => el.offsetParent !== null)
      if (!items.length) {
        e.preventDefault()
        return
      }
      const first = items[0],
        last = items.at(-1)
      if (
        e.shiftKey &&
        (document.activeElement === first || document.activeElement === panel.current)
      ) {
        e.preventDefault()
        last?.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', keys, true)
    return () => {
      document.removeEventListener('keydown', keys, true)
      document.body.style.overflow = old
      before?.focus()
    }
  }, [])
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={panel}
        className={'modal-panel' + (wide ? ' modal-wide' : '')}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        tabIndex={-1}
      >
        <div className="modal-heading">
          <h2 id={id}>{title}</h2>
          <button className="icon-button" aria-label="Fechar" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className={'modal-body' + (padded ? ' modal-body-padded' : '')}>{children}</div>
      </div>
    </div>
  )
}
