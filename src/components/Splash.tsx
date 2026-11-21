import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { readSavedCustomerId } from '../lib/customerId'
import { useShop } from '../lib/shop'
import { applyDocumentTheme, useTheme } from '../lib/theme'
import { FireBackdrop } from './FireBackdrop'
import { ShopStatus } from './ShopStatus'
import { ThemeBackdrop, ThemeDecor } from './ThemeMark'

const HOLD_MS = 2300
const LEAVE_MS = 560
// Offline devices may never answer; the menu still opens and shows the history error.
export const MAX_WAIT_MS = 15000

type SplashProps = {
  onDone: () => void
  ready?: boolean
  /** A blocked customer stays here: no way into the menu, and the wait never ends. */
  locked?: boolean
}

export function Splash({ onDone, ready = true, locked = false }: SplashProps) {
  const [held, setHeld] = useState(false)
  const [timedOut, setTimedOut] = useState(false)
  const [entered, setEntered] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const theme = useTheme()
  const shop = useShop()
  const { session } = useAuth()
  const savedCustomer = useRef(readSavedCustomerId() !== '')
  const reduce = useRef(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const userReady = session.status !== 'loading' && !locked

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

  const canLeave = !locked && (entered || (held && (ready || timedOut)))

  useEffect(() => {
    if (!canLeave) return
    setLeaving(true)
    const finish = window.setTimeout(onDone, reduce.current ? 180 : LEAVE_MS)
    return () => window.clearTimeout(finish)
  }, [canLeave, onDone])

  const status = !locked && held && !ready && savedCustomer.current ? 'Carregando seus pedidos' : 'Preparando a chapa'

  return (
    <div className={leaving && !locked ? 'splash splash--out' : 'splash'} role="status" aria-live="polite">
      <ThemeBackdrop theme={theme} />
      <ThemeDecor theme={theme} />
      <FireBackdrop />
      <div className="splash__glow" aria-hidden="true" />
      <div className="splash__mark">
        <span className="tick tick--nw" aria-hidden="true" />
        <span className="tick tick--ne" aria-hidden="true" />
        <span className="tick tick--sw" aria-hidden="true" />
        <span className="tick tick--se" aria-hidden="true" />
        <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Smash Burger" />
      </div>
      <div className="splash__foot">
        {shop.ready && <ShopStatus online={shop.online} hours={shop.hours} />}
        {userReady && (
          <button type="button" className="btn splash__enter" disabled={leaving} onClick={() => setEntered(true)}>
            Entrar no cardápio
            <span aria-hidden="true">→</span>
          </button>
        )}
        <p className="splash__status">{status}</p>
        <div className="splash__track" aria-hidden="true">
          <span />
        </div>
      </div>
    </div>
  )
}
