import { useEffect, useRef } from 'react'

export const LONG_PRESS_MS = 650

export function useLongPress(action: () => void, ms = LONG_PRESS_MS) {
  const timer = useRef<number | null>(null)
  const actionRef = useRef(action)
  actionRef.current = action

  function clear() {
    if (timer.current != null) {
      window.clearTimeout(timer.current)
      timer.current = null
    }
  }

  useEffect(() => clear, [])

  return {
    onPointerDown() {
      clear()
      timer.current = window.setTimeout(() => actionRef.current(), ms)
    },
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
    onContextMenu(event: { preventDefault: () => void }) {
      event.preventDefault()
    },
  }
}
