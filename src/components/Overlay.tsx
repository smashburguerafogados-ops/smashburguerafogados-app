import { useEffect, type ReactNode } from 'react'

type OverlayProps = {
  label: string
  onClose: () => void
  variant?: 'sheet' | 'popup'
  children: ReactNode
}

export function Overlay({ label, onClose, variant = 'sheet', children }: OverlayProps) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const root = variant === 'popup' ? 'popup' : 'sheet'
  const panel = variant === 'popup' ? 'popup__panel' : 'sheet__panel'

  return (
    <div className={root} onClick={onClose}>
      <div
        className={panel}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="text-btn overlay__close" onClick={onClose}>
          Fechar
        </button>
        {children}
      </div>
    </div>
  )
}
