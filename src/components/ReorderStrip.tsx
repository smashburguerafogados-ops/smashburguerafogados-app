import { useState } from 'react'
import { formatPrice } from '../lib/money'
import type { Order } from '../lib/orders'
import { formatOrderWhen, planReorder, recentOrders, type ReorderEntry, type ReorderLine, type ReorderPlan } from '../lib/reorder'
import type { Product } from '../data/catalog'
import { Overlay } from './Overlay'

type ReorderStripProps = {
  orders: Order[]
  products: Product[]
  onReorder: (entries: ReorderEntry[], label: string) => void
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M19 8.5A7.5 7.5 0 0 0 5.8 7M5 3.8V7.2h3.4M5 15.5A7.5 7.5 0 0 0 18.2 17M19 20.2V16.8h-3.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 5.5 15.5 12 9 18.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function unitsLabel(units: number): string {
  return `${units} ${units === 1 ? 'item' : 'itens'}`
}

function LineRow({ line }: { line: ReorderLine }) {
  const off = line.status !== 'ok'
  return (
    <li className={off ? 'reorder-line is-off' : 'reorder-line'}>
      {line.image ? <img className="reorder-line__img" src={line.image} alt="" /> : <span className="reorder-line__img" aria-hidden="true" />}
      <div className="reorder-line__info">
        <strong className="reorder-line__name">{line.name}</strong>
        <span className="reorder-line__qty">
          {line.unitCents === null ? `${line.qty}×` : `${line.qty} × ${formatPrice(line.unitCents)}`}
        </span>
        {line.extras.length > 0 && <p className="reorder-line__extras">+ {line.extras.join(', ')}</p>}
        {line.goneExtras.length > 0 && (
          <p className="reorder-line__warn">Adicional indisponível: {line.goneExtras.join(', ')}</p>
        )}
        {line.note && <p className="reorder-line__note">{line.note}</p>}
        {off && (
          <p className="reorder-line__warn">{line.status === 'esgotado' ? 'Esgotado hoje' : 'Não está mais no cardápio'}</p>
        )}
      </div>
      {line.unitCents !== null && <span className="reorder-line__total">{formatPrice(line.unitCents * line.qty)}</span>}
    </li>
  )
}

function ReorderSheet({ plan, onClose, onAdd }: { plan: ReorderPlan; onClose: () => void; onAdd: () => void }) {
  const none = plan.available === 0
  const when = formatOrderWhen(plan.createdAtMs)
  const title = when ? `Compra de ${when}` : 'Sua compra'
  return (
    <Overlay label={title} onClose={onClose} modal>
      <div className="reorder-sheet">
        <h2>{title}</h2>
        <p className="reorder-sheet__count">
          {plan.available < plan.wanted
            ? `${plan.available} de ${plan.wanted} itens disponíveis`
            : unitsLabel(plan.wanted)}
        </p>
        <ul className="reorder-sheet__list">
          {plan.lines.map((line) => (
            <LineRow key={line.key} line={line} />
          ))}
        </ul>
        <div className="reorder-sheet__foot">
          <p className="reorder-sheet__total">
            Total <strong>{none ? '—' : formatPrice(plan.totalCents)}</strong>
          </p>
          <button type="button" className="btn" disabled={none} onClick={onAdd}>
            Adicionar ao carrinho
          </button>
        </div>
      </div>
    </Overlay>
  )
}

export function ReorderStrip({ orders, products, onReorder }: ReorderStripProps) {
  const [openId, setOpenId] = useState<string | null>(null)
  const plans = recentOrders(orders).map((order) => planReorder(order, products))
  if (plans.length === 0) return null
  const openPlan = plans.find((plan) => plan.orderId === openId)

  return (
    <section className="reorder" aria-label="Pedir de novo">
      <p className="reorder__label">
        <RefreshIcon />
        <span>
          Peça de <b>novo</b>
        </span>
      </p>
      <ul className="reorder__scroll">
        {plans.map((plan) => {
          const none = plan.available === 0
          const partial = !none && plan.available < plan.wanted
          const when = formatOrderWhen(plan.createdAtMs)
          return (
            <li key={plan.orderId} className={none ? 'reorder__card is-off' : 'reorder__card'}>
              <button
                type="button"
                className="reorder__open"
                aria-haspopup="dialog"
                aria-label={`Ver itens do pedido${when ? ` de ${when}` : ''}`}
                onClick={() => setOpenId(plan.orderId)}
              >
                <span className="reorder__thumbs" aria-hidden="true">
                  {plan.images.slice(0, 3).map((image) => (
                    <img key={image} src={image} alt="" />
                  ))}
                </span>
                <span className="reorder__info">
                  <span className="reorder__meta">
                    {partial || none
                      ? `${plan.available} de ${plan.wanted} itens disponíveis`
                      : `${unitsLabel(plan.wanted)}${when ? ` · ${when}` : ''}`}
                  </span>
                  <strong className="reorder__total">{none ? 'Indisponível' : formatPrice(plan.totalCents)}</strong>
                </span>
                <span className="reorder__chevron" aria-hidden="true">
                  <ChevronIcon />
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      {openPlan && (
        <ReorderSheet
          plan={openPlan}
          onClose={() => setOpenId(null)}
          onAdd={() => {
            onReorder(openPlan.entries, `${openPlan.available} ${openPlan.available === 1 ? 'item' : 'itens'} do pedido`)
            setOpenId(null)
          }}
        />
      )}
    </section>
  )
}
