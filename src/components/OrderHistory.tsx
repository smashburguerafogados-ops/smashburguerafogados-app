import { useState } from 'react'
import { useOrders } from '../context/OrdersContext'
import { PAYMENT_LABELS } from '../lib/checkout'
import { formatPrice } from '../lib/money'
import { STATUS_LABEL, finalizeOrder, isAccepted, shortId, type Order } from '../lib/orders'

function formatWhen(ms: number): string {
  if (!ms) return ''
  return new Date(ms).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

function HistoryCard({ order }: { order: Order }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const classes = ['history__card', `history__card--${order.status}`]
  if (isAccepted(order.status)) classes.push('is-accepted')

  async function finish() {
    setBusy(true)
    setError('')
    try {
      await finalizeOrder(order)
    } catch {
      setError('Não foi possível finalizar. Tente de novo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className={classes.join(' ')} data-status={order.status} aria-label={`Pedido #${shortId(order.id)}`}>
      <div className="history__head">
        <strong>#{shortId(order.id)}</strong>
        <span className="history__status">{STATUS_LABEL[order.status]}</span>
      </div>
      <p className="history__when">{formatWhen(order.createdAtMs)}</p>
      <ul className="history__items">
        {order.items.map((item, index) => (
          <li key={`${item.productId}-${index}`}>
            {item.qty}× {item.name}
            {item.note && <em> · {item.note}</em>}
          </li>
        ))}
      </ul>
      <p className="history__total">
        {PAYMENT_LABELS[order.payment.method]} · <strong>{formatPrice(order.totalCents)}</strong>
      </p>
      {order.reason && (order.status === 'recusado' || order.status === 'cancelado') && (
        <p className="history__reason">Motivo: {order.reason}</p>
      )}
      {order.status === 'enviado' && (
        <button type="button" className="btn" disabled={busy} onClick={() => void finish()}>
          {busy ? 'Aguarde...' : 'Pedido recebido'}
        </button>
      )}
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
    </li>
  )
}

export function OrderHistory() {
  const history = useOrders()

  if (history.status === 'idle') {
    return <p className="muted">Entre na sua conta para ver seus pedidos.</p>
  }
  if (history.status === 'loading') return <p className="muted">Carregando seus pedidos.</p>
  if (history.status === 'error') {
    return (
      <p className="alert" role="alert">
        Não foi possível carregar seus pedidos.
      </p>
    )
  }
  if (history.orders.length === 0) return <p className="muted">Você ainda não fez pedidos.</p>

  return (
    <ul className="history" aria-label="Meus pedidos">
      {history.orders.map((order) => (
        <HistoryCard key={order.id} order={order} />
      ))}
    </ul>
  )
}
