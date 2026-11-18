import { useEffect, useState } from 'react'
import { FireBackdrop } from './FireBackdrop'

const HOLD_MS = 2300
const LEAVE_MS = 560

type SplashProps = {
  onDone: () => void
}

export function Splash({ onDone }: SplashProps) {
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const hold = reduce ? 350 : HOLD_MS
    const leave = reduce ? 180 : LEAVE_MS
    const startExit = window.setTimeout(() => setLeaving(true), hold)
    const finish = window.setTimeout(onDone, hold + leave)
    return () => {
      window.clearTimeout(startExit)
      window.clearTimeout(finish)
    }
  }, [onDone])

  return (
    <div className={leaving ? 'splash splash--out' : 'splash'} role="status" aria-live="polite">
      <FireBackdrop />
      <div className="splash__glow" aria-hidden="true" />
      <div className="splash__mark">
        <span className="tick tick--nw" aria-hidden="true" />
        <span className="tick tick--ne" aria-hidden="true" />
        <span className="tick tick--sw" aria-hidden="true" />
        <span className="tick tick--se" aria-hidden="true" />
        <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Smash Burguer" />
      </div>
      <p className="splash__status">Preparando a chapa</p>
      <div className="splash__track" aria-hidden="true">
        <span />
      </div>
    </div>
  )
}
