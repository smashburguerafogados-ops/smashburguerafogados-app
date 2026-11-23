import { useEffect, useRef, type ReactNode } from 'react'
import { BackIcon } from './Marks'

type OverlayProps = {
  label: string
  onClose: () => void
  variant?: 'sheet' | 'popup' | 'drawer'
  back?: boolean
  /** On by default: moves focus into the panel, keeps Tab inside, locks the page scroll and gives focus back on close. */
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

/** What Tab reaches: a radio group counts once, as its checked button or else its first. */
function tabbables(panel: HTMLElement): HTMLElement[] {
  const seen = new Map<string, HTMLInputElement>()
  const items: HTMLElement[] = []
  for (const item of Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE))) {
    if (!(item instanceof HTMLInputElement) || item.type !== 'radio' || !item.name) {
      items.push(item)
      continue
    }
    const group = `${item.form?.id ?? ''}|${item.name}`
    const kept = seen.get(group)
    if (!kept) {
      const checked = Array.from(panel.querySelectorAll<HTMLInputElement>('input[type="radio"]')).find(
        (radio) => radio.name === item.name && radio.checked,
      )
      const chosen = checked ?? item
      seen.set(group, chosen)
      items.push(chosen)
    }
  }
  return items
}

/** Open panels, oldest first. Only the last one answers ESC and Tab. */
const openPanels: symbol[] = []
const pageLock: { count: number; body: string; root: string } = { count: 0, body: '', root: '' }

function lockPage() {
  if (pageLock.count === 0) {
    pageLock.body = document.body.style.overflow
    pageLock.root = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
  }
  pageLock.count += 1
}

function unlockPage() {
  pageLock.count = Math.max(0, pageLock.count - 1)
  if (pageLock.count === 0) {
    document.body.style.overflow = pageLock.body
    document.documentElement.style.overflow = pageLock.root
  }
}

export function Overlay({ label, onClose, variant = 'sheet', back = false, modal = true, children }: OverlayProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const id = useRef<symbol>(Symbol(label))
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    const mine = id.current
    openPanels.push(mine)
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    if (modal) {
      lockPage()
      panelRef.current?.focus({ preventScroll: true })
    }
    return () => {
      const at = openPanels.indexOf(mine)
      if (at >= 0) openPanels.splice(at, 1)
      if (!modal) return
      unlockPage()
      if (previous?.isConnected) previous.focus({ preventScroll: true })
    }
  }, [modal])

  useEffect(() => {
    if (!modal) return
    let direction: 'forward' | 'back' | null = null
    let timer: ReturnType<typeof setTimeout> | undefined

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Tab') return
      direction = event.shiftKey ? 'back' : 'forward'
      clearTimeout(timer)
      timer = setTimeout(() => {
        direction = null
      }, 0)
    }

    // Radio groups and the like let the browser jump past the last control, so a Tab that
    // lands outside the panel is sent back in.
    function onFocusIn(event: FocusEvent) {
      const panel = panelRef.current
      if (!direction || !panel || openPanels[openPanels.length - 1] !== id.current) return
      if (!(event.target instanceof Node) || panel.contains(event.target)) return
      const items = tabbables(panel)
      const next = direction === 'back' ? items[items.length - 1] : items[0]
      ;(next ?? panel).focus({ preventScroll: true })
    }

    document.addEventListener('keydown', onKeyDown, true)
    document.addEventListener('focusin', onFocusIn)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('keydown', onKeyDown, true)
      document.removeEventListener('focusin', onFocusIn)
    }
  }, [modal])

  function trapTab(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!modal || event.key !== 'Tab' || openPanels[openPanels.length - 1] !== id.current) return
    const panel = panelRef.current
    if (!panel) return
    const items = tabbables(panel)
    if (items.length === 0) {
      event.preventDefault()
      panel.focus({ preventScroll: true })
      return
    }
    const first = items[0]
    const last = items[items.length - 1]
    const active = document.activeElement
    const inside = active instanceof Node && panel.contains(active)
    if (event.shiftKey && (active === first || active === panel || !inside)) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && (active === last || !inside)) {
      event.preventDefault()
      first.focus()
    }
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Escape' || openPanels[openPanels.length - 1] !== id.current) return
      closeRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

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
        {variant === 'sheet' && <div className="dock-spacer" aria-hidden="true" />}
      </div>
    </div>
  )
}
