import { useEffect, useRef, useState } from 'react'
import { readSavedCustomerId } from '../lib/customerId'
import { applyDocumentTheme, useTheme } from '../lib/theme'
import { FireBackdrop } from './FireBackdrop'
import { ThemeBackdrop, ThemeDecor } from './ThemeMark'

const HOLD_MS = 2300
const LEAVE_MS = 560
// Offline devices may never answer; the menu still opens and shows the history error.
export const MAX_WAIT_MS = 15000

type SplashProps = {
  onDone: () => void
  ready?: boolean
}

export function Splash({ onDone, ready = true }: SplashProps) {
  const [held, setHeld] = useState(false)
  const [timedOut, setTimedOut] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const theme = useTheme()
  const savedCustomer = useRef(readSavedCustomerId() !== '')
  const reduce = useRef(window.matchMedia('(prefers-reduced-motion: reduce)').matches)

  useEffect(() => {
    applyDocumentTheme(theme)
  }, [theme])

  useEffect(() => {
    const hold = window.setTimeout(() => setHeld(true), reduce.current ? 350 : HOLD_MS)
    const cap = window.setTimeout(() => setTimedOut(true), MAX_WAIT_MS)
    return () => {
      window.clearTimeout(hold)
      window.clearTimeout(cap)
    }
  }, [])

  const canLeave = held && (ready || timedOut)

  useEffect(() => {
    if (!canLeave) return
    setLeaving(true)
    const finish = window.setTimeout(onDone, reduce.current ? 180 : LEAVE_MS)
    return () => window.clearTimeout(finish)
  }, [canLeave, onDone])

  const status = held && !ready && savedCustomer.current ? 'Carregando seus pedidos' : 'Preparando a chapa'

  return (
    <div className={leaving ? 'splash splash--out' : 'splash'} role="status" aria-live="polite">
      <ThemeBackdrop theme={theme} />
      <ThemeDecor theme={theme} />
      <FireBackdrop />
      <div className="splash__glow" aria-hidden="true" />
      <div className="splash__mark">
        <span className="tick tick--nw" aria-hidden="true" />
        <span className="tick tick--ne" aria-hidden="true" />
        <span className="tick tick--sw" aria-hidden="true" />
        <span className="tick tick--se" aria-hidden="true" />
        <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Smash Burguer" />
      </div>
      <p className="splash__status">{status}</p>
      <div className="splash__track" aria-hidden="true">
        <span />
      </div>
    </div>
  )
}
