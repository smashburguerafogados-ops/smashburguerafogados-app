import { useState } from 'react'
import { formatWhatsapp } from '../lib/identity'
import { formatPrice } from '../lib/money'
import {
  FULFILLMENT_LABEL,
  STATUS_LABEL,
  finalizeOrder,
  setOrderStatus,
  shortId,
  type Order,
  type OrderStatus,
} from '../lib/orders'
import {
  acceptedMessage,
  cancelledMessage,
  customerNumber,
  formatAddress,
  openWhatsapp,
  paymentLine,
  refusedMessage,
  sentMessage,
} from '../lib/whatsapp'
import { Overlay } from './Overlay'

type OrderDialogProps = {
  order: Order
  onClose: () => void
}

type Mode = 'view' | 'refuse' | 'cancel'

function formatWhen(ms: number): string {
  if (!ms) return ''
  return new Date(ms).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

export function OrderDialog({ order, onClose }: OrderDialogProps) {
  const [mode, setMode] = useState<Mode>('view')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // WhatsApp opens first, inside the click, so mobile browsers do not block it.
  async function act(status: OrderStatus, message: string, withReason?: string) {
    setBusy(true)
    setError('')
    openWhatsapp(customerNumber(order), message)
    try {
      await setOrderStatus(order.id, status, withReason)
      onClose()
    } catch {
      setError('WhatsApp aberto, mas o pedido não foi atualizado. Tente de novo.')
    } finally {
      setBusy(false)
    }
  }

  async function finish() {
    setBusy(true)
    setError('')
    try {
      await finalizeOrder(order)
      onClose()
    } catch {
      setError('Não foi possível concluir o pedido.')
    } finally {
      setBusy(false)
    }
  }

  const cleanReason = reason.trim()

  return (
    <Overlay label={`Pedido #${shortId(order.id)}`} onClose={onClose} variant="popup">
      <p className="eyebrow">{STATUS_LABEL[order.status]}</p>
      <h2>Pedido #{shortId(order.id)}</h2>
      <dl className="details order-details">
        <div>
          <dt>Cliente</dt>
          <dd>{order.customerName || 'Sem nome'}</dd>
        </div>
        <div>
          <dt>WhatsApp</dt>
          <dd>{formatWhatsapp(order.customerWhatsapp)}</dd>
        </div>
        <div>
          <dt>Tipo</dt>
          <dd>{FULFILLMENT_LABEL[order.fulfillment]}</dd>
        </div>
        <div>
          <dt>{order.fulfillment === 'retirada' ? 'Retirada' : 'Endereço'}</dt>
          <dd>{formatAddress(order)}</dd>
        </div>
        {order.address?.cep && (
          <div>
            <dt>CEP</dt>
            <dd>{order.address.cep}</dd>
          </div>
        )}
        <div>
          <dt>Feito em</dt>
          <dd>{formatWhen(order.createdAtMs)}</dd>
        </div>
        <div>
          <dt>Itens</dt>
          <dd>
            <ul className="order-items">
              {order.items.map((item, index) => (
                <li key={`${item.productId}-${index}`}>
                  <span>
                    {item.qty}× {item.name}
                    {item.note && <em> · Obs.: {item.note}</em>}
                  </span>
                  <span>{formatPrice(item.priceCents * item.qty)}</span>
                </li>
              ))}
            </ul>
          </dd>
        </div>
        <div>
          <dt>Total</dt>
          <dd className="order-total">{formatPrice(order.totalCents)}</dd>
        </div>
        <div>
          <dt>Pagamento</dt>
          <dd>{paymentLine(order)}</dd>
        </div>
        {order.reason && (
          <div>
            <dt>Motivo</dt>
            <dd>{order.reason}</dd>
          </div>
        )}
      </dl>

      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}

      {mode !== 'view' ? (
        <div className="reason-box">
          <label className="field">
            <span>{mode === 'refuse' ? 'Motivo da recusa' : 'Motivo do cancelamento'}</span>
            <textarea rows={3} maxLength={240} value={reason} onChange={(event) => setReason(event.target.value)} />
          </label>
          <div className="actions">
            <button
              type="button"
              className="btn"
              disabled={!cleanReason || busy}
              onClick={() =>
                void (mode === 'refuse'
                  ? act('recusado', refusedMessage(order, cleanReason), cleanReason)
                  : act('cancelado', cancelledMessage(order, cleanReason), cleanReason))
              }
            >
              {mode === 'refuse' ? 'Enviar recusa' : 'Enviar cancelamento'}
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => setMode('view')}>
              Voltar
            </button>
          </div>
        </div>
      ) : (
        <div className="actions">
          {order.status === 'novo' && (
            <>
              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={() => void act('andamento', acceptedMessage(order))}
              >
                Aceitar
              </button>
              <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => setMode('refuse')}>
                Recusar
              </button>
            </>
          )}
          {order.status === 'andamento' && (
            <>
              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={() => void act('enviado', sentMessage(order))}
              >
                {order.fulfillment === 'retirada' ? 'Pronto para retirada' : 'Enviar pedido'}
              </button>
              <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => setMode('cancel')}>
                Cancelar
              </button>
            </>
          )}
          {order.status === 'enviado' && (
            <>
              <p className="muted">
                {order.fulfillment === 'retirada'
                  ? 'Pronto para retirada. O cliente confirma o recebimento em Meus pedidos.'
                  : 'Saiu para entrega. O cliente confirma o recebimento em Meus pedidos.'}
              </p>
              <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => void finish()}>
                Concluir
              </button>
            </>
          )}
        </div>
      )}
    </Overlay>
  )
}
