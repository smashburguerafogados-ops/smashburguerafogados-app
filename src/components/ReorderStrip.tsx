import { formatPrice } from '../lib/money'
import type { Order } from '../lib/orders'
import { formatOrderWhen, planReorder, recentOrders, type ReorderEntry } from '../lib/reorder'
import type { Product } from '../data/catalog'

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

export function ReorderStrip({ orders, products, onReorder }: ReorderStripProps) {
  const plans = recentOrders(orders).map((order) => planReorder(order, products))
  if (plans.length === 0) return null

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
          const units = plan.available
          const label = `${units} ${units === 1 ? 'item' : 'itens'} do pedido`
          return (
            <li key={plan.orderId} className={none ? 'reorder__card is-off' : 'reorder__card'}>
              <span className="reorder__thumbs" aria-hidden="true">
                {plan.images.slice(0, 3).map((image) => (
                  <img key={image} src={image} alt="" />
                ))}
              </span>
              <div className="reorder__info">
                <p className="reorder__meta">
                  {partial || none
                    ? `${plan.available} de ${plan.wanted} itens disponíveis`
                    : `${plan.wanted} ${plan.wanted === 1 ? 'item' : 'itens'}${when ? ` · ${when}` : ''}`}
                </p>
                <strong className="reorder__total">{none ? 'Indisponível' : formatPrice(plan.totalCents)}</strong>
              </div>
              <button
                type="button"
                className="reorder__btn"
                disabled={none}
                aria-label={`Pedir de novo${when ? `, pedido de ${when}` : ''}`}
                onClick={() => onReorder(plan.entries, label)}
              >
                <RefreshIcon />
                <span>Pedir de novo</span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
