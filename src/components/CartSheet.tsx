import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  PAYMENT_LABELS,
  PAYMENT_METHODS,
  canPlaceOrder,
  cashDigits,
  cashToCents,
  changeCents,
  checkoutProblem,
  emptyCheckout,
  type CheckoutState,
  type PaymentMethod,
} from '../lib/checkout'
import { formatPrice } from '../lib/money'
import { cartCount, cartTotal, type CartLine } from '../lib/menu'
import { deliveryReady } from '../lib/delivery'
import { buildOrder, placeOrder, shortId } from '../lib/orders'
import { DeliveryForm } from './DeliveryForm'
import { Overlay } from './Overlay'
import type { UserProfile } from '../types'

type CartSheetProps = {
  lines: CartLine[]
  onClose: () => void
  onRemove: (key: string) => void
  onPlaced: () => void
  onNeedAccount: () => void
}

export function CartSheet({ lines, onClose, onRemove, onPlaced, onNeedAccount }: CartSheetProps) {
  const { session } = useAuth()
  const [checkout, setCheckout] = useState<CheckoutState>(emptyCheckout)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [placedId, setPlacedId] = useState('')
  const [needsDelivery, setNeedsDelivery] = useState(false)

  const total = cartTotal(lines)
  const count = cartCount(lines)
  const problem = checkoutProblem(checkout, total, count)
  const ready = canPlaceOrder(checkout, total, count)
  const cash = checkout.method === 'dinheiro' && checkout.needsChange === 'sim' ? cashToCents(checkout.cash) : null
  const change = changeCents(cash, total)

  function chooseMethod(method: PaymentMethod) {
    setCheckout((current) => ({
      method,
      needsChange: method === 'dinheiro' ? current.needsChange : null,
      cash: method === 'dinheiro' ? current.cash : '',
    }))
  }

  async function send(profile: UserProfile) {
    setBusy(true)
    setError('')
    try {
      const id = await placeOrder(buildOrder(profile, lines, checkout, total))
      setPlacedId(id)
      setCheckout(emptyCheckout)
      onPlaced()
    } catch {
      setError('Não foi possível enviar o pedido. Tente de novo.')
    } finally {
      setBusy(false)
    }
  }

  async function submit() {
    if (!ready || busy) return
    if (session.status !== 'ready' || session.profile.role !== 'customer') {
      onNeedAccount()
      return
    }
    if (!deliveryReady(session.profile)) {
      setNeedsDelivery(true)
      return
    }
    await send(session.profile)
  }

  if (placedId) {
    return (
      <Overlay label="Carrinho" onClose={onClose}>
        <h2>Pedido enviado</h2>
        <p>
          Pedido <strong>#{shortId(placedId)}</strong> recebido. Acompanhe em Meus pedidos.
        </p>
        <button type="button" className="btn" onClick={onClose}>
          Voltar ao cardápio
        </button>
      </Overlay>
    )
  }

  return (
    <Overlay label="Carrinho" onClose={onClose}>
      <h2>Carrinho</h2>
      {lines.length === 0 ? (
        <p className="muted">Seu carrinho está vazio.</p>
      ) : (
        <ul className="cart">
          {lines.map((line) => (
            <li key={line.key}>
              <div className="cart__info">
                <strong className="cart__name">{line.name}</strong>
                <span>
                  {line.qty} × {formatPrice(line.priceCents)}
                </span>
                {line.note && <p>{line.note}</p>}
              </div>
              <div className="cart__side">
                <span className="cart__line-total">{formatPrice(line.priceCents * line.qty)}</span>
                <button type="button" className="text-btn" onClick={() => onRemove(line.key)}>
                  Remover
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="cart__total">
        Total <strong data-testid="cart-total">{formatPrice(total)}</strong>
      </p>

      {lines.length > 0 && (
        <>
          <fieldset className="pay">
            <legend>Forma de pagamento</legend>
            <div className="pay__options">
              {PAYMENT_METHODS.map((method) => (
                <label key={method} className={checkout.method === method ? 'pay__option is-active' : 'pay__option'}>
                  <input
                    type="radio"
                    name="payment"
                    value={method}
                    checked={checkout.method === method}
                    onChange={() => chooseMethod(method)}
                  />
                  <span>{PAYMENT_LABELS[method]}</span>
                </label>
              ))}
            </div>
            <p className="pay__notice">Os pagamentos são feitos ao entregador.</p>
          </fieldset>

          {checkout.method === 'dinheiro' && (
            <fieldset className="pay">
              <legend>Precisa de troco?</legend>
              <div className="pay__options">
                {(['sim', 'nao'] as const).map((choice) => (
                  <label
                    key={choice}
                    className={checkout.needsChange === choice ? 'pay__option is-active' : 'pay__option'}
                  >
                    <input
                      type="radio"
                      name="troco"
                      value={choice}
                      checked={checkout.needsChange === choice}
                      onChange={() =>
                        setCheckout((current) => ({
                          ...current,
                          needsChange: choice,
                          cash: choice === 'sim' ? current.cash : '',
                        }))
                      }
                    />
                    <span>{choice === 'sim' ? 'Sim' : 'Não'}</span>
                  </label>
                ))}
              </div>
              {checkout.needsChange === 'sim' && (
                <>
                  <label className="field">
                    <span>Valor em dinheiro (R$)</span>
                    <input
                      inputMode="numeric"
                      pattern="[0-9]*"
                      autoComplete="off"
                      placeholder="Ex.: 50"
                      value={checkout.cash}
                      onChange={(event) =>
                        setCheckout((current) => ({ ...current, cash: cashDigits(event.target.value) }))
                      }
                    />
                  </label>
                  {change !== null && (
                    <p className={change > 0 ? 'pay__change' : 'pay__change is-short'} aria-live="polite">
                      {change > 0
                        ? `Seu troco: ${formatPrice(change)}`
                        : `Informe um valor maior que ${formatPrice(total)}.`}
                    </p>
                  )}
                </>
              )}
            </fieldset>
          )}

          {error && (
            <p className="alert" role="alert">
              {error}
            </p>
          )}
          {problem && change === null && <p className="muted pay__hint">{problem}</p>}
          <button type="button" className="btn" disabled={!ready || busy} onClick={() => void submit()}>
            {busy ? 'Enviando...' : 'Fazer Pedido'}
          </button>
        </>
      )}
      {needsDelivery && session.status === 'ready' && (
        <DeliveryForm
          profile={session.profile}
          onClose={() => setNeedsDelivery(false)}
          onSaved={(profile) => void send(profile)}
        />
      )}
    </Overlay>
  )
}
