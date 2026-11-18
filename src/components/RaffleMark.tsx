import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useOrders } from '../context/OrdersContext'
import { dismissRaffle, showHourglass, WAITING_MESSAGE, watchDismissal } from '../lib/raffle'
import { Overlay } from './Overlay'
import { useRaffle } from './RaffleProvider'

function Hourglass() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M6 3h12M6 21h12M7 3c0 4.5 5 5.5 5 9s-5 4.5-5 9M17 3c0 4.5-5 5.5-5 9s5 4.5 5 9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function RaffleMark() {
  const raffle = useRaffle()
  const { session } = useAuth()
  const history = useOrders()
  const customerId = session.status === 'ready' && session.profile.role === 'customer' ? session.profile.uid : ''
  const [dismissed, setDismissed] = useState(false)
  const [open, setOpen] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!customerId || !raffle.day) return
    return watchDismissal(
      customerId,
      raffle.day,
      (next) => setDismissed(next),
      () => setDismissed(false),
    )
  }, [customerId, raffle.day])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  const visible = showHourglass({
    raffle,
    orders: history.orders,
    customerId,
    dismissed,
    now,
  })

  if (!visible) return null

  async function close() {
    setOpen(false)
    if (!raffle.winnerId || !customerId) return
    setDismissed(true)
    try {
      await dismissRaffle(customerId, raffle.day)
    } catch {
      setDismissed(false)
    }
  }

  return (
    <>
      <button type="button" className="raffle-hourglass" aria-label="Ampulheta do sorteio" onClick={() => setOpen(true)}>
        <Hourglass />
      </button>
      {open && (
        <Overlay label="Sorteio" onClose={() => void close()}>
          <h2>{raffle.title || 'Sorteio'}</h2>
          <p>{raffle.winnerId ? `Ganhador: ${raffle.winnerName}` : WAITING_MESSAGE}</p>
        </Overlay>
      )}
    </>
  )
}
