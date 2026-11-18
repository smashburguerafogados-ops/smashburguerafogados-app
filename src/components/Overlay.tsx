import { useEffect, type ReactNode } from 'react'

type OverlayProps = {
  label: string
  onClose: () => void
  variant?: 'sheet' | 'popup' | 'drawer'
  close?: 'text' | 'icon'
  children: ReactNode
}

function CloseMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 7l10 10M17 7L7 17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export function Overlay({ label, onClose, variant = 'sheet', close = 'text', children }: OverlayProps) {
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
        className={panel}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className={close === 'icon' ? 'mark-btn overlay__close' : 'text-btn overlay__close'}
          aria-label={close === 'icon' ? 'Fechar' : undefined}
          onClick={onClose}
        >
          {close === 'icon' ? <CloseMark /> : 'Fechar'}
        </button>
        {children}
      </div>
    </div>
  )
}
