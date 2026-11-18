import { useEffect, useRef, useState } from 'react'
import {
  activateRaffle,
  drawRaffle,
  eligibleCustomers,
  EMPTY_DRAW_MESSAGE,
  TITLE_REQUIRED,
  type Raffle,
} from '../lib/raffle'
import { watchAllOrders, type Order } from '../lib/orders'
import { CloseButton } from './Overlay'
import { useRaffle } from './RaffleProvider'

export function RaffleScreen({ onClose }: { onClose: () => void }) {
  const saved = useRaffle()
  const [title, setTitle] = useState(saved.title)
  const seeded = useRef(false)
  const [orders, setOrders] = useState<Order[]>([])
  const [locked, setLocked] = useState<Raffle | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (seeded.current || !saved.title) return
    seeded.current = true
    setTitle(saved.title)
  }, [saved.title])

  useEffect(
    () =>
      watchAllOrders(
        (next) => setOrders(next),
        () => setError('Não foi possível carregar os pedidos.'),
      ),
    [],
  )

  const view = locked && locked.day === saved.day ? { ...saved, ...locked } : saved
  const entrants = view.day ? eligibleCustomers(orders, view.day) : []

  async function activate() {
    setBusy(true)
    setError('')
    try {
      await activateRaffle(view, title)
      setNotice('Sorteio de hoje ativado.')
    } catch (caught) {
      setError(caught instanceof Error && caught.message === TITLE_REQUIRED ? TITLE_REQUIRED : 'Não foi possível ativar.')
    } finally {
      setBusy(false)
    }
  }

  async function draw() {
    setBusy(true)
    setError('')
    try {
      const outcome = await drawRaffle(view, orders)
      if (outcome.kind === 'empty') {
        setNotice(EMPTY_DRAW_MESSAGE)
        return
      }
      if (outcome.kind === 'drawn') {
        setLocked({ ...view, winnerId: outcome.winnerId, winnerName: outcome.winnerName, drawnAtMs: Date.now() })
      }
      setNotice(`Ganhador: ${outcome.winnerName}`)
    } catch {
      setError('Não foi possível sortear.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="product-screen" role="dialog" aria-modal="true" aria-label="Sorteio Smash Burger">
      <div className="product-screen__inner">
        <div className="product-screen__bar">
          <h2>Sorteio Smash Burger</h2>
          <CloseButton onClick={onClose} />
        </div>
        <label className="field">
          <span>O que será sorteado</span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <button type="button" className="btn" disabled={busy} onClick={() => void activate()}>
          Ativar sorteio de hoje
        </button>
        {view.active && (
          <p className="muted">
            Ativo hoje: {view.title}. {entrants.length === 1 ? '1 pessoa' : `${entrants.length} pessoas`} com pedido finalizado.
          </p>
        )}
        {view.winnerName && <p>Ganhador: {view.winnerName}</p>}
        <button type="button" className="btn" disabled={busy || !view.active} onClick={() => void draw()}>
          Sortear
        </button>
        {notice && <p role="status">{notice}</p>}
        {error && (
          <p className="alert" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
