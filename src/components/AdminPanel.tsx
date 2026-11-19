import { useEffect, useRef, useState } from 'react'
import { formatWhatsapp } from '../lib/identity'
import { formatPrice } from '../lib/money'
import {
  COLUMN_LABEL,
  STATUS_LABEL,
  columnOf,
  orderMatches,
  shortId,
  watchAllOrders,
  type Order,
  type OrderColumn,
} from '../lib/orders'
import { OrderDialog } from './OrderDialog'

const COLUMNS: OrderColumn[] = ['novos', 'andamento', 'finalizados']

function formatTime(ms: number): string {
  if (!ms) return ''
  return new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export function AdminPanel() {
  const [orders, setOrders] = useState<Order[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [column, setColumn] = useState<OrderColumn>('novos')
  const [blink, setBlink] = useState(false)
  const [openId, setOpenId] = useState('')
  const [query, setQuery] = useState('')
  const known = useRef<Set<string> | null>(null)

  useEffect(
    () =>
      watchAllOrders(
        (next) => {
          const seen = known.current
          if (seen && next.some((order) => order.status === 'novo' && !seen.has(order.id))) {
            setBlink(true)
          }
          known.current = new Set(next.map((order) => order.id))
          setOrders(next)
          setStatus('ready')
        },
        () => setStatus('error'),
      ),
    [],
  )

  function choose(next: OrderColumn) {
    setColumn(next)
    if (next === 'novos') setBlink(false)
  }

  const searching = query.trim() !== ''
  const visible = searching
    ? orders.filter((order) => orderMatches(order, query))
    : orders.filter((order) => columnOf(order.status) === column)
  const open = orders.find((order) => order.id === openId) ?? null

  return (
    <section className="board" aria-label="Pedidos">
      <label className="field board__search">
        <span className="sr-only">Buscar pedido</span>
        <input
          type="search"
          placeholder="Nome, WhatsApp ou nº do pedido"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <div className="board__columns" role="tablist" aria-label="Colunas">
        {COLUMNS.map((key) => {
          const count = orders.filter((order) => columnOf(order.status) === key).length
          const blinking = key === 'novos' && blink
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={column === key}
              className={column === key ? 'board__column is-active' : 'board__column'}
              onClick={() => choose(key)}
            >
              <span className={blinking ? 'board__title is-blinking' : 'board__title'}>{COLUMN_LABEL[key]}</span>
              <span className="board__count">{count}</span>
            </button>
          )
        })}
      </div>

      {status === 'loading' && <p className="muted">Carregando pedidos.</p>}
      {status === 'error' && (
        <p className="alert" role="alert">
          Não foi possível carregar os pedidos.
        </p>
      )}
      {status === 'ready' && visible.length === 0 && (
        <p className="muted">{searching ? 'Nenhum pedido encontrado.' : 'Nenhum pedido aqui.'}</p>
      )}

      <ul className="board__list" aria-label={searching ? 'Resultado da busca' : COLUMN_LABEL[column]}>
        {visible.map((order) => (
          <li key={order.id}>
            <button
              type="button"
              className={`order-card order-card--${order.status}`}
              onClick={() => setOpenId(order.id)}
            >
              <span className="order-card__head">
                <strong>#{shortId(order.id)}</strong>
                <span>{formatTime(order.createdAtMs)}</span>
              </span>
              <span className="order-card__name">{order.customerName || 'Sem nome'}</span>
              {order.customerWhatsapp && (
                <span className="order-card__meta">{formatWhatsapp(order.customerWhatsapp)}</span>
              )}
              <span className="order-card__meta">
                {STATUS_LABEL[order.status]} · {order.items.reduce((sum, item) => sum + item.qty, 0)} itens
              </span>
              <span className="order-card__total">{formatPrice(order.totalCents)}</span>
            </button>
          </li>
        ))}
      </ul>

      {open && <OrderDialog key={open.id} order={open} onClose={() => setOpenId('')} />}
    </section>
  )
}
