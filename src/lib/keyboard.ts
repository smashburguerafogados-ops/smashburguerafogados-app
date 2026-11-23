import { useEffect, useState } from 'react'

const TEXT_INPUTS = new Set(['text', 'search', 'tel', 'email', 'url', 'number', 'password', ''])
const KEYBOARD_MIN_SHRINK = 120
const SETTLE_MS = [60, 320, 700]

/** A field that opens the on-screen keyboard. */
export function isTextField(element: Element | null): element is HTMLElement {
  if (element instanceof HTMLTextAreaElement) return !element.readOnly && !element.disabled
  if (element instanceof HTMLInputElement) return TEXT_INPUTS.has(element.type) && !element.readOnly && !element.disabled
  return element instanceof HTMLElement && element.isContentEditable
}

function touchScreen(): boolean {
  try {
    return window.matchMedia('(pointer: coarse)').matches
  } catch {
    return false
  }
}

function viewportShrink(): number {
  const viewport = window.visualViewport
  return viewport ? Math.max(0, window.innerHeight - viewport.height) : 0
}

/**
 * True while a text field has focus on a phone or tablet (or while the visual
 * viewport is clearly shorter than the page). Browsers that shrink the page for
 * the keyboard would otherwise leave a fixed bar sitting on top of the field.
 * The focused field is also scrolled to the middle of what is left.
 */
export function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let timers: ReturnType<typeof setTimeout>[] = []

    function field(): HTMLElement | null {
      const active = document.activeElement
      return isTextField(active) ? active : null
    }

    function reveal() {
      const target = field()
      if (!target || typeof target.scrollIntoView !== 'function') return
      target.scrollIntoView({ block: 'center', inline: 'nearest' })
    }

    function sync() {
      const target = field()
      setOpen(Boolean(target) && (touchScreen() || viewportShrink() > KEYBOARD_MIN_SHRINK))
    }

    function settle() {
      timers.forEach(clearTimeout)
      timers = SETTLE_MS.map((delay) =>
        setTimeout(() => {
          sync()
          reveal()
        }, delay),
      )
    }

    function onFocusIn() {
      sync()
      settle()
    }

    function onFocusOut() {
      setTimeout(sync, 0)
    }

    function onViewport() {
      if (!field()) {
        setOpen(false)
        return
      }
      sync()
      reveal()
    }

    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', onFocusOut)
    window.visualViewport?.addEventListener('resize', onViewport)
    window.addEventListener('resize', onViewport)
    return () => {
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('focusout', onFocusOut)
      window.visualViewport?.removeEventListener('resize', onViewport)
      window.removeEventListener('resize', onViewport)
      timers.forEach(clearTimeout)
    }
  }, [])

  return open
}
