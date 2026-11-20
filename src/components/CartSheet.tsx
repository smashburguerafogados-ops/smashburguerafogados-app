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
import { formatPrice, maskWholeReais } from '../lib/money'
import { cartCount, cartTotal, type CartLine } from '../lib/menu'
import { contactReady, deliveryReady } from '../lib/delivery'
import { buildOrder, deliveryCharge, placeOrder, shortId, type Fulfillment, FULFILLMENT_LABEL } from '../lib/orders'
import { useShop } from '../lib/shop'
import { DeliveryForm } from './DeliveryForm'
import { PickupForm } from './PickupForm'
import { Overlay } from './Overlay'
import { useRaffle } from './RaffleProvider'
import { localDay } from '../lib/raffle'
import type { UserProfile } from '../types'

const EMPTY_CUSTOMER: UserProfile = {
  uid: '',
  nome: '',
  whatsapp: '',
  address: null,
  role: 'customer',
}

const FULFILLMENTS: Fulfillment[] = ['entrega', 'retirada']

function MinusMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 12h10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

type CartSheetProps = {
  lines: CartLine[]
  onClose: () => void
  onRemove: (key: string) => void
  onPlaced: () => void
}

export function CartSheet({ lines, onClose, onRemove, onPlaced }: CartSheetProps) {
  const { session } = useAuth()
  const shop = useShop()
  const raffle = useRaffle()
  const raffleToday = raffle.active && raffle.day === localDay(Date.now())
  const [checkout, setCheckout] = useState<CheckoutState>(emptyCheckout)
  const [fulfillment, setFulfillment] = useState<Fulfillment>('entrega')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [placedId, setPlacedId] = useState('')
  const [needsDelivery, setNeedsDelivery] = useState(false)
  const [needsPickup, setNeedsPickup] = useState(false)
  const [editingAddress, setEditingAddress] = useState(false)

  const itemsTotal = cartTotal(lines)
  const fee = deliveryCharge(fulfillment, shop.deliveryFeeCents)
  const total = itemsTotal + fee
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
      const id = await placeOrder(
        buildOrder(profile, lines, checkout, itemsTotal, fulfillment, shop.deliveryFeeCents),
      )
      setPlacedId(id)
      setCheckout(emptyCheckout)
      onPlaced()
    } catch {
      setError('Não foi possível enviar o pedido. Tente de novo.')
      throw new Error('Não foi possível enviar o pedido. Tente de novo.')
    } finally {
      setBusy(false)
    }
  }

  async function submit() {
    if (!ready || busy) return
    if (session.status === 'ready' && session.profile.role === 'customer') {
      try {
        if (fulfillment === 'retirada' && contactReady(session.profile)) {
          await send(session.profile)
          return
        }
        if (fulfillment === 'entrega' && deliveryReady(session.profile)) {
          await send(session.profile)
          return
        }
      } catch {
        return
      }
    }
    if (fulfillment === 'retirada') {
      setNeedsPickup(true)
      return
    }
    setNeedsDelivery(true)
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
      {raffleToday && (
        <p className="raffle-note">Comprando hoje você entra no sorteio: {raffle.title}. Vale o pedido finalizado.</p>
      )}
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
                <button type="button" className="mark-btn" aria-label="Remover" onClick={() => onRemove(line.key)}>
                  <MinusMark />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {lines.length === 0 && (
        <p className="cart__total">
          Total <strong data-testid="cart-total">{formatPrice(0)}</strong>
        </p>
      )}

      {lines.length > 0 && (
        <>
          <fieldset className="pay">
            <legend>Como prefere receber</legend>
            <div className="pay__options">
              {FULFILLMENTS.map((mode) => (
                <label key={mode} className={fulfillment === mode ? 'pay__option is-active' : 'pay__option'}>
                  <input
                    type="radio"
                    name="fulfillment"
                    value={mode}
                    checked={fulfillment === mode}
                    onChange={() => setFulfillment(mode)}
                  />
                  <span>{FULFILLMENT_LABEL[mode]}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {fulfillment === 'entrega' &&
            session.status === 'ready' &&
            session.profile.role === 'customer' &&
            session.profile.address?.street && (
              <div className="cart__address">
                <p>
                  {session.profile.address.street}, {session.profile.address.number}
                  {session.profile.address.neighborhood ? ` — ${session.profile.address.neighborhood}` : ''}
                </p>
                <button type="button" className="text-btn" onClick={() => setEditingAddress(true)}>
                  Alterar endereço
                </button>
              </div>
            )}

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
            <p className="pay__notice">
              {fulfillment === 'retirada'
                ? 'Os pagamentos são feitos na retirada.'
                : 'Os pagamentos são feitos ao entregador.'}
            </p>
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
                  <div className="field">
                    <span id="cash-amount">Valor em dinheiro (R$)</span>
                    <div className="money-join">
                      <span className="money-join__prefix" aria-hidden="true">
                        R$
                      </span>
                      <input
                        aria-labelledby="cash-amount"
                        inputMode="numeric"
                        autoComplete="off"
                        placeholder="Ex.: 50"
                        value={maskWholeReais(checkout.cash)}
                        onChange={(event) =>
                          setCheckout((current) => ({ ...current, cash: cashDigits(event.target.value) }))
                        }
                      />
                    </div>
                  </div>
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
          <div className="cart__summary" role="group" aria-label="Resumo do pedido">
            <p>
              Subtotal <strong>{formatPrice(itemsTotal)}</strong>
            </p>
            {fulfillment === 'entrega' && (
              <p>
                Taxa de entrega <strong>{formatPrice(fee)}</strong>
              </p>
            )}
            <p className="cart__total">
              Total <strong data-testid="cart-total">{formatPrice(total)}</strong>
            </p>
          </div>
          <button type="button" className="btn" disabled={!ready || busy} onClick={() => void submit()}>
            {busy ? 'Enviando...' : 'Fazer Pedido'}
          </button>
        </>
      )}
      {editingAddress && session.status === 'ready' && session.profile.role === 'customer' && (
        <DeliveryForm
          profile={session.profile}
          onClose={() => setEditingAddress(false)}
          onSaved={() => setEditingAddress(false)}
        />
      )}
      {needsDelivery && (
        <DeliveryForm
          profile={
            session.status === 'ready' && session.profile.role === 'customer' ? session.profile : EMPTY_CUSTOMER
          }
          ordering
          onClose={() => setNeedsDelivery(false)}
          onSaved={(profile) => send(profile)}
        />
      )}
      {needsPickup && (
        <PickupForm
          profile={
            session.status === 'ready' && session.profile.role === 'customer' ? session.profile : EMPTY_CUSTOMER
          }
          ordering
          onClose={() => setNeedsPickup(false)}
          onSaved={(profile) => send(profile)}
        />
      )}
    </Overlay>
  )
}
