import { useEffect, useRef, useState } from 'react'
import {
  activateRaffle,
  clearRaffle,
  drawRaffle,
  EMPTY_DRAW_MESSAGE,
  NO_REMAINING_MESSAGE,
  raffleError,
  remainingCustomers,
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
  const [confirmClear, setConfirmClear] = useState(false)
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
  const remaining = view.day ? remainingCustomers(orders, view.day, view.winners) : []
  const hasRaffle = Boolean(view.active || view.title || view.winners.length > 0 || view.winnerId)

  async function activate() {
    setBusy(true)
    setError('')
    try {
      await activateRaffle(view, title)
      setNotice('Sorteio de hoje ativado.')
    } catch (caught) {
      setError(raffleError(caught, 'Não foi possível ativar.'))
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
        setNotice(view.winners.length > 0 ? NO_REMAINING_MESSAGE : EMPTY_DRAW_MESSAGE)
        return
      }
      setLocked({
        ...view,
        winnerId: outcome.winnerId,
        winnerName: outcome.winnerName,
        drawnAtMs: Date.now(),
        winners: outcome.winners,
      })
      setNotice(`Ganhador: ${outcome.winnerName}`)
    } catch (caught) {
      setError(raffleError(caught, 'Não foi possível sortear.'))
    } finally {
      setBusy(false)
    }
  }

  async function endRaffle() {
    setBusy(true)
    setError('')
    try {
      await clearRaffle()
      setLocked(null)
      setTitle('')
      seeded.current = false
      setConfirmClear(false)
      setNotice('Sorteio encerrado e zerado.')
    } catch (caught) {
      setError(raffleError(caught, 'Não foi possível encerrar.'))
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
            Ativo hoje: {view.title}.{' '}
            {remaining.length === 1 ? '1 pessoa restante' : `${remaining.length} pessoas restantes`} para sortear.
          </p>
        )}
        {view.winners.length > 0 && (
          <div className="raffle-winners">
            <p>Ganhadores de hoje:</p>
            <ol>
              {view.winners.map((person) => (
                <li key={person.id}>{person.name}</li>
              ))}
            </ol>
          </div>
        )}
        {view.winnerName && view.winners.length === 0 && <p>Ganhador: {view.winnerName}</p>}
        <button type="button" className="btn" disabled={busy || !view.active} onClick={() => void draw()}>
          Sortear
        </button>
        {hasRaffle && (
          <button
            type="button"
            className="btn btn--ghost"
            disabled={busy}
            onClick={() => {
              setConfirmClear(true)
              setError('')
            }}
          >
            Encerrar
          </button>
        )}
        {confirmClear && (
          <div className="reason-box" role="group" aria-label="Confirmar encerramento">
            <p>Deseja limpar e zerar o sorteio?</p>
            <div className="actions">
              <button type="button" className="btn" disabled={busy} onClick={() => void endRaffle()}>
                Confirmar
              </button>
              <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => setConfirmClear(false)}>
                Cancelar
              </button>
            </div>
          </div>
        )}
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
