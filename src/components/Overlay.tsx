import { useEffect, useRef, type ReactNode } from 'react'
import { BackIcon } from './Marks'

type OverlayProps = {
  label: string
  onClose: () => void
  variant?: 'sheet' | 'popup' | 'drawer'
  back?: boolean
  /** Moves focus into the panel, keeps Tab inside, locks the page scroll and gives focus back on close. */
  modal?: boolean
  children: ReactNode
}

function CloseMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 7l10 10M17 7L7 17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export function CloseButton({
  onClick,
  className = '',
  label = 'Fechar',
}: {
  onClick: () => void
  className?: string
  label?: string
}) {
  return (
    <button type="button" className={`mark-btn${className ? ` ${className}` : ''}`} aria-label={label} onClick={onClick}>
      <CloseMark />
    </button>
  )
}

const FOCUSABLE = 'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'

export function Overlay({ label, onClose, variant = 'sheet', back = false, modal = false, children }: OverlayProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!modal) return
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const { overflow } = document.body.style
    const { overflow: rootOverflow } = document.documentElement.style
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    panelRef.current?.focus({ preventScroll: true })
    return () => {
      document.body.style.overflow = overflow
      document.documentElement.style.overflow = rootOverflow
      if (previous?.isConnected) previous.focus({ preventScroll: true })
    }
  }, [modal])

  function trapTab(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!modal || event.key !== 'Tab') return
    const panel = panelRef.current
    if (!panel) return
    const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE))
    if (items.length === 0) return
    const first = items[0]
    const last = items[items.length - 1]
    const active = document.activeElement
    if (event.shiftKey && (active === first || active === panel)) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && active === last) {
      event.preventDefault()
      first.focus()
    }
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const root = variant
  const panel = `${variant}__panel`

  return (
    <div className={root} onClick={onClose}>
      <div
        ref={panelRef}
        className={panel}
        tabIndex={modal ? -1 : undefined}
        onKeyDown={trapTab}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onClick={(event) => event.stopPropagation()}
      >
        {back && (
          <button type="button" className="mark-btn overlay__back" aria-label="Voltar" onClick={onClose}>
            <BackIcon />
          </button>
        )}
        <CloseButton className="overlay__close" onClick={onClose} />
        {children}
        {variant !== 'drawer' && <div className="dock-spacer" aria-hidden="true" />}
      </div>
    </div>
  )
}
